import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing Oceanarium pufferfish widget suppression...');

  const layoutPath = path.join(__dirname, '../components/Layout.tsx');
  const widgetPath = path.join(__dirname, '../components/CommunityGoalWidget.tsx');

  assert.ok(fs.existsSync(layoutPath), 'Layout.tsx must exist');
  assert.ok(fs.existsSync(widgetPath), 'CommunityGoalWidget.tsx must exist');

  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  const widgetSource = fs.readFileSync(widgetPath, 'utf8');

  // 1. Layout checks location.pathname before rendering CommunityGoalWidget
  assert.ok(
    layoutSource.includes("!location.pathname.startsWith('/oceanarium')") ||
    layoutSource.includes("location.pathname !== '/oceanarium'"),
    "Layout.tsx must conditionally exclude CommunityGoalWidget on oceanarium routes"
  );

  // 2. CommunityGoalWidget has early return guard for /oceanarium
  assert.ok(
    widgetSource.includes("location.pathname.startsWith('/oceanarium')"),
    "CommunityGoalWidget.tsx must include guard for /oceanarium route"
  );

  console.log('✓ Oceanarium pufferfish suppression tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
