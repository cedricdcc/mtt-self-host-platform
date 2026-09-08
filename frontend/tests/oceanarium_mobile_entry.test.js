import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bottomNavPath = path.join(__dirname, '../components/BottomNav.tsx');
const dashboardPath = path.join(__dirname, '../pages/Dashboard.tsx');
const routePath = path.join(__dirname, '../components/OceanariumRoute.tsx');

assert.ok(fs.existsSync(bottomNavPath), 'BottomNav.tsx should exist');
assert.ok(fs.existsSync(dashboardPath), 'Dashboard.tsx should exist');
assert.ok(fs.existsSync(routePath), 'OceanariumRoute.tsx should exist');

const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
const routeContent = fs.readFileSync(routePath, 'utf8');

// 1. BottomNav contains /oceanarium tab
assert.ok(
  bottomNavContent.includes('/oceanarium') && bottomNavContent.includes('Codex'),
  'BottomNav.tsx must contain /oceanarium tab with Codex label'
);

// 2. Dashboard contains mobile Marine Codex card and link to /oceanarium
assert.ok(
  dashboardContent.includes('Marine Codex') && dashboardContent.includes('/oceanarium'),
  'Dashboard.tsx must contain mobile Marine Codex card and link to /oceanarium'
);

// 3. OceanariumRoute allows all authenticated users
assert.ok(
  !routeContent.includes('hasAccess') && routeContent.includes('isAuthenticated'),
  'OceanariumRoute.tsx must permit all authenticated users'
);

console.log('✓ Oceanarium mobile entry & navigation test passed');
