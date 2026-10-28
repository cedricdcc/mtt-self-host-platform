// Mail routes - handles mail queue management, announcements, and user email preferences
const express = require("express");
const router = express.Router();
const { getDatabase } = require("../db/database");
const { requireAdmin } = require("../middleware/admin");
const { apiLimiter } = require("../middleware/rateLimit");
const { queueMail, sendMailSync } = require("../services/mail.service");
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
router.post("/admin/mail/broadcast", requireAdmin, apiLimiter, (req, res) => {
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
      SELECT email_on_discussion, email_on_status_change, email_digest_frequency, email_tone
      FROM user_preferences
      WHERE user_id = ?
    `).get(userId);

    // If preferences record doesn't exist, return default values
    if (!prefs) {
      prefs = {
        email_on_discussion: 1,
        email_on_status_change: 1,
        email_digest_frequency: "none",
        email_tone: "casual"
      };
    }

    // Also get the email from the users table
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);

    res.json({
      email: user?.email || null,
      emailOnDiscussion: prefs.email_on_discussion !== 0,
      emailOnStatusChange: prefs.email_on_status_change !== 0,
      emailDigestFrequency: prefs.email_digest_frequency || "none",
      emailTone: prefs.email_tone || "casual"
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
    const { email, emailOnDiscussion, emailOnStatusChange, emailDigestFrequency, emailTone } = req.body;

    const discuss = emailOnDiscussion ? 1 : 0;
    const statusChange = emailOnStatusChange ? 1 : 0;
    const freq = emailDigestFrequency || "none";
    const tone = emailTone || "casual";

    // Insert or update preferences record
    db.prepare(`
      INSERT INTO user_preferences (user_id, email_on_discussion, email_on_status_change, email_digest_frequency, email_tone, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        email_on_discussion = excluded.email_on_discussion,
        email_on_status_change = excluded.email_on_status_change,
        email_digest_frequency = excluded.email_digest_frequency,
        email_tone = excluded.email_tone,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, discuss, statusChange, freq, tone);

    // If email is provided, update the email column in the users table
    if (email !== undefined) {
      const emailValue = email && email.trim() !== "" ? email.trim() : null;
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(emailValue, userId);
      
      // Update email in active session
      if (req.session && req.session.user) {
        req.session.user.email = emailValue;
      }
    }

    res.json({ success: true, message: "Email preferences and email address updated successfully" });
  } catch (err) {
    console.error("[User Mail] Error updating email preferences:", err.message);
    res.status(500).json({ error: "Failed to update email preferences" });
  }
});

/**
 * @openapi
 * /api/admin/mail/settings:
 *   get:
 *     summary: Retrieve global email settings (admin only)
 */
router.get("/admin/mail/settings", requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    
    // Check if table exists (in case migration didn't run or table missing)
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'").get();
    let disableAllEmails = false;
    
    if (tableExists) {
      const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'disable_all_emails'").get();
      disableAllEmails = setting?.value === 'true';
    }
    
    res.json({ disableAllEmails });
  } catch (err) {
    console.error("[Admin Mail] Error fetching email settings:", err.message);
    res.status(500).json({ error: "Failed to fetch global email settings" });
  }
});

/**
 * @openapi
 * /api/admin/mail/settings:
 *   post:
 *     summary: Update global email settings (admin only)
 */
router.post("/admin/mail/settings", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { disableAllEmails } = req.body;
    if (disableAllEmails === undefined) {
      return res.status(400).json({ error: "disableAllEmails boolean is required." });
    }
    
    const db = getDatabase();
    db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('disable_all_emails', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(disableAllEmails ? 'true' : 'false');
    
    res.json({ success: true, message: "Global email settings updated successfully." });
  } catch (err) {
    console.error("[Admin Mail] Error updating email settings:", err.message);
    res.status(500).json({ error: "Failed to update global email settings" });
  }
});

/**
 * @openapi
 * /api/admin/mail/test:
 *   post:
 *     summary: Send a synchronous test email to verify SMTP configuration (admin only)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 description: Optional recipient email address. Defaults to configured superadmin/admin email.
 */
