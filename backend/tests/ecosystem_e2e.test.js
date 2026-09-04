const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_ecosystem_e2e.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const ecosystemService = require('../src/services/ecosystem.service');
const { applyApprovalReward, applyCreationReward } = require('../src/services/reputation.service');

async function run() {
  console.log('Running End-to-End Ecosystem & Gacha Integration Test...');
  initializeDatabase();
  const db = getDatabase();

  // 1. Create Admin User & Translation
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (100, 'admin_biologist', 1)").run();
  db.prepare("INSERT INTO terms (id, uri) VALUES (10, 'urn:mtt:marine_specimen_10')").run();
  db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (10, 10, 'http://schema.org/name', 'Sunfish')").run();
  db.prepare("INSERT INTO translations (id, term_field_id, language, value, status, created_by_id) VALUES (10, 10, 'nl', 'Maanvis', 'review', 100)").run();

  // 2. Submission should award food flake (+1)
  applyCreationReward(100, 10);
  let state = ecosystemService.getEcosystemState(100);
  assert.strictEqual(state.ecosystem.food_flakes, 6, 'Base 5 + 1 flake for translation submission');

  // 3. Approval should award ticket (+1) and super pellet (+1)
  applyApprovalReward(100, 10);
  state = ecosystemService.getEcosystemState(100);
  assert.strictEqual(state.ecosystem.tickets, 1, 'Approval should award 1 ticket');
  assert.strictEqual(state.ecosystem.super_pellets, 2, 'Base 1 + 1 super pellet on approval');

  // 4. Single Pull at Dive Station
  const singlePull = ecosystemService.pullGacha(100, 1);
  assert.strictEqual(singlePull.results.length, 1);
  assert.strictEqual(singlePull.updated_ecosystem.tickets, 0);
  assert.strictEqual(singlePull.updated_ecosystem.total_pulls, 1);

  // 5. Award 10 tickets and do multi-pull
  ecosystemService.awardRewards(100, { tickets: 10 });
  const multiPull = ecosystemService.pullGacha(100, 10);
  assert.strictEqual(multiPull.results.length, 10);
  assert.strictEqual(multiPull.updated_ecosystem.total_pulls, 11);

  // Multi-pull guaranteed rare+ check
  const hasRareOrHigher = multiPull.results.some(r => ['rare', 'epic', 'legendary'].includes(r.rarity));
  assert.ok(hasRareOrHigher, 'Multi-pull must guarantee at least one Rare or higher species');

  // 6. Check Aquarium population
  state = ecosystemService.getEcosystemState(100);
  assert.strictEqual(state.fishes.length, 11);

  // 7. Check Marine Codex discovery
  const codex = ecosystemService.getCodex(100);
  assert.ok(codex.total_discovered >= 1);
  assert.ok(codex.completion_percentage > 0);
  console.log(`✓ Codex progress: ${codex.total_discovered}/${codex.total_species} (${codex.completion_percentage}%)`);

  // 8. Simulate 4 days of inactivity (Decay: 4 * 15 = 60 drop -> 40% health)
  db.prepare("UPDATE user_ecosystem SET last_decay_at = datetime('now', '-4 days') WHERE user_id = 100").run();
  state = ecosystemService.getEcosystemState(100);
  assert.strictEqual(state.ecosystem.water_quality, 40);
  assert.strictEqual(state.ecosystem.health_status, 'stable');

  // 9. Simulate extreme neglect (7 days -> 0% health, trigger dormancy)
  db.prepare("UPDATE user_ecosystem SET last_decay_at = datetime('now', '-7 days') WHERE user_id = 100").run();
  state = ecosystemService.getEcosystemState(100);
  assert.strictEqual(state.ecosystem.water_quality, 0);
  assert.strictEqual(state.ecosystem.health_status, 'dormant');
  const dormantCount = state.fishes.filter(f => f.status === 'dormant').length;
  assert.ok(dormantCount > 0, 'Fish must enter dormant slumber state at 0% water health');

  // 10. Feed Super Pellet -> Water quality restores by +25% and revives dormant fish
  const fedState = ecosystemService.feedEcosystem(100, 'super_pellet');
  assert.strictEqual(fedState.water_quality, 25);
  state = ecosystemService.getEcosystemState(100);
  const activeCount = state.fishes.filter(f => f.status === 'active').length;
  assert.strictEqual(activeCount, state.fishes.length, 'All fish must revive back to active after feeding');

  console.log('✓ End-to-End Ecosystem & Gacha Integration Test Passed Successfully!');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
