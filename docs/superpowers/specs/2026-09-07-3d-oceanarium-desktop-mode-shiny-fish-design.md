# 3D Oceanarium, Desktop Submarine Mode & Shiny Fish System Design Specification

**Date:** 2026-09-07  
**Status:** Approved Design Spec  
**Target Area:** Oceanarium 3D Overhaul & Gacha Ecosystem Extension  
**Access Scope:** Admin / Authorized Oceanarium Users  

---

## 1. Overview & Objectives

The Oceanarium is upgraded from a 2D canvas simulation to a rich, immersive **3D Underwater Environment** using Three.js, orchestrated by a dedicated **`ThreeGameDirector`** architecture.

### Key Objectives
1. **Homepage Cartoon Aesthetics**: Adapt all 20 marine species to feature the friendly, rounded, expressive cartoon characteristics of the homepage pufferfish (big expressive eyes, glossy toon/cel shading, playful proportions, and organic sine-wave fin wiggles).
2. **Desktop Background Mode**: A dedicated fullscreen ambient mode featuring a third-person cinematic camera following an autonomous yellow cartoon research submarine as it cruises the oceanarium, occasionally pausing to observe random player fish with an observation spotlight and HUD tag.
3. **Shiny Variant System (1/500 Rarity)**: Introduce an ultra-rare 1/500 (0.2%) chance for any caught fish to be a Shiny variant, complete with iridescent/pearly materials, floating star sparkle particle auras, dramatic gacha pull animations, and dual codex badging.
4. **Interactive 3D Aquarium Experience**: Retain intuitive interactions in the standard view (multi-depth camera orbit/snap, 3D sinking food physics with autonomous fish feeding steering, and raycasted fish inspection).

---

## 2. Architecture & Component Hierarchy

To maintain clean separation of concerns and avoid bloated React components, the simulation logic is partitioned into a modular engine under `frontend/components/oceanarium/engine/`.

```
frontend/components/oceanarium/engine/
├── ThreeGameDirector.ts       # Orchestrates simulation loop, modes, and event bus
├── SceneEnvironment.ts        # Depth lighting, gradient fog, water caustics, bubbles
├── CartoonFishFactory.ts      # Procedural 3D cartoon mesh rigs matching pufferfish style
├── FishBoidsSystem.ts         # 3D boids swimming, depth strata clamping, food chasing
├── SubmarineDirector.ts       # Yellow bathyscaphe, propeller, searchlight, patrol & pause AI
├── CameraDirector.ts          # Smooth lerps between Orbit, Depth Snaps, and Submarine Chase
└── FeedingPhysics.ts          # 3D food flakes/pellets and mouth collision detection
```

### Mode State Machine
`ThreeGameDirector` manages 3 distinct states:
* **`STANDARD_VIEW`**: User-controlled orbit camera, depth zone jump buttons (*Sunlit 0m*, *Twilight 500m*, *Abyssal 2500m*), click-to-feed in 3D, and fish selection.
* **`DESKTOP_MODE`**: Fullscreen immersion, UI chrome hidden, auto-hiding controls on mouse movement, 3rd-person cinematic submarine chase camera with autonomous nature documentary pauses.
* **`INSPECTING_FISH`**: Camera smoothly focuses and frames a selected fish in close-up with its info card displayed.

---

## 3. Visual Styling & 3D Model System

### 3.1 Cartoon Characteristics (Matching Homepage Pufferfish)
The 20 marine species are built programmatically in `CartoonFishFactory.ts`:
* **Body Form**: Squashed spheres, capsules, and rounded organic extrusions with soft curves.
* **Eyes**: Distinctive oversized white sclera with glossy dark pupils, specular secondary light highlights, and subtle look-at tracking.
* **Procedural Swimming Rigs**: Segmented fin vertices and bone pivots driven by time-based sine-wave functions (`sin(time * speed + offset)`) producing natural, lively tail sweeps and fin flutters.
* **Materials**: `MeshToonMaterial` or customized gradient cel-shaders with soft Fresnel rim highlights, matching the vibrant pastel/marine color schemes in `gacha_species.visual_traits`.
* **Depth Strata Adaptation**:
  * *Sunlit (0–200m)*: Bright tropical tones, iridescent scales, lively fast swim cycles.
  * *Twilight (200–1000m)*: Silvery gradients, translucent membranes, subtle photophore glimmers.
  * *Abyssal (1000m+)*: Dark bodies with vibrant bioluminescent neon emissive nodes, slow majestic undulating movement.

### 3.2 Shiny Variant System (1/500 Rarity)
* **Visual Material**: Prismatic/pearlescent shader shift with shifting iridescent highlights and golden/crystal undertones.
* **Particle Aura**: Persistent orbiting four-point star glints and soft glitter particles circling the fish in 3D.
* **Submarine Observation**: When the submarine encounters a shiny fish during Desktop Mode, the observation tag highlights the shiny status with special golden text and star badges (*“✨ SHINY TARGET ACQUIRED”*).

---

