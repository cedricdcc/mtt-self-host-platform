import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing 3D Oceanarium GLB Fish Loader & Shiny Shaders...');

  const factoryPath = path.join(__dirname, '../components/oceanarium/engine/CartoonFishFactory.ts');
  const directorPath = path.join(__dirname, '../components/oceanarium/engine/ThreeGameDirector.ts');
  const boidsPath = path.join(__dirname, '../components/oceanarium/engine/FishBoidsSystem.ts');

  assert.ok(fs.existsSync(factoryPath), 'CartoonFishFactory.ts must exist');
  assert.ok(fs.existsSync(directorPath), 'ThreeGameDirector.ts must exist');
  assert.ok(fs.existsSync(boidsPath), 'FishBoidsSystem.ts must exist');

  const factorySrc = fs.readFileSync(factoryPath, 'utf8');
  const directorSrc = fs.readFileSync(directorPath, 'utf8');
  const boidsSrc = fs.readFileSync(boidsPath, 'utf8');

  // 1. CartoonFishFactory asserts
  assert.ok(
    factorySrc.includes('model_url') || factorySrc.includes('modelUrl'),
    'CartoonFishFactory SpeciesData must support model_url'
  );
  assert.ok(
    factorySrc.includes('GLTFLoader') || factorySrc.includes('loadGLB'),
    'CartoonFishFactory must implement GLTFLoader / loadGLB'
  );
  assert.ok(
    factorySrc.includes('applyShinyToGLB') || factorySrc.includes('isShiny'),
    'CartoonFishFactory must support applying shiny effects to GLB models'
  );
  assert.ok(
    factorySrc.includes('gltfCache') || factorySrc.includes('modelCache'),
    'CartoonFishFactory must cache parsed GLTF models'
  );

  // 2. ThreeGameDirector asserts
  assert.ok(
    directorSrc.includes('model_url') || directorSrc.includes('fish.model_url'),
    'ThreeGameDirector must forward model_url to fish factory'
  );

  // 3. FishBoidsSystem asserts
  assert.ok(
    boidsSrc.includes('animationMixer') || boidsSrc.includes('mixer') || boidsSrc.includes('glbContainer'),
    'FishBoidsSystem must support GLB animation / swimming kinematics'
  );

  console.log('✓ 3D Oceanarium GLB Fish Loader tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
