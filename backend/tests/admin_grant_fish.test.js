const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

const testDbPath = path.join(__dirname, 'test_admin_grant_fish.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

let mockSessionUser = { id: 999, is_admin: 1 };
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = { user: mockSessionUser };
  next();
});

const adminGachaRoutes = require('../src/routes/adminGacha.routes');
app.use('/api', adminGachaRoutes);

let server;
const PORT = 5691;

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
  console.log('Testing Admin Fish Grants & Species GLB Support...');
  initializeDatabase();
  const db = getDatabase();

  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));

  try {
    // 1. Setup mock user
    db.prepare("INSERT OR IGNORE INTO users (id, username) VALUES (10, 'diver_sam')").run();
    db.prepare("INSERT OR IGNORE INTO user_ecosystem (user_id) VALUES (10)").run();

    // 2. Test GET /api/admin/gacha/species
    const speciesRes = await request('/api/admin/gacha/species');
    assert.strictEqual(speciesRes.status, 200, 'GET /api/admin/gacha/species should return 200');
    assert.ok(Array.isArray(speciesRes.body.species), 'Should return an array of species');
    assert.ok(speciesRes.body.species.length >= 20, 'Should have at least 20 seeded species');
    
    // Check spotted_pufferfish seeded
    const puffer = speciesRes.body.species.find(s => s.id === 'spotted_pufferfish');
    assert.ok(puffer, 'spotted_pufferfish must be seeded');
    assert.strictEqual(puffer.model_url, '/models/puffer.glb', 'spotted_pufferfish must default to /models/puffer.glb');

    // 3. Test POST /api/admin/gacha/users/:id/grant-fish (standard)
    const grantStandardRes = await request('/api/admin/gacha/users/10/grant-fish', {
      method: 'POST',
      body: {
        species_id: 'azure_damselfish',
        nickname: 'Little Blue',
        is_shiny: false,
        count: 1
      }
    });
    assert.strictEqual(grantStandardRes.status, 200, 'Grant standard fish should return 200');
    assert.strictEqual(grantStandardRes.body.ok, true);
    assert.strictEqual(grantStandardRes.body.grantedCount, 1);
    assert.strictEqual(grantStandardRes.body.fishes[0].is_shiny, 0, 'Standard fish must have is_shiny = 0');
    assert.strictEqual(grantStandardRes.body.fishes[0].nickname, 'Little Blue');

    // 4. Test POST /api/admin/gacha/users/:id/grant-fish (Shiny!)
    const grantShinyRes = await request('/api/admin/gacha/users/10/grant-fish', {
      method: 'POST',
      body: {
        species_id: 'spotted_pufferfish',
        nickname: 'Golden Puffy',
        is_shiny: true,
        count: 1
      }
    });
    assert.strictEqual(grantShinyRes.status, 200, 'Grant shiny fish should return 200');
    assert.strictEqual(grantShinyRes.body.ok, true);
    assert.strictEqual(grantShinyRes.body.fishes[0].is_shiny, 1, 'Shiny fish must have is_shiny = 1');
    assert.strictEqual(grantShinyRes.body.fishes[0].species_id, 'spotted_pufferfish');

    // 5. Test PATCH /api/admin/gacha/species/:id (Update GLB model URL)
    const patchRes = await request('/api/admin/gacha/species/azure_damselfish', {
      method: 'PATCH',
      body: {
        model_url: '/models/custom_damselfish.glb'
      }
    });
    assert.strictEqual(patchRes.status, 200, 'PATCH species should return 200');
    assert.strictEqual(patchRes.body.species.model_url, '/models/custom_damselfish.glb');

    // Verify DB update
    const dbDamselfish = db.prepare('SELECT model_url FROM gacha_species WHERE id = ?').get('azure_damselfish');
    assert.strictEqual(dbDamselfish.model_url, '/models/custom_damselfish.glb');

    console.log('✓ All Admin Fish Grants & Species GLB tests PASSED!');
  } finally {
    server.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  }
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
