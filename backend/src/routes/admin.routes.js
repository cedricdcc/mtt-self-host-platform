// Admin routes - handles admin operations for user management

const express = require("express");
const router = express.Router();
const { getDatabase } = require("../db/database");
const { requireAdmin } = require("../middleware/admin");
const { apiLimiter } = require("../middleware/rateLimit");
const datetime = require("../utils/datetime");
const { applyReputationForTranslationStatusChange } = require("../services/reputation.service");

// Constants
const DEFAULT_BAN_REASON = 'No reason provided';

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     responses:
 *       200:
 *         description: List of all users
 */
router.get("/admin/users", requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const users = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.reputation,
        u.joined_at,
        u.extra,
        u.is_admin,
        u.is_banned,
        u.ban_reason
      FROM users u
      ORDER BY u.id ASC
    `).all();
    
    // Parse extra field for each user
    const usersWithParsedExtra = users.map(user => ({
      ...user,
      extra: user.extra ? JSON.parse(user.extra) : {}
    }));
    
    res.json(usersWithParsedExtra);
  } catch (err) {
    console.error('[Admin Users] Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @openapi
 * /api/admin/users/:id/promote:
 *   put:
 *     summary: Promote user to admin (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User promoted successfully
 */
router.put("/admin/users/:id/promote", requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const db = getDatabase();
    
    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const extra = user.extra ? JSON.parse(user.extra) : {};
    extra.is_admin = true;
    
    db.prepare('UPDATE users SET extra = ? WHERE id = ?')
      .run(JSON.stringify(extra), userId);
    
    // Log admin activity
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      adminUserId,
      'admin_user_promoted',
      JSON.stringify({ target_user_id: userId, target_username: user.username })
    );
    
    res.json({ success: true, message: 'User promoted to admin' });
  } catch (err) {
    console.error('[Admin Users] Error promoting user:', err);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

/**
 * @openapi
 * /api/admin/users/:id/demote:
 *   put:
 *     summary: Demote admin to regular user (admin only, cannot demote superadmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User demoted successfully
 */
router.put("/admin/users/:id/demote", requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const db = getDatabase();
    
    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const extra = user.extra ? JSON.parse(user.extra) : {};
    
    // Prevent demotion of superadmin
    if (extra.is_superadmin) {
      return res.status(403).json({ error: 'Cannot demote superadmin' });
    }
    
    extra.is_admin = false;
    
    db.prepare('UPDATE users SET extra = ? WHERE id = ?')
      .run(JSON.stringify(extra), userId);
    
    // Log admin activity
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      adminUserId,
      'admin_user_demoted',
      JSON.stringify({ target_user_id: userId, target_username: user.username })
    );
    
    res.json({ success: true, message: 'User demoted from admin' });
  } catch (err) {
    console.error('[Admin Users] Error demoting user:', err);
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

/**
 * @openapi
 * /api/admin/users/:id/ban:
 *   put:
 *     summary: Ban a user (admin only, cannot ban superadmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User banned successfully
 */
router.put("/admin/users/:id/ban", requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    const db = getDatabase();
    
    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const extra = user.extra ? JSON.parse(user.extra) : {};
    
    // Prevent banning of superadmin
    if (extra.is_superadmin) {
      return res.status(403).json({ error: 'Cannot ban superadmin' });
    }
    
    // Update both the database column AND the extra field for backward compatibility
    const banReason = reason || DEFAULT_BAN_REASON;
    extra.is_banned = true;
    extra.ban_reason = banReason;
    extra.banned_at = datetime.toISO(datetime.now());
    
    db.prepare('UPDATE users SET is_banned = 1, ban_reason = ?, extra = ? WHERE id = ?')
      .run(banReason, JSON.stringify(extra), userId);
    
    // Log admin activity
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      adminUserId,
      'admin_user_banned',
      JSON.stringify({ target_user_id: userId, target_username: user.username, reason: banReason })
    );
    
    res.json({ success: true, message: 'User banned successfully' });
  } catch (err) {
    console.error('[Admin Users] Error banning user:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * @openapi
 * /api/admin/users/:id/unban:
 *   put:
 *     summary: Unban a user (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User unbanned successfully
 */
router.put("/admin/users/:id/unban", requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const db = getDatabase();
    
    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update both the database column AND the extra field for backward compatibility
    const extra = user.extra ? JSON.parse(user.extra) : {};
    extra.is_banned = false;
    extra.ban_reason = '';
    extra.banned_at = '';
    
    db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL, extra = ? WHERE id = ?')
      .run(JSON.stringify(extra), userId);
    
    // Log admin activity
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      adminUserId,
      'admin_user_unbanned',
      JSON.stringify({ target_user_id: userId, target_username: user.username })
    );
    
    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (err) {
    console.error('[Admin Users] Error unbanning user:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

/**
 * @openapi
 * /api/admin/translations:
 *   get:
 *     summary: Get all translations with filters (admin only)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of translations
 */
router.get("/admin/translations", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { status, language, page = 1, limit = 50 } = req.query;
    const db = getDatabase();
    
    let query = `
      SELECT 
        t.id,
        t.term_field_id,
        t.language,
        t.value,
        t.status,
        t.created_at,
        t.updated_at,
        t.created_by_id,
        t.modified_by_id,
        t.reviewed_by_id,
        tf.field_uri as field_name,
        term.id as term_id,
        term.uri,
        created_user.username as created_by_username,
        modified_user.username as modified_by_username,
        reviewed_user.username as reviewed_by_username
      FROM translations t
      LEFT JOIN term_fields tf ON t.term_field_id = tf.id
      LEFT JOIN terms term ON tf.term_id = term.id
      LEFT JOIN users created_user ON t.created_by_id = created_user.id
      LEFT JOIN users modified_user ON t.modified_by_id = modified_user.id
      LEFT JOIN users reviewed_user ON t.reviewed_by_id = reviewed_user.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    
    if (language) {
      query += ' AND t.language = ?';
      params.push(language);
    }
    
    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const { total } = db.prepare(countQuery).get(...params);
    
    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY t.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const translations = db.prepare(query).all(...params);
    
    res.json({
      translations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[Admin Translations] Error fetching translations:', err);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

/**
 * @openapi
 * /api/admin/translations/:id/status:
 *   put:
 *     summary: Update translation status (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, review, approved, rejected, merged]
 *     responses:
 *       200:
 *         description: Translation status updated
 */
router.get("/admin/translations/pending-consensus", requireAdmin, apiLimiter, (req, res) => {
  const db = getDatabase();
  try {
    const pending = db.prepare(`
      SELECT t.id, t.language, t.value, t.created_at, t.status, tf.field_uri, term.uri,
             COALESCE(modified_user.username, created_user.username) as translator_username
      FROM translations t
      JOIN term_fields tf ON t.term_field_id = tf.id
      JOIN terms term ON tf.term_id = term.id
      LEFT JOIN users created_user ON t.created_by_id = created_user.id
      LEFT JOIN users modified_user ON t.modified_by_id = modified_user.id
      WHERE t.status IN ('review', 'discussion')
      ORDER BY t.created_at ASC
    `).all();

    const result = pending.map(t => {
      // Active translators in past 30 days
      const activeTranslators = db.prepare(`
        SELECT COUNT(DISTINCT COALESCE(modified_by_id, created_by_id)) as count
        FROM translations
        WHERE language = ? 
          AND (created_at >= datetime('now', '-30 days') OR updated_at >= datetime('now', '-30 days'))
          AND COALESCE(modified_by_id, created_by_id) IS NOT NULL
      `).get(t.language).count;

      let threshold = 1;
      if (activeTranslators > 2 && activeTranslators <= 5) {
        threshold = 2;
      } else if (activeTranslators > 5) {
        threshold = 3;
      }

      // Get reviews
      const reviews = db.prepare(`
        SELECT tr.action, tr.user_id, u.username, u.reputation, tr.created_at
        FROM translation_reviews tr
        JOIN users u ON tr.user_id = u.id
        WHERE tr.translation_id = ?
      `).all(t.id);

      let approvalsWeight = 0;
      let rejectionsWeight = 0;

      const voteBreakdown = reviews.map(r => {
        const weight = Math.min(4, 1 + Math.floor((r.reputation || 0) / 100));
        if (r.action === 'approve') {
          approvalsWeight += weight;
        } else {
          rejectionsWeight += weight;
        }
        return {
          username: r.username,
          action: r.action,
          reputation: r.reputation || 0,
          weight
        };
      });

      // Calculate time remaining until 3 days limit
      const createdMs = new Date(t.created_at + "Z").getTime(); // Ensure UTC parse
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const timeRemainingMs = Math.max(0, (createdMs + threeDaysMs) - nowMs);
      const daysRemaining = timeRemainingMs / (24 * 60 * 60 * 1000);

      return {
        id: t.id,
        language: t.language,
        value: t.value,
        created_at: t.created_at,
        status: t.status,
        field_uri: t.field_uri,
        uri: t.uri,
        translator_username: t.translator_username || 'Unknown',
        activeTranslators,
        threshold,
        approvalsWeight,
        rejectionsWeight,
        netScore: approvalsWeight - rejectionsWeight,
        daysRemaining,
        reviews: voteBreakdown
      };
    });

    res.json({ success: true, pending: result });
  } catch (err) {
    console.error('[Admin API] Error fetching pending consensus:', err);
    res.status(500).json({ error: 'Failed to fetch pending consensus reviews' });
  }
});

router.put("/admin/translations/:id/status", requireAdmin, apiLimiter, (req, res) => {
  try {
    const translationId = parseInt(req.params.id);
    const { status } = req.body;
    const db = getDatabase();
    
    // Validate status
    const validStatuses = ['draft', 'review', 'approved', 'rejected', 'merged'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    // Get current translation to check previous status and created_by
    const translation = db.prepare('SELECT * FROM translations WHERE id = ?').get(translationId);
    
    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }
    
    const previousStatus = translation.status;
    
    // Update translation status
    const result = db.prepare(
      'UPDATE translations SET status = ?, updated_at = CURRENT_TIMESTAMP, modified_by_id = ? WHERE id = ?'
    ).run(status, req.session.user.id, translationId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Translation not found' });
    }
    
    // Apply reputation points to the user who created the translation
    if (translation.created_by_id) {
      try {
        applyReputationForTranslationStatusChange(
          translation.created_by_id,
          previousStatus,
          status,
          translationId
        );
      } catch (reputationError) {
        console.error('[Admin Translations] Error applying reputation:', reputationError);
        // Don't fail the request if reputation update fails
      }
    }
    
    // Log admin activity
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, translation_id, extra) VALUES (?, ?, ?, ?)'
    ).run(
      adminUserId,
      'admin_translation_status_changed',
      translationId,
      JSON.stringify({ previous_status: previousStatus, new_status: status })
    );
    
    res.json({ success: true, message: 'Translation status updated' });
  } catch (err) {
    console.error('[Admin Translations] Error updating status:', err);
    res.status(500).json({ error: 'Failed to update translation status' });
  }
});

/**
 * @openapi
 * /api/admin/translations/:id/language:
 *   put:
 *     summary: Update translation language (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [nl, fr, de, es, it, pt]
 *     responses:
 *       200:
 *         description: Translation language updated
 */
router.put("/admin/translations/:id/language", requireAdmin, apiLimiter, (req, res) => {
  try {
    const translationId = parseInt(req.params.id);
    const { language } = req.body;
    const db = getDatabase();
    
    // Validate language
    const validLanguages = ['nl', 'fr', 'de', 'es', 'it', 'pt'];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({ error: 'Invalid language value' });
    }
    
    // Get current translation
    const translation = db.prepare('SELECT * FROM translations WHERE id = ?').get(translationId);
    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }
    
    const previousLanguage = translation.language;
    
    // Check if translation with same term_field_id and new language already exists
    const existing = db.prepare(
      'SELECT id FROM translations WHERE term_field_id = ? AND language = ? AND id != ?'
    ).get(translation.term_field_id, language, translationId);
    
    if (existing) {
      return res.status(409).json({ error: 'Translation for this language already exists for this term field' });
    }
    
    // Update translation language
    const result = db.prepare(
      'UPDATE translations SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(language, translationId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Translation not found' });
    }
    
    // Log admin activity
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, translation_id, extra) VALUES (?, ?, ?, ?)'
    ).run(
      adminUserId,
      'admin_translation_language_changed',
      translationId,
      JSON.stringify({ previous_language: previousLanguage, new_language: language })
    );
    
    res.json({ success: true, message: 'Translation language updated' });
  } catch (err) {
    console.error('[Admin Translations] Error updating language:', err);
    res.status(500).json({ error: 'Failed to update translation language' });
  }
});

