const assert = require("assert");
const path = require("path");

// Test mail.service configuration invariants
const mailService = require("../src/services/mail.service");

// Save original env
const origHost = process.env.SMTP_HOST;
const origPort = process.env.SMTP_PORT;
const origSecure = process.env.SMTP_SECURE;
const origUser = process.env.SMTP_USER;
const origPass = process.env.SMTP_PASS;
const origAuth = process.env.SMTP_AUTH;

try {
  console.log("Running mail service transporter tests...");

  // Test 1: Offline mode when SMTP_HOST is not set
  delete process.env.SMTP_HOST;
  mailService.resetTransporter();
  const nullTransporter = mailService.getTransporter();
  assert.strictEqual(nullTransporter, null, "Transporter should be null when SMTP_HOST is unset");

  // Test 2: Standard port 25 relay without auth (default)
  process.env.SMTP_HOST = "kms.vliz.be";
  delete process.env.SMTP_PORT;
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "test@example.com";
  process.env.SMTP_PASS = "testpass";
  delete process.env.SMTP_AUTH;
  mailService.resetTransporter();

  const relayTransporter = mailService.getTransporter();
  assert.ok(relayTransporter, "Transporter should be created");
  assert.strictEqual(relayTransporter.options.host, "kms.vliz.be");
  assert.strictEqual(relayTransporter.options.port, 25, "Default port should be 25");
  assert.strictEqual(relayTransporter.options.secure, false);
  assert.strictEqual(relayTransporter.options.auth, undefined, "Auth should be omitted by default to avoid 535 rejection on open internal relays");
  assert.strictEqual(relayTransporter.options.tls.rejectUnauthorized, false, "Should allow self-signed certificates");

  // Test 3: Explicit SMTP_AUTH="true"
  process.env.SMTP_AUTH = "true";
  process.env.SMTP_PORT = "587";
  mailService.resetTransporter();
  const authTransporter = mailService.getTransporter();
  assert.ok(authTransporter, "Auth transporter should be created");
  assert.strictEqual(authTransporter.options.port, 587);
  assert.deepStrictEqual(authTransporter.options.auth, {
    user: "test@example.com",
    pass: "testpass"
  }, "Auth credentials should be attached when SMTP_AUTH is true");

  // Test 4: Verify template rendering helper
  const body = mailService.getEmailBody("test-email", {
    sentAt: "2026-09-07 12:00:00",
    smtpHost: "kms.vliz.be",
    link: "https://mtt.vliz.be"
  });
  assert.ok(body.html, "Should compile HTML body");
  assert.ok(body.text, "Should compile text body");
  assert.ok(body.html.includes("kms.vliz.be"), "HTML body should include host");

  console.log("PASS: All mail service unit tests passed!");
} catch (err) {
  console.error("FAIL: Mail service test failed:", err);
  process.exit(1);
} finally {
  // Restore env
  if (origHost !== undefined) process.env.SMTP_HOST = origHost; else delete process.env.SMTP_HOST;
  if (origPort !== undefined) process.env.SMTP_PORT = origPort; else delete process.env.SMTP_PORT;
  if (origSecure !== undefined) process.env.SMTP_SECURE = origSecure; else delete process.env.SMTP_SECURE;
  if (origUser !== undefined) process.env.SMTP_USER = origUser; else delete process.env.SMTP_USER;
  if (origPass !== undefined) process.env.SMTP_PASS = origPass; else delete process.env.SMTP_PASS;
  if (origAuth !== undefined) process.env.SMTP_AUTH = origAuth; else delete process.env.SMTP_AUTH;
  mailService.resetTransporter();
}
