import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing FishInfographicPanel component and scale visualization...');

  const panelPath = path.join(__dirname, '../components/oceanarium/FishInfographicPanel.tsx');
  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');

  assert.ok(fs.existsSync(panelPath), 'FishInfographicPanel.tsx must exist');
  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');

  const panelContent = fs.readFileSync(panelPath, 'utf8');
  assert.ok(panelContent.includes('FishInfographicPanel'), 'Must export FishInfographicPanel');
  assert.ok(panelContent.includes('hand') || panelContent.includes('diver') || panelContent.includes('Scale') || panelContent.includes('Ruler'), 'Must include comparative physical scale visualizer');
  assert.ok(panelContent.includes('sunlit') && panelContent.includes('twilight') && panelContent.includes('abyssal'), 'Must display bathymetric depth stratum column');
  assert.ok(panelContent.includes('Vitality') || panelContent.includes('Velocity') || panelContent.includes('Speed') || panelContent.includes('Diet'), 'Must display bio-telemetry stats');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  assert.ok(canvasContent.includes('FishInfographicPanel'), 'OceanariumCanvas must render FishInfographicPanel');

  console.log('✓ FishInfographicPanel tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
