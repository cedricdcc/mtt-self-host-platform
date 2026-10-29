import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Task 7: Conditional Leaderboard TDD test...");

  const detailPath = path.join(__dirname, '../pages/EventDetailPage.tsx');
  const detailContent = fs.readFileSync(detailPath, 'utf8');

  // Verify EventDetailPage checks has_teams for conditional leaderboard
  assert.ok(detailContent.includes("has_teams === 0") || detailContent.includes("!event.has_teams"), "EventDetailPage must conditionally render based on has_teams");
  assert.ok(detailContent.includes("EventIndividualLeaderboard"), "EventDetailPage must render EventIndividualLeaderboard");

  const indPath = path.join(__dirname, '../components/EventIndividualLeaderboard.tsx');
  assert.ok(fs.existsSync(indPath), "EventIndividualLeaderboard.tsx must exist");
  const indContent = fs.readFileSync(indPath, 'utf8');
  assert.ok(indContent.includes("Individual Leaderboard") || indContent.includes("Top Contributors"), "Must have leaderboard title");

  console.log("PASS: Task 7 Conditional Leaderboard test passed!");
}

run();
