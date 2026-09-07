import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing Admin Fish Grants & Species 3D Model Catalog UI...');

  const modalPath = path.join(__dirname, '../components/admin/GrantFishModal.tsx');
  const drawerPath = path.join(__dirname, '../components/admin/AdminTankDrawer.tsx');
  const gachaPagePath = path.join(__dirname, '../pages/admin/AdminGacha.tsx');

  assert.ok(fs.existsSync(modalPath), 'GrantFishModal.tsx component must exist');
  assert.ok(fs.existsSync(drawerPath), 'AdminTankDrawer.tsx component must exist');
  assert.ok(fs.existsSync(gachaPagePath), 'AdminGacha.tsx page must exist');

  const modalSrc = fs.readFileSync(modalPath, 'utf8');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');
  const gachaSrc = fs.readFileSync(gachaPagePath, 'utf8');

  // 1. Modal asserts
  assert.ok(modalSrc.includes('GrantFishModal'), 'Must declare GrantFishModal component');
  assert.ok(modalSrc.includes('is_shiny') || modalSrc.includes('isShiny'), 'Must feature Shiny specimen toggle');
  assert.ok(modalSrc.includes('species_id') || modalSrc.includes('selectedSpecies'), 'Must feature species selector');
  assert.ok(modalSrc.includes('/admin/gacha/users/') && modalSrc.includes('/grant-fish'), 'Must post to grant-fish endpoint');

  // 2. Tank Drawer asserts
  assert.ok(drawerSrc.includes('GrantFishModal'), 'AdminTankDrawer must import GrantFishModal');
  assert.ok(drawerSrc.includes('Grant Specimen') || drawerSrc.includes('Grant Fish'), 'AdminTankDrawer must feature Grant Specimen button');

  // 3. AdminGacha Page asserts
  assert.ok(gachaSrc.includes('GrantFishModal'), 'AdminGacha must integrate GrantFishModal');
  assert.ok(
    gachaSrc.includes('Species & 3D Models') || gachaSrc.includes('Species Catalog') || gachaSrc.includes('activeTab'),
    'AdminGacha must feature tab for Species & 3D Models catalog'
  );

  console.log('✓ All Admin Fish Grants & Species Catalog UI tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
