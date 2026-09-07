import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CameraDirector isometric default and resetToIsometric...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');

  const content = fs.readFileSync(cameraPath, 'utf8');

  // Verify isometric default constants
  assert.ok(content.includes('resetToIsometric'), 'Must implement resetToIsometric method');
  assert.ok(content.includes('ISOMETRIC_RADIUS'), 'Must define ISOMETRIC_RADIUS constant');
  assert.ok(content.includes('ISOMETRIC_THETA'), 'Must define ISOMETRIC_THETA constant');
  assert.ok(content.includes('ISOMETRIC_PHI'), 'Must define ISOMETRIC_PHI constant');

  console.log('✓ CameraDirector tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
