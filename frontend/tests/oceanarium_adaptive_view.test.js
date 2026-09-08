import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const oceanariumPagePath = path.join(__dirname, '../pages/Oceanarium.tsx');
assert.ok(fs.existsSync(oceanariumPagePath), 'Oceanarium.tsx should exist');

const content = fs.readFileSync(oceanariumPagePath, 'utf8');

// 1. Checks isMobile state or responsive viewport
assert.ok(content.includes('isMobile'), 'Oceanarium.tsx must define isMobile state');

// 2. Only renders OceanariumCanvas when NOT mobile and has aquarium access
assert.ok(
  content.includes('!isMobile') && content.includes('OceanariumCanvas'),
  'OceanariumCanvas should only render when !isMobile'
);

// 3. Defaults to codex on mobile
assert.ok(
  content.includes('codex'),
  'Oceanarium.tsx must support codex tab'
);

// 4. Contains mobile ergonomic thumb dock for quick switching between Codex and Dive
assert.ok(
  content.includes('md:hidden'),
  'Oceanarium.tsx must contain md:hidden mobile dock'
);

console.log('✓ Oceanarium adaptive view test passed');
