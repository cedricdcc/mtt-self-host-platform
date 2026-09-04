const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_gacha_access_migration.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  const columns = db.prepare("PRAGMA table_info(user_ecosystem)").all();
  const hasAccessCol = columns.find(c => c.name === 'has_gacha_access');
  assert.ok(hasAccessCol, 'Column has_gacha_access should exist in user_ecosystem');
  assert.strictEqual(hasAccessCol.dflt_value, '0', 'Default value should be 0');

  // Insert user ecosystem without specifying has_gacha_access
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'tester', 0)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id) VALUES (1)").run();
  const row = db.prepare("SELECT has_gacha_access FROM user_ecosystem WHERE user_id = 1").get();
  assert.strictEqual(row.has_gacha_access, 0, 'has_gacha_access should default to 0');

  console.log('✓ Migration 038 test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
