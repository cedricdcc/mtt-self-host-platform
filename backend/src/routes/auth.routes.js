// Auth routes - handles authentication endpoints

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();
const config = require("../config");
const { authLimiter } = require("../middleware/rateLimit");
const { getDatabase } = require("../db/database");
const datetime = require("../utils/datetime");

/**
 * @openapi
 * /api/auth/orcid:
 *   get:
 *     summary: Redirect to ORCID OAuth authorization
 *     responses:
 *       302:
 *         description: Redirects to ORCID authorization page
 */
router.get("/auth/orcid", (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.state = state;
  
  console.log('[ORCID Auth] Generated state:', state);
  console.log('[ORCID Auth] Session ID:', req.sessionID);
  console.log('[ORCID Auth] Session saved, state stored');

  const authUrl = `https://orcid.org/oauth/authorize?` +
    new URLSearchParams({
      client_id: config.orcid.clientId,
      response_type: 'code',
      scope: '/authenticate',
      redirect_uri: `${config.baseUrl}/api/auth/orcid/callback`,
      state,
    }).toString();

  console.log('[ORCID Auth] Redirecting to ORCID with URL:', authUrl);
  res.redirect(authUrl);
});

/**
 * @openapi
 * /api/auth/orcid/callback:
 *   get:
 *     summary: ORCID OAuth callback - exchanges code for token
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard
 */
