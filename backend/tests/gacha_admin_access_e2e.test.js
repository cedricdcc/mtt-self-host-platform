const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_gacha_admin_access_e2e.db');
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
const adminGachaRoutes = require('../src/routes/adminGacha.routes');

app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/gacha', gachaRoutes);
app.use('/api', adminGachaRoutes);

let server;
const PORT = 5596;

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

  // Seed users:
  // 1: diver_dan (regular user)
  // 2: admiral_admin (admin)
  // 3: poseidon_super (superadmin)
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'diver_dan', 0)").run();
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'admiral_admin', 1)").run();
  db.prepare("INSERT INTO users (id, username, is_admin, extra) VALUES (3, 'poseidon_super', 0, '{\"is_superadmin\":true}')").run();

  // 1. diver_dan has no access initially -> 403
  mockSessionUser = { id: 1, username: 'diver_dan', is_admin: 0 };
  let res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 403, 'diver_dan should be 403 forbidden without access');

  // 2. admiral_admin lists users and grants access to diver_dan
  mockSessionUser = { id: 2, username: 'admiral_admin', is_admin: 1 };
  res = await request('/api/admin/gacha/users/1/access', {
    method: 'PATCH',
    body: { has_access: true }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.has_gacha_access, 1);

  // 3. admiral_admin grants 5 tickets to diver_dan
  res = await request('/api/admin/gacha/users/1/grant-resources', {
    method: 'POST',
    body: { tickets: 5 }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ecosystem.tickets, 5);

  // 4. diver_dan can now access ecosystem and sees 5 tickets
  mockSessionUser = { id: 1, username: 'diver_dan', is_admin: 0 };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ecosystem.tickets, 5);

  // 5. diver_dan spends 1 ticket on a slot dive pull
  res = await request('/api/gacha/pull', {
    method: 'POST',
    body: { count: 1 }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.results.length, 1);
  assert.strictEqual(res.body.updated_ecosystem.tickets, 4);

  // 6. admiral_admin revokes access from diver_dan
  mockSessionUser = { id: 2, username: 'admiral_admin', is_admin: 1 };
  res = await request('/api/admin/gacha/users/1/access', {
    method: 'PATCH',
    body: { has_access: false }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.has_gacha_access, 0);

  // 7. diver_dan is now rejected again -> 403
  mockSessionUser = { id: 1, username: 'diver_dan', is_admin: 0 };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 403);

  // 8. poseidon_super accesses ecosystem directly -> 200
  mockSessionUser = { id: 3, username: 'poseidon_super', is_admin: 0, is_superadmin: true };
  res = await request('/api/ecosystem');
  assert.strictEqual(res.status, 200);

  console.log('✓ Full Gacha Admin Access E2E test passed successfully!');
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
