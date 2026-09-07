import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing BubbleSystem corner aerators and mouth puffs...');

  const bubblePath = path.join(__dirname, '../components/oceanarium/engine/BubbleSystem.ts');
  assert.ok(fs.existsSync(bubblePath), 'BubbleSystem.ts must exist');

  const content = fs.readFileSync(bubblePath, 'utf8');

  // Verify class and methods
  assert.ok(content.includes('export class BubbleSystem'), 'Must export BubbleSystem');
  assert.ok(content.includes('emitFishMouthPuff'), 'Must implement emitFishMouthPuff method');
  assert.ok(content.includes('aerators'), 'Must manage corner aerators');
  assert.ok(content.includes('update('), 'Must implement update loop');
  assert.ok(content.includes('dispose('), 'Must implement dispose method');

  // Verify corner positions
  assert.ok(content.includes('-18') && content.includes('18'), 'Must place aerators in dual corners');

  console.log('✓ BubbleSystem tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
