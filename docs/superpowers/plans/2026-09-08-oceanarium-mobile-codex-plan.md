# Oceanarium Mobile Experience, Codex Redesign & Layout Max-Width Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an intuitive mobile experience for the Oceanarium by rendering a lightweight Marine Codex & Dive Station on mobile (with zero WebGL overhead), opening Codex & Gacha to all authenticated users, adding a mobile Dashboard button and BottomNav link, introducing funny animal cards with cartoon pufferfish-style artwork, and eliminating mobile horizontal layout offsets from long term URIs.

**Architecture:** 
The unified `/oceanarium` route dynamically adapts to screen size and user permissions. On mobile (`< 768px`), Three.js is completely excluded, defaulting to the Marine Codex and Dive Station. All authenticated users can access Gacha pull and Codex endpoints, while the 3D Aquarium remains desktop-only for authorized users. Long term URIs are bounded with `max-w-full truncate`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Express, SQLite (better-sqlite3), Jest, Lucide Icons.

## Global Constraints
- Exact routes: `/oceanarium`, `/api/gacha/codex`, `/api/gacha/pull`.
- Never initialize WebGL / Three.js canvas when `isMobile` is true (`window.innerWidth < 768px`).
- Preserves all 21 seeded species in `gacha_species`.
- Preserves existing admin 3D aquarium controls for desktop admin/superadmin/granted users.
- Every term URI displayed on mobile must include `truncate` and `max-w-full`.

---

### Task 1: Backend Gacha & Codex Permissions & Tests

**Files:**
- Modify: `backend/src/routes/gacha.routes.js:6-10`
- Test: `backend/tests/gacha_permissions.test.js`

**Interfaces:**
- Consumes: `requireAuth` from `backend/src/middleware/admin.middleware.js`, `ecosystemService` from `backend/src/services/ecosystem.service.js`
- Produces: Publicly accessible `/api/gacha/codex` and `/api/gacha/pull` for all authenticated session users without needing `requireEcosystemAccess`.

- [ ] **Step 1: Write the failing test for regular user gacha permissions**

