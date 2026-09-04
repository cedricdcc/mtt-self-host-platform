const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_admin_gacha_api.db');
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

const adminGachaRoutes = require('../src/routes/adminGacha.routes');
app.use('/api', adminGachaRoutes);

let server;
const PORT = 5597;

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request(`http://localhost:${PORT}${urlPath}`, {
      method: options.method || 'GET',
      headers
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
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  initializeDatabase();
  const db = getDatabase();

  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'normal_user', 0)").run();
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'admin_user', 1)").run();

  // 1. Regular user trying to access admin endpoints -> 403
  mockSessionUser = { id: 1, username: 'normal_user', is_admin: 0 };
  let res = await request('/api/admin/gacha/users');
  assert.strictEqual(res.status, 403, 'Normal user must receive 403 on admin gacha');

  // 2. Admin access -> 200
  mockSessionUser = { id: 2, username: 'admin_user', is_admin: 1 };
  res = await request('/api/admin/gacha/users');
  assert.strictEqual(res.status, 200, 'Admin should receive 200');
  assert.ok(Array.isArray(res.body.users), 'Response should contain users array');
  const target = res.body.users.find(u => u.id === 1);
  assert.ok(target, 'normal_user should be listed');
  assert.strictEqual(target.has_gacha_access, 0);

  // 3. Admin grants access to normal user
  res = await request('/api/admin/gacha/users/1/access', {
    method: 'PATCH',
    body: { has_access: true }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.has_gacha_access, 1);

  // 4. Admin grants 10 tickets and 5 super pellets to normal user
  res = await request('/api/admin/gacha/users/1/grant-resources', {
    method: 'POST',
    body: { tickets: 10, super_pellets: 5 }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ecosystem.tickets, 10);
  assert.strictEqual(res.body.ecosystem.super_pellets, 6); // 1 default + 5 granted = 6

  // 5. Admin revokes access
  res = await request('/api/admin/gacha/users/1/access', {
    method: 'PATCH',
    body: { has_access: false }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.has_gacha_access, 0);

  console.log('✓ Admin Gacha API test passed');
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
