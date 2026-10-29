const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { ensureEventsTable } = require("../src/services/eventService");

function runTest() {
  console.log("Running Task 1: Event has_teams schema test...");
  ensureEventsTable();
  const db = getDatabase();

  // 1. Verify has_teams column in events table
  const eventCols = db.prepare("PRAGMA table_info(events)").all().map(c => c.name);
  assert.ok(eventCols.includes("has_teams"), "events table must have has_teams column");

  // 2. Verify event_contributions allows NULL team_id
  const contribTable = db.prepare("PRAGMA table_info(event_contributions)").all();
  const teamIdCol = contribTable.find(c => c.name === "team_id");
  assert.ok(teamIdCol, "event_contributions must have team_id column");
  assert.strictEqual(teamIdCol.notnull, 0, "event_contributions.team_id must allow NULL");

  console.log("PASS: Task 1 schema test passed!");
}

runTest();
