# Mailing Service Transporter & Pre-Rebuild Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the backend mailing service transporter to connect to the unauthenticated institutional relay (`kms.vliz.be:25`) and provide a standalone test runner to verify live email delivery before rebuilding the backend container.

**Architecture:** Update `getTransporter()` in `backend/src/services/mail.service.js` to default to port 25 without sending authentication credentials. Provide a standalone runner script `backend/scripts/test-smtp-send.js` that verifies connectivity and sends a test email to `cedric.decruw@vliz.be`, and add a convenience npm script `"test:mail"`.

**Tech Stack:** Node.js, Nodemailer, dotenv.

## Global Constraints
- Do not pass `auth` credentials to `kms.vliz.be:25`.
- Set `rejectUnauthorized: false` in TLS options.
- Default port is 25 (`process.env.SMTP_PORT || "25"`).
- Target recipient for test email is `cedric.decruw@vliz.be`.

---

### Task 1: Dedicated SMTP Test Runner Script

**Files:**
- Create: `backend/scripts/test-smtp-send.js`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: CLI script that can be executed with `node backend/scripts/test-smtp-send.js [--to=<email>]` or `npm run test:mail`.

- [ ] **Step 1: Write `backend/scripts/test-smtp-send.js`**

```javascript
#!/usr/bin/env node
/**
 * Standalone SMTP Connectivity & Live Email Test Runner
 * 
 * Verifies connection handshake with the configured SMTP host
 * and sends a test email to verify delivery.
 * 
 * Usage:
 *   node backend/scripts/test-smtp-send.js
 *   node backend/scripts/test-smtp-send.js --to=cedric.decruw@vliz.be
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const nodemailer = require('nodemailer');

const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--to=')) acc.to = arg.split('=')[1];
  else if (arg === '--help' || arg === '-h') acc.help = true;
  return acc;
}, {});

if (args.help) {
  console.log(`
SMTP Test Runner
Usage: node test-smtp-send.js [options]

Options:
  --to=<email>       Target recipient email (default: cedric.decruw@vliz.be)
  --help, -h         Show this help message
  `);
  process.exit(0);
}

const smtpHost = process.env.SMTP_HOST || 'kms.vliz.be';
const smtpPort = parseInt(process.env.SMTP_PORT || '25', 10);
const smtpSecure = process.env.SMTP_SECURE === 'true';
const targetEmail = args.to || 'cedric.decruw@vliz.be';
const fromName = process.env.SMTP_FROM_NAME || 'Marine Term Translations';
const fromEmail = process.env.SMTP_FROM_EMAIL || 'marine-term-translation@mailing.vliz.be';

async function main() {
  console.log('='.repeat(70));
  console.log(' MTT SMTP CONNECTION & TEST EMAIL DISPATCH RUNNER');
  console.log('='.repeat(70));
  console.log(` SMTP Host   : ${smtpHost}`);
  console.log(` SMTP Port   : ${smtpPort}`);
  console.log(` Secure (TLS): ${smtpSecure}`);
  console.log(` From        : "${fromName}" <${fromEmail}>`);
  console.log(` Target To   : ${targetEmail}`);
  console.log('='.repeat(70));

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    tls: {
      rejectUnauthorized: false
    }
  });

  console.log('\n[1/2] Verifying SMTP connection handshake...');
  try {
    await transporter.verify();
    console.log('✔ SMTP connection and handshake succeeded!');
  } catch (err) {
    console.error('✖ SMTP connection failed:', err.message);
    process.exit(1);
  }

  console.log('\n[2/2] Sending test email...');
  try {
    const timestamp = new Date().toLocaleString();
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: targetEmail,
      subject: 'MTT Mailing Service Live Verification Test',
      text: `Hello,\n\nThis is a verification email from the Marine Term Translations mailing service.\n\nConnection Details:\n- Host: ${smtpHost}\n- Port: ${smtpPort}\n- Time: ${timestamp}\n\nIf you received this message, the unauthenticated SMTP relay is functioning properly.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="background: #0284c7; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="color: white; margin: 0; font-size: 20px;">Marine Term Translations</h2>
            <p style="color: #e0f2fe; margin: 4px 0 0 0; font-size: 14px;">Mailing Service Live Verification</p>
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.5;">
            This email confirms that the unauthenticated SMTP transport configured for <strong>${smtpHost}:${smtpPort}</strong> is successfully relaying messages.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #475569;">
            <p style="margin: 4px 0;"><strong>Recipient:</strong> ${targetEmail}</p>
            <p style="margin: 4px 0;"><strong>Sender:</strong> ${fromEmail}</p>
            <p style="margin: 4px 0;"><strong>Server:</strong> ${smtpHost}:${smtpPort}</p>
            <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${timestamp}</p>
          </div>
          <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            Marine Term Translations Platform System Notification
          </p>
        </div>
      `
    });

    console.log('✔ Test email successfully dispatched!');
    console.log(`  Message ID : ${info.messageId}`);
    console.log(`  Response   : ${info.response}`);
    console.log('\n[SUCCESS] Delivery accepted by mail relay.');
  } catch (err) {
    console.error('✖ Error dispatching email:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add `"test:mail"` to `backend/package.json`**
In `backend/package.json`:
```json
"test:mail": "node scripts/test-smtp-send.js"
```

- [ ] **Step 3: Test runner execution**
Run: `node backend/scripts/test-smtp-send.js --to=cedric.decruw@vliz.be`
Expected: Outputs "✔ SMTP connection and handshake succeeded!" and "✔ Test email successfully dispatched!" with exit code 0.

- [ ] **Step 4: Commit Task 1**
```bash
git add backend/scripts/test-smtp-send.js backend/package.json
git commit -m "feat(mail): add standalone SMTP test runner script"
```

---

### Task 2: Update `getTransporter()` in `mail.service.js`

**Files:**
- Modify: `backend/src/services/mail.service.js:12-39`

**Interfaces:**
- Consumes: Environment variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`.
- Produces: Configured Nodemailer transporter instance without `auth` and defaulting to port 25.

- [ ] **Step 1: Replace `getTransporter()` implementation**

In `backend/src/services/mail.service.js`:
```javascript
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
```

- [ ] **Step 2: Run backend offline tests to ensure zero regressions**
Run: `npm test` from `backend/` directory.
Expected: All tests pass.

- [ ] **Step 3: Test `sendMailSync` with updated `getTransporter`**
Run: `node -e 'const { sendMailSync } = require("./src/services/mail.service"); sendMailSync("cedric.decruw@vliz.be", "MTT Service Test", "test-email", { sentAt: new Date().toLocaleString(), smtpHost: process.env.SMTP_HOST, link: "https://mtt.vliz.be" }).then(() => console.log("SUCCESS")).catch(e => console.error("FAIL", e));'` in `backend/`.
Expected: Outputs `SUCCESS`.

- [ ] **Step 4: Commit Task 2**
```bash
git add backend/src/services/mail.service.js
git commit -m "fix(mail): configure unauthenticated SMTP relay on port 25"
```

---

### Task 3: Verification & Walkthrough Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-09-02-mail-service-transporter-design.md` (if needed)
- Create/Update: `walkthrough.md`

- [ ] **Step 1: Execute `npm run test:mail`**
Run: `npm run test:mail` from `backend/`.
Expected: Returns exit code 0 and message ID.

- [ ] **Step 2: Commit changes and present results**
