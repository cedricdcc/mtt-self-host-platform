const assert = require("assert");
const { getDatabase, applySchema, isDatabaseInitialized } = require("../src/db/database");
const { createEvent, deleteEvent } = require("../src/services/eventService");
const { settleEventRewards } = require("../src/services/rewardService");

function runTest() {
  console.log("Running Task 4: Individual Reward Settlement test...");
  if (!isDatabaseInitialized()) {
    applySchema();
  }
  const db = getDatabase();

  let user = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!user) {
    db.prepare("INSERT INTO users (username, email) VALUES ('solo_champ', 'champ@example.com')").run();
    user = db.prepare("SELECT id FROM users WHERE username = 'solo_champ'").get();
  }

  const evt = createEvent({
    title: "Solo Champ Event",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-01-02T00:00:00.000Z",
    hasTeams: false,
    rewardTitle: "Solo Legend 2026"
  });

  try {
    // Clean up any stale contribution from previous failed runs
    db.prepare("DELETE FROM event_contributions WHERE id = 'c_solo'").run();

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
    db.prepare("DELETE FROM user_rewards WHERE reward_id IN (SELECT id FROM event_rewards WHERE event_id = ?)").run(evt.id);
    db.prepare("DELETE FROM event_contributions WHERE id = 'c_solo'").run();
    deleteEvent(evt.id);
  }
  console.log("PASS: Task 4 Individual Reward Settlement test passed!");
}

runTest();