router.post("/admin/mail/test", requireAdmin, apiLimiter, async (req, res) => {
  try {
    const db = getDatabase();
    const { recipientEmail, targetEmail: bodyTargetEmail } = req.body || {};
    const requestedEmail = recipientEmail || bodyTargetEmail;
    let targetEmail = null;

    if (requestedEmail && typeof requestedEmail === "string" && requestedEmail.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmed = requestedEmail.trim();
      if (!emailPattern.test(trimmed) || trimmed.length > 255) {
        return res.status(400).json({ 
          error: "Invalid recipient email address format." 
        });
      }
      targetEmail = trimmed;
    } else {
      // Find superadmin(s) with configured emails
      const users = db.prepare("SELECT email, extra FROM users WHERE email IS NOT NULL AND is_banned = 0").all();
      
      for (const user of users) {
        try {
          const extra = user.extra ? JSON.parse(user.extra) : {};
          if (extra && extra.is_superadmin === true) {
            targetEmail = user.email;
            break;
          }
        } catch (e) {
          // Ignore json parse error
        }
      }
      
      // Fallback to currently logged-in administrator email if no superadmin email found
      if (!targetEmail && req.session.user && req.session.user.email) {
        targetEmail = req.session.user.email;
        console.log(`[Admin Mail] No superadmin email found. Falling back to logged-in admin email: ${targetEmail}`);
      }
    }
    
    if (!targetEmail) {
      return res.status(400).json({ 
        error: "No recipient email provided, and no superadmin or admin email address configured in the platform. Please verify your profile settings." 
      });
    }

    console.log(`[Admin Mail] Sending test email to: ${targetEmail}`);
    
    await sendMailSync(
      targetEmail,
      "MTT SMTP Test Connection",
      "test-email",
      {
        sentAt: new Date().toLocaleString(),
        smtpHost: process.env.SMTP_HOST || "not configured",
        link: `${config.frontendUrl}/dashboard`
      }
    );
    
    res.json({ success: true, message: `Test email successfully sent to ${targetEmail}.` });
  } catch (err) {
    console.error("[Admin Mail] Error sending test email:", err.message);
    res.status(500).json({ 
      error: `SMTP test connection failed: ${err.message}` 
    });
  }
});

/**
 * @openapi
 * /api/admin/mail/test-specific:
 *   post:
 *     summary: Send a specific test email template to verify styling and copy (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateName
 *             properties:
 *               templateName:
 *                 type: string
 *               tone:
 *                 type: string
 *               recipientEmail:
 *                 type: string
 *                 description: Optional recipient email address. Defaults to logged-in admin email.
 */
