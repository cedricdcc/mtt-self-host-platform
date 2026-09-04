import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const servicePath = path.join(__dirname, '../services/ecosystemService.ts');
  const typesPath = path.join(__dirname, '../types.ts');

  assert.ok(fs.existsSync(servicePath), 'frontend/services/ecosystemService.ts must exist');
  assert.ok(fs.existsSync(typesPath), 'frontend/types.ts must exist');

  const typesContent = fs.readFileSync(typesPath, 'utf8');
  assert.ok(typesContent.includes('export interface GachaSpecies'), 'GachaSpecies interface must be exported in types.ts');
  assert.ok(typesContent.includes('export interface UserEcosystem'), 'UserEcosystem interface must be exported in types.ts');
  assert.ok(typesContent.includes('export interface UserFish'), 'UserFish interface must be exported in types.ts');

  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert.ok(serviceContent.includes('fetchEcosystem'), 'ecosystemService must implement fetchEcosystem');
  assert.ok(serviceContent.includes('feedEcosystem'), 'ecosystemService must implement feedEcosystem');
  assert.ok(serviceContent.includes('pullGacha'), 'ecosystemService must implement pullGacha');
  assert.ok(serviceContent.includes('fetchCodex'), 'ecosystemService must implement fetchCodex');

  console.log('✓ Frontend Ecosystem Service Client contract verified');
}

run();
