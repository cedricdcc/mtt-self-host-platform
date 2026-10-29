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

// 4. Species3DPreview component existence and integration in MarineCodex.tsx
const previewPath = path.fileURLToPath
  ? path.fileURLToPath(new URL('../components/oceanarium/Species3DPreview.tsx', import.meta.url))
  : 'frontend/components/oceanarium/Species3DPreview.tsx';
assert.ok(fs.existsSync(previewPath), 'Species3DPreview.tsx must exist');

const previewContent = fs.readFileSync(previewPath, 'utf8');
assert.ok(previewContent.includes('CartoonFishFactory'), 'Species3DPreview must use CartoonFishFactory');
assert.ok(previewContent.includes('FishBoidsSystem.animateFishMesh'), 'Species3DPreview must use FishBoidsSystem.animateFishMesh');
assert.ok(previewContent.includes('interactive'), 'Species3DPreview must support interactive and snapshot modes');

assert.ok(content.includes('Species3DPreview'), 'MarineCodex.tsx must import and render Species3DPreview');
assert.ok(content.includes('interactive={true}'), 'MarineCodex.tsx must render interactive 3D preview in Inspect Modal');
assert.ok(content.includes('interactive={false}'), 'MarineCodex.tsx must render non-interactive 3D snapshot on discovered cards');

console.log('✓ MarineCodex funny cards test passed');