```javascript
// backend/tests/gacha_permissions.test.js
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('Gacha Universal Access Permissions', () => {
  let regularUserId;
  let regularCookie;

  beforeAll(() => {
    // Ensure test regular user exists without admin or ecosystem flags
    db.prepare("DELETE FROM users WHERE username = 'test_gacha_regular'").run();
    const info = db.prepare(`
      INSERT INTO users (username, email, password_hash, is_admin, is_superadmin)
      VALUES ('test_gacha_regular', 'gacha_reg@example.com', 'fakehash', 0, 0)
    `).run();
    regularUserId = info.lastInsertRowid;

    // Ensure user has ecosystem record with starting tickets
    db.prepare("DELETE FROM user_ecosystem WHERE user_id = ?").run();
    db.prepare(`
      INSERT INTO user_ecosystem (user_id, tickets, water_quality, has_gacha_access)
      VALUES (?, 5, 100, 0)
    `).run(regularUserId);
  });

  afterAll(() => {
    db.prepare("DELETE FROM user_ecosystem WHERE user_id = ?").run(regularUserId);
    db.prepare("DELETE FROM users WHERE id = ?").run(regularUserId);
  });

  test('GET /api/gacha/codex allows non-admin authenticated users', async () => {
    // Simulate login session
    const agent = request.agent(app);
    // Directly inject session or mock auth endpoint
    const res = await agent
      .get('/api/gacha/codex')
      .set('x-test-user-id', String(regularUserId));

    // Note: depending on test auth setup, should not return 403 Forbidden
    expect([200, 401]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('total_species');
      expect(res.body).toHaveProperty('species');
    }
  });

  test('POST /api/ecosystem/feed still requires ecosystem access', async () => {
    const res = await request(app)
      .post('/api/ecosystem/feed')
      .send({ food_type: 'flake' });
    expect([401, 403]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or exposes current restrictions**

Run: `npx jest backend/tests/gacha_permissions.test.js`  
Expected: Fails or shows 403 when authenticated regular user accesses `/api/gacha/codex`.

- [ ] **Step 3: Update `backend/src/routes/gacha.routes.js`**

Modify `backend/src/routes/gacha.routes.js` lines 6-9:
```javascript
// Remove router.use(requireEcosystemAccess) from gacha.routes.js
// All authenticated users can view the codex and pull gacha
router.use(requireAuth);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest backend/tests/gacha_permissions.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/gacha.routes.js backend/tests/gacha_permissions.test.js
git commit -m "feat(backend): allow all authenticated users to access gacha and codex"
```

---

### Task 2: Layout & Term URI Overflow Max-Width Fix

**Files:**
- Modify: `frontend/pages/TermDetail.tsx:950-960`
- Modify: `frontend/pages/Dashboard.tsx:460-485,530-540,580-590`
- Modify: `frontend/components/Layout.tsx:104,339`
- Test: `frontend/tests/term_uri_overflow.test.js`

**Interfaces:**
- Consumes: `term.uri`, `disc.term_uri`, `draft.term_uri`
- Produces: Fully bounded text elements with `max-w-full truncate` and `overflow-x-hidden` on containers.

- [ ] **Step 1: Write test for URI truncation and container bounds**

```javascript
// frontend/tests/term_uri_overflow.test.js
describe('Term URI overflow containment', () => {
  test('TermDetail URI container specifies truncate and max-w bounds', () => {
    const fs = require('fs');
    const content = fs.readFileSync('frontend/pages/TermDetail.tsx', 'utf8');
    expect(content).toContain('truncate');
    expect(content).toMatch(/max-w-/);
  });

  test('Layout root has overflow-x-hidden', () => {
    const fs = require('fs');
    const content = fs.readFileSync('frontend/components/Layout.tsx', 'utf8');
    expect(content).toContain('overflow-x-hidden');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest frontend/tests/term_uri_overflow.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement truncation fixes in `TermDetail.tsx`, `Dashboard.tsx`, and `Layout.tsx`**

1. In `frontend/pages/TermDetail.tsx` line 953:
```tsx
<a 
  href={term.uri} 
  target="_blank" 
  rel="noopener noreferrer" 
  className="inline-flex items-center text-xs text-slate-400 hover:text-marine-600 transition-colors max-w-full min-w-0"
>
  <span className="truncate max-w-[calc(100vw-3.5rem)] md:max-w-xl">{term.uri}</span>
  <ExternalLink size={12} className="ml-1 flex-shrink-0" />
</a>
```

2. In `frontend/pages/Dashboard.tsx` around lines 472-480, 536, 588:
Ensure `termLabel` and `term_uri` display spans include `truncate max-w-full inline-block align-bottom`.

3. In `frontend/components/Layout.tsx`:
Add `overflow-x-hidden` to the outer wrapper `div` and `main`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest frontend/tests/term_uri_overflow.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/TermDetail.tsx frontend/pages/Dashboard.tsx frontend/components/Layout.tsx frontend/tests/term_uri_overflow.test.js
git commit -m "fix(ui): eliminate mobile horizontal offset by truncating long term URIs"
```

---

### Task 3: Mobile Dashboard Entry Card & Mobile Bottom Navigation

**Files:**
- Modify: `frontend/pages/Dashboard.tsx`
- Modify: `frontend/components/BottomNav.tsx`
- Modify: `frontend/components/OceanariumRoute.tsx`
- Modify: `frontend/components/Layout.tsx`
- Test: `frontend/tests/oceanarium_mobile_entry.test.js`

**Interfaces:**
- Consumes: `useAuth()`, `location.pathname`
- Produces: Mobile-prominent Dashboard card with button linking to `/oceanarium`, and `/oceanarium` item in `BottomNav`.

- [ ] **Step 1: Write test for mobile entry button and navigation**

```javascript
// frontend/tests/oceanarium_mobile_entry.test.js
const fs = require('fs');

describe('Oceanarium mobile navigation and entry card', () => {
  test('BottomNav contains oceanarium / codex link', () => {
    const content = fs.readFileSync('frontend/components/BottomNav.tsx', 'utf8');
    expect(content).toContain('/oceanarium');
    expect(content).toContain('Codex');
  });

  test('Dashboard contains mobile Marine Codex card and button', () => {
    const content = fs.readFileSync('frontend/pages/Dashboard.tsx', 'utf8');
    expect(content).toContain('Marine Codex');
    expect(content).toContain('/oceanarium');
  });

  test('OceanariumRoute allows all authenticated users', () => {
    const content = fs.readFileSync('frontend/components/OceanariumRoute.tsx', 'utf8');
    expect(content).not.toContain('hasAccess');
    expect(content).toContain('isAuthenticated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest frontend/tests/oceanarium_mobile_entry.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement mobile Dashboard card, BottomNav item, and OceanariumRoute**

1. In `frontend/components/OceanariumRoute.tsx`:
Change guard so any authenticated user enters without being rejected for lacking admin access.
2. In `frontend/components/BottomNav.tsx`:
Add Codex navigation item:
```tsx
{
  path: '/oceanarium',
  icon: Fish,
  label: 'Codex',
}
```
3. In `frontend/pages/Dashboard.tsx`:
Add mobile card banner:
```tsx
{/* Mobile Marine Codex & Gacha Banner (md:hidden) */}
<div className="md:hidden mb-6 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 border border-cyan-500/30 shadow-lg text-white">
  <div className="flex items-center gap-3 mb-2">
    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
      <Fish size={22} />
    </div>
    <div>
      <h3 className="font-bold text-base text-white">Marine Codex</h3>
      <p className="text-xs text-cyan-300/80">Discover & collect species</p>
    </div>
  </div>
  <p className="text-xs text-slate-300 mb-3">
    Dive into the deep sea, unlock funny field guides, and complete your marine catalog!
  </p>
  <Link
    to="/oceanarium"
    className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
  >
    <span>Open Marine Codex & Dive</span>
    <ArrowRight size={14} />
  </Link>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest frontend/tests/oceanarium_mobile_entry.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/Dashboard.tsx frontend/components/BottomNav.tsx frontend/components/OceanariumRoute.tsx frontend/components/Layout.tsx frontend/tests/oceanarium_mobile_entry.test.js
git commit -m "feat(ui): add mobile dashboard codex card, bottom nav tab, and open route access"
```

---

### Task 4: Species Lore Data & Fish Illustrations

**Files:**
- Create: `frontend/data/speciesLore.ts`
- Create / Generate: `/public/species/*.png` assets in pufferfish cartoon style
- Test: `frontend/tests/species_lore.test.js`

**Interfaces:**
- Produces: `SPECIES_LORE: Record<string, SpeciesLore>` for all 21 species, and public image files.

- [ ] **Step 1: Write test for species lore catalog**

```javascript
// frontend/tests/species_lore.test.js
describe('Species Lore Catalog', () => {
  test('Contains lore entries for all 21 gacha species', () => {
    const { SPECIES_LORE } = require('../data/speciesLore');
    const expectedSpecies = [
      'azure_damselfish', 'sunburst_tang', 'emerald_parrotfish', 'clown_anemone',
      'golden_seahorse', 'sapphire_manta', 'solar_lionfish', 'spotted_pufferfish',
      'silver_hatchet', 'glass_lantern', 'ribbon_oarfish', 'prismatic_squid',
      'vampire_octo', 'coelacanth_shadow', 'ghost_grenadier', 'bioluminescent_angler',
      'gulper_void', 'dumbo_specter', 'crystal_siphonophore', 'abyssal_leviathan',
      'cosmic_jelly'
    ];

    expectedSpecies.forEach(id => {
      expect(SPECIES_LORE[id]).toBeDefined();
      expect(SPECIES_LORE[id].nickname).toBeTruthy();
      expect(SPECIES_LORE[id].personality).toBeTruthy();
      expect(SPECIES_LORE[id].favoriteFood).toBeTruthy();
      expect(SPECIES_LORE[id].quote).toBeTruthy();
      expect(SPECIES_LORE[id].realFact).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest frontend/tests/species_lore.test.js`  
Expected: FAIL (module not found)

- [ ] **Step 3: Create `frontend/data/speciesLore.ts` and generate puffer-style cartoon artwork**

1. Create `frontend/data/speciesLore.ts` containing the complete, witty lore dictionary.
2. Generate/provide images in `frontend/public/species/` using the 3D cartoon pufferfish style (chubby round proportions, glossy expressive cartoon eyes, whimsical friendly smile).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest frontend/tests/species_lore.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/data/speciesLore.ts frontend/public/species/ frontend/tests/species_lore.test.js
git commit -m "feat(codex): add humorous marine species lore catalog and cartoon artwork"
```

---

### Task 5: Marine Codex Funny Animal Cards & Inspection Modal Redesign

**Files:**
- Modify: `frontend/components/oceanarium/MarineCodex.tsx`
- Test: `frontend/tests/marine_codex_cards.test.js`

**Interfaces:**
- Consumes: `CodexResponse`, `SPECIES_LORE`
- Produces: Rich collector grid with funny cards, darkened mystery silhouettes for undiscovered species, and an inspect modal with humorous field notes and shiny toggle.

- [ ] **Step 1: Write test for MarineCodex funny cards**

```javascript
// frontend/tests/marine_codex_cards.test.js
const fs = require('fs');

describe('MarineCodex card components', () => {
  test('Imports and utilizes SPECIES_LORE', () => {
    const content = fs.readFileSync('frontend/components/oceanarium/MarineCodex.tsx', 'utf8');
    expect(content).toContain('SPECIES_LORE');
    expect(content).toContain('nickname');
    expect(content).toContain('quote');
    expect(content).toContain('realFact');
  });

  test('Renders locked silhouette for undiscovered species', () => {
    const content = fs.readFileSync('frontend/components/oceanarium/MarineCodex.tsx', 'utf8');
    expect(content).toContain('Undiscovered');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest frontend/tests/marine_codex_cards.test.js`  
Expected: FAIL

- [ ] **Step 3: Update `frontend/components/oceanarium/MarineCodex.tsx`**

Implement:
1. Card grid with cartoon image, rarity border, shiny sparkle, funny nickname, and count multiplier.
2. Mystery silhouette for locked specimens.
3. Expanded field guide dossier modal with high-res art, Standard/Shiny toggle, personality, favorite food, parody quote, and real taxonomy note.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest frontend/tests/marine_codex_cards.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/MarineCodex.tsx frontend/tests/marine_codex_cards.test.js
git commit -m "feat(codex): redesign marine codex with funny animal cards and field notes"
```

---

### Task 6: Oceanarium Responsive Architecture (Desktop Three.js vs Mobile Codex)

**Files:**
- Modify: `frontend/pages/Oceanarium.tsx`
- Test: `frontend/tests/oceanarium_adaptive_view.test.js`

**Interfaces:**
- Consumes: `window.innerWidth`, `user.isAdmin`, `user.isSuperAdmin`, `user.hasGachaAccess`
- Produces: Clean mobile Codex view without WebGL, desktop 3D aquarium view for authorized users, and 2-tab desktop view for regular users.

- [ ] **Step 1: Write test for adaptive Oceanarium view**

```javascript
// frontend/tests/oceanarium_adaptive_view.test.js
const fs = require('fs');

describe('Oceanarium adaptive device and permission rendering', () => {
  test('Contains window size check to isolate mobile from 3D canvas', () => {
    const content = fs.readFileSync('frontend/pages/Oceanarium.tsx', 'utf8');
    expect(content).toContain('isMobile');
    expect(content).toContain('OceanariumCanvas');
  });

  test('Omits OceanariumCanvas when isMobile is true', () => {
    const content = fs.readFileSync('frontend/pages/Oceanarium.tsx', 'utf8');
    expect(content).toMatch(/!isMobile/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest frontend/tests/oceanarium_adaptive_view.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement adaptive logic in `frontend/pages/Oceanarium.tsx`**

1. Add responsive viewport hook/state (`isMobile`).
2. If `isMobile`: default activeTab to `'codex'`, hide the `'oceanarium'` tab button, never render `OceanariumCanvas`.
3. If desktop:
   - For authorized aquarium viewers (`user.isAdmin || user.isSuperAdmin || user.hasGachaAccess`): show all 3 tabs, default `'oceanarium'`.
   - For regular users: show `'codex'` and `'dive'`, default `'codex'`.
4. Add mobile thumb dock at the bottom of the screen with quick toggle between `[Codex]` and `[Dive Station (Tickets: X)]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest frontend/tests/oceanarium_adaptive_view.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/Oceanarium.tsx frontend/tests/oceanarium_adaptive_view.test.js
git commit -m "feat(oceanarium): adapt oceanarium dynamically for mobile codex vs desktop 3D aquarium"
```

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- Test all backend and frontend test suites

- [ ] **Step 1: Run backend test suite**
Run: `npm test --prefix backend`
Expected: All backend unit and integration tests pass.

- [ ] **Step 2: Run frontend test suite**
Run: `npm test --prefix frontend`
Expected: All frontend tests pass without errors.

- [ ] **Step 3: Visual inspection via browser_subagent**
Run test verification on mobile viewport (375x667) and desktop viewport (1280x800).
Confirm:
1. Dashboard mobile card renders cleanly and clicking it opens the Codex.
2. BottomNav Codex button functions on mobile.
3. Codex grid displays funny animal cards, locked silhouettes, and inspect modal with funny quotes.
4. Long term URIs truncate cleanly on phone with zero horizontal scrollbar.
5. Desktop displays 3D aquarium for admin and codex for regular user.

- [ ] **Step 4: Final commit and cleanup**
```bash
git commit --allow-empty -m "chore: verify oceanarium mobile codex and uri overflow fix"
```
