# Oceanarium & Gacha Ecosystem Feature Design Specification

**Date:** 2026-09-04  
**Status:** Approved Design Spec  
**Target Branch:** `feat/gacha`  
**Access Scope:** Admin-Only (Staging Preview)

---

## 1. Overview & Objective

To gamify terminology contributions and establish a sustainable daily engagement loop, the platform introduces the **Oceanarium & Deep-Sea Gacha Ecosystem**.

Users earn **Expedition Tickets** and **Coral Nutrients** by performing valuable translation work—primarily when their translations are reviewed and marked as `approved`, when they complete batches of peer reviews, and when hitting daily translation goals.

These tickets are spent at the **Dive Station** (an atmospheric bathyscaphe gacha pull experience) to discover collectible marine life across three ocean depth strata: **Sunlit Reef (0–200m)**, **Twilight Pelagic (200–1000m)**, and **Abyssal Midnight (1000m+)**.

Collected creatures inhabit the player's personal **Oceanarium**—a living, interactive 2D canvas simulation. The ecosystem requires ongoing care: daily inactivity causes water quality to decay, eventually rendering fish dormant until revitalized by new translation activity and feeding.

> [!IMPORTANT]
> **Admin-Only Staging Restriction:** All routes, UI views, and navigation links for this feature are strictly gated behind an admin check (`is_admin === 1`) during the preview/balancing period.

---

## 2. Database Schema & Data Models

The feature adds four SQLite tables to `backend/data/translations.db` via a dedicated migration script (`backend/src/db/migrations/032_gacha_ecosystem.sql`).

```sql
-- 1. Catalog of all collectible marine species
CREATE TABLE IF NOT EXISTS gacha_species (
    id TEXT PRIMARY KEY,                       -- e.g. 'neon_tetra', 'bioluminescent_angler'
    name TEXT NOT NULL,                        -- e.g. 'Bioluminescent Angler'
    depth_zone TEXT NOT NULL CHECK(depth_zone IN ('sunlit', 'twilight', 'abyssal')),
    rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    drop_weight INTEGER NOT NULL,              -- Weighted drop probability
    description TEXT NOT NULL,                 -- Lore / creature description
    visual_traits TEXT NOT NULL,               -- JSON: primary_color, secondary_color, scale, fins_type, glow
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User ecosystem state & currency ledger
CREATE TABLE IF NOT EXISTS user_ecosystem (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tickets INTEGER NOT NULL DEFAULT 0,         -- Gacha dive currency
    food_flakes INTEGER NOT NULL DEFAULT 5,     -- Regular food (+10% water quality)
    super_pellets INTEGER NOT NULL DEFAULT 1,   -- Premium food (+25% water quality)
    water_quality INTEGER NOT NULL DEFAULT 100, -- Health gauge: 0 to 100
    last_fed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_decay_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Reference for lazy decay calculations
    pity_counter_epic INTEGER NOT NULL DEFAULT 0,      -- Guaranteed Epic <= 10 pulls
    pity_counter_legendary INTEGER NOT NULL DEFAULT 0, -- Guaranteed Legendary <= 30 pulls
    total_pulls INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Individual fish instances owned by users
CREATE TABLE IF NOT EXISTS user_fishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES gacha_species(id) ON DELETE CASCADE,
    nickname TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'dormant')),
    caught_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_user_fishes_user ON user_fishes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fishes_species ON user_fishes(species_id);

-- 4. Audit trail of all gacha pull transactions
CREATE TABLE IF NOT EXISTS gacha_pull_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES gacha_species(id),
    pull_type TEXT NOT NULL DEFAULT 'single' CHECK(pull_type IN ('single', 'multi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_user ON gacha_pull_logs(user_id);
```

---

## 3. Curated Marine Species Roster & Gacha Probabilities

### Initial Catalog (20 Stylized Species)

