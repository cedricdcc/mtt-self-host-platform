import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing SceneEnvironment vivarium diorama and azure palette...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');

  const content = fs.readFileSync(envPath, 'utf8');

  // Verify vivarium glass frame & dimensions
  assert.ok(content.includes('initVivariumFrame'), 'Must implement initVivariumFrame method');
  assert.ok(content.includes('48') && content.includes('40') && content.includes('32'), 'Must create 48x40x32 vivarium bounds');
  assert.ok(content.includes('LineSegments'), 'Must create glowing cyan edge wireframe');
  assert.ok(content.includes('sandFloor'), 'Must add sandy ocean floor bed');
  assert.ok(content.includes('waterSurface'), 'Must add translucent water surface ceiling');

  // Verify tropical azure lighting palette
  assert.ok(content.includes('0x0284c7') || content.includes('0x38bdf8'), 'Must use vibrant cyan/azure lighting');

  console.log('✓ SceneEnvironment tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
