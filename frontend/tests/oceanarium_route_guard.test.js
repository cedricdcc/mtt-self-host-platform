import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const oceanariumRoutePath = path.join(__dirname, '../components/OceanariumRoute.tsx');
assert.ok(fs.existsSync(oceanariumRoutePath), 'OceanariumRoute.tsx should exist');

const content = fs.readFileSync(oceanariumRoutePath, 'utf8');
assert.ok(content.includes('hasGachaAccess'), 'Should check hasGachaAccess');
assert.ok(content.includes('isAdmin'), 'Should check isAdmin');
assert.ok(content.includes('isSuperAdmin'), 'Should check isSuperAdmin');

console.log('✓ OceanariumRoute guard test passed');
