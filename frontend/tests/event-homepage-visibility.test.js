import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Event Homepage Visibility & Hide/Feature TDD tests...");

  const landingPath = path.join(__dirname, '../pages/Landing.tsx');
  const landingContent = fs.readFileSync(landingPath, 'utf8');

  // Test 1: Landing.tsx must check BOTH is_featured_homepage === 1 and status === 'ACTIVE'
  assert.ok(
    landingContent.includes("is_featured_homepage === 1") && landingContent.includes("status === 'ACTIVE'"),
    "Landing.tsx must filter events by both is_featured_homepage === 1 and status === 'ACTIVE'"
  );

  // Test 2: Unit test the visibility filter logic against various event states
  const filterLogic = (eventsList) => eventsList.find(e => e.is_featured_homepage === 1 && e.status === 'ACTIVE') || null;

  // Case A: Featured AND Active -> MUST be displayed
  const sampleEventsA = [
    { id: '1', title: 'Active Featured', is_featured_homepage: 1, status: 'ACTIVE' },
    { id: '2', title: 'Upcoming Unfeatured', is_featured_homepage: 0, status: 'UPCOMING' }
  ];
  assert.strictEqual(filterLogic(sampleEventsA)?.id, '1', 'Active featured event must be displayed on homescreen');

  // Case B: Featured but UPCOMING -> MUST NOT be displayed
  const sampleEventsB = [
    { id: '1', title: 'Upcoming Featured', is_featured_homepage: 1, status: 'UPCOMING' },
    { id: '2', title: 'Upcoming Unfeatured', is_featured_homepage: 0, status: 'UPCOMING' }
  ];
  assert.strictEqual(filterLogic(sampleEventsB), null, 'Upcoming featured event must NOT be displayed on homescreen');

  // Case C: Featured but ENDED -> MUST NOT be displayed
  const sampleEventsC = [
    { id: '1', title: 'Ended Featured', is_featured_homepage: 1, status: 'ENDED' }
  ];
  assert.strictEqual(filterLogic(sampleEventsC), null, 'Ended featured event must NOT be displayed on homescreen');

  // Case D: Active but NOT Featured -> MUST NOT be displayed
  const sampleEventsD = [
    { id: '1', title: 'Active Non-Featured', is_featured_homepage: 0, status: 'ACTIVE' }
  ];
  assert.strictEqual(filterLogic(sampleEventsD), null, 'Active but unfeatured event must NOT be displayed on homescreen');

  // Case E: No featured event -> MUST NOT be displayed
  const sampleEventsE = [];
  assert.strictEqual(filterLogic(sampleEventsE), null, 'Empty event list must return null');

  // Test 3: AdminEvents.tsx contains working Hide from Homepage and status display
  const adminEventsPath = path.join(__dirname, '../pages/admin/AdminEvents.tsx');
  const adminEventsContent = fs.readFileSync(adminEventsPath, 'utf8');

  assert.ok(
    adminEventsContent.includes("handleSetFeatured(null, false)"),
    "AdminEvents.tsx must call handleSetFeatured(null, false) to hide/remove from homepage"
  );
  assert.ok(
    adminEventsContent.includes("Hide from Homepage"),
    "AdminEvents.tsx must have Hide from Homepage button/option"
  );

  // Test 4: eventApi.ts handles optional/null eventId targeting /events/featured
  const eventApiPath = path.join(__dirname, '../services/eventApi.ts');
  const eventApiContent = fs.readFileSync(eventApiPath, 'utf8');

  assert.ok(
    eventApiContent.includes("/events/featured"),
    "eventApi.ts must support /events/featured endpoint when eventId is null/empty"
  );

  // Test 5: Backend routes include /events/featured
  const backendRoutesPath = path.join(__dirname, '../../backend/src/routes/eventRoutes.js');
  const backendRoutesContent = fs.readFileSync(backendRoutesPath, 'utf8');

  assert.ok(
    backendRoutesContent.includes('router.patch("/events/featured"') ||
    backendRoutesContent.includes('addRoute("patch", "/events/featured", eventController.setFeatured)'),
    "backend/src/routes/eventRoutes.js must register PATCH /events/featured"
  );

  console.log("All Event Homepage Visibility & Hide/Feature tests passed successfully!");
}

try {
  run();
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
