import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drawerPath = path.join(__dirname, '../components/admin/AdminTankDrawer.tsx');
const adminGachaPath = path.join(__dirname, '../pages/admin/AdminGacha.tsx');

assert.ok(fs.existsSync(drawerPath), 'AdminTankDrawer.tsx must exist');
const drawerContent = fs.readFileSync(drawerPath, 'utf8');

assert.ok(drawerContent.includes('reset-tank'), 'Drawer must include reset-tank API call');
assert.ok(drawerContent.includes('delete_fishes'), 'Drawer must support delete_fishes option');
assert.ok(drawerContent.includes('reset_water'), 'Drawer must support reset_water option');
assert.ok(drawerContent.includes('reset_pity'), 'Drawer must support reset_pity option');
assert.ok(drawerContent.includes('reset_food'), 'Drawer must support reset_food option');

const pageContent = fs.readFileSync(adminGachaPath, 'utf8');
assert.ok(pageContent.includes('AdminTankDrawer'), 'AdminGacha must embed AdminTankDrawer');
assert.ok(pageContent.includes('Manage Tank') || pageContent.includes('manage-tank'), 'AdminGacha must have Manage Tank trigger');

console.log('✓ Admin tank drawer integration test passed');
