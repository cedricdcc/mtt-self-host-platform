// Mail routes - handles mail queue management, announcements, and user email preferences
const express = require("express");
const router = express.Router();
const { getDatabase } = require("../db/database");
const { requireAdmin } = require("../middleware/admin");
const { apiLimiter } = require("../middleware/rateLimit");
const { queueMail } = require("../services/mail.service");
const config = require("../config");

// Auth check middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

/**
 * @openapi
 * /api/admin/mail/queue:
 *   get:
 *     summary: Retrieve mail queue status (admin only)
 */
router.get("/admin/mail/queue", requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = db.prepare("SELECT COUNT(*) as count FROM mail_queue").get();

    // Get queue items
    const items = db.prepare(`
      SELECT * FROM mail_queue
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error("[Admin Mail] Error fetching mail queue:", err.message);
    res.status(500).json({ error: "Failed to fetch mail queue" });
  }
});

/**
 * @openapi
 * /api/admin/mail/queue/{id}/retry:
 *   post:
 *     summary: Reset a failed mail status to pending to retry delivery (admin only)
 */
router.post("/admin/mail/queue/:id/retry", requireAdmin, apiLimiter, (req, res) => {
  try {
    const mailId = parseInt(req.params.id, 10);
    const db = getDatabase();

    const result = db.prepare(`
      UPDATE mail_queue
      SET status = 'pending', attempts = 0, last_error = NULL
      WHERE id = ? AND status = 'failed'
    `).run(mailId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Failed mail item not found or not in 'failed' status" });
    }

    res.json({ success: true, message: "Email queued for retry successfully" });
  } catch (err) {
    console.error("[Admin Mail] Error queueing retry:", err.message);
    res.status(500).json({ error: "Failed to queue retry" });
  }
});

/**
 * @openapi
 * /api/admin/mail/broadcast:
 *   post:
 *     summary: Broadcast an email announcement to all registered users (admin only)
 */
router.post("/api/admin/mail/broadcast", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { subject, body } = req.body;
    
    if (!subject || !body || subject.trim() === "" || body.trim() === "") {
      return res.status(400).json({ error: "Subject and body are required." });
    }

    const db = getDatabase();
    // Retrieve all users that have an email address configured
    const users = db.prepare("SELECT id, username, email FROM users WHERE email IS NOT NULL AND is_banned = 0").all();

    if (users.length === 0) {
      return res.json({ success: true, message: "No active users with configured emails found." });
    }

    console.log(`[Admin Mail] Queueing broadcast "${subject}" for ${users.length} user(s)...`);
    
    let queuedCount = 0;
    for (const user of users) {
      const extra = user.extra ? (() => {
        try { return JSON.parse(user.extra); } catch (e) { return {}; }
      })() : {};
      
      const displayName = extra.name || extra.display_name || user.username;
      
      const result = queueMail(user.email, subject, "broadcast", {
        displayName,
        body,
        link: `${config.frontendUrl}/dashboard`
      });

      if (result) queuedCount++;
    }

    res.json({ success: true, message: `Broadcast successfully queued for ${queuedCount} users.` });
  } catch (err) {
    console.error("[Admin Mail] Error broadcasting mail:", err.message);
    res.status(500).json({ error: "Failed to queue broadcast announcement" });
  }
});

/**
 * @openapi
 * /api/user/preferences/email:
 *   get:
 *     summary: Get logged-in user email preferences
 */
router.get("/user/preferences/email", requireAuth, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.session.user.id || req.session.user.user_id;

    // Fetch preferences
    let prefs = db.prepare(`
      SELECT email_on_discussion, email_on_status_change, email_digest_frequency
      FROM user_preferences
      WHERE user_id = ?
    `).get(userId);

    // If preferences record doesn't exist, return default values
    if (!prefs) {
      prefs = {
        email_on_discussion: 1,
        email_on_status_change: 1,
        email_digest_frequency: "none"
      };
    }

    // Also get the email from the users table
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);

    res.json({
      email: user?.email || null,
      emailOnDiscussion: prefs.email_on_discussion !== 0,
      emailOnStatusChange: prefs.email_on_status_change !== 0,
      emailDigestFrequency: prefs.email_digest_frequency || "none"
    });
  } catch (err) {
    console.error("[User Mail] Error loading email preferences:", err.message);
    res.status(500).json({ error: "Failed to load email preferences" });
  }
});

/**
 * @openapi
 * /api/user/preferences/email:
 *   post:
 *     summary: Update email preferences
 */
router.post("/user/preferences/email", requireAuth, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.session.user.id || req.session.user.user_id;
    const { emailOnDiscussion, emailOnStatusChange, emailDigestFrequency } = req.body;

    const discuss = emailOnDiscussion ? 1 : 0;
    const statusChange = emailOnStatusChange ? 1 : 0;
    const freq = emailDigestFrequency || "none";

    // Insert or update preferences record
    db.prepare(`
      INSERT INTO user_preferences (user_id, email_on_discussion, email_on_status_change, email_digest_frequency, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        email_on_discussion = excluded.email_on_discussion,
        email_on_status_change = excluded.email_on_status_change,
        email_digest_frequency = excluded.email_digest_frequency,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, discuss, statusChange, freq);

    res.json({ success: true, message: "Email preferences updated successfully" });
  } catch (err) {
    console.error("[User Mail] Error updating email preferences:", err.message);
    res.status(500).json({ error: "Failed to update email preferences" });
  }
});

module.exports = router;
