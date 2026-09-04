import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const pagePath = path.join(__dirname, '../pages/Oceanarium.tsx');
  const appPath = path.join(__dirname, '../App.tsx');
  const layoutPath = path.join(__dirname, '../components/Layout.tsx');

  assert.ok(fs.existsSync(pagePath), 'Oceanarium.tsx must exist');

  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.ok(appContent.includes('/oceanarium'), 'App.tsx must define /oceanarium route');

  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  assert.ok(
    layoutContent.includes('/oceanarium') && (layoutContent.includes('user?.isAdmin') || layoutContent.includes('is_admin')),
    'Layout.tsx must link to /oceanarium gated behind admin check'
  );

  console.log('✓ Oceanarium routing and admin guard verified');
}

run();
