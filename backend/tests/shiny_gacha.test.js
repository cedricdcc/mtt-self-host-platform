const assert = require('assert');
const { getDatabase } = require('../src/db/database');
const { pullGacha, getEcosystemState, getCodex } = require('../src/services/ecosystem.service');
const { initializeDatabase } = require('../src/services/dbInit.service');

console.log('Testing Shiny Fishes DB & Gacha Service...');

// Ensure DB initialized and migrations run
initializeDatabase();
const db = getDatabase();

// 1. Verify migration added is_shiny column to user_fishes and gacha_pull_logs
const userFishesCols = db.prepare("PRAGMA table_info(user_fishes)").all();
const hasShinyCol = userFishesCols.some(c => c.name === 'is_shiny');
assert.strictEqual(hasShinyCol, true, 'user_fishes must contain is_shiny column');

const pullLogsCols = db.prepare("PRAGMA table_info(gacha_pull_logs)").all();
const hasLogsShinyCol = pullLogsCols.some(c => c.name === 'is_shiny');
assert.strictEqual(hasLogsShinyCol, true, 'gacha_pull_logs must contain is_shiny column');

// Ensure user 1 ecosystem exists with tickets
db.prepare(`
  INSERT OR IGNORE INTO user_ecosystem (user_id, tickets, food_flakes, super_pellets, water_quality)
  VALUES (1, 50, 5, 1, 100)
`).run();
db.prepare("UPDATE user_ecosystem SET tickets = 50 WHERE user_id = 1").run();

// 2. Test shiny generation flag in pullGacha
const pullRes = pullGacha(1, 1);
assert.ok(pullRes.results.length === 1, 'pull should yield 1 fish');
assert.ok('is_shiny' in pullRes.results[0], 'pull result must include is_shiny boolean');

// 3. Test getEcosystemState returns is_shiny
const eco = getEcosystemState(1);
assert.ok(eco.fishes.length > 0, 'ecosystem fishes must not be empty');
assert.ok('is_shiny' in eco.fishes[0], 'fishes list must include is_shiny property');

// 4. Test getCodex returns is_shiny flag
const codex = getCodex(1);
assert.ok(codex.species.length > 0, 'codex species must not be empty');
assert.ok('discovered_shiny' in codex.species[0], 'codex species must indicate discovered_shiny');

console.log('✓ All Shiny Fishes backend tests PASSED!');
