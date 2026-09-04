# Specification: Admin Tank & Fish Management and Suspenseful Deep Dive Expedition

**Date**: 2026-09-04  
**Status**: Approved  
**Branch**: `feat/gacha`  
**Target Areas**: 
- Admin Gacha Management (`/admin/gacha`, `backend/src/routes/adminGacha.routes.js`, `frontend/pages/admin/AdminGacha.tsx`)
- Marine Diving Experience (`frontend/components/oceanarium/DiveStation.tsx`, `frontend/services/oceanAudio.ts`)

---

## 1. Overview & Objectives

This specification defines two tightly coupled enhancements to the Oceanarium & Gacha system:
1. **Administrative Tank & Fish Management**: Platform administrators can inspect any user's aquarium, browse their collected marine species with search and filters, edit nicknames, release/delete individual specimens, and execute a configurable tank reset with safety confirmation dialogs.
2. **Suspenseful Marine Deep Dive Experience**: An overhauled bathyscaphe diving simulation that delivers authentic underwater atmosphere, variable depth zones, radar anomaly suspense scaling with the highest rarity pulled in the batch, procedural hydrophone Web Audio cues, and theatrical bio-containment pod reveals for Rare, Epic, and Legendary creatures.

---

## 2. Architecture & Data Model

### 2.1 Database Model
The existing schema natively supports all needed attributes. No database migrations are required:
- `user_ecosystem`: stores `water_quality`, `tickets`, `food_flakes`, `super_pellets`, `pity_counter_epic`, `pity_counter_legendary`.
- `user_fishes`: stores caught specimens (`id`, `user_id`, `species_id`, `nickname`, `status`, `caught_at`, `is_favorite`).
- `gacha_species`: species catalogue with metadata and visual traits (`primary_color`, `secondary_color`, `scale`, `glow`, `body_type`).

### 2.2 Backend Admin Endpoints (`backend/src/routes/adminGacha.routes.js`)
All endpoints are protected by `requireAdmin` and validate that the target user exists.

1. **`GET /api/admin/gacha/users/:id/tank`**:
   - Retrieves the target user's ecosystem record along with an array of all caught specimens joined with `gacha_species` fields.
   - Response payload:
     ```json
     {
       "ecosystem": {
         "water_quality": 95,
         "tickets": 3,
         "food_flakes": 8,
         "super_pellets": 2,
         "pity_counter_epic": 4,
         "pity_counter_legendary": 12,
         "last_fed_at": "2026-09-04 12:00:00"
       },
       "fishes": [
         {
           "id": 42,
           "species_id": "azure_damselfish",
           "name": "Azure Damselfish",
           "nickname": "Bubbles",
           "depth_zone": "sunlit",
           "rarity": "common",
           "visual_traits": "{\"primary_color\":\"#00d2ff\",\"secondary_color\":\"#3a7bd5\",\"scale\":0.9,\"glow\":false,\"body_type\":\"oval\"}",
           "caught_at": "2026-09-04 12:30:00",
           "is_favorite": 0
         }
       ]
     }
     ```

2. **`DELETE /api/admin/gacha/users/:id/fishes/:fishId`**:
   - Permanently deletes the specimen record with ID `:fishId` belonging to `user_id = :id`.
   - Response: `{ "ok": true, "deletedFishId": 42, "remainingCount": 15 }`.

3. **`PATCH /api/admin/gacha/users/:id/fishes/:fishId`**:
   - Updates nickname or favorite flag for a target user's fish.
   - Accepts `{ "nickname": "New Name" }`.
   - Response: `{ "ok": true, "fish": { ... } }`.

4. **`POST /api/admin/gacha/users/:id/reset-tank`**:
   - Executes a configurable tank reset inside a SQLite transaction based on admin checkboxes:
     ```json
     {
       "delete_fishes": true,
       "reset_water": true,
       "reset_pity": false,
       "reset_food": false
     }
     ```
   - Rules:
     - `delete_fishes === true`: `DELETE FROM user_fishes WHERE user_id = ?`
     - `reset_water === true`: `UPDATE user_ecosystem SET water_quality = 100 WHERE user_id = ?`
     - `reset_pity === true`: `UPDATE user_ecosystem SET pity_counter_epic = 0, pity_counter_legendary = 0 WHERE user_id = ?`
     - `reset_food === true`: `UPDATE user_ecosystem SET food_flakes = 5, super_pellets = 1 WHERE user_id = ?`
   - Response: `{ "ok": true, "ecosystem": { ... }, "fishes_count": 0 }`.

---

## 3. Frontend: Admin Tank & Fish Management

### 3.1 Entry Point in `AdminGacha.tsx`
- Each row in the user table displays:
  - Total caught fish badge.
  - Button: **"Manage Tank"** (styled with an aquarium/fish icon).
  - Clicking "Manage Tank" opens the `AdminTankDrawer`.

### 3.2 `AdminTankDrawer` Component
- **Header & Stats**:
  - Target user's avatar, username, and role badge.
  - Quick health summary: Water quality gauge, caught specimen count, tickets balance.
  - Action button: **"Reset Tank..."** (danger button styling).
- **Search & Filters**:
  - Live search input matching fish nickname or species name.
  - Rarity pill buttons filter: `All`, `Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`.
- **Specimen Cards Grid**:
  - Fish icon with dynamic gradient background and rarity glow.
  - Species name, depth badge, and catch timestamp.
  - Inline pencil button to edit/rename fish nickname.
  - Trash icon button with inline confirmation popover: *"Release this specimen back into the ocean? This action cannot be undone."*
  - Empty state with informative message and shortcut button to grant dive tickets.

