const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_gacha_permissions.db');
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

const gachaRoutes = require('../src/routes/gacha.routes');
app.use('/api/gacha', gachaRoutes);

let server;
const PORT = 5792;

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
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  const db = getDatabase();
  initializeDatabase(db);

  // Create a regular user without admin or ecosystem access
  db.prepare("DELETE FROM users WHERE id = 777").run();
  db.prepare(`
    INSERT INTO users (id, username, is_admin)
    VALUES (777, 'regular_codex_user', 0)
  `).run();

  // Give them starter tickets
  db.prepare("DELETE FROM user_ecosystem WHERE user_id = 777").run();
  db.prepare(`
    INSERT INTO user_ecosystem (user_id, tickets, water_quality, has_gacha_access)
    VALUES (777, 3, 100, 0)
  `).run();

  server = app.listen(PORT);

  try {
    console.log('--- Test 1: Unauthenticated request to /api/gacha/codex returns 401 ---');
    mockSessionUser = null;
    const unauthRes = await request('/api/gacha/codex');
    assert.strictEqual(unauthRes.status, 401, 'Expected 401 for unauthenticated request');

    console.log('--- Test 2: Regular authenticated user accessing /api/gacha/codex returns 200 ---');
    mockSessionUser = { id: 777, username: 'regular_codex_user', is_admin: 0, is_superadmin: 0 };
    const codexRes = await request('/api/gacha/codex');
    assert.strictEqual(codexRes.status, 200, `Expected 200 for regular user codex, got ${codexRes.status}: ${JSON.stringify(codexRes.body)}`);
    assert.strictEqual(typeof codexRes.body.total_species, 'number');
    assert.strictEqual(Array.isArray(codexRes.body.species), true);

    console.log('--- Test 3: Regular authenticated user can pull gacha with tickets ---');
    const pullRes = await request('/api/gacha/pull', {
      method: 'POST',
      body: { count: 1 }
    });
    assert.strictEqual(pullRes.status, 200, `Expected 200 for regular user pull, got ${pullRes.status}: ${JSON.stringify(pullRes.body)}`);
    assert.strictEqual(Array.isArray(pullRes.body.results), true);
    assert.strictEqual(pullRes.body.results.length, 1);
    assert.strictEqual(pullRes.body.updated_ecosystem.tickets, 2);

    console.log('✅ All gacha permission tests passed successfully!');
  } finally {
    server.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (_) {}
    }
  }
}

runTests().catch(err => {
  console.error('❌ Gacha permissions test failed:', err);
  if (server) server.close();
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (_) {}
  }
  process.exit(1);
});
