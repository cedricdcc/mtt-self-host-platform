const assert = require("assert");
const fs = require("fs");
const path = require("path");

const testDbPath = path.join(__dirname, 'test_event_scoring.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { getDatabase } = require("../src/db/database");
const { initializeDatabase } = require("../src/services/dbInit.service");
const scoringService = require("../src/services/scoringService");

try {
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT OR IGNORE INTO users (id, username) VALUES (10, 'marine_user')").run();
  db.prepare(`
    INSERT OR IGNORE INTO events (id, title, start_date, end_date, target_language, status)
    VALUES ('evt-score-1', 'Scoring Event', '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z', 'all', 'ACTIVE')
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO event_teams (id, event_id, name, join_code)
    VALUES ('team-score-1', 'evt-score-1', 'Score Team', 'TM-SC-01')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO event_memberships (id, event_id, team_id, user_id, is_active)
    VALUES ('mem-score-1', 'evt-score-1', 'team-score-1', 10, 1)
  `).run();

  db.prepare("INSERT OR IGNORE INTO terms (id, uri) VALUES (1, 'http://example.org/term1')").run();
  db.prepare("INSERT OR IGNORE INTO term_fields (id, term_id, field_uri, original_value) VALUES (1, 1, 'http://example.org/field1', 'orig')").run();
  db.prepare("INSERT OR IGNORE INTO translations (id, term_field_id, value) VALUES (101, 1, 'test')").run();

  const recorded = scoringService.recordEventContribution(10, 101, 'TRANSLATION_APPROVED', 'ALL');
  assert.ok(Array.isArray(recorded));
  assert.strictEqual(recorded.length, 1);
  assert.strictEqual(recorded[0].team_id, 'team-score-1');

  const contr = db.prepare("SELECT * FROM event_contributions WHERE user_id = 10").all();
  assert.strictEqual(contr.length, 1);
  assert.strictEqual(contr[0].points, 10);

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log("PASS: Event scoring service test passed!");
} catch (err) {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  console.error("FAIL: Event scoring service test failed:", err.message);
  process.exit(1);
}