router.post("/admin/mail/test-specific", requireAdmin, apiLimiter, async (req, res) => {
  try {
    const { templateName, tone, recipientEmail, targetEmail: bodyTargetEmail } = req.body || {};
    const db = getDatabase();
    
    const requestedEmail = recipientEmail || bodyTargetEmail;
    let targetEmail = null;

    if (requestedEmail && typeof requestedEmail === "string" && requestedEmail.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmed = requestedEmail.trim();
      if (!emailPattern.test(trimmed) || trimmed.length > 255) {
        return res.status(400).json({ 
          error: "Invalid recipient email address format." 
        });
      }
      targetEmail = trimmed;
    } else {
      // Resolve logged in admin email
      targetEmail = req.session.user && req.session.user.email;
      if (!targetEmail) {
        // Find superadmin fallback
        const users = db.prepare("SELECT email FROM users WHERE email IS NOT NULL AND is_banned = 0").all();
        targetEmail = users[0]?.email;
      }
    }
    
    if (!targetEmail) {
      return res.status(400).json({ error: "No recipient email provided, and no email address found for testing." });
    }

    const testTone = tone || "casual";
    const displayName = req.session.user?.name || req.session.user?.username || "Admin Tester";

    console.log(`[Admin Mail] Sending test specific template "${templateName}" with tone "${testTone}" to: ${targetEmail}`);

    let subject = `MTT Test: ${templateName} (${testTone})`;
    let context = {
      displayName,
      tone: testTone,
      link: `${config.frontendUrl}/dashboard`
    };

    if (templateName === 'inactive-7day') {
      subject = "We miss you at Marine Term Translations!";
    } else if (templateName === 'inactive-14day') {
      subject = "Important: Your translation reviews are waiting on MTT";
    } else if (templateName === 'digest') {
      subject = testTone === 'professional' ? "Marine Term Translations - Activity Digest" : "Your MTT digest is here!";
      context = {
        ...context,
        digestFrequency: "weekly",
        hasApproved: true,
        hasDiscussions: true,
        approvedTranslationsHtml: `
          <li style="margin-bottom: 12px;"><strong>Abyssal zone</strong> (en): <span style="color: #0d9488;">"Deep ocean floor between 3,000 and 6,000 meters"</span></li>
          <li style="margin-bottom: 12px;"><strong>Bathypelagic</strong> (en): <span style="color: #0d9488;">"Depth zone of the open ocean from 1,000 to 4,000 meters"</span></li>
        `,
        activeDiscussionsHtml: `
          <li style="margin-bottom: 12px;"><strong>Benthic</strong>: Discussion opened: <a href="${config.frontendUrl}/flow" style="color: #0891b2; text-decoration: none;">"Is benthic vocabulary up to date?"</a></li>
        `
      };
    } else if (templateName === 'translation-approved') {
      subject = "Translation Suggestion Approved: Abyssal zone";
      context = {
        ...context,
        termLabel: "Abyssal zone",
        value: "Deep ocean floor",
        reputationChange: 5
      };
    } else if (templateName === 'translation-rejected') {
      subject = "Translation Suggestion Update: Abyssal zone";
      context = {
        ...context,
        termLabel: "Abyssal zone",
        value: "Abyss plain",
        reason: "Term does not align with standard NERC Vocabulary guidelines."
      };
    } else if (templateName === 'blogpost-notification') {
      subject = "New Blog Post: Marine Taxonomy Advancements";
      context = {
        ...context,
        title: "Lost in Translation? Not Your Marine Data",
        summary: "EMODnet Biology officially launches its self-hosted, expert-moderated marine term translation platform.",
        author: "Joanna Goley",
        authorRole: "VLIZ Project Manager",
        date: "June 10, 2026",
        readTime: "3 min read",
        link: `${config.frontendUrl}/blog/lost-in-translation-not-your-marine-data`
      };
    } else {
      return res.status(400).json({ error: "Invalid template name specified." });
    }

    await sendMailSync(
      targetEmail,
      subject,
      templateName,
      context
    );

    res.json({ success: true, message: `Test email (${templateName}) successfully sent to ${targetEmail}.` });
  } catch (err) {
    console.error("[Admin Mail] Error sending test email:", err.message);
    res.status(500).json({ error: `SMTP test connection failed: ${err.message}` });
  }
});

/**
 * @openapi
 * /api/admin/mail/broadcast-blogpost:
 *   post:
 *     summary: Broadcast a blogpost notification to all registered users (admin only)
 */
router.post("/admin/mail/broadcast-blogpost", requireAdmin, apiLimiter, (req, res) => {
  try {
    const { title, summary, slug, author, authorRole, date, readTime } = req.body;
    
    if (!title || !slug || !summary || title.trim() === "" || slug.trim() === "") {
      return res.status(400).json({ error: "Title, summary, and slug are required." });
    }

    const db = getDatabase();
    
    // Get all active users with email address
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.extra, up.email_tone
      FROM users u
      LEFT JOIN user_preferences up ON u.id = up.user_id
      WHERE u.email IS NOT NULL AND u.is_banned = 0
    `).all();

    if (users.length === 0) {
      return res.json({ success: true, message: "No active users with configured emails found." });
    }

    console.log(`[Admin Mail] Queueing blogpost broadcast "${title}" for ${users.length} user(s)...`);

    let queuedCount = 0;
    for (const user of users) {
      let displayName = user.username;
      try {
        const extra = user.extra ? JSON.parse(user.extra) : {};
        displayName = extra.name || extra.display_name || user.username;
      } catch (e) {}

      const recipientTone = user.email_tone || "casual";
      const link = `${config.frontendUrl}/blog/${slug}`;

      const result = queueMail(user.email, `New MTT Blog: ${title}`, "blogpost-notification", {
        displayName,
        title,
        summary,
        slug,
        author: author || "MTT Team",
        authorRole: authorRole || "Contributor",
        date: date || "Today",
        readTime: readTime || "5 min read",
        link,
        tone: recipientTone
      });

      if (result) queuedCount++;
    }

    res.json({ success: true, message: `Blogpost notification successfully queued for ${queuedCount} users.` });
  } catch (err) {
    console.error("[Admin Mail] Error broadcasting blogpost:", err.message);
    res.status(500).json({ error: "Failed to queue blogpost announcement" });
  }
});

module.exports = router;
