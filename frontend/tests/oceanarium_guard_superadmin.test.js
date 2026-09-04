import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const pagePath = path.join(__dirname, '../pages/Oceanarium.tsx');
  assert.ok(fs.existsSync(pagePath), 'Oceanarium.tsx must exist');

  const content = fs.readFileSync(pagePath, 'utf8');

  // Ensure Oceanarium doesn't strictly check only user.is_admin !== 1
  assert.ok(
    !content.includes('if (!user || user.is_admin !== 1)'),
    'Oceanarium.tsx should not strictly block non-numeric is_admin === 1'
  );

  // Ensure it checks hasAccess encompassing isSuperAdmin, isAdmin, and hasGachaAccess
  assert.ok(
    content.includes('hasAccess'),
    'Oceanarium.tsx must define hasAccess'
  );
  assert.ok(
    content.includes('isSuperAdmin'),
    'Oceanarium.tsx hasAccess must check isSuperAdmin'
  );
  assert.ok(
    content.includes('hasGachaAccess'),
    'Oceanarium.tsx hasAccess must check hasGachaAccess'
  );
  assert.ok(
    content.includes('isAdmin'),
    'Oceanarium.tsx hasAccess must check isAdmin'
  );

  // Ensure data loading triggers when hasAccess is true
  assert.ok(
    content.includes('if (hasAccess)'),
    'Oceanarium.tsx must trigger loadData when hasAccess is true'
  );

  console.log('✓ Oceanarium internal superadmin & gacha access guard verified');
}

run();
