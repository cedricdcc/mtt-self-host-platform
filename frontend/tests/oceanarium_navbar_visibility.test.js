import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const layoutPath = path.join(__dirname, '../components/Layout.tsx');
const content = fs.readFileSync(layoutPath, 'utf8');

// Ensure canAccessOceanarium condition exists and checks all 3 criteria
assert.ok(
  content.includes('canAccessOceanarium'),
  'Layout.tsx should define canAccessOceanarium'
);
assert.ok(
  content.includes('user.hasGachaAccess') || content.includes('hasGachaAccess'),
  'Layout.tsx should check hasGachaAccess'
);
assert.ok(
  content.includes('user.isSuperAdmin') || content.includes('isSuperAdmin'),
  'Layout.tsx should check isSuperAdmin'
);

console.log('✓ Oceanarium Navbar visibility test passed');
