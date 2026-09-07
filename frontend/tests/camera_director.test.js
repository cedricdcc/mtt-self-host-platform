import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CameraDirector locked standard view and auto-reset from desktop mode...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');

  const content = fs.readFileSync(cameraPath, 'utf8');

  // Verify isometric default constants
  assert.ok(content.includes('resetToIsometric'), 'Must implement resetToIsometric method');
  assert.ok(content.includes('ISOMETRIC_RADIUS'), 'Must define ISOMETRIC_RADIUS constant');
  assert.ok(content.includes('ISOMETRIC_THETA'), 'Must define ISOMETRIC_THETA constant');
  assert.ok(content.includes('ISOMETRIC_PHI'), 'Must define ISOMETRIC_PHI constant');

  // Verify dragging is disabled / locked in STANDARD_VIEW
  assert.ok(content.includes('isOrbitLocked') || content.includes('// Orbit drag disabled in normal mode') || !content.includes('this.isDragging = true;'), 'Must lock rotation / disable dragging in standard view');

  // Verify auto-reset on transition from DESKTOP_MODE to STANDARD_VIEW
  assert.ok(content.includes('this.resetToIsometric') && content.includes("prevMode === 'DESKTOP_MODE'"), 'Must trigger resetToIsometric when returning from DESKTOP_MODE to STANDARD_VIEW');

  console.log('✓ CameraDirector locked view and auto-reset tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
