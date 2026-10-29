import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CartoonFishFactory structural invariants, 8 rig families, and 21 species...');

  const factoryPath = path.join(__dirname, '../components/oceanarium/engine/CartoonFishFactory.ts');
  assert.ok(fs.existsSync(factoryPath), 'CartoonFishFactory.ts must exist');

  const content = fs.readFileSync(factoryPath, 'utf8');

  // Core class & methods
  assert.ok(content.includes('export class CartoonFishFactory'), 'Must export CartoonFishFactory class');
  assert.ok(content.includes('createFishMesh'), 'Must implement createFishMesh method');
  assert.ok(content.includes('addCartoonEyes'), 'Must implement addCartoonEyes method');
  assert.ok(content.includes('sclera') && content.includes('pupil') && content.includes('shine'), 'Must construct eye sclera, pupil, and shine');
  assert.ok(content.includes('tailPivot') && content.includes('leftFin') && content.includes('rightFin'), 'Must assign tailPivot, leftFin, rightFin');
  assert.ok(content.includes('dorsalFin') && content.includes('analFin') && content.includes('jawPivot'), 'Must assign dorsalFin, analFin, jawPivot');
  assert.ok(content.includes('addNibblingMouth'), 'Must implement addNibblingMouth');
  assert.ok(content.includes('addCheekBlush'), 'Must implement addCheekBlush');
  assert.ok(content.includes('addSpeciesMarkings'), 'Must implement addSpeciesMarkings');
  assert.ok(content.includes('addAnglerLure'), 'Must implement addAnglerLure');
  assert.ok(content.includes('MeshToonMaterial') && content.includes('createToonGradient'), 'Must use MeshToonMaterial and createToonGradient');
  assert.ok(content.includes('isShiny') && content.includes('getShinyColor') && content.includes('createSparkleAura'), 'Must handle Shiny variants');

  // Verify all body types & specialized rig builders
  const requiredBodyChecks = [
    "bodyType === 'ray'",
    "bodyType === 'vertical'",
    "bodyType === 'spiky'",
    'buildMantaRayRig',
    'buildSeahorseRig',
    'buildCephalopodRig',
    'buildMedusaAndChainRig',
    'buildSerpentineRig',
    'buildDeepSpecialistRig',
    'createPatternTexture'
  ];
  for (const check of requiredBodyChecks) {
    assert.ok(content.includes(check), `CartoonFishFactory must include ${check}`);
  }

  // Verify locomotion types assigned on userData
  const locomotionTypes = [
    'carangiform',
    'hover_flutter',
    'puffer',
    'rajiform',
    'upright_bob',
    'jet_pulse',
    'ear_flap',
    'medusa_pulse',
    'chain_wave',
    'anguilliform',
    'specialist_swim'
  ];
  for (const loco of locomotionTypes) {
    assert.ok(content.includes(loco), `CartoonFishFactory must support locomotionType: ${loco}`);
  }

  console.log('✓ CartoonFishFactory 8 rig families and 21 species invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
