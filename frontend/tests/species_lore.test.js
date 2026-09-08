import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const lorePath = path.join(__dirname, '../utils/speciesLore.ts');
assert.ok(fs.existsSync(lorePath), 'speciesLore.ts should exist');

const content = fs.readFileSync(lorePath, 'utf8');

const expectedSpecies = [
  'azure_damselfish', 'sunburst_tang', 'emerald_parrotfish', 'clown_anemone',
  'golden_seahorse', 'sapphire_manta', 'solar_lionfish', 'spotted_pufferfish',
  'silver_hatchet', 'glass_lantern', 'ribbon_oarfish', 'prismatic_squid',
  'vampire_octo', 'coelacanth_shadow', 'ghost_grenadier', 'bioluminescent_angler',
  'gulper_void', 'dumbo_specter', 'crystal_siphonophore', 'abyssal_leviathan',
  'cosmic_jelly'
];

expectedSpecies.forEach(speciesId => {
  assert.ok(content.includes(speciesId), `Missing species entry in speciesLore.ts: ${speciesId}`);
});

assert.ok(content.includes('nickname'), 'Species lore must include nickname');
assert.ok(content.includes('personality'), 'Species lore must include personality');
assert.ok(content.includes('favoriteFood'), 'Species lore must include favoriteFood');
assert.ok(content.includes('quote'), 'Species lore must include quote');
assert.ok(content.includes('realFact'), 'Species lore must include realFact');

console.log('✓ Species Lore catalog test passed');
