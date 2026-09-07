# Footer & About Page Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove footer stickiness, update footer branding to "Supported by EMODnet" and VLIZ copyright with privacy links, update the About page with an EMODnet community card and streamlined partner logo strip, and relocate VLIZ Vocabulary Server to architecture downstream systems.

**Architecture:** Frontend React component refactoring in `Layout.tsx` and `About.tsx`, removing window scroll-listeners and viewport threshold state in favor of static semantic document flow, creating a 2-column ecosystem grid (NVS + EMODnet Community), converting partners into a clean logo strip, and updating unit tests in `emodnet-content.test.js`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vite, Node.js assert test runner.

## Global Constraints

- Git branch: `fix/footer-about`
- Footer must be static (`relative z-10`), never sticky.
- Footer EMODnet text must be `"Supported by"`.
- Footer copyright must be `&copy; {format(parse(now()), 'YYYY')} VLIZ.` with links to `https://www.vliz.be/en` and `https://www.vliz.be/en/privacy`.
- Bottom EU regulation 2021/1139 paragraph must be deleted.
- About page intro must use `"was developed with support of EMODnet Biology"`.
- Partners section must be titled `"Partners"` and contain clean logo links for VLIZ, EMODnet, and BODC without descriptive body cards.
- VLIZ Vocabulary Server must not be in Partners; placed as downstream consumer in Architecture.

---

### Task 1: Partner Logo Assets Setup

**Files:**
- Create: `frontend/public/vliz-logo.svg`
- Create: `frontend/public/bodc-logo.png`
- Test: `frontend/public/emodnet-logo.png` (verify exists)

**Interfaces:**
- Consumes: Official vector/PNG assets from VLIZ (`https://www.vliz.be`) and BODC (`https://www.bodc.ac.uk`).
- Produces: Static public assets `/vliz-logo.svg` and `/bodc-logo.png` accessible by Vite frontend.

- [ ] **Step 1: Fetch and save official VLIZ SVG logo**

Fetch official vector SVG from `https://www.vliz.be/en` and save to `frontend/public/vliz-logo.svg`:
```bash
curl -sL https://www.vliz.be/en | sed -n '/<svg.*class="logo"/,/<\/svg>/p' > frontend/public/vliz-logo.svg
```
Verify the file contains `<svg` and `</svg>` with valid XML structure.

- [ ] **Step 2: Fetch and save official BODC PNG logo**

Fetch official BODC logo from `https://www.bodc.ac.uk/assets/img/bodc-logo-colour-white.png` and save to `frontend/public/bodc-logo.png`:
```bash
curl -sL https://www.bodc.ac.uk/assets/img/bodc-logo-colour-white.png -o frontend/public/bodc-logo.png
```
Verify with `file frontend/public/bodc-logo.png` that it is a valid PNG image.

- [ ] **Step 3: Verify assets exist in public folder**

Run: `ls -la frontend/public/vliz-logo.svg frontend/public/bodc-logo.png frontend/public/emodnet-logo.png`
Expected: All 3 files exist with non-zero size.

- [ ] **Step 4: Commit assets**

```bash
git add frontend/public/vliz-logo.svg frontend/public/bodc-logo.png
git commit -m "assets: add VLIZ and BODC logos to public directory"
```

---

### Task 2: Update Content & Footer Unit Tests (TDD)

**Files:**
- Modify: `frontend/tests/emodnet-content.test.js`

**Interfaces:**
- Consumes: `frontend/components/Layout.tsx` and `frontend/pages/About.tsx` file contents.
- Produces: Test runner verifying static footer, "Supported by", VLIZ copyright & privacy links, no EU disclaimer, About page support text, EMODnet community card, and Partners logo section.

- [ ] **Step 1: Write the updated strict content tests**

Update `frontend/tests/emodnet-content.test.js`:
```javascript
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
```

- [ ] **Step 2: Run tests to verify they FAIL (RED phase)**

Run: `node frontend/tests/emodnet-content.test.js`
Expected: FAIL with assertion error showing footer stickiness / "Supported by" / VLIZ links missing.

- [ ] **Step 3: Commit updated test**

```bash
git add frontend/tests/emodnet-content.test.js
git commit -m "test: update emodnet-content tests for static footer, VLIZ copyright, and About page updates"
```

---

### Task 3: Global Footer Refactoring in `Layout.tsx`

**Files:**
- Modify: `frontend/components/Layout.tsx`

