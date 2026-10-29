import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Task 5: Admin Events hasTeams TDD test...");

  const adminPath = path.join(__dirname, '../pages/admin/AdminEvents.tsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');

  // Verify AdminEvents contains hasTeams state and toggle UI
  assert.ok(adminContent.includes("hasTeams"), "AdminEvents must manage hasTeams state");
  assert.ok(adminContent.includes("Individual Challenge") || adminContent.includes("No Teams"), "AdminEvents must provide Individual Challenge option");

  const typesPath = path.join(__dirname, '../types.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  assert.ok(typesContent.includes("has_teams"), "types.ts Event interface must include has_teams");
  assert.ok(typesContent.includes("EventStatsResponse"), "types.ts must include EventStatsResponse");

  const apiPath = path.join(__dirname, '../services/eventApi.ts');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  assert.ok(apiContent.includes("fetchEventStats"), "eventApi.ts must export fetchEventStats");
  assert.ok(apiContent.includes("hasTeams"), "eventApi.ts createEvent must accept hasTeams");

  console.log("PASS: Task 5 Admin Events hasTeams test passed!");
}

run();
