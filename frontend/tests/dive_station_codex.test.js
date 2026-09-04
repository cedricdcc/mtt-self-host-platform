import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const divePath = path.join(__dirname, '../components/oceanarium/DiveStation.tsx');
  const codexPath = path.join(__dirname, '../components/oceanarium/MarineCodex.tsx');

  assert.ok(fs.existsSync(divePath), 'DiveStation.tsx must exist');
  assert.ok(fs.existsSync(codexPath), 'MarineCodex.tsx must exist');

  const diveContent = fs.readFileSync(divePath, 'utf8');
  assert.ok(diveContent.includes('Single Dive'), 'DiveStation must support Single Dive');
  assert.ok(diveContent.includes('Expedition Dive'), 'DiveStation must support Expedition Dive (10x)');

  const codexContent = fs.readFileSync(codexPath, 'utf8');
  assert.ok(
    codexContent.includes('completion_percentage') || codexContent.includes('%'),
    'Codex must display collection completion percentage'
  );

  console.log('✓ Dive Station and Marine Codex verified');
}

run();
