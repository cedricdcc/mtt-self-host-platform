import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running strict EMODnet & VLIZ footer/about tests (TDD)...");

  const layoutPath = path.join(__dirname, '../components/Layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  // Test 1: Navbar EMODnet logo must ONLY be rendered when isAuthenticated is true
  const navbarSection = layoutContent.substring(layoutContent.indexOf('<header'), layoutContent.indexOf('</header>'));
  assert.ok(
    navbarSection.includes('{isAuthenticated &&') && navbarSection.includes('emodnet-logo.png'),
    "Navbar must wrap EMODnet logo button inside `{isAuthenticated && (...)}`"
  );

  // Test 2: Footer must be static (relative z-10), NOT sticky
  const footerSection = layoutContent.substring(layoutContent.indexOf('<footer'), layoutContent.indexOf('</footer>'));
  assert.ok(
    !footerSection.includes('sticky bottom-0'),
    "Footer must NOT have sticky bottom-0 positioning"
  );
  assert.ok(
    footerSection.includes('relative z-10'),
    "Footer must have static 'relative z-10' positioning"
  );

  // Test 3: Footer must say 'Supported by' (not 'Sponsored by')
  assert.ok(
    footerSection.includes('Supported by'),
    "Footer must state 'Supported by' for EMODnet"
  );
  assert.ok(
    !footerSection.includes('Sponsored by'),
    "Footer must NOT state 'Sponsored by'"
  );

  // Test 4: Footer must have VLIZ copyright and links to VLIZ website & Privacy policy
  assert.ok(
    footerSection.includes('VLIZ.') || footerSection.includes('VLIZ'),
    "Footer must credit VLIZ in copyright"
  );
  assert.ok(
    footerSection.includes('https://www.vliz.be/en/privacy'),
    "Footer must link to VLIZ privacy policy (https://www.vliz.be/en/privacy)"
  );
  assert.ok(
    footerSection.includes('https://www.vliz.be/en'),
    "Footer must link to VLIZ website (https://www.vliz.be/en)"
  );

  // Test 5: Bottom EU Regulation disclaimer must be completely removed
  assert.ok(
    !layoutContent.includes('Regulation (EU) 2021/1139'),
    "EU regulation disclaimer text must be removed from Layout.tsx"
  );

  // Test 6: About page must have updated wording and structure
  const aboutPath = path.join(__dirname, '../pages/About.tsx');
  const aboutContent = fs.readFileSync(aboutPath, 'utf8');

  assert.ok(
    aboutContent.includes('was developed with support of'),
    "About page intro must state 'was developed with support of'"
  );
  assert.ok(
    !aboutContent.includes('was developed within the framework of'),
    "About page intro must not say 'within the framework of'"
  );
  assert.ok(
    aboutContent.includes('EMODnet Community'),
    "About page must include an 'EMODnet Community' section/card"
  );
  assert.ok(
    aboutContent.includes('Partners') && !aboutContent.includes('Partners & Sponsors'),
    "About page must rename 'Partners & Sponsors' to 'Partners'"
  );
  assert.ok(
    aboutContent.includes('/vliz-logo.svg') && aboutContent.includes('/bodc-logo.png') && aboutContent.includes('/emodnet-logo.png'),
    "About page Partners section must feature VLIZ, BODC, and EMODnet logos"
  );

  console.log("Strict EMODnet & VLIZ footer/about tests passed successfully!");
}

try {
  run();
} catch (err) {
  console.error("Test failure (Expected in RED phase):", err.message);
  process.exit(1);
}
