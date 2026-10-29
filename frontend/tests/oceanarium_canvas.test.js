import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');
  const oceanariumPath = path.join(__dirname, '../pages/Oceanarium.tsx');
  const rendererPath = path.join(__dirname, '../components/oceanarium/canvasRenderer.ts');

  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');
  assert.ok(fs.existsSync(oceanariumPath), 'Oceanarium.tsx must exist');
  assert.ok(fs.existsSync(rendererPath), 'canvasRenderer.ts must exist');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  const oceanariumContent = fs.readFileSync(oceanariumPath, 'utf8');
  const directorPath = path.join(__dirname, '../components/oceanarium/engine/ThreeGameDirector.ts');
  const directorContent = fs.readFileSync(directorPath, 'utf8');

  assert.ok(canvasContent.includes('requestAnimationFrame') || directorContent.includes('requestAnimationFrame'), 'Must use game loop / director');
  assert.ok(canvasContent.includes('devicePixelRatio') || directorContent.includes('devicePixelRatio'), 'Must support devicePixelRatio for mobile displays');

  // Verify 100% width usage in Oceanarium.tsx
  assert.ok(!oceanariumContent.includes('max-w-6xl'), 'Oceanarium page must not be restricted to max-w-6xl');
  assert.ok(oceanariumContent.includes('w-full'), 'Oceanarium page must be w-full');

  // Verify locked isometric navigation hint
  assert.ok(canvasContent.includes('Locked Isometric') || canvasContent.includes('Isometric View'), 'Must display locked isometric view hint');

  // Verify Reset View, UI dock and rich tooltips
  assert.ok(canvasContent.includes('RotateCcw'), 'Must import RotateCcw icon for reset view');
  assert.ok(canvasContent.includes('resetCameraView'), 'Must call resetCameraView on button click');
  assert.ok(canvasContent.includes('Reset View'), 'Must display Reset View tooltip/label');
  assert.ok(canvasContent.includes("e.key === 'r'") || canvasContent.includes("e.key === 'R'"), 'Must listen for R key to reset view');

  // Verify Front Glass View [F], wheel zoom, click-vs-drag threshold, and collapsible Tank Specimen Roster
  assert.ok(canvasContent.includes('snapToFrontView'), 'Must wire snapToFrontView for Front Glass View');
  assert.ok(canvasContent.includes("e.key === 'f'") || canvasContent.includes("e.key === 'F'"), 'Must listen for F key to snap to Front Glass View');
  assert.ok(canvasContent.includes('handleWheel') && canvasContent.includes('onWheel'), 'Must wire onWheel to director.handleWheel');
  assert.ok(
    canvasContent.includes('isRosterOpen') && canvasContent.includes('Specimens in Tank'),
    'Must render collapsible Specimens in Tank roster bar'
  );
  assert.ok(
    canvasContent.includes('pointerDownRef') && canvasContent.includes('isDragging') && canvasContent.includes('Math.hypot'),
    'Must implement < 5px click-vs-drag threshold'
  );
  assert.ok(
    canvasContent.includes('selectFishById') && canvasContent.includes('boopFish'),
    'Must wire selectFishById and boopFish in OceanariumCanvas'
  );

  console.log('✓ Oceanarium 100% width and canvas navigation verified');
}

run();