**Interfaces:**
- Consumes: `frontend/public/emodnet-logo.png`, `frontend/public/mtt-logo.svg`.
- Produces: Clean, static footer with "Supported by", VLIZ copyright, Privacy Policy link, VLIZ website link, and no EU disclaimer.

- [ ] **Step 1: Remove scroll listener and sticky state from `Layout.tsx`**

Remove:
- `const [isFooterVisible, setIsFooterVisible] = useState(false);`
- `const footerRef = React.useRef<HTMLElement>(null);`
- The `useEffect` that attaches `handleScroll` to `window`.

- [ ] **Step 2: Update the `<footer>` markup in `Layout.tsx`**

Replace lines 357–402 with:
```tsx
      {/* Footer - static standard footer */}
      <footer className="relative z-10 bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <img 
                src="/mtt-logo.svg" 
                alt="Marine Term Translations" 
                className="w-5 h-5 transition-transform group-hover:scale-105" 
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Marine Term Translations
              </span>
            </Link>
            <div className="flex items-center border-slate-300 dark:border-slate-800 sm:border-l sm:pl-6 py-0.5 gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                Supported by
              </span>
              <a 
                href="https://emodnet.ec.europa.eu/en/biology" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:scale-105 active:scale-95 transition-transform duration-200"
                title="EMODnet Biology"
              >
                <img 
                  src="/emodnet-logo.png" 
                  alt="EMODnet Biology" 
                  className="h-8 object-contain bg-white/90 dark:bg-white px-1.5 py-0.5 rounded" 
                />
              </a>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs text-slate-500 dark:text-slate-400 text-center md:text-right">
            <span>
              &copy; {format(parse(now()), 'YYYY')} VLIZ.
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <a 
              href="https://www.vliz.be/en" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-marine-600 dark:hover:text-marine-400 transition-colors"
            >
              VLIZ Website
            </a>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <a 
              href="https://www.vliz.be/en/privacy" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-marine-600 dark:hover:text-marine-400 transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
```

- [ ] **Step 3: Run partial test to verify footer assertions pass**

Run: `node frontend/tests/emodnet-content.test.js`
Expected: Tests 1 through 5 pass (Test 6 for About page still fails).

- [ ] **Step 4: Commit footer changes**

```bash
git add frontend/components/Layout.tsx
git commit -m "feat(footer): remove stickiness, update to Supported by EMODnet, and add VLIZ copyright with privacy links"
```

---

### Task 4: About Page Overhaul in `About.tsx`

**Files:**
- Modify: `frontend/pages/About.tsx`

**Interfaces:**
- Consumes: `/vliz-logo.svg`, `/bodc-logo.png`, `/emodnet-logo.png`.
- Produces: Updated About page with "with support of" text, dual-column NVS & EMODnet Community cards, downstream VLIZ Vocabulary Server card in Architecture, and streamlined Partners logo strip.

- [ ] **Step 1: Update lead intro text in `About.tsx`**

Replace:
```tsx
was developed within the framework of <a href="https://emodnet.ec.europa.eu/en/biology" target="_blank" rel="noopener noreferrer" className="text-marine-600 hover:underline font-semibold">EMODnet Biology</a>.
```
With:
```tsx
was developed with support of <a href="https://emodnet.ec.europa.eu/en/biology" target="_blank" rel="noopener noreferrer" className="text-marine-600 hover:underline font-semibold">EMODnet Biology</a>.
```

- [ ] **Step 2: Add Downstream Vocabulary Systems card into Architecture grid**

In the "Built for Data Sovereignty" grid (`grid sm:grid-cols-2 gap-4`), update to include downstream ingestion by VLIZ Vocabulary Server:
```tsx
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                      <Share2 size={16} className="text-marine-500" /> Downstream Vocabulary Ingestion
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                      Approved translations can be ingested directly into institutional systems like the <a href="https://vocab.vliz.be/" target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-400 hover:underline font-medium">VLIZ Vocabulary Server</a> for semantic cataloging and search.
                  </p>
              </div>
```

- [ ] **Step 3: Replace NVS Info Box with Dual-Column Ecosystem Section (NVS + EMODnet Community)**

