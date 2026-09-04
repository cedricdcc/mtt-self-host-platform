const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_gacha_access_control.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

let mockSessionUser = null;
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = mockSessionUser ? { user: mockSessionUser } : {};
  next();
});

const ecosystemRoutes = require('../src/routes/ecosystem.routes');
const gachaRoutes = require('../src/routes/gacha.routes');
app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/gacha', gachaRoutes);

let server;
const PORT = 5599;

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${PORT}${urlPath}`, {
      method: options.method || 'GET',
      headers: options.headers || {}
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

  // Create test users:
  // 1: regular user (no access)
  // 2: regular user (with access)
  // 3: admin user
  // 4: superadmin user
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'regular_no_access', 0)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (1, 0)").run();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'regular_with_access', 0)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (2, 1)").run();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (3, 'admin_user', 1)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (3, 0)").run();

  db.prepare("INSERT INTO users (id, username, is_admin, extra) VALUES (4, 'super_user', 0, '{\"is_superadmin\":true}')").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (4, 0)").run();

  // 1. Unauthenticated -> 401
  mockSessionUser = null;
  let res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 401, 'Unauthenticated request should be 401');

  // 2. Regular user without access -> 403
  mockSessionUser = { id: 1, username: 'regular_no_access', is_admin: 0 };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 403, 'User without access should be 403');

  // 3. Regular user with access -> 200
  mockSessionUser = { id: 2, username: 'regular_with_access', is_admin: 0 };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 200, 'User with access should be 200');

  // 4. Admin user -> 200
  mockSessionUser = { id: 3, username: 'admin_user', is_admin: 1 };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 200, 'Admin should be 200');

  // 5. Superadmin user -> 200
  mockSessionUser = { id: 4, username: 'super_user', is_admin: 0, is_superadmin: true };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 200, 'Superadmin should be 200');

  console.log('✓ Gacha Access Control test passed');
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
