import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const termDetailPath = path.join(__dirname, '../pages/TermDetail.tsx');
const layoutPath = path.join(__dirname, '../components/Layout.tsx');
const dashboardPath = path.join(__dirname, '../pages/Dashboard.tsx');

assert.ok(fs.existsSync(termDetailPath), 'TermDetail.tsx should exist');
assert.ok(fs.existsSync(layoutPath), 'Layout.tsx should exist');
assert.ok(fs.existsSync(dashboardPath), 'Dashboard.tsx should exist');

const termDetailContent = fs.readFileSync(termDetailPath, 'utf8');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// Check TermDetail has truncate and max-w bounds for term.uri
assert.ok(
  termDetailContent.includes('truncate') && termDetailContent.includes('max-w-'),
  'TermDetail.tsx must contain truncate and max-w bounds for term.uri'
);

// Check Layout root has overflow-x-hidden
assert.ok(
  layoutContent.includes('overflow-x-hidden'),
  'Layout.tsx must contain overflow-x-hidden on outer container'
);

// Check Dashboard discussions & drafts truncate term label/URI
assert.ok(
  dashboardContent.includes('truncate') && dashboardContent.includes('min-w-0'),
  'Dashboard.tsx must contain truncate and min-w-0 for preventing layout blowout'
);

console.log('✓ Term URI overflow and layout containment test passed');
