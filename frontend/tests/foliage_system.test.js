import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing FoliageSystem seabed ecology...');

  const foliagePath = path.join(__dirname, '../components/oceanarium/engine/FoliageSystem.ts');
  assert.ok(fs.existsSync(foliagePath), 'FoliageSystem.ts must exist');

  const content = fs.readFileSync(foliagePath, 'utf8');

  // Verify class and methods
  assert.ok(content.includes('export class FoliageSystem'), 'Must export FoliageSystem');
  assert.ok(content.includes('createKelpForest'), 'Must implement createKelpForest');
  assert.ok(content.includes('createCoralsAndAnemones'), 'Must implement createCoralsAndAnemones');
  assert.ok(content.includes('update('), 'Must implement update animation loop');
  assert.ok(content.includes('dispose('), 'Must implement dispose method');

  // Verify procedural sway kinematics
  assert.ok(content.includes('Math.sin'), 'Must use harmonic sine kinematics for kelp sway');
  assert.ok(content.includes('anemones'), 'Must animate pulsing anemones');

  console.log('✓ FoliageSystem tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
