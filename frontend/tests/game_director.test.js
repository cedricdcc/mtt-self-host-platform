import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadDirectorModule(tsFilePath) {
  const source = fs.readFileSync(tsFilePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  });
  const threeUrl = pathToFileURL(path.join(__dirname, '../node_modules/three/build/three.module.js')).href;
  const code = transpiled.outputText
    .replace(/from\s+['"]three['"]/g, `from '${threeUrl}'`)
    // Strip relative runtime imports so we can test ThreeGameDirector prototype methods directly in Node
    .replace(/import\s+\{[^}]+\}\s+from\s+['"]\.\/[^'"]+['"];?/g, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

async function run() {
  console.log('Testing CameraDirector & ThreeGameDirector structural invariants, 3D reticle, selection, and boop...');

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
  assert.ok(cameraContent.includes('snapToFrontView'), 'CameraDirector must implement snapToFrontView');
  assert.ok(cameraContent.includes('onWheel'), 'CameraDirector must implement onWheel');

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
  assert.ok(directorContent.includes('emitFishMouthPuff'), 'Must emit bubble puffs on feeding and booping');

  // Verify 3D in-scene focus reticle
  assert.ok(directorContent.includes('attachReticle') || directorContent.includes('selectionReticle'), 'Must implement 3D selection reticle');
  assert.ok(directorContent.includes('detachReticle'), 'Must implement reticle detachment');

  // Verify new Task 4 methods on ThreeGameDirector
  assert.ok(directorContent.includes('snapToFrontView'), 'ThreeGameDirector must implement snapToFrontView');
  assert.ok(directorContent.includes('handleWheel'), 'ThreeGameDirector must implement handleWheel');
  assert.ok(directorContent.includes('selectFishById'), 'ThreeGameDirector must implement selectFishById');
  assert.ok(directorContent.includes('boopFish'), 'ThreeGameDirector must implement boopFish');
  assert.ok(directorContent.includes('triggerReaction'), 'ThreeGameDirector.boopFish must call boidsSystem.triggerReaction');

  // Runtime behavioral verification of ThreeGameDirector methods
  const { ThreeGameDirector } = await loadDirectorModule(directorPath);
  assert.strictEqual(typeof ThreeGameDirector.prototype.snapToFrontView, 'function', 'snapToFrontView must be a method on ThreeGameDirector');
  assert.strictEqual(typeof ThreeGameDirector.prototype.handleWheel, 'function', 'handleWheel must be a method on ThreeGameDirector');
  assert.strictEqual(typeof ThreeGameDirector.prototype.selectFishById, 'function', 'selectFishById must be a method on ThreeGameDirector');
  assert.strictEqual(typeof ThreeGameDirector.prototype.boopFish, 'function', 'boopFish must be a method on ThreeGameDirector');

  // Create lightweight harness bound to ThreeGameDirector.prototype
  const rawFish1 = { user_fish_id: 42, species_id: 'spotted_pufferfish', name: 'Puffy', depth_zone: 'sunlit' };
  const mesh1 = new THREE.Group();
  mesh1.position.set(3, 10, -2);
  mesh1.userData.rawFish = rawFish1;

  let frontSnapDuration = null;
  let lastWheelDelta = null;
  let inspectedMesh = null;
  let selectedCallbackFish = null;
  let triggeredReactionId = null;
  let emittedBubbleArgs = null;
  let lastPointerDownArgs = null;

  const mockDirector = Object.create(ThreeGameDirector.prototype);
  mockDirector.selectionReticle = new THREE.Group();
  mockDirector.reticleTarget = null;
  mockDirector.callbacks = {
    onFishSelected: (f) => {
      selectedCallbackFish = f;
    }
  };
  mockDirector.cameraDirector = {
    snapToFrontView: (dur) => {
      frontSnapDuration = dur;
    },
    onWheel: (deltaY) => {
      lastWheelDelta = deltaY;
    },
    inspectFish: (m) => {
      inspectedMesh = m;
    },
    onPointerDown: (x, y, isPan) => {
      lastPointerDownArgs = { x, y, isPan };
    }
  };
  mockDirector.boidsSystem = {
    getAllFishes: () => [{ id: 42, mesh: mesh1 }],
    triggerReaction: (id) => {
      if (id === 42) {
        triggeredReactionId = id;
        return true;
      }
      return false;
    }
  };
  mockDirector.bubbleSystem = {
    emitFishMouthPuff: (pos, count) => {
      emittedBubbleArgs = { pos: pos.clone(), count };
    }
  };

  // 1. Test selectFishById
  const selected = mockDirector.selectFishById(42);
  assert.strictEqual(selected, rawFish1, 'selectFishById must return rawFish for matching userFishId');
  assert.strictEqual(mockDirector.reticleTarget, mesh1, 'selectFishById must attach reticle to fish mesh');
  assert.strictEqual(inspectedMesh, mesh1, 'selectFishById must call cameraDirector.inspectFish(boid.mesh)');
  assert.strictEqual(selectedCallbackFish, rawFish1, 'selectFishById must invoke callbacks.onFishSelected');
  assert.strictEqual(mockDirector.selectFishById(999), null, 'selectFishById must return null for unknown fish id');

  // 2. Test boopFish
  const booped = mockDirector.boopFish(42);
  assert.strictEqual(booped, true, 'boopFish must return true when fish is found and triggered');
  assert.strictEqual(triggeredReactionId, 42, 'boopFish must call boidsSystem.triggerReaction(userFishId)');
  assert.ok(emittedBubbleArgs && emittedBubbleArgs.count === 6, 'boopFish must emit 6 celebratory mouth bubbles');
  assert.strictEqual(mockDirector.boopFish(999), false, 'boopFish must return false for unknown fish id');

  // 3. Test snapToFrontView
  mockDirector.snapToFrontView();
  assert.strictEqual(mockDirector.reticleTarget, null, 'snapToFrontView must detach reticle');
  assert.strictEqual(frontSnapDuration, 0.9, 'snapToFrontView must call cameraDirector.snapToFrontView(0.9)');

  // 4. Test handleWheel
  mockDirector.handleWheel(120);
  assert.strictEqual(lastWheelDelta, 120, 'handleWheel must delegate deltaY to cameraDirector.onWheel');

  // 5. Test handlePointerDown: pan flag delegation when no fish hit, and boop when clicking already-selected fish
  mockDirector.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 300);
  mockDirector.mouseVec = new THREE.Vector2();
  mockDirector.raycaster = {
    setFromCamera: () => {},
    intersectObjects: () => []
  };
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  const hitEmpty = mockDirector.handlePointerDown(400, 300, rect, true);
  assert.strictEqual(hitEmpty, false, 'handlePointerDown must return false when no fish is hit');
  assert.deepStrictEqual(
    lastPointerDownArgs,
    { x: 400, y: 300, isPan: true },
    'handlePointerDown must pass isPan to cameraDirector.onPointerDown'
  );

  // Now simulate hitting mesh1 twice: first click selects, second click on already-selected fish also boops
  triggeredReactionId = null;
  mockDirector.raycaster.intersectObjects = () => [{ object: mesh1 }];
  const hitFirst = mockDirector.handlePointerDown(400, 300, rect, false);
  assert.strictEqual(hitFirst, true, 'First click on fish must return true');
  assert.strictEqual(mockDirector.reticleTarget, mesh1, 'First click must select fish and attach reticle');
  assert.strictEqual(triggeredReactionId, null, 'First click on unselected fish should select without booping');

  const hitSecond = mockDirector.handlePointerDown(400, 300, rect, false);
  assert.strictEqual(hitSecond, true, 'Second click on already-selected fish must return true');
  assert.strictEqual(triggeredReactionId, 42, 'Clicking an already-selected fish must trigger boopFish');

  console.log('✓ CameraDirector & ThreeGameDirector invariants PASSED!');
}

run().catch((err) => {
  console.error('Test Failure:', err.message);
  process.exit(1);
});
