import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CameraDirector & ThreeGameDirector structural invariants...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  const directorPath = path.join(__dirname, '../components/oceanarium/engine/ThreeGameDirector.ts');

  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');
  assert.ok(fs.existsSync(directorPath), 'ThreeGameDirector.ts must exist');

  // Verify CameraDirector
  const cameraContent = fs.readFileSync(cameraPath, 'utf8');
  assert.ok(cameraContent.includes('export class CameraDirector'), 'Must export CameraDirector');
  assert.ok(cameraContent.includes('updateStandardCamera'), 'Must support standard orbit/pan camera');
  assert.ok(cameraContent.includes('updateDesktopCamera') || cameraContent.includes('updateSubmarineChase'), 'Must support 3rd person submarine chase camera');
  assert.ok(cameraContent.includes('snapToDepth'), 'Must support snapping to depth strata');

  // Verify ThreeGameDirector
  const directorContent = fs.readFileSync(directorPath, 'utf8');
  assert.ok(directorContent.includes('export class ThreeGameDirector'), 'Must export ThreeGameDirector');
  assert.ok(directorContent.includes('setMode'), 'Must implement setMode');
  assert.ok(directorContent.includes('STANDARD_VIEW') && directorContent.includes('DESKTOP_MODE'), 'Must support standard and desktop modes');
  assert.ok(directorContent.includes('syncFishes'), 'Must implement syncFishes');
  assert.ok(directorContent.includes('feed'), 'Must implement 3D feed method');
  assert.ok(directorContent.includes('dispose'), 'Must implement dispose method for resource cleanup');
  assert.ok(directorContent.includes('foliageSystem'), 'Must instantiate FoliageSystem');
  assert.ok(directorContent.includes('bubbleSystem'), 'Must instantiate BubbleSystem');
  assert.ok(directorContent.includes('resetCameraView'), 'Must expose resetCameraView method');
  assert.ok(directorContent.includes('emitFishMouthPuff'), 'Must emit bubble puffs on feeding');

  console.log('✓ CameraDirector & ThreeGameDirector invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
