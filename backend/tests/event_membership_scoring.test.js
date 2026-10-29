const assert = require("assert");
const { getDatabase, applySchema, isDatabaseInitialized } = require("../src/db/database");
const eventService = require("../src/services/eventService");
const scoringService = require("../src/services/scoringService");

function testMembershipAndSourceScoredPoints() {
  if (!isDatabaseInitialized()) {
    applySchema();
  }
  const db = getDatabase();

  // Create test sources
  db.prepare("INSERT OR IGNORE INTO sources (source_id, source_path) VALUES (101, 'Source A'), (102, 'Source B')").run();

  // Create event with source_id = 101
  const evt = eventService.createEvent({
    title: "Source 101 Competition",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    sourceId: 101
  });
  eventService.updateEventStatus(evt.id, "ACTIVE");

  // Create user and team
  const team = eventService.createTeam(evt.id, "Alpha Squad");
  const userId = 9991;
  db.prepare("INSERT OR IGNORE INTO users (id, username, reputation) VALUES (?, 'user_9991', 10)").run(userId);

  eventService.joinTeam(evt.id, team.join_code, userId);

  // Test 1: getEventById(evt.id, userId) returns user_team_id
  const loadedEvent = eventService.getEventById(evt.id, userId);
  assert.strictEqual(loadedEvent.user_team_id, team.id);
  const myTeam = loadedEvent.teams.find(t => t.id === team.id);
  assert.strictEqual(myTeam.is_user_member, true);
  console.log("✅ getEventById membership recognition test passed!");

  // Test 2: Create terms in Source 101 and Source 102
  const uri101 = `http://ex.org/term_101_${Date.now()}`;
  const uri102 = `http://ex.org/term_102_${Date.now()}`;
  const term101Id = db.prepare("INSERT INTO terms (uri, source_id) VALUES (?, 101)").run(uri101).lastInsertRowid;
  const term102Id = db.prepare("INSERT INTO terms (uri, source_id) VALUES (?, 102)").run(uri102).lastInsertRowid;

  const tf101Id = db.prepare("INSERT INTO term_fields (term_id, field_uri, original_value) VALUES (?, 'http://ex.org/label', 'test 101')").run(term101Id).lastInsertRowid;
  const tf102Id = db.prepare("INSERT INTO term_fields (term_id, field_uri, original_value) VALUES (?, 'http://ex.org/label', 'test 102')").run(term102Id).lastInsertRowid;


  const tr101 = `tr_101_${Date.now()}`;
  const tr102 = `tr_102_${Date.now()}`;
  db.prepare("INSERT INTO translations (term_field_id, language, value, created_by_id) VALUES (?, 'nl', 'A', ?)").run(tf101Id, userId);
  db.prepare("INSERT INTO translations (term_field_id, language, value, created_by_id) VALUES (?, 'nl', 'B', ?)").run(tf102Id, userId);
  const tr101Id = db.prepare("SELECT id FROM translations WHERE term_field_id = ?").get(tf101Id).id;
  const tr102Id = db.prepare("SELECT id FROM translations WHERE term_field_id = ?").get(tf102Id).id;





  // Record contribution for translation in Source 101 (should count for evt.id)
  const res101 = scoringService.recordEventContribution(userId, tr101Id, 'TRANSLATION_CREATED');
  const evtRes101 = res101.filter(r => r.event_id === evt.id);
  assert.strictEqual(evtRes101.length, 1);
  assert.strictEqual(evtRes101[0].event_id, evt.id);

  // Record contribution for translation in Source 102 (should NOT count for Event with source 101)
  const res102 = scoringService.recordEventContribution(userId, tr102Id, 'TRANSLATION_CREATED');
  const evtRes102 = res102.filter(r => r.event_id === evt.id);
  assert.strictEqual(evtRes102.length, 0);

  eventService.deleteEvent(evt.id);

  console.log("✅ Source-scoped event contribution scoring test passed!");
}

try {
  testMembershipAndSourceScoredPoints();
} catch (err) {
  console.error("FAIL:", err.stack);
  process.exit(1);
}

