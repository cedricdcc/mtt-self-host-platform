const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_ecosystem_service.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const ecosystemService = require('../src/services/ecosystem.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Create mock user
  db.prepare("INSERT INTO users (id, username) VALUES (1, 'captain_admin')").run();

  // 1. Initialize and get ecosystem
  const initial = ecosystemService.getEcosystemState(1);
  assert.strictEqual(initial.ecosystem.water_quality, 100);
  assert.strictEqual(initial.ecosystem.health_status, 'thriving');
  assert.strictEqual(initial.ecosystem.food_flakes, 5);
  assert.strictEqual(initial.fishes.length, 0);

  // 2. Test lazy decay simulation (set last_decay_at to 2 days ago)
  db.prepare("UPDATE user_ecosystem SET last_decay_at = datetime('now', '-2 days') WHERE user_id = 1").run();
  const decayed = ecosystemService.getEcosystemState(1);
  // 100 - (2 * 15) = 70
  assert.strictEqual(decayed.ecosystem.water_quality, 70);
  assert.strictEqual(decayed.ecosystem.health_status, 'stable');

  // 3. Test feeding flake (+10)
  const fed = ecosystemService.feedEcosystem(1, 'flake');
  assert.strictEqual(fed.water_quality, 80);
  assert.strictEqual(fed.food_flakes, 4);

  // 4. Test Gacha pull without tickets -> should throw
  assert.throws(() => {
    ecosystemService.pullGacha(1, 1);
  }, /Not enough tickets/i);

  // 5. Award tickets and pull
  ecosystemService.awardRewards(1, { tickets: 11 });
  const stateAfterAward = ecosystemService.getEcosystemState(1);
  assert.strictEqual(stateAfterAward.ecosystem.tickets, 11);

  // Pull 1
  const singlePull = ecosystemService.pullGacha(1, 1);
  assert.strictEqual(singlePull.results.length, 1);
  assert.strictEqual(singlePull.updated_ecosystem.tickets, 10);
  assert.strictEqual(singlePull.updated_ecosystem.total_pulls, 1);

  // Pull 10 (multi-pull guarantee at least 1 rare+)
  const multiPull = ecosystemService.pullGacha(1, 10);
  assert.strictEqual(multiPull.results.length, 10);
  assert.strictEqual(multiPull.updated_ecosystem.tickets, 0);
  assert.strictEqual(multiPull.updated_ecosystem.total_pulls, 11);
  const hasRareOrHigher = multiPull.results.some(r => ['rare', 'epic', 'legendary'].includes(r.rarity));
  assert.ok(hasRareOrHigher, 'Multi-pull must guarantee at least one Rare or higher');

  // 6. Test Codex
  const codex = ecosystemService.getCodex(1);
  assert.ok(codex.species.length >= 20);
  assert.ok(codex.total_discovered >= 1);
  assert.ok(codex.completion_percentage > 0);

  // 7. Test updating fish (nickname / favorite)
  const fishId = singlePull.results[0].user_fish_id;
  const updatedFish = ecosystemService.updateFish(1, fishId, { nickname: 'Finny', is_favorite: 1 });
  assert.strictEqual(updatedFish.nickname, 'Finny');
  assert.strictEqual(updatedFish.is_favorite, 1);

  console.log('✓ Ecosystem Service test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
