# Oceanarium Mobile Experience, Codex Redesign & Layout Max-Width Fix

**Date:** 2026-09-08  
**Status:** Approved by User  
**Topic:** Oceanarium Mobile Experience, Marine Codex Funny Cards, Universal Gacha Access, and Long Term URI Layout Fix

---

## 1. Overview & Goals

The Oceanarium is a gamified marine ecosystem feature in the Marine Term Translations (MTT) platform. Currently, the experience on mobile phones is suboptimal: heavy 3D WebGL rendering causes lag or crashes on mobile devices, there is no direct navigation entry point for signed-in mobile users, and long vocabulary term URIs create horizontal layout offsets and page blowouts on small screens.

This design achieves four primary goals:
1. **Universal Codex & Gacha Access:** Make the Marine Codex and Dive Station (Gacha) available to all signed-in users, while reserving the 3D Three.js Aquarium tab on desktop for authorized aquarium viewers.
2. **Device-Adaptive Oceanarium:** Mobile phones render directly into a lightweight, fast **Marine Codex & Dive Station** view with zero WebGL/Three.js overhead. Desktop PC maintains the full 3D aquarium for authorized users.
3. **Mobile Dashboard Button & Navigation:** Add an inviting "Marine Codex & Dive Station" card to the mobile Dashboard and a 1-tap Codex icon to the mobile bottom navigation bar (`BottomNav.tsx`).
4. **Funny Animal Cards & Pufferfish-Style Artwork:** Upgrade the Codex with humorous animal cards (quirky bios, funny quotes, personality traits, and real biology facts) featuring cute cartoon illustrations in the style of the homepage's 3D cartoon pufferfish.
5. **Mobile Layout Offset Elimination:** Add `max-w-full truncate` rules and container boundaries (`overflow-x-hidden`) to eliminate horizontal scroll displacement caused by long term URIs on phone screens.

---

## 2. Architecture & Detailed Changes

### 2.1 Access Control & Backend Permissions

#### `backend/src/routes/gacha.routes.js`
* **Current State:** Routes are protected by both `requireAuth` and `requireEcosystemAccess`.
* **New State:**
  * Keep `requireAuth`.
  * Remove `requireEcosystemAccess` from `/api/gacha/codex` and `/api/gacha/pull`.
  * All authenticated users can retrieve their species collection progress and spend dive tickets to pull new species.
  * In `ecosystem.service.js`, `ensureUserEcosystem(userId)` automatically provisions starter tickets and default water quality when any new authenticated user pulls or views the codex.

#### `backend/src/routes/ecosystem.routes.js`
* Retain `requireEcosystemAccess` on `/api/ecosystem/feed` and 3D simulation endpoints so only authorized aquarium viewers manage water quality and live habitat feeding.

#### `frontend/components/OceanariumRoute.tsx`
* Allow all authenticated users (`isAuthenticated === true`) to access `/oceanarium`.
* Redirect unauthenticated visitors to `/login`.

---

### 2.2 Mobile Navigation & Dashboard Entry

#### `frontend/pages/Dashboard.tsx`
* Insert a mobile-prominent (`md:hidden`) card banner beneath the welcome header / stats:
  * **Visual:** Vibrant gradient container (`from-cyan-900/60 to-blue-900/60 border-cyan-500/30`) with a cartoon marine badge.
  * **Content:** *"Marine Codex & Dive Station — Explore your collected specimens, discover quirky field guides, and dive for rare sea creatures."*
  * **Call to Action:** `<Link to="/oceanarium">` with button styling: `Open Codex & Dive →`.
* Fix text overflow in Recent Activity, Discussions, and Drafts:
  * Wrap all `termLabel` and `termUri` displays in `min-w-0 truncate block` so long strings never push card widths.

#### `frontend/components/BottomNav.tsx`
* Add a dedicated **Codex** tab to the mobile bottom bar:
  * Path: `/oceanarium`
  * Icon: `Fish` (from `lucide-react`)
  * Label: `Codex`
  * Active state highlights when `location.pathname === '/oceanarium'`.

