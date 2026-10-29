const assert = require("assert");
const fs = require("fs");
const path = require("path");

const testDbPath = path.join(__dirname, 'test_event_individual_scoring.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { getDatabase } = require("../src/db/database");
const { initializeDatabase } = require("../src/services/dbInit.service");
const { createEvent, deleteEvent } = require("../src/services/eventService");
const { recordEventContribution } = require("../src/services/scoringService");

function runTest() {
  console.log("Running Task 2: Individual Scoring test...");
  initializeDatabase();
  const db = getDatabase();

  // Ensure test user exists
  db.prepare("INSERT INTO users (username) VALUES ('test_scorer')").run();
  const user = db.prepare("SELECT id FROM users WHERE username = 'test_scorer'").get();

  // Create active event with hasTeams = false
  const now = new Date();
  const start = new Date(now.getTime() - 60000).toISOString();
  const end = new Date(now.getTime() + 86400000).toISOString();

  const evt = createEvent({
    title: "Solo Challenge",
    description: "No teams competition",
    startDate: start,
    endDate: end,
    hasTeams: false
  });

  assert.strictEqual(evt.has_teams, 0, "Event must be created with has_teams = 0");

  // Record translation created contribution
  const res = recordEventContribution(user.id, null, 'TRANSLATION_CREATED');
  const matched = res.find(c => c.event_id === evt.id);
  assert.ok(matched, "Contribution must be recorded for active team-less event");
  assert.strictEqual(matched.team_id, null, "Recorded contribution team_id must be null");

  // Verify in DB
  const row = db.prepare("SELECT * FROM event_contributions WHERE event_id = ?").get(evt.id);
  assert.ok(row, "Row must exist in event_contributions");
  assert.strictEqual(row.team_id, null);
  assert.strictEqual(row.points, 5);

  deleteEvent(evt.id);

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log("PASS: Task 2 individual scoring test passed!");
}

try {
  runTest();
} catch (err) {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  throw err;
}
