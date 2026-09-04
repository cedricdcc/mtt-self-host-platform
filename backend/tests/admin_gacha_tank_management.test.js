const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_admin_gacha_tank.db');
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
const PORT = 5599;

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

  try {
    // Seed test users
    db.prepare(`INSERT OR REPLACE INTO users (id, username, is_admin) VALUES (201, 'admin_tank', 1)`).run();
    db.prepare(`INSERT OR REPLACE INTO users (id, username, is_admin) VALUES (202, 'diver_tank', 0)`).run();

    // Seed ecosystem for diver_tank
    db.prepare(`
      INSERT OR REPLACE INTO user_ecosystem (user_id, tickets, food_flakes, super_pellets, water_quality, pity_counter_epic, pity_counter_legendary)
      VALUES (202, 3, 7, 2, 45, 4, 12)
    `).run();

    // Insert 2 caught fishes
    db.prepare(`
      INSERT INTO user_fishes (id, user_id, species_id, nickname)
      VALUES (901, 202, 'azure_damselfish', 'Finny'),
             (902, 202, 'solar_lionfish', 'Sol')
    `).run();

    // 1. Unauthenticated test
    mockSessionUser = null;
    let res = await request('/api/admin/gacha/users/202/tank');
    assert.strictEqual(res.status, 401, 'Unauthenticated access should be 401');

    // 2. Non-admin test
    mockSessionUser = { id: 202, username: 'diver_tank', is_admin: 0 };
    res = await request('/api/admin/gacha/users/202/tank');
    assert.strictEqual(res.status, 403, 'Non-admin access should be 403');

    // 3. Admin: GET /tank
    mockSessionUser = { id: 201, username: 'admin_tank', is_admin: 1 };
    res = await request('/api/admin/gacha/users/202/tank');
    assert.strictEqual(res.status, 200, 'Admin should fetch tank');
    assert.strictEqual(res.body.ecosystem.water_quality, 45);
    assert.strictEqual(res.body.fishes.length, 2);
    assert.strictEqual(res.body.fishes[0].nickname, 'Sol'); // ordered DESC by id
    assert.strictEqual(res.body.fishes[0].name, 'Solar Lionfish');

    // 4. Admin: PATCH fish nickname
    res = await request('/api/admin/gacha/users/202/fishes/901', {
      method: 'PATCH',
      body: { nickname: 'Bubbles Renamed' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.fish.nickname, 'Bubbles Renamed');

    // 5. Admin: DELETE single fish
    res = await request('/api/admin/gacha/users/202/fishes/901', {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.deletedFishId, 901);
    assert.strictEqual(res.body.remainingCount, 1);

    // Verify fish 901 is gone from DB
    const checkFish = db.prepare('SELECT id FROM user_fishes WHERE id = 901').get();
    assert.strictEqual(checkFish, undefined);

    // 6. Admin: POST reset-tank (configurable: delete fishes, reset water, reset pity, reset food)
    res = await request('/api/admin/gacha/users/202/reset-tank', {
      method: 'POST',
      body: {
        delete_fishes: true,
        reset_water: true,
        reset_pity: true,
        reset_food: true
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.fishes_count, 0);
    assert.strictEqual(res.body.ecosystem.water_quality, 100);
    assert.strictEqual(res.body.ecosystem.pity_counter_epic, 0);
    assert.strictEqual(res.body.ecosystem.pity_counter_legendary, 0);
    assert.strictEqual(res.body.ecosystem.food_flakes, 5);
    assert.strictEqual(res.body.ecosystem.super_pellets, 1);

    const remainingFishes = db.prepare('SELECT COUNT(*) as count FROM user_fishes WHERE user_id = 202').get().count;
    assert.strictEqual(remainingFishes, 0);

    console.log('✓ Admin Gacha tank management test passed successfully');
  } finally {
    server.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }
}

run().catch(err => {
  console.error(err);
  if (server) server.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