/**
 * @openapi
 * /api/admin/translations/:id/appeal:
 *   post:
 *     summary: Create an appeal for a translation (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appeal created successfully
 */
router.post("/admin/translations/:id/appeal", requireAdmin, apiLimiter, (req, res) => {
  try {
    const translationId = parseInt(req.params.id);
    const { reason } = req.body;
    const db = getDatabase();
    
    // Check if translation exists
    const translation = db.prepare('SELECT * FROM translations WHERE id = ?').get(translationId);
    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }
    
    // Check if there's already an open appeal for this translation
    const existingAppeal = db.prepare(
      'SELECT id FROM appeals WHERE translation_id = ? AND status = ?'
    ).get(translationId, 'open');
    
    if (existingAppeal) {
      return res.status(409).json({ error: 'An open appeal already exists for this translation' });
    }
    
    // Create appeal
    const currentUserId = req.session.user.id || req.session.user.user_id;
    const result = db.prepare(
      'INSERT INTO appeals (translation_id, opened_by_id, resolution, status) VALUES (?, ?, ?, ?)'
    ).run(translationId, currentUserId, reason || 'Appeal created by admin', 'open');
    
    res.status(201).json({ 
      success: true, 
      message: 'Appeal created successfully',
      appealId: result.lastInsertRowid 
    });
  } catch (err) {
    console.error('[Admin Translations] Error creating appeal:', err);
    res.status(500).json({ error: 'Failed to create appeal' });
  }
});