### 3.3 Configurable Reset Tank Dialog
- Modal displayed upon clicking "Reset Tank...":
  - `☑ Delete all caught fishes (releases N specimens)`
  - `☑ Restore water quality to 100%`
  - `☐ Reset pity counters (Epic: X/10, Legendary: Y/30)`
  - `☐ Reset food supply to initial defaults (5 flakes, 1 pellet)`
- Explicit **"Confirm Tank Reset"** button with loading state.
- Automatically refreshes the drawer and updates the parent user list row upon success.

---

## 4. Frontend: Suspenseful Marine Dive Experience

### 4.1 Audio Synthesizer Engine (`frontend/services/oceanAudio.ts`)
Zero-dependency, procedural sound effects powered by the Web Audio API:
- `playSonarPing(frequency, depthRatio)`: ping with depth-dependent echo and low-pass dampening.
- `playTrenchDrone()`: filtered sub-bass drone and hull creaks simulating deep-sea pressure.
- `playAnomalyAlert(rarity)`:
  - *Common/Uncommon*: gentle aquatic ping.
  - *Rare*: resonant azure dual-chime.
  - *Epic*: ominous violet bio-frequency synth swell.
  * *Legendary*: emergency klaxon pulse and deep sub-bass tremor.
- `playCanisterHiss()`: high-pass pneumatic decompression burst.
- `playRevealStinger(rarity)`: triumphant marine fanfare and particle sparkle audio scaling by rarity.

### 4.2 State Machine in `DiveStation.tsx`

```
[Idle] ---> [Descent] ---> [SonarLock] ---> [PodReveal] ---> [SummaryManifest]
                                                 ^               |
                                                 |--- (Next) ----| (or Skip All)
```

1. **Idle State**:
   - Displays bathyscaphe bridge controls, ticket count, and pity counters.
   - Single Dive (1 🎟️) and Expedition Dive (10 🎟️) buttons.

2. **Descent State (Submersible Porthole View)**:
   - Reinforced porthole with rivets, glass condensation, and depth meter.
   - Dynamic lighting shifts:
     - **0m – 200m (Sunlit)**: Sunlight shafts and cyan plankton.
     - **200m – 1000m (Twilight)**: Deep indigo, marine snow, distant shadow silhouettes.
     - **1000m – 3000m (Abyssal Trench)**: Pitch black with dual searchlight beams sweeping through the water.
   - Depth meter counts down from `0m` to target depth (e.g. `2,840m - 284 ATM`).

3. **Sonar Anomaly Lock (Anticipation Spike)**:
   - Submersible thrusters hold position.
   - Radar sweep circles the screen with audio pings.
   - Header banner flashes based on the **highest rarity in the pull**:
     - *Common/Uncommon*: Cyan radar sweep (*"Biomass detected"*).
     - *Rare*: Azure radar pulse (*"Rare specimen detected"*).
     - *Epic*: Violet strobe and spotlight focus (*"Exotic biosignature locked"*).
     - *Legendary*: Emergency amber/crimson strobe, screen vibration, and alarm klaxon (*"⚠️ COLOSSAL ABYSSAL SIGNATURE DETECTED ⚠️"*).

4. **Pod Reveal State (Pressurized Bio-Canisters)**:
   - Heavy containment canisters emerge into the bathyscaphe airlock.
   - Counter shows `Specimen X of Y`.
   - Top-right persistent button: **"Skip to Summary"** (available anytime).
   - Unsealing mechanics:
     - *Common / Uncommon*: Instant hydraulic hiss, burst of bubbles, card presented with clean chime.
     - *Rare*: Glowing blue aura streams from the vent seals, followed by a flip reveal.
     - *Epic*: **1.2s Suspense Delay** — canister rattles, warning vents spew bubbles, purple silhouette swims inside tinted porthole, then bursts open in a violet shockwave ring.
     - *Legendary*: **Maximum Cinematic Suspense** — cabin floodlights flicker and dim, deep seismic tremor shakes the screen, golden cosmic rays stream from struggling seals, followed by a radiant aquatic shockwave and majestic creature card with animated runic borders.

5. **Expedition Research Manifest (Summary Grid)**:
   - Complete grid of all caught specimens in high-tech marine lab formatting.
   - Badges for *"NEW DISCOVERY!"* and duplicate food flake conversions.
   - Quick action buttons: *"Dive Again"* or *"Return to Oceanarium"*.

---

## 5. Verification Plan

### Automated Tests
1. **Backend Admin Gacha Routes Test** (`backend/tests/admin_gacha_tank_management.test.js`):
   - Test `GET /api/admin/gacha/users/:id/tank` returns correct user ecosystem and fishes.
   - Test `DELETE /api/admin/gacha/users/:id/fishes/:fishId` deletes only the specified fish.
   - Test `POST /api/admin/gacha/users/:id/reset-tank` with combinations of checkboxes (`delete_fishes`, `reset_water`, `reset_pity`, `reset_food`).
   - Test access protection (reject unauthenticated / non-admin requests).
2. **Frontend Component & Routing Tests**:
   - Test `AdminTankDrawer` renders, filters fishes, triggers fish deletion, and executes tank reset.
   - Test `DiveStation` state transitions (`idle` -> `descent` -> `sonar_lock` -> `pod_reveal` -> `summary`).
   - Test `oceanAudio` safely runs or falls back in non-audio/headless environments without throwing.
3. **Full Suite**:
   - `npm test --prefix backend` to verify zero regressions.
   - `npm run build --prefix frontend` for clean compilation.

### Manual Verification
- Log in as admin/superadmin, open `/admin/gacha`, open a user's tank drawer, delete a fish, and execute a configurable tank reset.
- Go to `/oceanarium` and launch a single dive and a 10-dive: verify the descent animation, radar anomaly suspense, high-rarity pod reveals, and skip button.
