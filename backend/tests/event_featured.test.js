const assert = require("assert");
const { getDatabase, applySchema, isDatabaseInitialized } = require("../src/db/database");
const eventService = require("../src/services/eventService");

function testFeaturedEvent() {
  if (!isDatabaseInitialized()) {
    applySchema();
  }
  const db = getDatabase();
  const evt1 = eventService.createEvent({ title: "Evt 1", startDate: "2026-01-01", endDate: "2026-12-31" });
  const evt2 = eventService.createEvent({ title: "Evt 2", startDate: "2026-01-01", endDate: "2026-12-31" });

  // Set evt1 as featured
  eventService.setFeaturedHomepageEvent(evt1.id);
  let loaded1 = eventService.getEventById(evt1.id);
  assert.strictEqual(loaded1.is_featured_homepage, 1);

  // Set evt2 as featured - evt1 should un-feature
  eventService.setFeaturedHomepageEvent(evt2.id);
  loaded1 = eventService.getEventById(evt1.id);
  let loaded2 = eventService.getEventById(evt2.id);
  assert.strictEqual(loaded1.is_featured_homepage, 0);
  assert.strictEqual(loaded2.is_featured_homepage, 1);

  // Clear featured event (Hide from homepage / set to null)
  const cleared = eventService.setFeaturedHomepageEvent(null);
  assert.strictEqual(cleared, null);
  loaded1 = eventService.getEventById(evt1.id);
  loaded2 = eventService.getEventById(evt2.id);
  assert.strictEqual(loaded1.is_featured_homepage, 0);
  assert.strictEqual(loaded2.is_featured_homepage, 0);

  eventService.deleteEvent(evt1.id);
  eventService.deleteEvent(evt2.id);

  console.log("✅ Featured homepage event test passed!");
}

try {
  testFeaturedEvent();
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
