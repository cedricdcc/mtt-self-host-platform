import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stationPath = path.join(__dirname, '../components/oceanarium/DiveStation.tsx');

assert.ok(fs.existsSync(stationPath), 'DiveStation.tsx must exist');
const content = fs.readFileSync(stationPath, 'utf8');

assert.ok(content.includes('sonar_lock') || content.includes('Sonar Anomaly') || content.includes('anomaly'), 'Must feature sonar lock/anomaly stage');
assert.ok(content.includes('oceanAudio'), 'Must use oceanAudio engine');
assert.ok(content.includes('Skip') || content.includes('Reveal All'), 'Must include Skip / Reveal All option');
assert.ok(content.includes('Sunlit') && content.includes('Abyssal'), 'Must reference depth zones');

console.log('✓ DiveStation suspense mechanics verified');
