const assert = require("assert");
const { getDatabase, applySchema, isDatabaseInitialized } = require("../src/db/database");

const fs = require("fs");
const path = require("path");

try {
  if (!isDatabaseInitialized()) {
    applySchema();
  }
  const db = getDatabase();

  const hasEventsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").get();
  if (!hasEventsTable) {
    const migrationSql = fs.readFileSync(path.join(__dirname, "../src/db/migrations/035_events.sql"), "utf8");
    db.exec(migrationSql);
  }

  db.prepare("DELETE FROM events WHERE id = 'evt-1'").run();
  // Insert test event
  const stmtEvent = db.prepare(`
    INSERT INTO events (id, title, description, start_date, end_date, target_language, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmtEvent.run("evt-1", "Marine Bio Challenge", "Translate benthic terms", "2026-08-01T00:00:00Z", "2026-08-31T23:59:59Z", "all", "ACTIVE");

  const fetchedEvent = db.prepare("SELECT * FROM events WHERE id = ?").get("evt-1");
  assert.strictEqual(fetchedEvent.title, "Marine Bio Challenge");

  // Insert test team
  const stmtTeam = db.prepare(`
    INSERT INTO event_teams (id, event_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `);
  stmtTeam.run("team-1", "evt-1", "Team Coral", "TM-CORAL-99");

  const fetchedTeam = db.prepare("SELECT * FROM event_teams WHERE id = ?").get("team-1");
  assert.strictEqual(fetchedTeam.name, "Team Coral");
  assert.strictEqual(fetchedTeam.join_code, "TM-CORAL-99");

  db.prepare("DELETE FROM events WHERE id = 'evt-1'").run();

  console.log("PASS: Events database schema test passed!");
} catch (err) {
  console.error("FAIL: Events database schema test failed:", err.message);
  process.exit(1);
}
