import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');
  const rendererPath = path.join(__dirname, '../components/oceanarium/canvasRenderer.ts');

  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');
  assert.ok(fs.existsSync(rendererPath), 'canvasRenderer.ts must exist');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  assert.ok(canvasContent.includes('requestAnimationFrame'), 'Must use requestAnimationFrame');
  assert.ok(canvasContent.includes('devicePixelRatio'), 'Must support devicePixelRatio for mobile displays');
  assert.ok(canvasContent.includes('touch-action') || canvasContent.includes('touchAction'), 'Must configure touch-action for mobile touch handling');

  const rendererContent = fs.readFileSync(rendererPath, 'utf8');
  assert.ok(rendererContent.includes('drawDepthBackground'), 'Renderer must implement drawDepthBackground');
  assert.ok(rendererContent.includes('drawFish'), 'Renderer must implement drawFish');
  assert.ok(rendererContent.includes('drawPellet'), 'Renderer must implement drawPellet');

  console.log('✓ Oceanarium Canvas component structure verified');
}

run();
