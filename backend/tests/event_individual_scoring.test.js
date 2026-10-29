const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { createEvent, deleteEvent } = require("../src/services/eventService");
const { recordEventContribution } = require("../src/services/scoringService");

function runTest() {
  console.log("Running Task 2: Individual Scoring test...");
  const db = getDatabase();

  // Ensure test user exists
  let user = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!user) {
    db.prepare("INSERT INTO users (username) VALUES ('test_scorer')").run();
    user = db.prepare("SELECT id FROM users WHERE username = 'test_scorer'").get();
  }

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
  console.log("PASS: Task 2 individual scoring test passed!");
}

runTest();