#### `frontend/components/Layout.tsx`
* Ensure the burger menu and desktop nav link to Oceanarium / Codex are visible to all authenticated users.
* Add `overflow-x-hidden w-full max-w-full` on the main layout wrapper to guarantee no horizontal viewport offset occurs on mobile.

---

### 2.3 Oceanarium Adaptive Architecture (Desktop 3D vs Mobile Codex)

#### `frontend/pages/Oceanarium.tsx`
* **Viewport Detection:** Detect mobile viewport dynamically (`window.innerWidth < 768px`).
* **Mobile Viewport Behavior (`isMobile === true`):**
  * **Zero WebGL Context:** Does not instantiate `OceanariumCanvas`, Three.js scene, camera, boids simulation, or GLTF loaders.
  * **Default Tab:** Automatically defaults to `'codex'`.
  * **Available Tabs:** Only `[Codex]` and `[Dive Station]`. The `[Oceanarium]` (3D) tab is omitted from the mobile DOM.
  * **Mobile Thumb Dock:** Bottom bar contains quick-action buttons:
    * `[📖 Marine Codex]`
    * `[✨ Dive Station (Tickets: X)]`
* **Desktop Viewport Behavior (`isMobile === false`):**
  * **Authorized Aquarium Viewers (`isAdmin || isSuperAdmin || hasGachaAccess`):**
    * Tabs: `[Aquarium]` (Three.js 3D canvas), `[Dive Station]`, and `[Codex]`.
    * Default tab: `'oceanarium'`.
  * **Regular Authenticated Users:**
    * Tabs: `[Codex]` (default) and `[Dive Station]`.
    * The 3D Aquarium tab is hidden.

---

### 2.4 Marine Codex Funny Animal Cards & Pufferfish-Style Visuals

#### `frontend/components/oceanarium/MarineCodex.tsx`
* **Collection Grid:**
  * Displays all 21 species categorized across Sunlit, Twilight, and Abyssal depth zones.
  * **Discovered Species:**
    * Illustrated card with cartoon art.
    * Rarity-tinted border (Common: Slate, Uncommon: Emerald, Rare: Sapphire, Epic: Violet, Legendary: Amber/Gold).
    * Shiny variant badge (`✨ Shiny`) if caught.
    * Catch counter (`×N`).
    * Funny nickname (e.g. *Spotted Pufferfish: "Certified Drama Balloon"*).
  * **Undiscovered Species:**
    * Darkened silhouette with a lock icon and mystery zone hint (e.g. *"Sunlit Reef Specimen #3 — Undiscovered"*).
* **Interactive Inspect Modal ("Field Guide Dossier"):**
  * High-resolution character artwork with a **Standard / Shiny** toggle.
  * **Humorous Field Notes:**
    * **Quirky Bio:** Humorous 2-sentence description playing on the animal's behavior.
    * **Personality Trait:** E.g., *"Chaotic Neutral"*, *"Professionally Anxious"*, *"Vibe Connoisseur"*.
    * **Favorite Food:** E.g., *"Bread flakes and unearned confidence"*.
    * **Parody Quote:** E.g., *“If not friend, why round?”*.
    * **Real Science Fun Fact:** Educational 1-sentence marine taxonomy note honoring MTT's scientific mission.
* **Species Visual Assets:**
  * Stored in `/public/species/` (e.g., `spotted_pufferfish.png`, `azure_damselfish.png`, `clown_anemone.png`, etc.).
  * Generated in the style of the homepage's 3D cartoon pufferfish: chubby, rounded, expressive cartoon eyes, whimsical smiles, studio lighting.
  * Clean SVG/color fallback system for resilient rendering during loading.

---

### 2.5 Term URI Layout & Max-Width Overflow Fix

