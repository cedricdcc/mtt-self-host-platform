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
  console.log('Testing SceneEnvironment 1:1:1 true cube vivarium, 3-tier bathymetric biome, god-rays, and stratified lighting...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');

  const content = fs.readFileSync(envPath, 'utf8');

  // Verify true cube dimensions (40x40x40)
  assert.ok(content.includes('40, 40, 40') || (content.includes('40') && content.includes('CUBE_SIZE')), 'Must create 40x40x40 true cube vivarium bounds');
  // Verify corner bracket cubes are removed for clean rimless glass aesthetic
  assert.ok(!content.includes('cornerBrackets') && !content.includes('bracketGeo'), 'Must NOT have corner brackets or dark corner cubes');
  assert.ok(content.includes('depthTicks') || content.includes('DepthTick') || content.includes('tickMesh'), 'Must create etched depth tick marks on vertical pillars');
  assert.ok(content.includes('glassPanels') || content.includes('GlassPanel') || content.includes('acrylic') || content.includes('glassMaterial'), 'Must create translucent acrylic glass faces');

  // Verify 3-tier vertical biome features in source
  assert.ok(content.includes('bathymetricBackdrop'), 'Must define bathymetricBackdrop vertical gradient plane');
  assert.ok(
    content.includes('#0284c7') && content.includes('#1e3a8a') && content.includes('#070b14'),
    'Must use #0284c7 (Sunlit) -> #1e3a8a (Twilight) -> #070b14 (Abyssal) gradient colors'
  );
  assert.ok(content.includes('godRaysGroup'), 'Must define godRaysGroup for volumetric sun shafts');
  assert.ok(content.includes('sunlitLight'), 'Must define sunlitLight for Sunlit zone');
  assert.ok(content.includes('twilightLight'), 'Must define twilightLight for Twilight zone');
  assert.ok(content.includes('abyssalGlowLight'), 'Must define abyssalGlowLight for Abyssal trench');

  // Runtime behavioral verification
  const { SceneEnvironment, HALF_CUBE } = await loadTsModule(envPath);
  const scene = new THREE.Scene();
  const env = new SceneEnvironment(scene);

  assert.ok(env.bathymetricBackdrop instanceof THREE.Mesh, 'bathymetricBackdrop must be a THREE.Mesh');
  assert.ok(
    Math.abs(env.bathymetricBackdrop.position.z - (-HALF_CUBE - 0.15)) < 0.01,
    `bathymetricBackdrop must sit behind rear glass at Z = -HALF_CUBE - 0.15 (-20.15), got ${env.bathymetricBackdrop.position.z}`
  );

  assert.ok(env.godRaysGroup instanceof THREE.Group, 'godRaysGroup must be a THREE.Group');
  assert.strictEqual(env.godRaysGroup.children.length, 5, 'godRaysGroup must contain 5 angled light shafts');

  assert.ok(env.sunlitLight instanceof THREE.Light, 'sunlitLight must be a THREE.Light');
  assert.ok(env.twilightLight instanceof THREE.Light, 'twilightLight must be a THREE.Light');
  assert.ok(env.abyssalGlowLight instanceof THREE.PointLight, 'abyssalGlowLight must be a THREE.PointLight');
  assert.strictEqual(env.abyssalGlowLight.position.y, -16, 'abyssalGlowLight must be positioned at Y = -16');

  // Verify sculpted sandFloor has non-flat vertex heights
  const floorPos = env.sandFloor.geometry.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < floorPos.count; i++) {
    const y = floorPos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  assert.ok(maxY - minY > 1.8, 'sandFloor must have sculpted multi-zone vertex heights (sandy perimeter dunes + central/rear trench dip)');

  // Verify godRays shimmer during update()
  const initialOpacity = env.godRaysGroup.children[0].material.opacity;
  env.update(0.016, 1.75);
  assert.notStrictEqual(env.godRaysGroup.children[0].material.opacity, initialOpacity, 'godRays shafts must shimmer in update()');

  // Verify DESKTOP_MODE hides bathymetricBackdrop and godRaysGroup
  env.setDesktopMode(true);
  assert.strictEqual(env.bathymetricBackdrop.visible, false, 'bathymetricBackdrop must be hidden in DESKTOP_MODE');
  assert.strictEqual(env.godRaysGroup.visible, false, 'godRaysGroup must be hidden in DESKTOP_MODE');

  env.setDesktopMode(false);
  assert.strictEqual(env.bathymetricBackdrop.visible, true, 'bathymetricBackdrop must be visible in standard mode');
  assert.strictEqual(env.godRaysGroup.visible, true, 'godRaysGroup must be visible in standard mode');

  // Verify dispose() removes bathymetricBackdrop and godRaysGroup from scene
  env.dispose();
  assert.ok(!scene.children.includes(env.bathymetricBackdrop), 'dispose() must remove bathymetricBackdrop from scene');
  assert.ok(!scene.children.includes(env.godRaysGroup), 'dispose() must remove godRaysGroup from scene');

  console.log('✓ SceneEnvironment 1:1:1 true cube vivarium & 3-tier biome tests PASSED!');
}

run().catch((err) => {
  console.error('Test Failure:', err.message);
  process.exit(1);
});
