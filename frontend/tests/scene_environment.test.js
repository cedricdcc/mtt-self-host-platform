import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing SceneEnvironment 1:1:1 true cube vivarium, brackets, and pedestal...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');

  const content = fs.readFileSync(envPath, 'utf8');

  // Verify true cube dimensions (40x40x40)
  assert.ok(content.includes('40, 40, 40') || (content.includes('40') && content.includes('CUBE_SIZE')), 'Must create 40x40x40 true cube vivarium bounds');
  assert.ok(content.includes('pedestal') || content.includes('Pedestal'), 'Must create diorama pedestal base');
  assert.ok(content.includes('bracket') || content.includes('Bracket'), 'Must create corner brackets');
  assert.ok(content.includes('depthTicks') || content.includes('DepthTick') || content.includes('tickMesh'), 'Must create etched depth tick marks on vertical pillars');
  assert.ok(content.includes('glassPanels') || content.includes('GlassPanel') || content.includes('acrylic') || content.includes('glassMaterial'), 'Must create translucent acrylic glass faces');

  console.log('✓ SceneEnvironment 1:1:1 true cube vivarium tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
