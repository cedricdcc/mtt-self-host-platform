const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_superadmin_auth_me.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const { requireAdmin } = require('../src/middleware/admin');

let mockSessionUser = null;
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = mockSessionUser ? { user: mockSessionUser } : {};
  next();
});

const authRoutes = require('../src/routes/auth.routes');
app.use('/api', authRoutes);

// Test protected admin endpoint
app.get('/api/test-admin-only', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

let server;
const PORT = 5595;

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${PORT}${urlPath}`, {
      method: 'GET'
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
    req.end();
  });
}

async function run() {
  initializeDatabase();
  const db = getDatabase();

  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));

  // Insert user exactly as in production: is_admin column is 0, extra has is_admin: true and is_superadmin: true
  const extra = JSON.stringify({
    name: 'Cedric Decruw',
    is_admin: true,
    is_superadmin: true
  });
  db.prepare("INSERT INTO users (id, username, is_admin, extra) VALUES (1, 'cedric_super', 0, ?)").run(extra);

  // User logs in and has initial session
  mockSessionUser = {
    id: 1,
    username: 'cedric_super',
    is_admin: true,
    is_superadmin: true
  };

  // Call /api/me to refresh session
  const meRes = await request('/api/me');
  assert.strictEqual(meRes.status, 200);

  // Both is_admin and is_superadmin must be true/truthy!
  assert.strictEqual(Boolean(meRes.body.is_superadmin), true, 'is_superadmin must be true');
  assert.strictEqual(Boolean(meRes.body.is_admin), true, 'is_admin must NOT be wiped out by users table column');

  // Must also pass requireAdmin middleware
  const adminRes = await request('/api/test-admin-only');
  assert.strictEqual(adminRes.status, 200, 'Superadmin must pass requireAdmin');

  console.log('✓ Superadmin auth me test passed');
  server.close();
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (server) server.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
