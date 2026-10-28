const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_admin_mail_recipient.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase, closeDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const mailService = require('../src/services/mail.service');

// Spy on sendMailSync
const sentMails = [];
const originalSendMailSync = mailService.sendMailSync;
mailService.sendMailSync = async (toEmail, subject, templateName, context) => {
  sentMails.push({ toEmail, subject, templateName, context });
  return Promise.resolve();
};

let mockSessionUser = {
  id: 1,
  username: 'admin',
  email: 'admin-session@example.com',
  is_admin: 1
};

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = { user: mockSessionUser };
  next();
});

const mailRoutes = require('../src/routes/mail.routes');
app.use('/api', mailRoutes);

let server;
const PORT = 5597;

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body || {});
    const req = http.request(`http://localhost:${PORT}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("Starting admin mail recipient custom selection tests...");
  initializeDatabase();
  const db = getDatabase();

  // Create superadmin in database
  db.prepare("DELETE FROM users").run();
  db.prepare(`
    INSERT INTO users (id, username, email, is_admin, extra)
    VALUES (1, 'superadmin', 'superadmin@example.com', 1, '{"is_superadmin": true}')
  `).run();

  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));

  try {
    // 1. POST /api/admin/mail/test with custom recipient email
    sentMails.length = 0;
    const res1 = await post('/api/admin/mail/test', { recipientEmail: 'bart.vanhoorne@vliz.be' });
    assert.strictEqual(res1.status, 200, "Should return status 200");
    assert.strictEqual(res1.body.success, true);
    assert.ok(res1.body.message.includes('bart.vanhoorne@vliz.be'));
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].toEmail, 'bart.vanhoorne@vliz.be');
    assert.strictEqual(sentMails[0].templateName, 'test-email');
    console.log("✓ Test 1 passed: /admin/mail/test sends to specified recipient email");

    // 2. POST /api/admin/mail/test with invalid email format
    sentMails.length = 0;
    const res2 = await post('/api/admin/mail/test', { recipientEmail: 'not-an-email' });
    assert.strictEqual(res2.status, 400, "Should return status 400 for invalid email");
    assert.strictEqual(res2.body.error, "Invalid recipient email address format.");
    assert.strictEqual(sentMails.length, 0, "No email should be dispatched on invalid recipient");
    console.log("✓ Test 2 passed: /admin/mail/test rejects invalid recipient email format");

    // 3. POST /api/admin/mail/test without recipient email (fallback to superadmin)
    sentMails.length = 0;
    const res3 = await post('/api/admin/mail/test', {});
    assert.strictEqual(res3.status, 200, "Should return status 200 on default fallback");
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].toEmail, 'superadmin@example.com');
    console.log("✓ Test 3 passed: /admin/mail/test falls back to superadmin when recipientEmail is omitted");

    // 4. POST /api/admin/mail/test-specific with custom recipient email
    sentMails.length = 0;
    const res4 = await post('/api/admin/mail/test-specific', {
      templateName: 'inactive-7day',
      tone: 'casual',
      recipientEmail: 'bart.vanhoorne@vliz.be'
    });
    assert.strictEqual(res4.status, 200, "Should return status 200");
    assert.strictEqual(res4.body.success, true);
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].toEmail, 'bart.vanhoorne@vliz.be');
    assert.strictEqual(sentMails[0].templateName, 'inactive-7day');
    console.log("✓ Test 4 passed: /admin/mail/test-specific sends to specified recipient email");

    // 5. POST /api/admin/mail/test-specific with invalid email format
    sentMails.length = 0;
    const res5 = await post('/api/admin/mail/test-specific', {
      templateName: 'inactive-7day',
      recipientEmail: 'invalid@bad'
    });
    // invalid@bad has no dot in domain -> rejects
    assert.strictEqual(res5.status, 400, "Should reject invalid email");
    assert.strictEqual(res5.body.error, "Invalid recipient email address format.");
    assert.strictEqual(sentMails.length, 0);
    console.log("✓ Test 5 passed: /admin/mail/test-specific rejects invalid email");

    // 6. POST /api/admin/mail/test-specific without recipient email (fallback to session admin user)
    sentMails.length = 0;
    const res6 = await post('/api/admin/mail/test-specific', {
      templateName: 'inactive-7day',
      tone: 'casual'
    });
    assert.strictEqual(res6.status, 200);
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].toEmail, 'admin-session@example.com');
    console.log("✓ Test 6 passed: /admin/mail/test-specific falls back to session user email when omitted");

    // 7. Support alias targetEmail as well
    sentMails.length = 0;
    const res7 = await post('/api/admin/mail/test', { targetEmail: 'alias.test@vliz.be' });
    assert.strictEqual(res7.status, 200);
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].toEmail, 'alias.test@vliz.be');
    console.log("✓ Test 7 passed: targetEmail alias supported");

    console.log("\nALL 7 RECIPIENT SELECTION UNIT TESTS PASSED SUCCESSFULLY!\n");
  } finally {
    server.close();
    closeDatabase();
    mailService.sendMailSync = originalSendMailSync;
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }
}

run().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
