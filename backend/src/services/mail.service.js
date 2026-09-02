// Mail service - handles queuing and sending of emails using Nodemailer
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { getDatabase } = require("../db/database");
const config = require("../config");
const datetime = require("../utils/datetime");

// Initialize transporter lazily to pick up runtime environment changes
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "25", 10);
    const smtpSecure = process.env.SMTP_SECURE === "true";
    if (!smtpHost) {
      console.warn("[Mail Service] SMTP_HOST not configured. Mail service running in offline mode.");
      return null;
    }
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      tls: {
        rejectUnauthorized: false // Avoid SSL certificate rejection for local/self-signed setups
      }
    });
  }
  return transporter;
}

/**
 * Simple HTML compiler supporting {{variable}} replacement and {{#if variable}}...{{/if}}
 */
function compileTemplate(html, context) {
  let compiled = html;

  // Handle {{#if key}} ... {{/if}}
  const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  compiled = compiled.replace(ifRegex, (match, key, content) => {
    return context[key] ? compileTemplate(content, context) : "";
  });

  // Handle standard {{key}}
  for (const [key, value] of Object.entries(context)) {
    const val = value !== undefined && value !== null ? value : "";
    compiled = compiled.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), val);
  }

  // Clean unmatched brackets
  compiled = compiled.replace(/\{\{[\s\S]*?\}\}/g, "");

  return compiled;
}

/**
 * Strips HTML tags to generate a clean plain-text fallback
 */
function stripHtml(html) {
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, "")
    .replace(/<script([\s\S]*?)<\/script>/gi, "")
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:.|\n)*?>/gm, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Compile a template with layout
 */
/**
 * Compile a template with layout
 */
function getEmailBody(templateName, context) {
  try {
    const templatesDir = path.join(__dirname, "../templates/email");
    const baseHtml = fs.readFileSync(path.join(templatesDir, "base.html"), "utf8");
    
    // Check if tone-specific template exists
    const tone = context.tone || 'casual';
    let templateHtml;
    const toneTemplatePath = path.join(templatesDir, `${templateName}_${tone}.html`);
    if (fs.existsSync(toneTemplatePath)) {
      templateHtml = fs.readFileSync(toneTemplatePath, "utf8");
    } else {
      templateHtml = fs.readFileSync(path.join(templatesDir, `${templateName}.html`), "utf8");
    }

    // Set tone-specific boolean flags in context for simple conditional rendering
    const enhancedContext = {
      ...context,
      frontendUrl: config.frontendUrl,
      tone_professional: tone === 'professional',
      tone_casual: tone === 'casual',
      tone_enthusiastic: tone === 'enthusiastic'
    };

    // Precompile inner template
    const content = compileTemplate(templateHtml, enhancedContext);
    
    // Inject into base layout
    const fullContext = {
      ...enhancedContext,
      content,
      frontendUrl: config.frontendUrl,
      unsubscribe_link: `${config.frontendUrl}/settings`
    };

    const finalHtml = compileTemplate(baseHtml, fullContext);
    const finalTxt = stripHtml(content);

    return { html: finalHtml, text: finalTxt };
  } catch (err) {
    console.error(`[Mail Service] Error compiling email template ${templateName}:`, err.message);
    throw err;
  }
}

/**
 * Check for users that have been inactive for 7 or 14 days and send reminder emails
 */