| Depth Zone | Species ID | Name | Rarity | Drop Weight |
|:---|:---|:---|:---|:---:|
| **Sunlit (0–200m)** | `azure_damselfish` | Azure Damselfish | Common | 25 |
| | `sunburst_tang` | Sunburst Tang | Common | 25 |
| | `emerald_parrotfish` | Emerald Parrotfish | Common | 20 |
| | `clown_anemone` | Clown Anemonefish | Uncommon | 15 |
| | `golden_seahorse` | Golden Pygmy Seahorse | Uncommon | 12 |
| | `sapphire_manta` | Sapphire Reef Manta | Rare | 5 |
| | `solar_lionfish` | Solar Lionfish | Epic | 2 |
| **Twilight (200–1000m)** | `silver_hatchet` | Silver Hatchetfish | Common | 20 |
| | `glass_lantern` | Glass Lanternfish | Uncommon | 15 |
| | `ribbon_oarfish` | Ribbon Oarfish | Rare | 6 |
| | `prismatic_squid` | Prismatic Glass Squid | Rare | 5 |
| | `vampire_octo` | Crimson Vampire Octopus | Epic | 2 |
| | `coelacanth_shadow` | Ancient Dusk Coelacanth | Legendary | 0.6 |
| **Abyssal (1000m+)** | `ghost_grenadier` | Ghost Grenadier | Uncommon | 12 |
| | `bioluminescent_angler` | Bioluminescent Angler | Rare | 6 |
| | `gulper_void` | Void Gulper Eel | Rare | 5 |
| | `dumbo_specter` | Dumbo Specter Octopus | Epic | 2 |
| | `crystal_siphonophore` | Crystal Siphonophore | Epic | 1.5 |
| | `abyssal_leviathan` | Abyssal Trench Leviathan | Legendary | 0.4 |
| | `cosmic_jelly` | Cosmic Aurelia Jelly | Legendary | 0.5 |

### Probabilities & Pity Architecture
* **Base Pull Rates:**
  * Common: `~58%`
  * Uncommon: `~27%`
  * Rare: `~10%`
  * Epic: `~4%`
  * Legendary: `~1%`
* **Pity Mechanics:**
  * Every pull without an Epic increments `pity_counter_epic`. Upon reaching `10`, the next pull is guaranteed Epic or higher, resetting the counter to 0.
  * Every pull without a Legendary increments `pity_counter_legendary`. Upon reaching `30`, the next pull is guaranteed Legendary, resetting the counter to 0.
  * **10-Pull Guarantee:** Multi-pulls (10 tickets) enforce at least one Rare or higher creature.
  * **Duplicate Compensation:** Pulling a duplicate species automatically grants `+3 Food Flakes` ("Marine Essence") to nourish the ecosystem.

---

## 4. Ecosystem Decay & Health Engine

### Lazy Evaluation on Read
To eliminate cron overhead and ensure deterministic behavior across timezones, decay is computed on-demand during `GET /api/ecosystem`:
1. Calculate full 24-hour days elapsed: `daysElapsed = floor((now - last_decay_at) / 86400000)`.
2. If `daysElapsed >= 1`:
   * Reduce `water_quality = max(0, water_quality - (daysElapsed * 15))`.
   * If `water_quality == 0`, set non-favorite fish status to `'dormant'`.
   * Update `last_decay_at = now`.

### Health Status Bands
* **Pristine & Thriving (80–100%):** Crystal clear azure water, glowing flora, fast and playful swim animations, golden particle glimmers.
* **Balanced Ecosystem (40–79%):** Normal water clarity, standard swimming routines.
* **Murky / Distressed (1–39%):** Turbid greenish-gray tint, sluggish swimming, warning indicator in HUD.
* **Critical / Dormant (0%):** Desaturated water, corals bleached, fish sink to seafloor encased in translucent slumber orbs.

### Reviving and Feeding
* Consuming **1 Food Flake** adds `+10%` water quality.
* Consuming **1 Super Pellet** adds `+25%` water quality.
* When water quality rises above `0%`, all dormant fish immediately pop out of their slumber orbs with celebratory bubble effects and return to active swimming.

---

## 5. Backend Architecture & API Routes

### 1. Security Middleware
Defined in `backend/src/middleware/admin.middleware.js`:
```javascript
function requireAdmin(req, res, next) {
  if (!req.user || req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Oceanarium access is restricted to administrators during preview.' });
  }
  next();
}
```

### 2. Routes (`backend/src/routes/ecosystem.routes.js` & `backend/src/routes/gacha.routes.js`)
* **`GET /api/ecosystem`** (Admin)
  * Triggers lazy decay check.
  * Returns `{ ecosystem: { water_quality, health_status, tickets, food_flakes, super_pellets, pity_counter_epic, pity_counter_legendary }, fishes: [...] }`.
* **`POST /api/ecosystem/feed`** (Admin)
  * Body: `{ food_type: 'flake' | 'super_pellet' }`.
  * Deducts inventory, restores water quality, revives dormant fish, logs `last_fed_at`.
* **`POST /api/gacha/pull`** (Admin)
  * Body: `{ count: 1 | 10 }`.
  * Validates ticket balance, runs weighted drop algorithm with pity rules, inserts to `user_fishes` and `gacha_pull_logs`.
  * Returns `{ results: [...], new_discoveries: [...], updated_ecosystem: {...} }`.