Replace the single NVS info box with:
```tsx
      {/* Marine Vocabulary & Data Ecosystem Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-16">
        {/* NVS Authority Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wide mb-4">
              Vocabulary Authority
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              <a href="https://vocab.nerc.ac.uk/" target="_blank" rel="noopener noreferrer" className="hover:text-marine-600 dark:hover:text-marine-400 transition-colors">
                NERC Vocabulary Server
              </a>
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              The NVS provides access to curated collections of controlled vocabularies in oceanographic and earth-science domains. Managed by the <strong>British Oceanographic Data Centre (BODC)</strong> and funded by the UK's <strong>Natural Environment Research Council (NERC)</strong>, it serves as the foundational authority from which MTT retrieves standardized concepts for community translation.
            </p>
          </div>
          <div>
            <a 
              href="https://vocab.nerc.ac.uk/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-marine-600 dark:text-marine-400 text-sm font-semibold hover:underline inline-flex items-center gap-1"
            >
              Explore NVS Vocabularies &rarr;
            </a>
          </div>
        </div>

        {/* EMODnet Community Card */}
        <div className="bg-marine-50/50 dark:bg-slate-800/50 border border-marine-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-marine-100 dark:bg-marine-900 text-marine-700 dark:text-marine-300 text-xs font-bold uppercase tracking-wide mb-4">
              Marine Science Community
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              <a href="https://emodnet.ec.europa.eu/en/biology" target="_blank" rel="noopener noreferrer" className="hover:text-marine-600 dark:hover:text-marine-400 transition-colors">
                EMODnet Community
              </a>
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              The European Marine Observation and Data Network (<strong>EMODnet Biology</strong>) unifies fragmented marine biodiversity data from across Europe. Multilingual translations produced on MTT enable European data contributors to map local terminologies to common standards, significantly increasing the accessibility and FAIR reuse of marine biodiversity observations.
            </p>
          </div>
          <div>
            <a 
              href="https://emodnet.ec.europa.eu/en/biology" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-marine-600 dark:text-marine-400 text-sm font-semibold hover:underline inline-flex items-center gap-1"
            >
              Learn about EMODnet Biology &rarr;
            </a>
          </div>
        </div>
      </div>
```

- [ ] **Step 4: Update Partners section into streamlined Logo Strip**

Replace the existing `Partners & Sponsors` section with:
```tsx
      {/* Partners Logo Strip */}
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 mb-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Partners</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto mb-8">
          Developed and maintained in collaboration with leading marine research institutions and data networks.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto items-center">
          {/* VLIZ */}
          <a 
            href="https://www.vliz.be/en" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="h-24 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-400 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
            title="Flanders Marine Institute (VLIZ)"
          >
            <img 
              src="/vliz-logo.svg" 
              alt="Flanders Marine Institute (VLIZ)" 
              className="max-h-12 w-auto object-contain group-hover:scale-105 transition-transform duration-200" 
            />
          </a>

          {/* EMODnet */}
          <a 
            href="https://emodnet.ec.europa.eu/en/biology" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="h-24 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-400 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
            title="EMODnet Biology"
          >
            <img 
              src="/emodnet-logo.png" 
              alt="EMODnet Biology" 
              className="max-h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200 bg-white/90 px-2 py-1 rounded" 
            />
          </a>

          {/* BODC */}
          <a 
            href="https://www.bodc.ac.uk/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="h-24 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-400 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
            title="British Oceanographic Data Centre (BODC)"
          >
            <img 
              src="/bodc-logo.png" 
              alt="British Oceanographic Data Centre (BODC)" 
              className="max-h-12 w-auto object-contain group-hover:scale-105 transition-transform duration-200" 
            />
          </a>
        </div>
      </div>
```

- [ ] **Step 5: Run tests to verify all pass (GREEN phase)**

Run: `node frontend/tests/emodnet-content.test.js`
Expected: Output: `Strict EMODnet & VLIZ footer/about tests passed successfully!` with exit code 0.

- [ ] **Step 6: Commit About page updates**

```bash
git add frontend/pages/About.tsx
git commit -m "feat(about): add EMODnet community card, streamline Partners logo strip, and relocate VLIZ vocab server"
```

---

### Task 5: Build Verification & Final Sanity Check

**Files:**
- Test: All tests in `frontend/tests/`
- Build: `frontend/dist`

- [ ] **Step 1: Run complete test suite**

Run:
```bash
node frontend/tests/emodnet-content.test.js
node frontend/tests/admin-community-goals-ui.test.js
node frontend/tests/community-goal-widget-pufferfish.test.js
```
Expected: All tests pass with exit code 0.

- [ ] **Step 2: Run frontend production build**

Run: `npm --prefix frontend run build`
Expected: Vite build succeeds with exit code 0.

- [ ] **Step 3: Review git status and diff on branch `fix/footer-about`**

Run: `git status && git log -n 5 --oneline`
Expected: Clean working tree on `fix/footer-about` with structured, logical commits.
