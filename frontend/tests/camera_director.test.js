import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadTsModule(tsFilePath) {
  const source = fs.readFileSync(tsFilePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  });
  const threeUrl = pathToFileURL(path.join(__dirname, '../node_modules/three/build/three.module.js')).href;
  const codeWithResolvedThree = transpiled.outputText.replace(
    /from\s+['"]three['"]/g,
    `from '${threeUrl}'`
  );
  const dataUrl = `data:text/javascript;base64,${Buffer.from(codeWithResolvedThree, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

async function run() {
  console.log('Testing CameraDirector 360 orbit, wheel zoom, pan, front/iso presets, and orbiting follow-cam...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');

  const content = fs.readFileSync(cameraPath, 'utf8');

  // Verify isometric default constants & methods
  assert.ok(content.includes('resetToIsometric'), 'Must implement resetToIsometric method');
  assert.ok(content.includes('snapToFrontView'), 'Must implement snapToFrontView method');
  assert.ok(content.includes('onWheel'), 'Must implement onWheel method');
  assert.ok(content.includes('onPointerDown'), 'Must implement onPointerDown method');
  assert.ok(content.includes('onPointerMove'), 'Must implement onPointerMove method');
  assert.ok(content.includes('onPointerUp'), 'Must implement onPointerUp method');
  assert.ok(content.includes('isPanning'), 'Must track isPanning state');
  assert.ok(content.includes('ISOMETRIC_RADIUS'), 'Must define ISOMETRIC_RADIUS constant');
  assert.ok(content.includes('ISOMETRIC_THETA'), 'Must define ISOMETRIC_THETA constant');
  assert.ok(content.includes('ISOMETRIC_PHI'), 'Must define ISOMETRIC_PHI constant');

  // Verify auto-reset on transition from DESKTOP_MODE to STANDARD_VIEW
  assert.ok(
    content.includes('this.resetToIsometric') && content.includes("prevMode === 'DESKTOP_MODE'"),
    'Must trigger resetToIsometric when returning from DESKTOP_MODE to STANDARD_VIEW'
  );

  // Verify orbiting follow-cam uses spherical offset around inspectingTarget
  assert.ok(
    content.includes('setFromSpherical(this.spherical)'),
    'Must compute camera offset from this.spherical in updateInspectingCamera'
  );

  // Runtime behavioral verification
  const { CameraDirector, ISOMETRIC_RADIUS, ISOMETRIC_PHI, ISOMETRIC_THETA } = await loadTsModule(cameraPath);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 300);
  const director = new CameraDirector(camera);

  assert.strictEqual(typeof director.snapToFrontView, 'function', 'snapToFrontView must be a function');
  assert.strictEqual(typeof director.onWheel, 'function', 'onWheel must be a function');

  // 1. Test 360 orbit drag updates spherical.theta and spherical.phi
  const initialTheta = director.spherical.theta;
  const initialPhi = director.spherical.phi;
  director.onPointerDown(100, 100, false);
  assert.strictEqual(director.isDragging, true, 'onPointerDown must set isDragging = true');
  assert.strictEqual(director.isPanning, false, 'onPointerDown(x, y, false) must set isPanning = false');

  director.onPointerMove(150, 130);
  assert.ok(
    Math.abs(director.spherical.theta - (initialTheta - 50 * 0.007)) < 1e-6,
    'Orbit drag must update spherical.theta by -dx * 0.007'
  );
  assert.ok(
    Math.abs(director.spherical.phi - (initialPhi - 30 * 0.007)) < 1e-6,
    'Orbit drag must update spherical.phi by -dy * 0.007'
  );

  // Verify phi clamping [0.2, Math.PI - 0.2]
  director.onPointerMove(150, 5000);
  assert.strictEqual(director.spherical.phi, 0.2, 'spherical.phi must clamp to minimum 0.2');
  director.onPointerMove(150, -5000);
  assert.strictEqual(director.spherical.phi, Math.PI - 0.2, 'spherical.phi must clamp to maximum Math.PI - 0.2');

  director.onPointerUp();
  assert.strictEqual(director.isDragging, false, 'onPointerUp must set isDragging = false');

  // 2. Test panning updates centerOffset.x and centerOffset.y with clamping
  director.centerOffset.set(0, 0, 0);
  director.onPointerDown(200, 200, true);
  assert.strictEqual(director.isPanning, true, 'onPointerDown(x, y, true) must set isPanning = true');
  director.onPointerMove(250, 240);
  assert.ok(
    Math.abs(director.centerOffset.x - -50 * 0.06) < 1e-6,
    'Panning must shift centerOffset.x by -dx * 0.06'
  );
  assert.ok(
    Math.abs(director.centerOffset.y - 40 * 0.06) < 1e-6,
    'Panning must shift centerOffset.y by dy * 0.06'
  );
  director.onPointerMove(5000, 5000);
  assert.strictEqual(director.centerOffset.x, -16, 'centerOffset.x must clamp to [-16, 16]');
  assert.strictEqual(director.centerOffset.y, 18, 'centerOffset.y must clamp to [-18, 18]');
  director.onPointerUp();

  // 3. Test wheel zoom in STANDARD_VIEW clamps to [12.0, 82.0]
  director.spherical.radius = 40;
  director.onWheel(-200); // -200 * 0.025 = -5 -> 35
  assert.strictEqual(director.spherical.radius, 35, 'onWheel must adjust spherical.radius by deltaY * 0.025');
  director.onWheel(-5000);
  assert.strictEqual(director.spherical.radius, 12.0, 'STANDARD_VIEW radius must clamp to min 12.0');
  director.onWheel(10000);
  assert.strictEqual(director.spherical.radius, 82.0, 'STANDARD_VIEW radius must clamp to max 82.0');

  // 4. Test snapToFrontView(0.9) smoothly transitions to (radius: 48, phi: Math.PI / 2, theta: 0) and centerOffset (0, 0, 0)
  director.snapToFrontView(0.9);
  assert.strictEqual(director.getMode(), 'STANDARD_VIEW', 'snapToFrontView must set mode to STANDARD_VIEW');
  director.updateStandardCamera(0.9);
  assert.ok(Math.abs(director.spherical.radius - 48) < 1e-5, `snapToFrontView radius must reach 48, got ${director.spherical.radius}`);
  assert.ok(Math.abs(director.spherical.phi - Math.PI / 2) < 1e-5, `snapToFrontView phi must reach Math.PI / 2, got ${director.spherical.phi}`);
  assert.ok(Math.abs(director.spherical.theta - 0) < 1e-5, `snapToFrontView theta must reach 0, got ${director.spherical.theta}`);
  assert.ok(director.centerOffset.length() < 1e-5, 'snapToFrontView centerOffset must reach (0, 0, 0)');

  // 5. Test resetToIsometric(1.0) smoothly transitions back to isometric constants
  director.resetToIsometric(1.0);
  director.updateStandardCamera(1.0);
  assert.ok(Math.abs(director.spherical.radius - ISOMETRIC_RADIUS) < 1e-5, 'resetToIsometric must restore ISOMETRIC_RADIUS');
  assert.ok(Math.abs(director.spherical.phi - ISOMETRIC_PHI) < 1e-5, 'resetToIsometric must restore ISOMETRIC_PHI');
  assert.ok(Math.abs(director.spherical.theta - ISOMETRIC_THETA) < 1e-5, 'resetToIsometric must restore ISOMETRIC_THETA');

  // 6. Test INSPECTING_FISH mode: initial macro spherical (12.0, Math.PI / 2.2, Math.PI / 6), orbiting, zooming, and tracking moving fish
  const fishMesh = new THREE.Object3D();
  fishMesh.position.set(5, 8, -3);
  director.inspectFish(fishMesh);
  assert.strictEqual(director.getMode(), 'INSPECTING_FISH', 'inspectFish must set mode to INSPECTING_FISH');
  assert.ok(Math.abs(director.spherical.radius - 12.0) < 1e-5, 'inspectFish must initialize radius to 12.0 when entering INSPECTING_FISH');
  assert.ok(Math.abs(director.spherical.phi - Math.PI / 2.2) < 1e-5, 'inspectFish must initialize phi to Math.PI / 2.2');
  assert.ok(Math.abs(director.spherical.theta - Math.PI / 6) < 1e-5, 'inspectFish must initialize theta to Math.PI / 6');

  // Orbiting and zooming around inspected fish
  director.onPointerDown(100, 100, false);
  director.onPointerMove(140, 120);
  director.onPointerUp();
  const orbitedTheta = director.spherical.theta;
  assert.notStrictEqual(orbitedTheta, Math.PI / 6, 'User must be able to orbit around inspected fish');

  director.onWheel(-5000);
  assert.strictEqual(director.spherical.radius, 5.5, 'INSPECTING_FISH radius must clamp to min 5.5');
  director.onWheel(5000);
  assert.strictEqual(director.spherical.radius, 24.0, 'INSPECTING_FISH radius must clamp to max 24.0');

  // Calling inspectFish again while already in INSPECTING_FISH should preserve current spherical orbit
  director.spherical.radius = 10.0;
  director.inspectFish(fishMesh);
  assert.strictEqual(director.spherical.radius, 10.0, 'Re-calling inspectFish while already in INSPECTING_FISH must preserve spherical radius');
  assert.strictEqual(director.spherical.theta, orbitedTheta, 'Re-calling inspectFish while already in INSPECTING_FISH must preserve spherical theta');

  // Verify updateInspectingCamera positions camera at fishPos + spherical offset
  const expectedOffset = new THREE.Vector3().setFromSpherical(director.spherical);
  const expectedTargetPos = fishMesh.position.clone().add(expectedOffset);
  for (let i = 0; i < 100; i++) {
    director.update(0.016, null, null);
  }
  assert.ok(
    camera.position.distanceTo(expectedTargetPos) < 0.05,
    `Inspecting camera must converge to fishPos + spherical offset, dist=${camera.position.distanceTo(expectedTargetPos)}`
  );
  assert.ok(
    director.currentLookAt.distanceTo(fishMesh.position) < 0.05,
    'Inspecting camera currentLookAt must converge to fishMesh.position'
  );

  console.log('✓ CameraDirector 360 orbit, zoom, pan, front view preset, and orbiting follow-cam tests PASSED!');
}

run().catch((err) => {
  console.error('Test Failure:', err.message);
  process.exit(1);
});