## 4. Desktop Mode & Submarine Patrol Director

### 4.1 Submarine Model & Effects
* **Model**: Classic cartoon yellow bathyscaphe with rounded hull, bubble dome cockpit with interior glow, spinning dual side/rear propellers, top periscope and hatch.
* **Trail Emitter**: Churns a gentle stream of buoyant micro-bubbles behind the propulsion propellers.
* **Searchlight**: Two forward-mounted spot lamps projecting volumetric light cones through the water column.

### 4.2 Autonomous Nature Documentary Routine
1. **Cruise Phase**: Submarine gently glides through waypoints across the 3D tank using smooth Catmull-Rom spline curves or damped pursuit vectors.
2. **Acquisition Phase**: Every 25–40 seconds, the director selects an active fish from the tank.
3. **Deceleration & Hover**: The submarine slows to a hover ~3–5 units from the fish and directs its searchlight onto it.
4. **Cinematic Framing**: `CameraDirector` smoothly pivots to frame both the hovering submarine and the swimming fish.
5. **Observation Tag**: Ambient glassmorphic card fades in:
   ```
   [● OBSERVING SPECIMEN]
   Species: Clown Anemonefish (or ✨ Shiny Azure Damselfish)
   Depth: Sunlit Reef (45m) • Status: Active
   ```
6. **Resume**: After 6–8 seconds of observation, the tag fades out, propeller rpm increases, and the submarine resumes open-water cruising.

### 4.3 Controls & Fullscreen Handling
* Triggered via a prominent **“Desktop Mode”** button in `Oceanarium.tsx` and the 3D canvas HUD.
* Invokes HTML5 Fullscreen API with graceful fallback to fixed 100vw/100vh CSS overlay.
* Pressing `Escape` or clicking the auto-hiding floating exit button exits Desktop Mode immediately.

---

## 5. Backend Schema & Gacha Integration

### 5.1 Database Migration (`038_shiny_fishes.sql`)
```sql
-- Add is_shiny column to user_fishes
ALTER TABLE user_fishes ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0 CHECK(is_shiny IN (0, 1));

-- Record shiny status in pull logs
ALTER TABLE gacha_pull_logs ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0 CHECK(is_shiny IN (0, 1));
```

### 5.2 Pull Logic in `ecosystem.service.js`
* During each pull in `pullGacha(userIdentifier, count)`:
  * An independent check `const isShiny = Math.random() < (1 / 500);` is evaluated.
  * If true, `is_shiny = 1` is inserted into `user_fishes` and `gacha_pull_logs`.
  * The result object includes `is_shiny: Boolean(isShiny)`.
* `fetchEcosystem` and `fetchCodex` return `is_shiny` for all user fishes.

### 5.3 Marine Codex & Gacha Presentation
* `MarineCodex.tsx` adds a shiny toggle/star icon on each card. Clicking it allows users to view the shiny variant visual traits and marks shiny collection progress (e.g. *“Shinies Discovered: 1/20”*).
* Gacha reveal modal triggers a special prismatic/rainbow particle burst and fanfare when a shiny fish is pulled.

---

## 6. Performance, Error Handling & Lifecycle

* **DPR Clamping**: Restrict render target DPR to `Math.min(window.devicePixelRatio, 2.0)` to guarantee stable 60fps.
* **Shared Geometries**: Fin, eye, and bubble geometries are instantiated and shared across instances.
* **Resource Disposal**: On unmount, `ThreeGameDirector.dispose()` cleans up geometries, materials, textures, RAF loops, and event listeners.
* **Context Loss Resilience**: Native handling of `webglcontextlost` and `webglcontextrestored`.

---

## 7. Verification Plan

### Automated Tests
1. **Backend Tests (`backend/tests/shiny_gacha.test.js`)**:
   - Verify `038_shiny_fishes.sql` migration runs cleanly and sets `is_shiny` default to `0`.
   - Verify `pullGacha` rolls shiny flag and records `is_shiny: 1` in `user_fishes` and `gacha_pull_logs`.
   - Verify `fetchEcosystem` and `fetchCodex` return `is_shiny` property.
2. **Frontend Tests (`frontend/tests/three_oceanarium.test.js`)**:
   - Verify `ThreeGameDirector` initializes and switches modes (`STANDARD_VIEW` ↔ `DESKTOP_MODE`).
   - Verify `CartoonFishFactory` creates valid meshes for all 20 species and shiny configurations.
   - Verify `MarineCodex` shiny toggle updates state correctly.

### Manual / Browser Verification
1. Open Oceanarium page and verify the 3D scene renders with cartoon fish matching the homepage pufferfish style.
2. Click in the tank with Flake and Super Pellet selected to verify 3D food sinking and fish feeding steering.
3. Click the "Desktop Mode" button to verify fullscreen activation, submarine cinematic chase camera, volumetric searchlight, and the nature documentary pause routine.
4. Verify pressing ESC exits Desktop Mode cleanly.
5. In admin tools / test scripts, grant a shiny fish and verify the iridescent material and star sparkle particle trail.
