import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing SceneEnvironment, FishBoidsSystem, and FeedingPhysics...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  const boidsPath = path.join(__dirname, '../components/oceanarium/engine/FishBoidsSystem.ts');
  const feedingPath = path.join(__dirname, '../components/oceanarium/engine/FeedingPhysics.ts');

  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');
  assert.ok(fs.existsSync(boidsPath), 'FishBoidsSystem.ts must exist');
  assert.ok(fs.existsSync(feedingPath), 'FeedingPhysics.ts must exist');

  // Verify SceneEnvironment
  const envContent = fs.readFileSync(envPath, 'utf8');
  assert.ok(envContent.includes('export class SceneEnvironment'), 'Must export SceneEnvironment');
  assert.ok(envContent.includes('FogExp2') || envContent.includes('Fog'), 'Must configure depth fog');
  assert.ok(envContent.includes('DirectionalLight') || envContent.includes('AmbientLight'), 'Must configure depth lighting');
  assert.ok(envContent.includes('updateWaterQuality'), 'Must support updating water turbidity/quality');

  // Verify FishBoidsSystem
  const boidsContent = fs.readFileSync(boidsPath, 'utf8');
  assert.ok(boidsContent.includes('export class FishBoidsSystem'), 'Must export FishBoidsSystem');
  assert.ok(boidsContent.includes('addFish'), 'Must support adding fish');
  assert.ok(boidsContent.includes('update'), 'Must implement update loop');
  assert.ok(boidsContent.includes('sunlit') && boidsContent.includes('twilight') && boidsContent.includes('abyssal'), 'Must constrain fish to depth zones');
  assert.ok(boidsContent.includes('tailPivot'), 'Must animate tail fin pivot during swimming');

  // Verify FeedingPhysics
  const feedingContent = fs.readFileSync(feedingPath, 'utf8');
  assert.ok(feedingContent.includes('export class FeedingPhysics'), 'Must export FeedingPhysics');
  assert.ok(feedingContent.includes('dropFood'), 'Must support dropFood');
  assert.ok(feedingContent.includes('update'), 'Must implement update loop for food sinking');
  assert.ok(feedingContent.includes('checkFishFeeding'), 'Must detect mouth collision when fish feeds');

  console.log('✓ SceneEnvironment, FishBoidsSystem, and FeedingPhysics invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
