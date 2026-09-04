const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const testDbPath = path.join(__dirname, 'test_ecosystem_api.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const app = require('../src/app');
const ecosystemService = require('../src/services/ecosystem.service');

let server;
const PORT = 5598;

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
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

  // Create normal user and admin user
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'normal_user', 0)").run();
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'admin_user', 1)").run();

  server = app.listen(PORT);

  // 1. Unauthenticated request to /api/ecosystem should return 401
  const unauthRes = await request('/api/ecosystem');
  assert.strictEqual(unauthRes.status, 401, `Expected 401, got ${unauthRes.status}`);

  // 2. Unauthenticated request to /api/gacha/pull should return 401
  const unauthPull = await request('/api/gacha/pull', { method: 'POST', body: { count: 1 } });
  assert.strictEqual(unauthPull.status, 401, `Expected 401, got ${unauthPull.status}`);

  console.log('✓ Ecosystem API unauthenticated guard verified');
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
