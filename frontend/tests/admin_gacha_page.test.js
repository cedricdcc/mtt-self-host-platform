import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const adminGachaPath = path.join(__dirname, '../pages/admin/AdminGacha.tsx');
assert.ok(fs.existsSync(adminGachaPath), 'AdminGacha.tsx should exist');

const content = fs.readFileSync(adminGachaPath, 'utf8');
assert.ok(content.includes('/admin/gacha/users'), 'Should call admin gacha users endpoint');
assert.ok(content.includes('grant-resources'), 'Should support grant-resources API');
assert.ok(content.includes('has_access'), 'Should support toggling access');

const adminDashboardPath = path.join(__dirname, '../pages/AdminDashboard.tsx');
const dashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
assert.ok(dashboardContent.includes('/admin/gacha'), 'AdminDashboard should link to /admin/gacha');

console.log('✓ Admin Gacha Page & Dashboard Link test passed');
