# Oceanarium Admin Fish Grants & GLB Model Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admins to grant any fish species to users with custom shiny flags, and add native Three.js glTF/GLB 3D model support so species (starting with the Spotted Pufferfish at `/models/puffer.glb`) display custom 3D models in the Oceanarium.

**Architecture:**
- SQLite migration adding `model_url` column to `gacha_species` and seeding `spotted_pufferfish`.
- Express admin endpoints for granting specimens (`/grant-fish`), listing species, and updating species model configurations.
- React Admin UI components (`GrantFishModal.tsx`, "+ Grant Specimen" buttons, and a Species & 3D Models catalog tab in `AdminGacha.tsx`).
- Three.js `GLTFLoader` pipeline in `CartoonFishFactory.ts` / `ThreeGameDirector.ts` with mesh caching, graceful placeholder fallback, shiny iridescent shaders + sparkle trails, and procedural swimming kinematics.

**Tech Stack:** Node.js, Express, SQLite (`better-sqlite3`), React, TypeScript, Three.js (`GLTFLoader`), Vite.

## Global Constraints
- Admin must be able to specify `is_shiny` (0 or 1) and optional `nickname` when granting fish.
- Existing 20 cartoon species must continue rendering without regression if `model_url` is null.
- If a `.glb` is loading or missing from `/models/`, the engine must gracefully display a stylized fallback cartoon fish without throwing unhandled exceptions.
- 100% test pass rate across backend and frontend test suites.

---

### Task 1: Database Migration & Backend Admin Endpoints

**Files:**
- Create: `backend/src/db/migrations/040_species_glb_and_admin_grants.sql`
- Modify: `backend/src/routes/adminGacha.routes.js`
- Modify: `backend/src/services/ecosystem.service.js`
- Modify: `backend/src/routes/gacha.routes.js`
- Test: `backend/tests/admin_grant_fish.test.js`

**Interfaces:**
- `POST /api/admin/gacha/users/:id/grant-fish`: `{ species_id, is_shiny, nickname, count }` -> `{ ok: true, grantedCount, fishes }`
- `GET /api/admin/gacha/species`: -> `{ species: GachaSpecies[] }`
- `PATCH /api/admin/gacha/species/:id`: `{ model_url, ... }` -> `{ ok: true, species }`

- [ ] **Step 1: Write backend test `backend/tests/admin_grant_fish.test.js`**

```javascript
// Tests grant-fish endpoint with standard and shiny flags, species listing, and species patch
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/admin_grant_fish.test.js`  
Expected: FAIL (endpoints or migration not yet implemented)

- [ ] **Step 3: Create migration `040_species_glb_and_admin_grants.sql`**

Add `model_url` to `gacha_species` and seed `spotted_pufferfish`.

- [ ] **Step 4: Implement endpoints in `backend/src/routes/adminGacha.routes.js`**

Implement `POST /admin/gacha/users/:id/grant-fish`, `GET /admin/gacha/species`, and `PATCH /admin/gacha/species/:id`. Update ecosystem queries to select `model_url`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node backend/tests/admin_grant_fish.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/migrations/040_species_glb_and_admin_grants.sql \
        backend/src/routes/adminGacha.routes.js \
        backend/src/services/ecosystem.service.js \
        backend/src/routes/gacha.routes.js \
        backend/tests/admin_grant_fish.test.js
git commit -m "feat(gacha): add admin fish grant endpoints and species model_url schema"
```

---

### Task 2: Admin UI - Grant Specimen Modal & Species 3D Model Catalog

**Files:**
- Create: `frontend/components/admin/GrantFishModal.tsx`
- Modify: `frontend/components/admin/AdminTankDrawer.tsx`
- Modify: `frontend/pages/admin/AdminGacha.tsx`
- Modify: `frontend/types.ts`
- Test: `frontend/tests/admin_grant_fish_ui.test.js`

**Interfaces:**
- `GrantFishModal`: props `{ isOpen, user, onClose, onFishGranted }`
- `AdminTankDrawer`: "+ Grant Specimen" action opening `GrantFishModal`
- `AdminGacha`: tab switcher ("Users & Aquariums" | "Species & 3D Models")

- [ ] **Step 1: Write UI test `frontend/tests/admin_grant_fish_ui.test.js`**

Assert presence of `GrantFishModal`, shiny toggle, species selector, and Species Management tab.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/admin_grant_fish_ui.test.js`  
Expected: FAIL

- [ ] **Step 3: Create `GrantFishModal.tsx` and integrate into `AdminTankDrawer.tsx` and `AdminGacha.tsx`**

Implement searchable species picker with depth badges, animated ✨ Shiny toggle, nickname input, and species management catalog tab.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/admin_grant_fish_ui.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/admin/GrantFishModal.tsx \
        frontend/components/admin/AdminTankDrawer.tsx \
        frontend/pages/admin/AdminGacha.tsx \
        frontend/types.ts \
        frontend/tests/admin_grant_fish_ui.test.js
git commit -m "feat(admin): add grant fish modal with shiny toggle and species 3d model catalog"
```

---

### Task 3: Three.js 3D Engine GLB Support & Shiny Rendering

**Files:**
- Modify: `frontend/components/oceanarium/engine/CartoonFishFactory.ts`
- Modify: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Test: `frontend/tests/glb_fish_loader.test.js`

**Interfaces:**
- `CartoonFishFactory.createFishMesh(species, isShiny)`: checks `species.model_url` -> loads GLB asynchronously with `GLTFLoader`, caches geometry, applies iridescent sheen & sparkle particles if shiny, and falls back to cartoon mesh.
- `ThreeGameDirector.ts`: updates animation mixer for rigged GLBs or applies dynamic hydrodynamic yaw oscillation for static GLBs.

- [ ] **Step 1: Write test `frontend/tests/glb_fish_loader.test.js`**

Assert GLTFLoader integration, model caching, shiny shader enhancements, and fallback behavior.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/glb_fish_loader.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement GLTF loading and shiny rendering in `CartoonFishFactory.ts`**

Wire `GLTFLoader`, async model cache, shiny material properties, sparkle trails, and fallback swap.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/glb_fish_loader.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/CartoonFishFactory.ts \
        frontend/components/oceanarium/engine/ThreeGameDirector.ts \
        frontend/tests/glb_fish_loader.test.js
git commit -m "feat(oceanarium): integrate GLB 3d model loader with shiny shaders in fish engine"
```

---

### Task 4: Full Verification & Bundle Build

**Files:**
- Verification across backend and frontend test suites.

- [ ] **Step 1: Run all unit tests**

```bash
node backend/tests/admin_grant_fish.test.js && \
node backend/tests/mail_service.test.js && \
node frontend/tests/admin_grant_fish_ui.test.js && \
node frontend/tests/glb_fish_loader.test.js && \
node frontend/tests/scene_environment.test.js && \
node frontend/tests/oceanarium_pufferfish_suppression.test.js && \
node frontend/tests/camera_director.test.js && \
node frontend/tests/game_director.test.js && \
node frontend/tests/desktop_mode_world.test.js && \
node frontend/tests/fish_infographic.test.js
```
Expected: All tests PASS with exit code 0.

- [ ] **Step 2: Production bundle build**

Run: `cd frontend && npm run build`  
Expected: Build passes with 0 errors.
