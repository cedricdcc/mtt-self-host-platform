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
const fs = require('fs');

// Locate and load .env file from root or backend directory
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

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
