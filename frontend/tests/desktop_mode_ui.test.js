import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing Desktop Mode UI, OceanariumCanvas 3D integration, and Shiny Codex...');

  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');
  const oceanariumPath = path.join(__dirname, '../pages/Oceanarium.tsx');
  const codexPath = path.join(__dirname, '../components/oceanarium/MarineCodex.tsx');

  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');
  assert.ok(fs.existsSync(oceanariumPath), 'Oceanarium.tsx must exist');
  assert.ok(fs.existsSync(codexPath), 'MarineCodex.tsx must exist');

  // Verify OceanariumCanvas uses ThreeGameDirector
  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  assert.ok(canvasContent.includes('ThreeGameDirector'), 'OceanariumCanvas must instantiate ThreeGameDirector');
  assert.ok(canvasContent.includes('DESKTOP_MODE') || canvasContent.includes('isDesktopMode'), 'Must support Desktop Mode state');
  assert.ok(canvasContent.includes('snapToDepth'), 'Must support depth jump controls');
  assert.ok(canvasContent.includes('Observing') || canvasContent.includes('Observation') || canvasContent.includes('OBSERVING'), 'Must render Observation HUD card');
  assert.ok(canvasContent.includes('Escape') || canvasContent.includes('KeyDown') || canvasContent.includes('keydown'), 'Must support ESC key exit');

  // Verify Oceanarium.tsx has Desktop Mode button
  const pageContent = fs.readFileSync(oceanariumPath, 'utf8');
  assert.ok(pageContent.includes('Desktop Mode') || pageContent.includes('desktopMode'), 'Oceanarium page must feature Desktop Mode button');

  // Verify MarineCodex.tsx has Shiny support
  const codexContent = fs.readFileSync(codexPath, 'utf8');
  assert.ok(codexContent.includes('discovered_shiny') || codexContent.includes('total_shiny_discovered'), 'Codex must track shiny discoveries');

  console.log('✓ Desktop Mode & 3D Oceanarium UI invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