/**
 * @openapi
 * /api/admin/moderation/reports:
 *   get:
 *     summary: Get all message reports (admin only)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, dismissed, action_taken]
 *     responses:
 *       200:
 *         description: List of message reports
 */
router.get("/admin/moderation/reports", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { status } = req.query;
    const db = getDatabase();
    
    let query = `
      SELECT 
        mr.id,
        mr.appeal_message_id,
        mr.reported_by_id,
        mr.reason,
        mr.status,
        mr.reviewed_by_id,
        mr.admin_notes,
        mr.created_at,
        mr.reviewed_at,
        reporter.username as reported_by_username,
        reviewer.username as reviewed_by_username,
        am.message,
        am.author_id as message_author_id,
        author.username as message_author_username,
        am.appeal_id
      FROM message_reports mr
      LEFT JOIN users reporter ON mr.reported_by_id = reporter.id
      LEFT JOIN users reviewer ON mr.reviewed_by_id = reviewer.id
      LEFT JOIN appeal_messages am ON mr.appeal_message_id = am.id
      LEFT JOIN users author ON am.author_id = author.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND mr.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY mr.created_at DESC';
    
    const reports = db.prepare(query).all(...params);
    
    res.json(reports);
  } catch (err) {
    console.error('[Admin Moderation] Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * @openapi
 * /api/admin/moderation/reports/{id}/review:
 *   put:
 *     summary: Review a message report (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [reviewed, dismissed, action_taken]
 *               admin_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report reviewed successfully
 */
router.put("/admin/moderation/reports/:id/review", requireAdmin, apiLimiter, (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { status, admin_notes } = req.body;
    const db = getDatabase();
    
    // Validate status
    const validStatuses = ['reviewed', 'dismissed', 'action_taken'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const currentUserId = req.session.user.id || req.session.user.user_id;
    
    // Update report
    const result = db.prepare(
      'UPDATE message_reports SET status = ?, reviewed_by_id = ?, admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(status, currentUserId, admin_notes || null, reportId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ success: true, message: 'Report reviewed successfully' });
  } catch (err) {
    console.error('[Admin Moderation] Error reviewing report:', err);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

/**
 * @openapi
 * /api/admin/moderation/appeals/{id}/messages:
 *   get:
 *     summary: Get appeal messages with report info (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of appeal messages with report information
 */
router.get("/admin/moderation/appeals/:id/messages", requireAdmin, apiLimiter, (req, res) => {
  try {
    const appealId = parseInt(req.params.id);
    const db = getDatabase();
    
    // Get appeal messages with author and report info
    const messages = db.prepare(`
      SELECT 
        am.id,
        am.appeal_id,
        am.author_id,
        am.message,
        am.created_at,
        u.username as author_username,
        COUNT(mr.id) as report_count,
        SUM(CASE WHEN mr.status = 'pending' THEN 1 ELSE 0 END) as pending_reports
      FROM appeal_messages am
      LEFT JOIN users u ON am.author_id = u.id
      LEFT JOIN message_reports mr ON am.id = mr.message_id
      WHERE am.appeal_id = ?
      GROUP BY am.id
      ORDER BY am.created_at ASC
    `).all(appealId);
    
    res.json(messages);
  } catch (err) {
    console.error('[Admin Moderation] Error fetching appeal messages:', err);
    res.status(500).json({ error: 'Failed to fetch appeal messages' });
  }
});

/**
 * @openapi
 * /api/admin/moderation/users/{id}/penalty:
 *   post:
 *     summary: Apply reputation penalty or ban to a user (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [reputation_penalty, ban]
 *               penalty_amount:
 *                 type: integer
 *               ban_reason:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Penalty applied successfully
 */
router.post("/admin/moderation/users/:id/penalty", requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { action, penalty_amount, ban_reason, reason } = req.body;
    const db = getDatabase();
    
    // Validate action
    if (!['reputation_penalty', 'ban'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Check if user exists
    const user = db.prepare('SELECT id, extra FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse extra field
    const userExtra = user.extra ? JSON.parse(user.extra) : {};
    
    // Check if trying to penalize a superadmin
    if (userExtra.is_superadmin) {
      return res.status(403).json({ error: 'Cannot penalize superadmin' });
    }
    
    if (action === 'reputation_penalty') {
      if (!penalty_amount || penalty_amount <= 0) {
        return res.status(400).json({ error: 'Penalty amount must be positive' });
      }
      
      // Apply reputation penalty
      db.prepare('UPDATE users SET reputation = reputation - ? WHERE id = ?')
        .run(penalty_amount, userId);
      
      // Log the penalty
      db.prepare(
        'INSERT INTO reputation_events (user_id, delta, reason) VALUES (?, ?, ?)'
      ).run(userId, -penalty_amount, reason || 'Admin moderation penalty');
      
      res.json({ 
        success: true, 
        message: `Reputation penalty of ${penalty_amount} applied successfully` 
      });
      
    } else if (action === 'ban') {
      if (!ban_reason || ban_reason.trim().length === 0) {
        return res.status(400).json({ error: 'Ban reason is required' });
      }
      
      // Ban the user
      userExtra.is_banned = true;
      userExtra.ban_reason = ban_reason.trim();
      userExtra.banned_at = new Date().toISOString();
      
      db.prepare('UPDATE users SET extra = ? WHERE id = ?')
        .run(JSON.stringify(userExtra), userId);
      
      res.json({ 
        success: true, 
        message: 'User banned successfully' 
      });
    }
  } catch (err) {
    console.error('[Admin Moderation] Error applying penalty:', err);
    res.status(500).json({ error: 'Failed to apply penalty' });
  }
});

/**
 * @openapi
 * /api/admin/activity:
 *   get:
 *     summary: Get admin activity log (admin only)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of admin activities
 */
router.get("/admin/activity", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const db = getDatabase();
    
    // Build query to fetch admin activities
    let query = `
      SELECT 
        ua.id,
        ua.user_id,
        ua.action,
        ua.term_id,
        ua.term_field_id,
        ua.translation_id,
        ua.appeal_id,
        ua.appeal_message_id,
        ua.extra,
        ua.created_at,
        u.username as admin_username
      FROM user_activity ua
      LEFT JOIN users u ON ua.user_id = u.id
      WHERE ua.action LIKE 'admin_%'
    `;
    
    const params = [];
    
    // Filter by specific action if provided
    if (action) {
      query += ' AND ua.action = ?';
      params.push(action);
    }
    
    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;
    
    // Add pagination and ordering
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY ua.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const activities = db.prepare(query).all(...params);
    
    // Parse extra field for each activity
    const parsedActivities = activities.map(activity => ({
      ...activity,
      extra: activity.extra ? JSON.parse(activity.extra) : null
    }));
    
    res.json({
      activities: parsedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[Admin Activity] Error fetching activity log:', err);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

/**
 * @openapi
 * /api/admin/communities:
 *   get:
 *     summary: Get all communities (admin only)
 *     responses:
 *       200:
 *         description: List of all communities
 */
router.get("/admin/communities", requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    
    const communities = db.prepare(`
      SELECT 
        c.*,
        u.username as owner_username,
        l.name as language_name,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) as member_count,
        (SELECT COUNT(*) FROM community_reports cr WHERE cr.community_id = c.id AND cr.status = 'pending') as pending_reports,
        (SELECT COUNT(*) FROM community_goal_links cgl 
         INNER JOIN community_goals cg ON cgl.goal_id = cg.id 
         WHERE cgl.community_id = c.id AND cg.is_active = 1) as active_goals
      FROM communities c
      LEFT JOIN users u ON c.owner_id = u.id
      LEFT JOIN languages l ON c.language_code = l.code
      ORDER BY c.created_at DESC
    `).all();
    
    res.json(communities);
  } catch (err) {
    console.error('[Admin Communities] Error fetching communities:', err);
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

/**
 * @openapi
 * /api/admin/communities/{id}:
 *   delete:
 *     summary: Delete a community (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Community deleted successfully
 */
router.delete("/admin/communities/:id", requireAdmin, apiLimiter, (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const db = getDatabase();

    // Get community info before deleting
    const community = db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
    
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Prevent deletion of language communities
    if (community.type === 'language') {
      return res.status(400).json({ error: 'Language communities cannot be deleted' });
    }
    
    db.prepare('DELETE FROM communities WHERE id = ?').run(communityId);

    // Log admin activity
    const currentUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      currentUserId,
      'admin_community_deleted',
      JSON.stringify({ community_id: communityId, name: community.name })
    );
    
    res.json({ success: true, message: 'Community deleted successfully' });
  } catch (err) {
    console.error('[Admin Communities] Error deleting community:', err);
    res.status(500).json({ error: 'Failed to delete community' });
  }
});

/**
 * @openapi
 * /api/admin/communities/{id}/goals:
 *   post:
 *     summary: Create a goal for any community (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Goal created successfully
 */
router.post("/admin/communities/:id/goals", requireAdmin, apiLimiter, (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const {
      title,
      description,
      goal_type,
      target_count,
      target_language,
      collection_id,
      is_recurring,
      recurrence_type,
      start_date,
      end_date
    } = req.body;

    const db = getDatabase();

    // Check if community exists
    const community = db.prepare('SELECT id FROM communities WHERE id = ?').get(communityId);
    
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Validation
    if (!title || !goal_type || !start_date) {
      return res.status(400).json({ error: 'Missing required fields: title, goal_type, start_date' });
    }

    if (!['translation_count', 'collection'].includes(goal_type)) {
      return res.status(400).json({ error: 'Invalid goal_type' });
    }

    const currentUserId = req.session.user.id || req.session.user.user_id;

    const result = db.prepare(`
      INSERT INTO community_goals (
        title, description, goal_type, target_count, target_language,
        collection_id, community_id, is_recurring, recurrence_type, start_date, end_date, created_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description || null,
      goal_type,
      target_count || null,
      target_language || null,
      collection_id || null,
      communityId,
      is_recurring ? 1 : 0,
      recurrence_type || null,
      start_date,
      end_date || null,
      currentUserId
    );

    const goalId = result.lastInsertRowid;

    // Log admin activity
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      currentUserId,
      'admin_community_goal_created',
      JSON.stringify({ community_id: communityId, goal_id: goalId, title })
    );

    res.status(201).json({
      success: true,
      message: 'Goal created successfully',
      goalId
    });
  } catch (err) {
    console.error('[Admin Communities] Error creating goal:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

/**
 * @openapi
 * /api/admin/community-reports:
 *   get:
 *     summary: Get all community reports (admin only)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewing, resolved, dismissed]
 *     responses:
 *       200:
 *         description: List of community reports
 */
router.get("/admin/community-reports", requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const { status } = req.query;
    
    let query = `
      SELECT 
        cr.*,
        c.name as community_name,
        c.type as community_type,
        c.owner_id as community_owner_id,
        u1.username as reported_by_username,
        u2.username as reviewed_by_username,
        u3.username as community_owner_username
      FROM community_reports cr
      INNER JOIN communities c ON cr.community_id = c.id
      INNER JOIN users u1 ON cr.reported_by_id = u1.id
      LEFT JOIN users u2 ON cr.reviewed_by_id = u2.id
      LEFT JOIN users u3 ON c.owner_id = u3.id
    `;
    
    const params = [];
    
    if (status) {
      query += ' WHERE cr.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY cr.created_at DESC';
    
    const reports = db.prepare(query).all(...params);
    
    res.json(reports);
  } catch (err) {
    console.error('[Admin Community Reports] Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * @openapi
 * /api/admin/community-reports/{id}/review:
 *   put:
 *     summary: Review a community report (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [reviewing, resolved, dismissed]
 *               resolution_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report reviewed successfully
 */
router.put("/admin/community-reports/:id/review", requireAdmin, apiLimiter, (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { status, resolution_notes } = req.body;
    const db = getDatabase();

    // Validate status
    if (!['reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if report exists
    const report = db.prepare('SELECT * FROM community_reports WHERE id = ?').get(reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const currentUserId = req.session.user.id || req.session.user.user_id;

    // Update report
    db.prepare(`
      UPDATE community_reports 
      SET status = ?, 
          resolution_notes = ?,
          reviewed_by_id = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, resolution_notes || null, currentUserId, reportId);

    // Log admin activity
    db.prepare(
      'INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)'
    ).run(
      currentUserId,
      'admin_community_report_reviewed',
      JSON.stringify({ report_id: reportId, status, community_id: report.community_id })
    );

    res.json({ success: true, message: 'Report reviewed successfully' });
  } catch (err) {
    console.error('[Admin Community Reports] Error reviewing report:', err);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

/**
 * @openapi
 * /api/admin/reputation-rules:
 *   get:
 *     summary: Get all reputation rules (admin only)
 *     responses:
 *       200:
 *         description: List of reputation rules
 */
router.get("/admin/reputation-rules", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { getReputationRules } = require("../services/reputation.service");
    const rules = getReputationRules();
    res.json(rules);
  } catch (err) {
    console.error('[Admin Reputation Rules] Error fetching rules:', err);
    res.status(500).json({ error: 'Failed to fetch reputation rules' });
  }
});

/**
 * @openapi
 * /api/admin/reputation-rules:
 *   put:
 *     summary: Update a reputation rule (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ruleName:
 *                 type: string
 *               newValue:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Rule updated successfully
 */
router.put("/admin/reputation-rules", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { updateReputationRule } = require("../services/reputation.service");
    const { ruleName, newValue } = req.body;
    
    if (!ruleName || typeof newValue !== 'number' || isNaN(newValue)) {
      return res.status(400).json({ error: 'Missing ruleName or invalid newValue' });
    }
    
    const userId = req.session.user.id;
    const success = updateReputationRule(ruleName, newValue, userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({ success: true, message: 'Rule updated successfully' });
  } catch (err) {
    console.error('[Admin Reputation Rules] Error updating rule:', err);
    res.status(500).json({ error: 'Failed to update reputation rule' });
  }
});

/**
 * @openapi
 * /api/admin/reputation-rules/preview:
 *   post:
 *     summary: Preview the impact of changing a reputation rule (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ruleName:
 *                 type: string
 *               newValue:
 *                 type: integer
 *               sampleSize:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Preview data showing impact on sample users
 */
router.post("/admin/reputation-rules/preview", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { previewRuleChange } = require("../services/reputation.service");
    const { ruleName, newValue, sampleSize = 10 } = req.body;
    
    if (!ruleName || typeof newValue !== 'number' || isNaN(newValue)) {
      return res.status(400).json({ error: 'Missing ruleName or invalid newValue' });
    }
    
    const preview = previewRuleChange(ruleName, newValue, sampleSize);
    res.json(preview);
  } catch (err) {
    console.error('[Admin Reputation Rules] Error previewing rule change:', err);
    res.status(500).json({ error: err.message || 'Failed to preview rule change' });
  }
});

module.exports = router;
