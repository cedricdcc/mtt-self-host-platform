import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Task 6: Event Detail Analytics TDD test...");

  const detailPath = path.join(__dirname, '../pages/EventDetailPage.tsx');
  const detailContent = fs.readFileSync(detailPath, 'utf8');

  // Verify EventDetailPage includes stats fetching, scope toggle, and chart
  assert.ok(detailContent.includes("fetchEventStats"), "EventDetailPage must call fetchEventStats");
  assert.ok(detailContent.includes("EventActivityChart"), "EventDetailPage must render EventActivityChart");
  assert.ok(detailContent.includes("userOnly") || detailContent.includes("scope"), "EventDetailPage must support user-only toggle");

  const chartPath = path.join(__dirname, '../components/EventActivityChart.tsx');
  assert.ok(fs.existsSync(chartPath), "EventActivityChart.tsx must exist");
  const chartContent = fs.readFileSync(chartPath, 'utf8');
  assert.ok(chartContent.includes("BarChart"), "EventActivityChart must use Recharts BarChart");
  assert.ok(chartContent.includes("inReview"), "EventActivityChart must include inReview bar");
  assert.ok(chartContent.includes("approved"), "EventActivityChart must include approved bar");

  console.log("PASS: Task 6 Event Detail Analytics test passed!");
}

run();
