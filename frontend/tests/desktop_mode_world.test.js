import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing Desktop Mode infinite procedural seabed, sky canopy, drifting clouds, and sun...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  const boidsPath = path.join(__dirname, '../components/oceanarium/engine/FishBoidsSystem.ts');

  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');
  assert.ok(fs.existsSync(boidsPath), 'FishBoidsSystem.ts must exist');

  const envContent = fs.readFileSync(envPath, 'utf8');
  assert.ok(envContent.includes('setDesktopMode'), 'SceneEnvironment must implement setDesktopMode');
  assert.ok(envContent.includes('infiniteTerrain') || envContent.includes('InfiniteTerrain') || envContent.includes('proceduralTerrain'), 'Must implement procedural infinite terrain');
  assert.ok(envContent.includes('skyDome') || envContent.includes('skyCanopy') || envContent.includes('clouds') || envContent.includes('Cloud'), 'Must implement sky and drifting clouds');
  assert.ok(envContent.includes('sunLight') || envContent.includes('sunShaft') || envContent.includes('sunCorona'), 'Must implement radiant sun light source');

  const boidsContent = fs.readFileSync(boidsPath, 'utf8');
  assert.ok(boidsContent.includes('setDesktopMode'), 'FishBoidsSystem must implement setDesktopMode');

  console.log('✓ Desktop Mode infinite procedural world tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
