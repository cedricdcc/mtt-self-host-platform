// Mail service - handles queuing and sending of emails using Nodemailer
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { getDatabase } = require("../db/database");
const config = require("../config");

// Initialize transporter lazily to pick up runtime environment changes
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost) {
      console.warn("[Mail Service] SMTP_HOST not configured. Mail service running in offline mode.");
      return null;
    }

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser ? {
        user: smtpUser,
        pass: smtpPass
      } : undefined,
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
function getEmailBody(templateName, context) {
  try {
    const templatesDir = path.join(__dirname, "../templates/email");
    const baseHtml = fs.readFileSync(path.join(templatesDir, "base.html"), "utf8");
    const templateHtml = fs.readFileSync(path.join(templatesDir, `${templateName}.html`), "utf8");

    // Precompile inner template
    const content = compileTemplate(templateHtml, context);
    
    // Inject into base layout
    const fullContext = {
      ...context,
      content,
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
    const { html, text } = getEmailBody(templateName, { ...context, subject });
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO mail_queue (to_email, subject, body_html, body_text, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    
    const result = stmt.run(toEmail, subject, html, text);
    console.log(`[Mail Service] Queued email to ${toEmail} with subject: "${subject}" (ID: ${result.lastInsertRowid})`);
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

module.exports = {
  queueMail,
  processQueue,
  startMailQueueWorker
};
