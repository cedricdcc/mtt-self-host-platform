import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CartoonFishFactory structural invariants and cartoon features...');

  const factoryPath = path.join(__dirname, '../components/oceanarium/engine/CartoonFishFactory.ts');
  assert.ok(fs.existsSync(factoryPath), 'CartoonFishFactory.ts must exist');

  const content = fs.readFileSync(factoryPath, 'utf8');

  // Verify class and methods
  assert.ok(content.includes('export class CartoonFishFactory'), 'Must export CartoonFishFactory class');
  assert.ok(content.includes('createFishMesh'), 'Must implement createFishMesh method');

  // Verify cartoon eyes matching homepage pufferfish (sclera + pupil + shine reflection)
  assert.ok(content.includes('addCartoonEyes'), 'Must implement addCartoonEyes method');
  assert.ok(content.includes('sclera'), 'Must construct rounded eye sclera');
  assert.ok(content.includes('pupil'), 'Must construct glossy pupil');
  assert.ok(content.includes('shine'), 'Must add specular shine reflection dot to eye');

  // Verify procedural swimming rigs
  assert.ok(content.includes('tailPivot'), 'Must assign tailPivot for procedural animation');
  assert.ok(content.includes('leftFin'), 'Must assign leftFin for pectoral flutter');
  assert.ok(content.includes('rightFin'), 'Must assign rightFin for pectoral flutter');

  // Verify Toon Materials & Gradient Texture
  assert.ok(content.includes('MeshToonMaterial'), 'Must use MeshToonMaterial for cel/toon shading');
  assert.ok(content.includes('createToonGradient'), 'Must generate toon gradient map');

  // Verify Shiny Variant features
  assert.ok(content.includes('isShiny'), 'Must handle isShiny flag');
  assert.ok(content.includes('getShinyColor'), 'Must derive iridescent/pearlescent color for shinies');
  assert.ok(content.includes('createSparkleAura'), 'Must generate sparkle/star particle cloud for shiny fish');

  // Verify specialized body types
  assert.ok(content.includes('bodyType === \'ray\''), 'Must handle ray/manta body geometry');
  assert.ok(content.includes('bodyType === \'vertical\''), 'Must handle vertical seahorse body geometry');
  assert.ok(content.includes('bodyType === \'spiky\''), 'Must handle spiky pufferfish body geometry');
  assert.ok(content.includes('addAnglerLure'), 'Must handle bioluminescent lure for anglerfish');

  // Verify nibbling mouth/jaw pivot
  assert.ok(content.includes('jawPivot'), 'Must assign jawPivot for mouth nibbling kinematics');
  assert.ok(content.includes('addNibblingMouth'), 'Must implement addNibblingMouth');

  // Verify dorsal and anal fin crests
  assert.ok(content.includes('dorsalFin'), 'Must assign dorsalFin crest');
  assert.ok(content.includes('analFin'), 'Must assign analFin crest');

  // Verify species-specific markings & cheek blush
  assert.ok(content.includes('addCheekBlush'), 'Must add rosy cartoon cheek blush decals');
  assert.ok(content.includes('addSpeciesMarkings'), 'Must implement addSpeciesMarkings');
  assert.ok(content.includes('clownfish') || content.includes('stripes'), 'Must handle clownfish white bands');

  console.log('✓ CartoonFishFactory structural and visual invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
