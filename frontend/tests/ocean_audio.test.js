import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioPath = path.join(__dirname, '../services/oceanAudio.ts');

assert.ok(fs.existsSync(audioPath), 'oceanAudio.ts must exist');
const content = fs.readFileSync(audioPath, 'utf8');

assert.ok(content.includes('playSonarPing'), 'Must export playSonarPing');
assert.ok(content.includes('playTrenchDrone'), 'Must export playTrenchDrone');
assert.ok(content.includes('playAnomalyAlert'), 'Must export playAnomalyAlert');
assert.ok(content.includes('playCanisterHiss'), 'Must export playCanisterHiss');
assert.ok(content.includes('playRevealStinger'), 'Must export playRevealStinger');

console.log('✓ Ocean audio service structure verified');
