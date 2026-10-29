const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { createEvent, deleteEvent, getEventStats } = require("../src/services/eventService");
const eventController = require("../src/controllers/eventController");

async function runTest() {
  console.log("Running Task 3: Event Stats API service & controller test...");
  const db = getDatabase();

  // Clean up any stale test records from prior runs
  db.prepare("DELETE FROM event_contributions WHERE id LIKE 'c_stats_%'").run();

  // Ensure test users exist
  let user1 = db.prepare("SELECT id FROM users WHERE username = 'test_stats_user1'").get();
  if (!user1) {
    db.prepare("INSERT INTO users (username, email) VALUES ('test_stats_user1', 'stats1@example.com')").run();
    user1 = db.prepare("SELECT id FROM users WHERE username = 'test_stats_user1'").get();
  }

  let user2 = db.prepare("SELECT id FROM users WHERE username = 'test_stats_user2'").get();
  if (!user2) {
    db.prepare("INSERT INTO users (username, email) VALUES ('test_stats_user2', 'stats2@example.com')").run();
    user2 = db.prepare("SELECT id FROM users WHERE username = 'test_stats_user2'").get();
  }

  const now = new Date();
  const start = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
  const end = new Date(now.getTime() + 86400000).toISOString();

  const evt = createEvent({
    title: "Stats Test Event",
    startDate: start,
    endDate: end,
    hasTeams: false
  });

  const cId1 = `c_stats_${Date.now()}_1`;
  const cId2 = `c_stats_${Date.now()}_2`;
  const cId3 = `c_stats_${Date.now()}_3`;

  try {
    // Seed sample contributions for user 1
    db.prepare(`
      INSERT INTO event_contributions (id, event_id, team_id, user_id, action_type, points, created_at)
      VALUES (?, ?, NULL, ?, 'TRANSLATION_CREATED', 5, ?),
             (?, ?, NULL, ?, 'TRANSLATION_APPROVED', 10, ?)
    `).run(cId1, evt.id, user1.id, new Date(now.getTime() - 1800000).toISOString(),
           cId2, evt.id, user1.id, new Date(now.getTime() - 600000).toISOString());

    // Seed sample contribution for user 2
    db.prepare(`
      INSERT INTO event_contributions (id, event_id, team_id, user_id, action_type, points, created_at)
      VALUES (?, ?, NULL, ?, 'TRANSLATION_CREATED', 5, ?)
    `).run(cId3, evt.id, user2.id, new Date(now.getTime() - 300000).toISOString());

    // --- 1. Service: Default Smart Binning Test ---
    const resultDefault = getEventStats(evt.id, null, 'smart', false);
    assert.ok(resultDefault.stats, "Response must include stats object");
    assert.strictEqual(resultDefault.stats.inReviewCount, 2, "inReviewCount should count TRANSLATION_CREATED for both users");
    assert.strictEqual(resultDefault.stats.approvedCount, 1, "approvedCount should count TRANSLATION_APPROVED");
    assert.strictEqual(resultDefault.stats.totalActions, 3, "totalActions should be 3");
    assert.strictEqual(resultDefault.stats.totalPoints, 20, "totalPoints should be 20 (5 + 10 + 5)");
    assert.strictEqual(resultDefault.stats.activeContributors, 2, "activeContributors should be 2");

    assert.ok(resultDefault.timeline, "Response must include timeline object");
    assert.strictEqual(resultDefault.timeline.resolution, "hour", "Smart resolution for 1h event should be hour");
    assert.ok(resultDefault.timeline.data.length >= 1, "Timeline data should contain buckets");
    assert.ok(resultDefault.timeline.data[0].timestamp, "Timeline bucket must have timestamp");
    assert.ok(resultDefault.timeline.data[0].label, "Timeline bucket must have label");

    assert.ok(Array.isArray(resultDefault.individualLeaderboard), "Must include individualLeaderboard array");
    assert.strictEqual(resultDefault.individualLeaderboard[0].userId, user1.id, "User 1 should be #1 on leaderboard");
    assert.strictEqual(resultDefault.individualLeaderboard[0].totalPoints, 15);
    assert.strictEqual(resultDefault.individualLeaderboard[1].userId, user2.id, "User 2 should be #2 on leaderboard");
    assert.strictEqual(resultDefault.individualLeaderboard[1].totalPoints, 5);

    // --- 2. Service: Resolutions Test ('hour', 'day', 'week') ---
    const resHour = getEventStats(evt.id, null, 'hour', false);
    assert.strictEqual(resHour.timeline.resolution, 'hour');

    const resDay = getEventStats(evt.id, null, 'day', false);
    assert.strictEqual(resDay.timeline.resolution, 'day');

    const resWeek = getEventStats(evt.id, null, 'week', false);
    assert.strictEqual(resWeek.timeline.resolution, 'week');

    // Smart resolution test for long events
    const evtMonthOld = createEvent({
      title: "Month Old Event",
      startDate: new Date(now.getTime() - 10 * 86400000).toISOString(), // 10 days ago
      endDate: end,
      hasTeams: false
    });
    const resSmartDay = getEventStats(evtMonthOld.id, null, 'smart', false);
    assert.strictEqual(resSmartDay.timeline.resolution, 'day', "10-day old event should resolve to day");
    deleteEvent(evtMonthOld.id);

    const evtTwoMonthsOld = createEvent({
      title: "Two Months Old Event",
      startDate: new Date(now.getTime() - 40 * 86400000).toISOString(), // 40 days ago
      endDate: end,
      hasTeams: false
    });
    const resSmartWeek = getEventStats(evtTwoMonthsOld.id, null, 'week', false);
    assert.strictEqual(resSmartWeek.timeline.resolution, 'week', "40-day old event should resolve to week");
    deleteEvent(evtTwoMonthsOld.id);

    // --- 3. Service: userOnly=true Test ---
    const resultUser1Only = getEventStats(evt.id, user1.id, 'smart', true);
    assert.strictEqual(resultUser1Only.stats.totalActions, 2, "User 1 only should have 2 actions");
    assert.strictEqual(resultUser1Only.stats.totalPoints, 15, "User 1 only should have 15 points");
    assert.strictEqual(resultUser1Only.stats.activeContributors, 1, "User 1 only should count 1 contributor");

    const resultUser2Only = getEventStats(evt.id, user2.id, 'smart', true);
    assert.strictEqual(resultUser2Only.stats.totalActions, 1, "User 2 only should have 1 action");
    assert.strictEqual(resultUser2Only.stats.totalPoints, 5, "User 2 only should have 5 points");

    // --- 4. Controller getEventStats Test ---
    function createMockRes() {
      return {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        }
      };
    }

    // 4a. userOnly=true without auth -> 401
    const reqUnauth = {
      params: { id: evt.id },
      query: { userOnly: 'true' },
      session: null,
      user: null
    };
    const resUnauth = createMockRes();
    await eventController.getEventStats(reqUnauth, resUnauth);
    assert.strictEqual(resUnauth.statusCode, 401, "userOnly=true without session/user must return 401");
    assert.deepStrictEqual(resUnauth.body, { error: "Authentication required for user-only statistics" });

    // 4b. userOnly=true with auth -> 200 filtered
    const reqAuth = {
      params: { id: evt.id },
      query: { userOnly: 'true' },
      session: { user: { id: user1.id } }
    };
    const resAuth = createMockRes();
    await eventController.getEventStats(reqAuth, resAuth);
    assert.strictEqual(resAuth.statusCode, 200);
    assert.strictEqual(resAuth.body.stats.totalPoints, 15);

    // 4c. non-existent event -> 404
    const reqNotFound = {
      params: { id: 'non-existent-id' },
      query: {},
      session: null
    };
    const resNotFound = createMockRes();
    await eventController.getEventStats(reqNotFound, resNotFound);
    assert.strictEqual(resNotFound.statusCode, 404);
    assert.strictEqual(resNotFound.body.error, "Event not found");

    console.log("PASS: Task 3 Event Stats API test passed!");
  } finally {
    // Cleanup
    deleteEvent(evt.id);
    db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(user1.id, user2.id);
  }
}

runTest().catch(err => {
  console.error("FAIL: Task 3 Event Stats API test failed:", err);
  process.exit(1);
});
