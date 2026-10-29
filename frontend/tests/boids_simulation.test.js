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

  // Verify FishBoidsSystem structural invariants
  const boidsContent = fs.readFileSync(boidsPath, 'utf8');
  assert.ok(boidsContent.includes('export class FishBoidsSystem'), 'Must export FishBoidsSystem');
  assert.ok(boidsContent.includes('addFish'), 'Must support adding fish');
  assert.ok(boidsContent.includes('update'), 'Must implement update loop');
  assert.ok(boidsContent.includes('sunlit') && boidsContent.includes('twilight') && boidsContent.includes('abyssal'), 'Must constrain fish to depth zones');
  assert.ok(boidsContent.includes('tailPivot'), 'Must animate tail fin pivot during swimming');

  // Multi-archetype locomotion, boid separation/schooling, habitat affinity, and boop reactions
  assert.ok(
    boidsContent.includes('static animateFishMesh') || boidsContent.includes('public static animateFishMesh'),
    'Must implement static animateFishMesh helper'
  );
  assert.ok(boidsContent.includes('triggerReaction'), 'Must implement instance triggerReaction method');
  assert.ok(boidsContent.includes('reactionTimer'), 'Must track reactionTimer on BoidFish');

  const requiredLocomotionTypes = [
    'rajiform',
    'medusa_pulse',
    'anguilliform',
    'jet_pulse',
    'upright_bob',
    'puffer',
    'hover_flutter',
    'ear_flap',
    'chain_wave',
    'specialist_swim',
    'carangiform'
  ];
  for (const loco of requiredLocomotionTypes) {
    assert.ok(boidsContent.includes(loco), `FishBoidsSystem must handle locomotion type: ${loco}`);
  }

  const requiredRigHandles = [
    'spineSegments',
    'leftWingInner',
    'leftWingOuter',
    'rightWingInner',
    'rightWingOuter',
    'bellGroup',
    'tentacles',
    'leftEarFin',
    'rightEarFin',
    'puffSpikes',
    'lobeFins',
    'escaLure'
  ];
  for (const handle of requiredRigHandles) {
    assert.ok(boidsContent.includes(handle), `FishBoidsSystem must animate rig handle: ${handle}`);
  }

  assert.ok(boidsContent.includes('separation'), 'Must apply neighbor separation between nearby boids');
  assert.ok(
    boidsContent.includes('clown_anemone') &&
      boidsContent.includes('golden_seahorse') &&
      boidsContent.includes('ghost_grenadier') &&
      boidsContent.includes('bioluminescent_angler') &&
      boidsContent.includes('dumbo_specter'),
    'Must apply habitat affinity landmarks for reef shelf and abyssal trench species'
  );

  // Runtime behavioral verification of FishBoidsSystem
  const { FishBoidsSystem } = await loadTsModule(boidsPath);
  assert.strictEqual(typeof FishBoidsSystem.animateFishMesh, 'function', 'FishBoidsSystem.animateFishMesh must be a static function');

  const scene = new THREE.Scene();
  const boids = new FishBoidsSystem(scene);
  assert.strictEqual(typeof boids.triggerReaction, 'function', 'boids.triggerReaction must be an instance method');

  // 1. Test puffer locomotion & reaction puffing (body -> 1.45x, puffSpikes -> 1.8x)
  const pufferGroup = new THREE.Group();
  const spike1 = new THREE.Object3D();
  const spike2 = new THREE.Object3D();
  pufferGroup.userData = {
    speciesId: 'spotted_pufferfish',
    locomotionType: 'puffer',
    puffSpikes: [spike1, spike2],
    leftFin: new THREE.Object3D(),
    rightFin: new THREE.Object3D(),
    tailPivot: new THREE.Object3D(),
    jawPivot: new THREE.Object3D()
  };
  boids.addFish({
    user_fish_id: 101,
    species_id: 'spotted_pufferfish',
    depth_zone: 'sunlit',
    mesh: pufferGroup
  });

  const triggered = boids.triggerReaction(101);
  assert.strictEqual(triggered, true, 'triggerReaction must return true for existing active fish');
  const pufferBoid = boids.getAllFishes().find((f) => f.id === 101);
  assert.strictEqual(pufferBoid.reactionTimer, 2.5, 'triggerReaction must set reactionTimer = 2.5');

  for (let i = 0; i < 20; i++) {
    FishBoidsSystem.animateFishMesh(pufferGroup, 1.0 + i * 0.05, 0.05, 1.0, 2.0);
  }
  assert.ok(Math.abs(pufferGroup.scale.x - 1.45) < 0.05, `Puffer body scale should approach 1.45x when reacting, got ${pufferGroup.scale.x}`);
  assert.ok(Math.abs(spike1.scale.x - 1.8) < 0.05, `Puffer spikes should approach 1.8x when reacting, got ${spike1.scale.x}`);

  // 2. Test rajiform, medusa_pulse, anguilliform, jet_pulse, upright_bob, specialist_swim animations
  const mantaGroup = new THREE.Group();
  mantaGroup.userData = {
    locomotionType: 'rajiform',
    leftWingInner: new THREE.Object3D(),
    leftWingOuter: new THREE.Object3D(),
    rightWingInner: new THREE.Object3D(),
    rightWingOuter: new THREE.Object3D(),
    tailPivot: new THREE.Object3D()
  };
  FishBoidsSystem.animateFishMesh(mantaGroup, 0.7, 0.016, 1.0, 0);
  assert.notStrictEqual(mantaGroup.userData.leftWingInner.rotation.z, 0, 'rajiform must flap leftWingInner');
  assert.strictEqual(
    mantaGroup.userData.leftWingInner.rotation.z,
    -mantaGroup.userData.rightWingInner.rotation.z,
    'rajiform inner wings must flap symmetrically on rotation.z'
  );

  const jellyGroup = new THREE.Group();
  jellyGroup.userData = {
    locomotionType: 'medusa_pulse',
    bellGroup: new THREE.Object3D(),
    tentacles: [new THREE.Object3D(), new THREE.Object3D()]
  };
  FishBoidsSystem.animateFishMesh(jellyGroup, 0.5, 0.016, 1.0, 0);
  assert.notStrictEqual(jellyGroup.userData.bellGroup.scale.y, 1.0, 'medusa_pulse must squash-and-stretch bellGroup');
  assert.notStrictEqual(jellyGroup.userData.tentacles[0].rotation.x, 0, 'medusa_pulse must wave tentacles');

  const eelGroup = new THREE.Group();
  eelGroup.userData = {
    speciesId: 'gulper_void',
    locomotionType: 'anguilliform',
    spineSegments: [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()],
    jawPivot: new THREE.Object3D()
  };
  FishBoidsSystem.animateFishMesh(eelGroup, 0.8, 0.016, 1.0, 1.5);
  assert.notStrictEqual(eelGroup.userData.spineSegments[1].rotation.y, 0, 'anguilliform must rotate spineSegments in S-wave');
  assert.ok(eelGroup.userData.jawPivot.rotation.x > 0.5, 'gulper_void must open jaw wide when reacting');

  // 3. Test short-range neighbor separation (dist < 2.4)
  const sepScene = new THREE.Scene();
  const sepBoids = new FishBoidsSystem(sepScene);
  const f1 = new THREE.Group();
  const f2 = new THREE.Group();
  sepBoids.addFish({ user_fish_id: 1, species_id: 'azure_damselfish', depth_zone: 'sunlit', mesh: f1 });
  sepBoids.addFish({ user_fish_id: 2, species_id: 'azure_damselfish', depth_zone: 'sunlit', mesh: f2 });
  f1.position.set(0, 10, 0);
  f2.position.set(0.5, 10, 0);
  const [b1, b2] = sepBoids.getAllFishes();
  b1.velocity.set(0, 0, 0);
  b2.velocity.set(0, 0, 0);
  b1.target.set(0, 10, 0);
  b2.target.set(0.5, 10, 0);
  sepBoids.update(0.05, 1.0);
  assert.ok(b1.velocity.x < b2.velocity.x, 'Separation must push nearby boids (dist < 2.4) apart');

  // 4. Test upright stabilization for golden_seahorse & cosmic_jelly
  const seahorseGroup = new THREE.Group();
  seahorseGroup.userData = {
    speciesId: 'golden_seahorse',
    locomotionType: 'upright_bob',
    dorsalFin: new THREE.Object3D(),
    tailPivot: new THREE.Object3D()
  };
  seahorseGroup.rotation.set(0.8, 0.2, -0.7);
  sepBoids.addFish({ user_fish_id: 3, species_id: 'golden_seahorse', depth_zone: 'sunlit', mesh: seahorseGroup });
  const shBoid = sepBoids.getAllFishes().find((f) => f.id === 3);
  shBoid.velocity.set(1.0, 1.5, 1.0);
  for (let i = 0; i < 15; i++) {
    sepBoids.update(0.05, 2.0 + i * 0.05);
  }
  assert.ok(Math.abs(seahorseGroup.rotation.x) < 0.08, `Upright seahorse pitch should damp toward 0, got ${seahorseGroup.rotation.x}`);
  assert.ok(Math.abs(seahorseGroup.rotation.z) < 0.08, `Upright seahorse roll should damp toward 0, got ${seahorseGroup.rotation.z}`);

  // 5. Test habitat affinity waypoint selection
  const trenchBoid = {
    id: 4,
    speciesId: 'bioluminescent_angler',
    depthZone: 'abyssal',
    status: 'active',
    isFavorite: false,
    mesh: new THREE.Group(),
    velocity: new THREE.Vector3(),
    target: new THREE.Vector3(),
    targetChangeTimer: 0,
    scale: 1,
    reactionTimer: 0
  };
  for (let i = 0; i < 10; i++) {
    const wp = sepBoids.selectWaypointForBoid(trenchBoid);
    assert.ok(wp.y >= -17.5 && wp.y <= -10.0, `Abyssal trench specialist waypoint Y must be in [-17.5, -10], got ${wp.y}`);
  }

  // Verify FeedingPhysics
  const feedingContent = fs.readFileSync(feedingPath, 'utf8');
  assert.ok(feedingContent.includes('export class FeedingPhysics'), 'Must export FeedingPhysics');
  assert.ok(feedingContent.includes('dropFood'), 'Must support dropFood');
  assert.ok(feedingContent.includes('update'), 'Must implement update loop for food sinking');
  assert.ok(feedingContent.includes('checkFishFeeding'), 'Must detect mouth collision when fish feeds');

  console.log('✓ SceneEnvironment, FishBoidsSystem, and FeedingPhysics invariants PASSED!');
}

run().catch((err) => {
  console.error('Test Failure:', err.message);
  process.exit(1);
});
