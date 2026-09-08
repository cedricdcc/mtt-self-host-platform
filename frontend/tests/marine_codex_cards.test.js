import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = path.fileURLToPath ? path.fileURLToPath(new URL('.', import.meta.url)) : process.cwd();

const codexPath = path.fileURLToPath
  ? path.fileURLToPath(new URL('../components/oceanarium/MarineCodex.tsx', import.meta.url))
  : 'frontend/components/oceanarium/MarineCodex.tsx';

assert.ok(fs.existsSync(codexPath), 'MarineCodex.tsx should exist');

const content = fs.readFileSync(codexPath, 'utf8');

// 1. Imports and uses SPECIES_LORE
assert.ok(content.includes('SPECIES_LORE'), 'MarineCodex.tsx must import and use SPECIES_LORE');

// 2. Contains funny card fields
assert.ok(content.includes('nickname'), 'MarineCodex.tsx must display species nickname');
assert.ok(content.includes('quote'), 'MarineCodex.tsx must display species funny quote');
assert.ok(content.includes('realFact'), 'MarineCodex.tsx must display realFact');
assert.ok(content.includes('personality'), 'MarineCodex.tsx must display personality');

// 3. Silhouette / lock for undiscovered species
assert.ok(content.includes('Undiscovered') || content.includes('silhouette'), 'MarineCodex.tsx must handle undiscovered silhouettes');

console.log('✓ MarineCodex funny cards test passed');
