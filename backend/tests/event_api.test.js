const assert = require("assert");
const { getDatabase, applySchema, isDatabaseInitialized } = require("../src/db/database");
const eventService = require("../src/services/eventService");

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

  // Seed test user
  db.prepare("INSERT OR IGNORE INTO users (id, username) VALUES (1, 'test_user')").run();

  // Seed test event and team
  db.prepare(`
    INSERT OR IGNORE INTO events (id, title, description, start_date, end_date, status)
    VALUES ('evt-test-1', 'Summer Translation Rally', 'Translate marine species', '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z', 'ACTIVE')
  `).run();


  db.prepare(`
    INSERT OR IGNORE INTO event_teams (id, event_id, name, join_code)
    VALUES ('team-test-1', 'evt-test-1', 'Ocean Defenders', 'TM-OD-100')
  `).run();

  // Test eventService.getAllEvents
  const events = eventService.getAllEvents();
  assert.ok(Array.isArray(events));
  assert.ok(events.some(e => e.id === 'evt-test-1'));

  // Test eventService.getEventById
  const event = eventService.getEventById('evt-test-1');
  assert.strictEqual(event.id, 'evt-test-1');
  assert.ok(Array.isArray(event.teams));
  assert.strictEqual(event.teams[0].name, 'Ocean Defenders');

  // Test team creation & join
  const newTeam = eventService.createTeam('evt-test-1', 'Deep Sea Crew', null, 1);
  assert.strictEqual(newTeam.name, 'Deep Sea Crew');
  assert.ok(newTeam.join_code.startsWith('TM-DEEP-'));

  db.prepare("DELETE FROM event_memberships WHERE event_id = 'evt-test-1' AND user_id = 1").run();
  const joinResult = eventService.joinTeam('evt-test-1', newTeam.join_code, 1);
  assert.strictEqual(joinResult.success, true);
  assert.strictEqual(joinResult.teamId, newTeam.id);


  // Test event with reward title
  const rewEvent = eventService.createEvent({
    title: 'Autumn Coral Sprint',
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2026-09-15T23:59:59Z',
    rewardTitle: 'Coral Sprint Champion 2026'
  });
  assert.strictEqual(rewEvent.reward_title, 'Coral Sprint Champion 2026');
  const fetchedEvent = eventService.getEventById(rewEvent.id);
  assert.strictEqual(fetchedEvent.reward_title, 'Coral Sprint Champion 2026');

  eventService.deleteEvent('evt-test-1');
  eventService.deleteEvent(rewEvent.id);

  console.log("PASS: Events API service test passed!");
  process.exit(0);
} catch (err) {
  console.error("FAIL: Events API service test failed:", err.message);
  process.exit(1);
}
