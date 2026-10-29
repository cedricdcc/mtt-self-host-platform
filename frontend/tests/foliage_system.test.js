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
  console.log('Testing FoliageSystem 3-tier vertical reef-to-abyss ecology...');

  const foliagePath = path.join(__dirname, '../components/oceanarium/engine/FoliageSystem.ts');
  assert.ok(fs.existsSync(foliagePath), 'FoliageSystem.ts must exist');

  const content = fs.readFileSync(foliagePath, 'utf8');

  // Verify class and methods
  assert.ok(content.includes('export class FoliageSystem'), 'Must export FoliageSystem');
  assert.ok(content.includes('createKelpForest'), 'Must implement createKelpForest');
  assert.ok(content.includes('createCoralsAndAnemones'), 'Must implement createCoralsAndAnemones');
  assert.ok(content.includes('createSunlitCoralShelf'), 'Must implement createSunlitCoralShelf');
  assert.ok(content.includes('createTwilightCanyonWall'), 'Must implement createTwilightCanyonWall');
  assert.ok(content.includes('createAbyssalHydrothermalVents'), 'Must implement createAbyssalHydrothermalVents');
  assert.ok(content.includes('update('), 'Must implement update animation loop');
  assert.ok(content.includes('dispose('), 'Must implement dispose method');

  // Verify procedural sway kinematics
  assert.ok(content.includes('Math.sin'), 'Must use harmonic sine kinematics for kelp sway');
  assert.ok(content.includes('anemones'), 'Must animate pulsing anemones');

  // Runtime behavioral verification
  const { FoliageSystem } = await loadTsModule(foliagePath);
  const scene = new THREE.Scene();
  const foliage = new FoliageSystem(scene);

  assert.strictEqual(typeof foliage.createSunlitCoralShelf, 'function', 'createSunlitCoralShelf must be a method');
  assert.strictEqual(typeof foliage.createTwilightCanyonWall, 'function', 'createTwilightCanyonWall must be a method');
  assert.strictEqual(typeof foliage.createAbyssalHydrothermalVents, 'function', 'createAbyssalHydrothermalVents must be a method');

  assert.ok(foliage.sunlitShelfGroup instanceof THREE.Group, 'Must create sunlitShelfGroup for Sunlit reef shelves & arch');
  assert.ok(foliage.sunlitShelfGroup.children.length >= 3, 'sunlitShelfGroup must contain left shelf, right shelf, and coral arch');

  assert.ok(foliage.twilightCanyonGroup instanceof THREE.Group, 'Must create twilightCanyonGroup for Twilight basalt canyon outcrops');
  assert.ok(foliage.twilightCanyonGroup.children.length >= 3, 'twilightCanyonGroup must contain stepped basalt outcrops with gorgonian sea-fans and sponge chimneys');

  assert.ok(foliage.abyssalVentsGroup instanceof THREE.Group, 'Must create abyssalVentsGroup for Abyssal hydrothermal vents');
  assert.strictEqual(foliage.abyssalVentsGroup.children.length, 3, 'abyssalVentsGroup must contain 3 volcanic black-smoker vent chimneys');
  foliage.abyssalVentsGroup.children.forEach((vent) => {
    assert.strictEqual(vent.position.y, -19.2, 'Hydrothermal vent chimneys must sit on the Abyssal trench floor at Y = -19.2');
  });

  // Verify update and dispose execute cleanly
  foliage.update(0.016, 2.5);
  foliage.dispose();
  assert.strictEqual(scene.children.length, 0, 'dispose() must remove foliageGroup from scene');

  console.log('✓ FoliageSystem 3-tier vertical reef-to-abyss ecology tests PASSED!');
}

run().catch((err) => {
  console.error('Test Failure:', err.message);
  process.exit(1);
});
