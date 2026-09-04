const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_reward_hooks.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const { applyApprovalReward } = require('../src/services/reputation.service');
const ecosystemService = require('../src/services/ecosystem.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (10, 'translator_hero', 1)").run();
  db.prepare("INSERT INTO terms (id, uri) VALUES (1, 'urn:test:1')").run();
  db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (1, 1, 'http://schema.org/name', 'Cod')").run();
  db.prepare("INSERT INTO translations (id, term_field_id, language, value, status, created_by_id) VALUES (1, 1, 'fr', 'Morue', 'review', 10)").run();

  // Call applyApprovalReward
  applyApprovalReward(10, 1);

  // Check user_ecosystem state
  const state = ecosystemService.getEcosystemState(10);
  assert.strictEqual(state.ecosystem.tickets, 1, 'Should award 1 ticket upon approval');
  assert.strictEqual(state.ecosystem.super_pellets, 2, 'Should award 1 super pellet (1 base + 1 awarded)');

  console.log('✓ Ecosystem Reward Hooks test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
