const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_gacha_schema.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Check tables exist
  const tables = ['gacha_species', 'user_ecosystem', 'user_fishes', 'gacha_pull_logs'];
  for (const table of tables) {
    const res = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    assert.ok(res, `Table ${table} should exist`);
  }

  // Check species seed data (at least 20 species)
  const count = db.prepare("SELECT count(*) as count FROM gacha_species").get().count;
  assert.ok(count >= 20, `Expected at least 20 seeded species, got ${count}`);

  // Check species rarity coverage
  const rarities = db.prepare("SELECT DISTINCT rarity FROM gacha_species").all().map(r => r.rarity);
  assert.ok(rarities.includes('common'), 'Should include common');
  assert.ok(rarities.includes('uncommon'), 'Should include uncommon');
  assert.ok(rarities.includes('rare'), 'Should include rare');
  assert.ok(rarities.includes('epic'), 'Should include epic');
  assert.ok(rarities.includes('legendary'), 'Should include legendary');

  console.log('✓ Gacha Schema & Seed test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