* **`GET /api/gacha/codex`** (Admin)
  * Returns all species with discovery status, caught counts, and collection percentage.
* **`PATCH /api/ecosystem/fishes/:id`** (Admin)
  * Body: `{ nickname?: string, is_favorite?: boolean }`.
  * Updates fish metadata.

### 3. Reward Lifecycle Integration
* **Translation Approved:** In `backend/src/services/reputation.service.js` inside `applyApprovalReward()`, call `ecosystemService.awardRewards(userId, { tickets: 1, super_pellets: 1 })`.
* **Translation Submitted:** In `backend/src/services/flow.service.js` on translation creation, award `+1 Food Flake`.
* **Review Batch Completed:** In `backend/src/services/flow.service.js` when user completes 5 peer reviews, award `+1 Ticket` and `+1 Food Flake`.
* **Daily Goal Completed:** In `backend/src/services/gamification.service.js` when `user_daily_goals` completes (5 tasks), award `+1 Bonus Ticket` and reset `water_quality = 100`.

---

## 6. Frontend Architecture & Mobile-First Design

### 1. View Layout (`frontend/pages/Oceanarium.tsx`)
A high-immersion marine research hub divided into three sub-views:
1. **The Oceanarium (Live Canvas):** Fullscreen interactive viewport with depth gradient, live swimming fish, and click/tap-to-feed interaction.
2. **The Dive Station:** Atmospheric submarine descent portal with lever pull, sound effects, sonar ping, and card-reveal animations.
3. **The Marine Codex:** Responsive grid catalog displaying discovered creatures, rarities, lore cards, and completion percentage.

### 2. Canvas Physics (`frontend/components/oceanarium/OceanariumCanvas.tsx`)
* **Aspect Ratio & Responsiveness:** Auto-scales to viewport using `window.devicePixelRatio` (capped at 2.0).
* **Depth Strata:**
  * Top: Sunlit surface caustics with rising micro-bubbles.
  * Middle: Deep pelagic twilight with floating plankton motes.
  * Bottom: Dark rocky seafloor silhouette with bioluminescent flora.
* **Fish AI:** Each fish moves autonomously in its native depth zone with sinusoidal tail wagging, smooth turning inertia, and avoidance of screen boundaries.
* **Feeding Physics:** Tapping drops food flakes/pellets that drift downward with gravity and water drag. Fish within detection range turn and swim to consume them, triggering bubble particles and sound.

### 3. Mobile Phone Optimizations
* **Vertical Viewport as Submarine Observation Tube:** The vertical mobile portrait screen perfectly maps to the vertical depth strata from surface to abyss.
* **Touch Controls:** `touch-action: none` on canvas prevents scrolling conflicts.
* **Ergonomic Thumb-Zone HUD:**
  * Fixed bottom dock with large touch targets: **[ 🍞 Flake ]**, **[ 🤿 DIVE (Hero) ]**, **[ 🔮 Super Pellet ]**.
  * Haptic feedback via `navigator.vibrate([15])` upon feeding and gacha pulls.
* **Mobile Codex:** 2–3 column grid with bottom-sheet drawer for creature details.
* **Performance Budget:** Capped at 15–20 concurrently rendered fish on mobile screens to guarantee uninterrupted 60 FPS.

---

## 7. Verification & Testing Plan

### Automated Backend Tests
* `tests/ecosystem.test.js`:
  * Verify `requireAdmin` returns `403` for non-admin users.
  * Verify lazy decay calculation correctly subtracts 15% per elapsed day.
  * Verify feeding restores water quality and revives dormant fish.
  * Verify gacha pull correctly consumes tickets and honors Epic (<=10) and Legendary (<=30) pity counters.
  * Verify translation approval hook credits tickets and pellets atomically.

### Automated Frontend & Build Tests
* Verify Vite build passes without TypeScript errors (`npm run build`).
* Validate responsive canvas resizing across desktop (1920x1080) and mobile (375x812) viewports.
* Verify admin guard redirects or displays unauthorized state for non-admin users.

### Manual End-to-End Verification
1. Log in as admin user.
2. Confirm "Oceanarium" tab appears in Navbar with ticket badge.
3. Open `/oceanarium`, verify canvas renders at 60 FPS.
4. Tap "Drop Flake" to watch food fall, fish swim toward it, and health update.
5. Navigate to "Dive Station", pull 1x and 10x dives, verify bathyscaphe descent animation, sound FX, and card reveals.
6. Verify new catches appear in both the live Oceanarium and the Marine Codex.
7. Test on mobile screen emulation (Chrome DevTools Mobile Mode) to verify thumb buttons and touch gestures.