function checkInactiveUsers() {
  const db = getDatabase();
  try {
    // 1. Check for 7-day inactive users
    const inactive7Days = db.prepare(`
      SELECT id, username, email, extra
      FROM users 
      WHERE email IS NOT NULL 
        AND is_banned = 0 
        AND last_login_at IS NOT NULL
        AND datetime(last_login_at) <= datetime('now', '-7 days')
        AND last_inactive_email_sent_type = 'none'
    `).all();

    for (const user of inactive7Days) {
      let displayName = user.username;
      try {
        const extra = user.extra ? JSON.parse(user.extra) : {};
        displayName = extra.name || extra.display_name || user.username;
      } catch (e) {}

      console.log(`[Mail Service] Inactive user (7 days) detected: ${user.username} (${user.email})`);
      
      const result = queueMail(user.email, "We miss you at Marine Term Translations!", "inactive-7day", {
        displayName,
        link: `${config.frontendUrl}/dashboard`
      });

      if (result) {
        db.prepare(`
          UPDATE users 
          SET last_inactive_email_sent_type = '7_day', 
              last_inactive_email_sent_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(user.id);
      }
    }

    // 2. Check for 14-day inactive users
    const inactive14Days = db.prepare(`
      SELECT id, username, email, extra
      FROM users 
      WHERE email IS NOT NULL 
        AND is_banned = 0 
        AND last_login_at IS NOT NULL
        AND datetime(last_login_at) <= datetime('now', '-14 days')
        AND last_inactive_email_sent_type = '7_day'
    `).all();

    for (const user of inactive14Days) {
      let displayName = user.username;
      try {
        const extra = user.extra ? JSON.parse(user.extra) : {};
        displayName = extra.name || extra.display_name || user.username;
      } catch (e) {}

      console.log(`[Mail Service] Inactive user (14 days) detected: ${user.username} (${user.email})`);

      const result = queueMail(user.email, "Important: Your translation reviews are waiting on MTT", "inactive-14day", {
        displayName,
        link: `${config.frontendUrl}/dashboard`
      });

      if (result) {
        db.prepare(`
          UPDATE users 
          SET last_inactive_email_sent_type = '14_day', 
              last_inactive_email_sent_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(user.id);
      }
    }
  } catch (err) {
    console.error("[Mail Service] Error checking inactive users:", err.message);
  }
}

/**
 * Compile and queue daily/weekly activity digests for configured users
 */
function sendDigests() {
  const db = getDatabase();
  try {
    const usersDue = db.prepare(`
      SELECT u.id, u.username, u.email, u.extra, up.email_digest_frequency, up.email_tone, up.last_digest_sent_at
      FROM users u
      JOIN user_preferences up ON u.id = up.user_id
      WHERE u.email IS NOT NULL
        AND u.is_banned = 0
        AND up.email_digest_frequency IN ('daily', 'weekly')
        AND (
          up.last_digest_sent_at IS NULL 
          OR (up.email_digest_frequency = 'daily' AND datetime(up.last_digest_sent_at) <= datetime('now', '-23 hours'))
          OR (up.email_digest_frequency = 'weekly' AND datetime(up.last_digest_sent_at) <= datetime('now', '-6 days', '-23 hours'))
        )
    `).all();

    for (const user of usersDue) {
      console.log(`[Mail Service] Compiling ${user.email_digest_frequency} digest for ${user.username} (${user.email})...`);

      // Compile content since last_digest_sent_at (default to last 7 days if NULL)
      const sinceTime = user.last_digest_sent_at || datetime.format(datetime.subtract(datetime.now(), 7, 'day'), 'YYYY-MM-DD HH:mm:ss');
      
      const approvedTranslations = db.prepare(`
        SELECT t.value, t.language, tf.original_value as term_label
        FROM translations t
        JOIN term_fields tf ON t.term_field_id = tf.id
        WHERE t.status = 'approved'
          AND datetime(t.updated_at) >= datetime(?)
        ORDER BY t.updated_at DESC
        LIMIT 5
      `).all(sinceTime);

      const activeDiscussions = db.prepare(`
        SELECT DISTINCT td.title, tf.original_value as term_label, td.id as discussion_id, td.term_id
        FROM term_discussions td
        JOIN term_fields tf ON tf.term_id = td.term_id
        WHERE datetime(td.created_at) >= datetime(?)
        GROUP BY td.id
        ORDER BY td.created_at DESC
        LIMIT 5
      `).all(sinceTime);

      if (approvedTranslations.length === 0 && activeDiscussions.length === 0) {
        console.log(`[Mail Service] Skipping digest for ${user.username} - no new activity since ${sinceTime}`);
        
        db.prepare(`
          UPDATE user_preferences 
          SET last_digest_sent_at = CURRENT_TIMESTAMP 
          WHERE user_id = ?
        `).run(user.id);
        continue;
      }

      let displayName = user.username;
      try {
        const extra = user.extra ? JSON.parse(user.extra) : {};
        displayName = extra.name || extra.display_name || user.username;
      } catch (e) {}

      const tone = user.email_tone || 'casual';
      const subject = user.email_digest_frequency === 'daily' 
        ? `Daily Translations Activity Digest` 
        : `Weekly Translations Activity Digest`;

      const approvedTranslationsHtml = approvedTranslations.map(t => 
        `<li style="margin-bottom: 12px;"><strong>${t.term_label}</strong> (${t.language}): <span style="color: #0d9488;">"${t.value}"</span></li>`
      ).join('\n');

      const activeDiscussionsHtml = activeDiscussions.map(d => 
        `<li style="margin-bottom: 12px;"><strong>${d.term_label}</strong>: Discussion opened: <a href="${config.frontendUrl}/flow?term_id=${d.term_id}" style="color: #0891b2; text-decoration: none;">"${d.title}"</a></li>`
      ).join('\n');

      const result = queueMail(user.email, subject, "digest", {
        displayName,
        digestFrequency: user.email_digest_frequency,
        approvedTranslationsHtml,
        activeDiscussionsHtml,
        hasApproved: approvedTranslations.length > 0,
        hasDiscussions: activeDiscussions.length > 0,
        tone
      });

      if (result) {
        db.prepare(`
          UPDATE user_preferences 
          SET last_digest_sent_at = CURRENT_TIMESTAMP 
          WHERE user_id = ?
        `).run(user.id);
      }
    }
  } catch (err) {
    console.error("[Mail Service] Error sending digests:", err.message);
  }
}

/**
 * Queue an email in the SQLite database
 * @param {string} toEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} templateName - Template filename (without .html)
 * @param {object} context - Variables to pass to the template
 * @returns {number|null} The inserted queue row ID
 */
function queueMail(toEmail, subject, templateName, context) {
  if (!toEmail) {
    console.warn("[Mail Service] Cannot queue mail: No recipient email specified.");
    return null;
  }

  try {
    const db = getDatabase();
    
    // Check if emails are disabled globally
    try {
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'").get();
      if (tableExists) {
        const disableEmails = db.prepare("SELECT value FROM system_settings WHERE key = 'disable_all_emails'").get()?.value === 'true';
        if (disableEmails) {
          console.log(`[Mail Service] Mail queueing skipped: Emails are globally disabled (attempted: "${subject}" to ${toEmail})`);
          return null;
        }
      }
    } catch (settingsErr) {
      console.warn("[Mail Service] Failed to check global email settings status in queueMail:", settingsErr.message);
    }

    const { html, text } = getEmailBody(templateName, { ...context, subject });
    
    const stmt = db.prepare(`
      INSERT INTO mail_queue (to_email, subject, body_html, body_text, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    
    const result = stmt.run(toEmail, subject, html, text);
    console.log(`[Mail Service] Queued email to ${toEmail} with subject: "${subject}" (ID: ${result.lastInsertRowid})`);
    
    // Trigger queue processing asynchronously to send the email immediately
    setImmediate(() => {
      processQueue().catch(err => {
        console.error("[Mail Service] Error in async queue process trigger:", err.message);
      });
    });

    return result.lastInsertRowid;
  } catch (err) {
    console.error("[Mail Service] Failed to queue email:", err.message);
    return null;
  }
}

/**
 * Process pending emails in the queue
 */
async function processQueue() {
  const client = getTransporter();
  const db = getDatabase();

  // Check if emails are disabled globally
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'").get();
    if (tableExists) {
      const disableEmails = db.prepare("SELECT value FROM system_settings WHERE key = 'disable_all_emails'").get()?.value === 'true';
      if (disableEmails) {
        return; // Skip queue processing when globally disabled
      }
    }
  } catch (settingsErr) {
    console.warn("[Mail Service] Failed to check global email settings status in processQueue:", settingsErr.message);
  }

  // Trigger checks for inactive users and periodic digests
  checkInactiveUsers();
  sendDigests();

  // Find emails that are pending, or failed with less than 3 attempts
  const pendingMails = db.prepare(`
    SELECT * FROM mail_queue 
    WHERE status = 'pending' OR (status = 'failed' AND attempts < 3)
    ORDER BY created_at ASC
    LIMIT 20
  `).all();

  if (pendingMails.length === 0) {
    return;
  }

  console.log(`[Mail Service] Processing ${pendingMails.length} queued email(s)...`);

  for (const mail of pendingMails) {
    const nextAttempts = mail.attempts + 1;
    
    // Mark as sending to prevent double-processing
    db.prepare(`
      UPDATE mail_queue 
      SET status = 'sending', attempts = ? 
      WHERE id = ?
    `).run(nextAttempts, mail.id);

    if (!client) {
      db.prepare(`
        UPDATE mail_queue 
        SET status = 'failed', last_error = 'SMTP transporter not configured' 
        WHERE id = ?
      `).run(mail.id);
      continue;
    }

    try {
      await client.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Marine Term Translations'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@example.com'}>`,
        to: mail.to_email,
        subject: mail.subject,
        html: mail.body_html,
        text: mail.body_text
      });

      // Update on success
      db.prepare(`
        UPDATE mail_queue 
        SET status = 'sent', last_error = NULL, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(mail.id);
      console.log(`[Mail Service] Successfully sent email ID ${mail.id} to ${mail.to_email}`);
    } catch (err) {
      console.error(`[Mail Service] Error sending email ID ${mail.id} to ${mail.to_email}:`, err.message);
      
      db.prepare(`
        UPDATE mail_queue 
        SET status = 'failed', last_error = ? 
        WHERE id = ?
      `).run(err.message, mail.id);
    }
  }
}

/**
 * Start the mail queue worker (interval of 30 minutes)
 */
function startMailQueueWorker() {
  console.log("[Mail Service] Starting mail queue background worker (runs every 30 minutes)");
  
  // Run once immediately on startup to pick up any pending/unprocessed emails
  setTimeout(() => {
    processQueue().catch(err => {
      console.error("[Mail Service] Error during initial queue processing run:", err.message);
    });
  }, 5000);

  // Set recurring interval (30 minutes = 30 * 60 * 1000 ms)
  const intervalMs = 30 * 60 * 1000;
  setInterval(() => {
    processQueue().catch(err => {
      console.error("[Mail Service] Error in mail queue worker loop:", err.message);
    });
  }, intervalMs);
}

/**
 * Send an email synchronously, bypassing the database queue.
 * Useful for SMTP setup validation testing.
 */
async function sendMailSync(toEmail, subject, templateName, context) {
  const client = getTransporter();
  if (!client) {
    throw new Error("SMTP transporter not configured. Please set SMTP_HOST in your environment variables.");
  }

  const { html, text } = getEmailBody(templateName, { ...context, subject });
  
  await client.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'Marine Term Translations'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@example.com'}>`,
    to: toEmail,
    subject: subject,
    html: html,
    text: text
  });
}

module.exports = {
  queueMail,
  processQueue,
  startMailQueueWorker,
  sendMailSync,
  getEmailBody
};