router.get("/auth/orcid/callback", async (req, res) => {
  const { code, state: returnedState } = req.query;
  
  console.log('[ORCID Callback] Returned state from ORCID:', returnedState);
  console.log('[ORCID Callback] Expected state from session:', req.session.state);
  console.log('[ORCID Callback] Session ID:', req.sessionID);
  console.log('[ORCID Callback] Has code?', !!code);
  console.log('[ORCID Callback] Session object:', JSON.stringify(req.session, null, 2));

  if (!code || returnedState !== req.session.state) {
    console.log('[ORCID Callback] State mismatch! Failing auth.');
    console.log('[ORCID Callback] Comparison: returned="' + returnedState + '" vs stored="' + req.session.state + '"');
    return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
  }

  try {
    console.log('[ORCID Callback] State validated, exchanging code for token');
    const tokenResponse = await axios.post(
      'https://orcid.org/oauth/token',
      new URLSearchParams({
        client_id: config.orcid.clientId,
        client_secret: config.orcid.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${config.baseUrl}/api/auth/orcid/callback`,
      }),
      { headers: { Accept: 'application/json' } }
    );

    const { orcid, name, access_token, refresh_token, expires_in } = tokenResponse.data;
    console.log('[ORCID Callback] Token exchange successful, ORCID:', orcid);

    // Check if user exists in database and handle registration
    const db = getDatabase();
    
    try {
      // Check if this is the first user in the database
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
      const isFirstUser = userCount.count === 0;
      
      // Check if auth provider entry exists for this ORCID
      const existingAuth = db.prepare(
        'SELECT ap.*, u.* FROM auth_providers ap JOIN users u ON ap.user_id = u.id WHERE ap.provider = ? AND ap.provider_id = ?'
      ).get('orcid', orcid);
      
      let userId;
      let username;
      let userReputation;
      let userExtra;
      const isNewUser = !existingAuth;
      
      if (isNewUser) {
        console.log('[ORCID Callback] New user detected, creating user record');
        console.log('[ORCID Callback] Is first user (superadmin):', isFirstUser);
        
        // Create user in database
        const extra = JSON.stringify({
          name: name,
          orcid: orcid,
          is_admin: isFirstUser,
          is_superadmin: isFirstUser,
          is_banned: false,
          ban_reason: '',
          banned_at: '',
          registered_at: datetime.toISO(datetime.now())
        });
        
        const userResult = db.prepare(
          'INSERT INTO users (username, reputation, extra) VALUES (?, ?, ?)'
        ).run(orcid, 0, extra);
        
        userId = userResult.lastInsertRowid;
        username = orcid;
        userReputation = 0;
        userExtra = { 
          name, 
          orcid, 
          is_admin: isFirstUser, 
          is_superadmin: isFirstUser,
          is_banned: false,
          ban_reason: '',
          banned_at: '',
          registered_at: datetime.toISO(datetime.now()) 
        };
        
        // Create auth_provider entry
        db.prepare(
          'INSERT INTO auth_providers (user_id, provider, provider_id, name, access_token, refresh_token, token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          userId,
          'orcid',
          orcid,
          name,
          access_token,
          refresh_token,
          datetime.add(datetime.now(), expires_in, 'second')
        );
        
        console.log('[ORCID Callback] User created successfully with ID:', userId);
      } else {
        console.log('[ORCID Callback] Existing user found:', orcid);
        userId = existingAuth.user_id;
        username = existingAuth.username;
        userReputation = existingAuth.reputation;
        userExtra = existingAuth.extra ? JSON.parse(existingAuth.extra) : {};
        
        // Check if user is banned
        if (userExtra.is_banned) {
          console.log('[ORCID Callback] User is banned:', orcid);
          return res.redirect(`${config.frontendUrl}/login?error=user_banned&reason=${encodeURIComponent(userExtra.ban_reason || 'No reason provided')}`);
        }
        
        // Update auth_provider tokens
        db.prepare(
          'UPDATE auth_providers SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = ? AND provider_id = ?'
        ).run(
          access_token,
          refresh_token,
          datetime.add(datetime.now(), expires_in, 'second'),
          'orcid',
          orcid
        );
      }
      
      // Store user info in session with both user_id and username for backward compatibility
      req.session.user = { 
        id: userId,
        user_id: userId, // Alias for consistency
        username: username,
        orcid, 
        name: name || userExtra.name, 
        access_token, 
        refresh_token, 
        expires_at: datetime.unix(datetime.add(datetime.now(), expires_in, 'second')) * 1000,
        is_admin: userExtra.is_admin || false,
        is_superadmin: userExtra.is_superadmin || false,
        reputation: userReputation
      };

      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('[ORCID Callback] Session save error:', err);
          return res.redirect(`${config.frontendUrl}/login?error=session_failed`);
        }
        
        // Redirect based on whether user is new
        if (isNewUser) {
          console.log('[ORCID Callback] Session saved, redirecting new user to user-profile');
          res.redirect(`${config.frontendUrl}/profile`);
        } else {
          console.log('[ORCID Callback] Session saved, redirecting existing user to dashboard');
          res.redirect(`${config.frontendUrl}/dashboard`);
        }
      });
    } catch (dbError) {
      console.error('[ORCID Callback] Database error:', dbError);
      return res.redirect(`${config.frontendUrl}/login?error=database_failed`);
    }
  } catch (err) {
    console.error('[ORCID Callback] OAuth error:', err.response?.data || err.message);
    if (err.response) {
      console.error('[ORCID Callback] Error status:', err.response.status);
      console.error('[ORCID Callback] Error data:', JSON.stringify(err.response.data, null, 2));
    }
    res.redirect(`${config.frontendUrl}/login?error=orcid_failed`);
  }
});

/**
 * @openapi
 * /api/me:
 *   get:
 *     summary: Get current authenticated user
 *     responses:
 *       200:
 *         description: Returns current user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orcid:
 *                   type: string
 *                 name:
 *                   type: string
 *       401:
 *         description: Not authenticated
 */
router.get("/me", (req, res) => {
  console.log('[Me] Checking session, Session ID:', req.sessionID);
  console.log('[Me] User in session:', !!req.session.user);
  
  if (req.session.user) {
    console.log('[Me] Returning user:', req.session.user.username);
    // Force fresh check of ban status from database
    const db = getDatabase();
    try {
      const user = db.prepare('SELECT extra FROM users WHERE username = ?').get(req.session.user.username);
      if (user && user.extra) {
        const extra = JSON.parse(user.extra);
        // Update session with fresh ban status
        req.session.user.is_banned = extra.is_banned || false;
        req.session.user.ban_reason = extra.ban_reason || '';
        req.session.user.banned_at = extra.banned_at || '';
      }
    } catch (err) {
      console.error('[Me] Error checking ban status:', err);
    }
    
    res.json(req.session.user);
  } else {
    console.log('[Me] No authenticated user found');
    res.status(401).json({ error: 'Not authenticated' });
  }
});

/**
 * @openapi
 * /api/logout:
 *   post:
 *     summary: Logout current user
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout] Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('mtt.sid'); // Match the custom session cookie name
    console.log('[Logout] Session destroyed successfully');
    res.json({ ok: true });
  });
});

module.exports = router;