#### `frontend/pages/TermDetail.tsx`
* **Issue:** The external URI link (`<a href={term.uri}>{term.uri} <ExternalLink /></a>`) at line 953 contains unbroken URI strings up to 100+ characters (e.g. `http://vocab.nerc.ac.uk/collection/P02/current/FREP/`). On screens narrower than 420px, this blows out the document width.
* **Fix:**
  ```tsx
  <a
    href={term.uri}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center text-xs text-slate-400 hover:text-marine-600 transition-colors max-w-full"
  >
    <span className="truncate max-w-[calc(100vw-3.5rem)]">{term.uri}</span>
    <ExternalLink size={12} className="ml-1 flex-shrink-0" />
  </a>
  ```
* Ensure container headers have `max-w-full overflow-hidden`.

#### `frontend/components/FlowTermCard.tsx` & `Dashboard.tsx`
* Add `max-w-full truncate min-w-0` to all term URI / label anchor tags and list rows.

---

## 3. Data Structures & Lore Catalog

A structured lore database will be added to `frontend/data/speciesLore.ts`:
```typescript
export interface SpeciesLore {
  nickname: string;
  personality: string;
  favoriteFood: string;
  quote: string;
  realFact: string;
  image: string;
}

export const SPECIES_LORE: Record<string, SpeciesLore> = {
  spotted_pufferfish: {
    nickname: 'Certified Drama Balloon',
    personality: 'Easily startled, 90% air',
    favoriteFood: 'Snails, flakes, and personal space',
    quote: 'If not friend, why round?',
    realFact: 'Pufferfish can inflate by quickly ingesting water to deter predators.',
    image: '/puffer.png'
  },
  azure_damselfish: {
    nickname: 'The Turbo Nibbler',
    personality: 'Fiercely protective of a 2cm rock',
    favoriteFood: 'Algae wafers & audacity',
    quote: 'Get off my lawn (coral).',
    realFact: 'Damselfish are known for farming algae patches and aggressively defending their territory.',
    image: '/species/azure_damselfish.png'
  },
  // Lore entries for all 21 species in gacha_species
};
```

---

## 4. Verification Plan

### Automated Tests
1. **Backend Route Tests (`backend/tests/gacha_permissions.test.js`)**:
   * Verify non-admin authenticated users can successfully call `GET /api/gacha/codex` (200 OK).
   * Verify non-admin authenticated users can call `POST /api/gacha/pull` with tickets (200 OK).
   * Verify unauthenticated requests receive 401.
   * Verify `POST /api/ecosystem/feed` rejects non-admins with 403.
2. **Frontend UI Tests (`frontend/tests/oceanarium_mobile_codex.test.js`)**:
   * Test that on mobile viewports (`innerWidth < 768px`), `OceanariumCanvas` is not rendered.
   * Test that the Codex tab is active by default on mobile.
   * Test that `BottomNav` renders the Codex navigation item.
   * Test that `Dashboard` renders the mobile Codex card.
   * Test that `TermDetail` truncates long term URIs without exceeding viewport bounds.

### Manual Verification
1. **Mobile Emulation (Chrome DevTools / Firefox Responsive Mode at 375px & 390px)**:
   * Log in as a standard user.
   * Verify the Dashboard displays the "Marine Codex & Dive Station" card.
   * Verify tapping the card or bottom nav tab navigates to `/oceanarium`.
   * Verify no Three.js canvas or WebGL warning loads; Codex grid displays smoothly.
   * Open Term Detail for a long URI (e.g. `http://vocab.nerc.ac.uk/collection/P02/current/FREP/`) and verify there is zero horizontal scrollbar or offset.
   * Tap on fish cards in the Codex to inspect funny lore, quotes, and shiny toggles.
   * Test spending tickets in the Dive Station and checking newly unlocked cards.
2. **Desktop Browser Verification**:
   * Log in as Admin/Superadmin: verify all 3 tabs (`[Aquarium]`, `[Dive Station]`, `[Codex]`) are visible and 3D aquarium functions normally.
   * Log in as regular user: verify 2 tabs (`[Codex]` and `[Dive Station]`) are displayed cleanly without aquarium errors.
