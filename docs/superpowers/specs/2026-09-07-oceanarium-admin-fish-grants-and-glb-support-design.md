# Oceanarium Admin Fish Grants & GLB Model Integration Design

**Date**: 2026-09-07  
**Branch**: `feat/gacha`  
**Status**: Approved by User  

## 1. Executive Summary
This feature enhances the Oceanarium Gacha system by:
1. Providing an intuitive Admin interface to grant specific marine species to any user, including configuring whether the granted specimen is **Shiny** (`is_shiny = 1`), with optional custom nicknames and quantity selection.
2. Integrating native **GLB (glTF 2.0)** 3D model support for fish species in the Oceanarium vivarium and infinite world engines. Admins can associate any species with a `.glb` asset URL (such as `/models/puffer.glb`), and the 3D engine will seamlessly load, scale, animate, and apply shiny particle shaders to the model.
3. Seeding an official `spotted_pufferfish` species configured to load `/models/puffer.glb` from `frontend/public/models/puffer.glb`.
4. Adding a dedicated **Species & 3D Models** catalog management tab in Admin Gacha to inspect and configure species model URLs directly from the UI.

---

## 2. Architecture & Data Model

### 2.1 Database Schema (`040_species_glb_and_admin_grants.sql`)
```sql
-- Add model_url column to gacha_species
ALTER TABLE gacha_species ADD COLUMN model_url TEXT DEFAULT NULL;

-- Seed Spotted Pufferfish
INSERT OR IGNORE INTO gacha_species (id, name, depth_zone, rarity, drop_weight, description, visual_traits, model_url)
VALUES (
  'spotted_pufferfish',
  'Spotted Pufferfish',
  'sunlit',
  'rare',
  8,
  'An endearing globose swimmer with fine spots and expressive eyes that inflates when startled.',
  '{"primary_color":"#f59e0b","secondary_color":"#fef3c7","scale":1.1,"glow":false,"body_type":"oval"}',
  '/models/puffer.glb'
);
```

### 2.2 Backend Admin Endpoints (`adminGacha.routes.js`)
- `POST /api/admin/gacha/users/:id/grant-fish`:
  - Request body: `{ species_id: string, is_shiny?: boolean, nickname?: string, count?: number }`
  - Validates `species_id` exists in `gacha_species`.
  - Inserts `count` (1-10) entries into `user_fishes` with `user_id`, `species_id`, `nickname`, `is_shiny` (0 or 1).
  - Returns `{ ok: true, grantedCount: number, fishes: AdminUserFish[] }`.
- `GET /api/admin/gacha/species`:
  - Returns list of all `gacha_species` with `id, name, depth_zone, rarity, drop_weight, description, visual_traits, model_url`.
- `PATCH /api/admin/gacha/species/:id`:
  - Request body: `{ model_url?: string, name?: string, rarity?: string, drop_weight?: number, description?: string, visual_traits?: object }`
  - Updates `gacha_species` record in SQLite and returns updated row.
- `GET /api/gacha/species` (public/authenticated):
  - Updated to include `model_url` in returned species data for frontend and 3D engine consumers.

---

## 3. Frontend & UI Design

### 3.1 Admin Gacha Users & Tank Drawer (`AdminGacha.tsx` & `AdminTankDrawer.tsx`)
- **Grant Specimen Modal (`GrantFishModal.tsx`)**:
  - Opened via:
    - Quick Action icon in the `AdminGacha` table per user (`<Fish className="text-cyan-400" />`).
    - Dedicated prominent **"+ Grant Specimen"** button in `AdminTankDrawer` header.
  - Controls:
    - **Species Selector**: Searchable list with rarity color badges and depth stratum tags.
    - **✨ Shiny Toggle**: High-contrast toggle with animated iridescent sheen and sparkle indicator.
    - **Nickname Field**: Optional custom nickname.
    - **Quantity Counter**: 1 to 5 specimens at once.
    - **Submit Button**: Grants specimen, displays success toast, and refreshes the user's tank instantly without page reload.

### 3.2 Species & 3D Models Management Tab
- Inside `AdminGacha.tsx`, introduce a tab switcher:
  - **Tab 1: Users & Aquariums** (existing user list, access switches, resource grant modals, tank inspector).
  - **Tab 2: Species & 3D Models**:
    - Displays grid of all 21 marine species.
    - Shows badge: `Procedural Cartoon` vs `3D GLB Model` with green/amber status.
    - Inline editor for `model_url` (e.g. `/models/puffer.glb`).
    - Quick "Test URL" button checking `fetch(model_url, { method: 'HEAD' })` to verify asset accessibility.

---

## 4. 3D Engine GLB Integration

### 4.1 Asset Placement
- Static GLB models reside in `frontend/public/models/` (e.g., `frontend/public/models/puffer.glb`).
- Vite serves files in `public/` directly from root, accessible via `/models/puffer.glb`.

### 4.2 Three.js GLTF Loader & Mesh Cache (`CartoonFishFactory.ts` & `ThreeGameDirector.ts`)
- `GLTFLoader` imported from `'three/examples/jsm/loaders/GLTFLoader.js'`.
- `modelCache: Map<string, THREE.Group>` stores pre-parsed GLTF scenes.
- When `createFishMesh` is invoked:
  - If `species.model_url` is present:
    - If cached: clone scene, apply shiny effects if needed, normalize bounding box (target dimensions ~2.0 units), and attach to boids system.
    - If loading: instantiate procedural placeholder mesh immediately so the tank doesn't hitch or stall; when GLTF completes loading, smoothly swap placeholder with the GLB model in the boid hierarchy.
    - If error / file missing: log warning and continue using procedural cartoon mesh.

### 4.3 Shiny Effects on GLB Models
- When `is_shiny === true`:
  - Traverse GLB child meshes:
    - If `MeshStandardMaterial` or `MeshPhysicalMaterial`: increase metalness to 0.75, set roughness to 0.25, and tint with subtle iridescent specular color (`0xe0f2fe`).
    - Add subtle pulsating emissive glow.
  - Attach `SparkleParticleSystem` (4-point star trail generator) orbiting around the specimen.

### 4.4 Swimming Kinematics
- If GLB contains embedded animation clips (`gltf.animations` with swim / fin cycles):
  - Initialize `THREE.AnimationMixer` and play the primary swimming clip at speed proportional to boid velocity.
- If static mesh (no bones):
  - In `FishBoidsSystem.update(delta)`:
    - Apply sinusoidal yaw rotation oscillation (`Math.sin(time * 6) * 0.15`) and subtle pitch bobbing to simulate lifelike hydrodynamic swimming.

---

## 5. Verification & Test Plan

### 5.1 Automated Backend Tests (`backend/tests/admin_grant_fish.test.js`)
- Test granting standard fish to user.
- Test granting shiny fish (`is_shiny = 1`).
- Test species listing endpoint (`GET /api/admin/gacha/species`).
- Test updating species model URL (`PATCH /api/admin/gacha/species/:id`).

### 5.2 Automated Frontend Tests (`frontend/tests/admin_grant_fish_ui.test.js` & `frontend/tests/glb_fish_loader.test.js`)
- Verify `AdminGacha.tsx` and `AdminTankDrawer.tsx` render the Grant Specimen button and Shiny toggle.
- Verify `CartoonFishFactory.ts` / `ThreeGameDirector.ts` handles `model_url`, caching, and shiny shaders without regressions.

### 5.3 Build & Integration Verification
- Full test suite: all backend and frontend unit tests pass.
- `cd frontend && npm run build`: production bundle builds with 0 errors.
