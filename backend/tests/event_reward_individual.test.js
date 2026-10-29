const assert = require("assert");
const fs = require("fs");
const path = require("path");

const testDbPath = path.join(__dirname, 'test_event_reward_individual.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { getDatabase } = require("../src/db/database");
const { initializeDatabase } = require("../src/services/dbInit.service");
const { createEvent, deleteEvent } = require("../src/services/eventService");
const { settleEventRewards } = require("../src/services/rewardService");

function runTest() {
  console.log("Running Task 4: Individual Reward Settlement test...");
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT INTO users (username) VALUES ('solo_champ')").run();
  const user = db.prepare("SELECT id FROM users WHERE username = 'solo_champ'").get();

  const evt = createEvent({
    title: "Solo Champ Event",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-01-02T00:00:00.000Z",
    hasTeams: false,
    rewardTitle: "Solo Legend 2026"
  });

  try {
    // Insert contribution
    db.prepare(`
      INSERT INTO event_contributions (id, event_id, team_id, user_id, action_type, points)
      VALUES ('c_solo', ?, NULL, ?, 'TRANSLATION_APPROVED', 50)
    `).run(evt.id, user.id);

    const res = settleEventRewards(evt.id);
    assert.strictEqual(res.settled, true);
    assert.strictEqual(res.awardedCount, 1);

    // Verify user reward
    const rewardRow = db.prepare(`
      SELECT ur.*, r.name as title_name 
      FROM user_rewards ur
      JOIN event_rewards r ON ur.reward_id = r.id
      WHERE ur.user_id = ? AND r.event_id = ?
    `).get(user.id, evt.id);
    assert.ok(rewardRow);
    assert.strictEqual(rewardRow.title_name, "Solo Legend 2026");
  } finally {
    // Clean up
    deleteEvent(evt.id);
  }

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log("PASS: Task 4 Individual Reward Settlement test passed!");
}

try {
  runTest();
} catch (err) {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  throw err;
}
