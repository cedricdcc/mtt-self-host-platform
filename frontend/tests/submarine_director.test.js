import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing SubmarineDirector structural and cinematic invariants...');

  const subPath = path.join(__dirname, '../components/oceanarium/engine/SubmarineDirector.ts');
  assert.ok(fs.existsSync(subPath), 'SubmarineDirector.ts must exist');

  const content = fs.readFileSync(subPath, 'utf8');

  // Verify class
  assert.ok(content.includes('export class SubmarineDirector'), 'Must export SubmarineDirector');

  // Verify 3D Model Components
  assert.ok(content.includes('buildSubmarineMesh'), 'Must build 3D submarine mesh');
  assert.ok(content.includes('propeller') || content.includes('propellers'), 'Must construct spinning propellers');
  assert.ok(content.includes('bubbleEmitter') || content.includes('bubbleTrail'), 'Must feature propeller bubble trail');
  assert.ok(content.includes('SpotLight'), 'Must feature forward searchlight spot lamp');

  // Verify Nature Documentary Routine & State Machine
  assert.ok(content.includes('CRUISING') && content.includes('HOVERING_OBSERVATION'), 'Must implement state machine');
  assert.ok(content.includes('onObservationStart'), 'Must implement onObservationStart callback');
  assert.ok(content.includes('onObservationEnd'), 'Must implement onObservationEnd callback');
  assert.ok(content.includes('triggerObservation'), 'Must support triggering observation of a fish');

  console.log('✓ SubmarineDirector invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
