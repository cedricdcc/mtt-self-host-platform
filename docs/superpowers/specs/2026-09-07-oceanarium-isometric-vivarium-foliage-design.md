# 3D Oceanarium: 2.5D Isometric Vivarium, Foliage, Detail & Controls Spec

**Date:** 2026-09-07  
**Status:** Approved in Brainstorming  
**Author:** AI Agent & User  

---

## 1. Overview & Objectives

The Oceanarium is being enhanced from its initial dark underwater presentation into a bright, vibrant, 2.5D isometric glass cube diorama. This spec outlines the architectural and visual additions required to achieve:

1. **2.5D Isometric Glass Vivarium Presentation:**
   - Default arrival perspective set to a crisp 2.5D isometric orientation looking into a glass diorama cube.
   - Distinct glass vivarium boundary frame with glowing cyan edge highlights, translucent caustic water ceiling, and sandy floor plate.
2. **Tropical Azure Lighting & Palette:**
   - Overhaul the lighting atmosphere from dark deep-sea navy to luminous tropical cyan and azure.
   - Enhanced rim lighting, brighter ambient fill, sunbeam caustics, and vivid water fog.
3. **Seabed Foliage & Living Reef System (`FoliageSystem.ts`):**
   - Procedurally swaying kelp ribbons along the rear/side perimeter.
   - Stylized branched staghorn corals, rippled brain corals, and rhythmic pulsing sea anemones.
4. **Creative Bubble Dynamics (`BubbleSystem.ts`):**
   - Submerged dual corner aerator bubbling stones producing rising streams with surface pop particles.
   - Micro bubble puffs emitted from fish mouths when feeding or turning.
   - Ambient suspended luminous marine snow flecks.
5. **Enhanced Cartoon Fish Models (`CartoonFishFactory.ts`):**
   - Expressive animated nibbling mouths with synchronized jaw opening/closing.
   - Sculpted dorsal and anal fin crests with kinematic secondary lag.
   - Species-specific markings (clownfish bands, tang palette loops, pufferfish spines) and rosy cheek blush patches.
6. **UI Controls Dock & Rich Tooltips (`OceanariumCanvas.tsx` / `CameraDirector.ts`):**
   - Glassmorphic control dock featuring a **Reset View** button (`RotateCcw` icon, hotkey `R`) that smoothly interpolates camera back to default isometric angle.
   - Interactive hover tooltips providing title, feature description, and keyboard shortcut badges.

---

## 2. Architectural Design & Module Breakdown

### 2.1 Vivarium Diorama Framing (`VivariumCube.ts` & `SceneEnvironment.ts`)
- **Dimensions:** `48` units wide $\times$ `40` units tall $\times$ `32` units deep, centered around `(0, 0, 0)` with floor at `y = -20` and water surface at `y = 20`.
- **Bounding Edges:** `LineSegments` highlighting vivarium edges in neon cyan (`#38bdf8`, opacity 0.35).
- **Floor Bed:** Sandy ocean floor mesh (`BoxGeometry(48, 1.5, 32)`) at `y = -20` with warm golden coral sand tint (`#fed7aa` / `#fde047` toon ramp).
- **Water Surface:** Translucent plane at `y = 20` with gentle normal ripples and cyan tint (`#38bdf8`, opacity 0.45).
- **Atmospheric Palette:**
  - Sky/Background: Deep cyan-blue gradient transition from `#0284c7` to `#0369a1`.
  - Ambient Light: Sky blue `#38bdf8` at intensity 1.4.
  - Sun Directional Light: Overhead bright azure-white `#e0f2fe` at intensity 2.2 casting soft shadows.
  - Water Fog: `THREE.FogExp2(0x0284c7, 0.012)`.

### 2.2 Animated Foliage System (`FoliageSystem.ts`)
- **Kelp Ribbons:**
  - Instanced or segmented ribbon geometry anchored to floor boundary perimeter.
  - Dynamic sine wave vertex / bone displacement: `dx = sin(time * 2.0 + segmentIndex * 0.4) * 0.8`.
  - Gradient toon shading: Emerald `#059669` base to lime `#84cc16` tips.
- **Corals & Anemones:**
  - Staghorn branch clusters in coral pink (`#fb7185`) and violet (`#a855f7`).
  - Brain corals with geodesic rippled domes in amber (`#f59e0b`).
  - Pulsing sea anemones with tentacle rings pulsing on an expansion/contraction scale cycle (`1.0 + 0.15 * sin(time * 3.0)`).
- **Lifecycle Integration:** Created inside `ThreeGameDirector`, attached to scene, updated every frame in `animate()`.

### 2.3 Dynamic Bubble Dynamics (`BubbleSystem.ts`)
- **Corner Aerators:**
  - Dual aerator stones positioned at `(-18, -19, -10)` and `(18, -19, -10)`.
  - Continuous particle recycling loop emitting 40–60 rising bubbles per stream.
  - Bubbles oscillate with `x += cos(time * 3.0 + id) * 0.04`, ascending until `y >= 19.5`, where they trigger a brief 3-particle pop ring and reset.
- **Fish Mouth Bubble Puffs:**
  - Exposed method `emitFishMouthPuff(position: THREE.Vector3, count = 3)` in `BubbleSystem`.
  - Triggered by `FeedingPhysics` whenever a fish forages a food flake, plus random low-frequency idle puffs.
- **Visuals:** Translucent spheres with specular toon glint (`MeshToonMaterial` or billboard particle sprites, opacity 0.75).

### 2.4 Cartoon Fish Enhancements (`CartoonFishFactory.ts`)
- **Nibbling Jaws:**
  - Lower jaw group linked to body.
  - Animated rotation around x-axis: `jaw.rotation.x = Math.max(0, Math.sin(time * 8.0) * 0.25)` during feeding, `0.08` while cruising.
- **Fin Crests:**
  - Dorsal ridge crest mesh attached to upper spine.
  - Anal/ventral fins attached to belly.
  - Secondary sway kinematics: `fin.rotation.y = Math.sin(time * 5.0 - 0.5) * 0.2`.
- **Species Markings & Cheeks:**
  - Clownfish: 3 distinct white ring decals / geometry rings with fine dark borders.
  - Pufferfish: Rounded spines scattered over belly and soft pink blush discs (`#f472b6`) below the eyes.
  - Blue Tang: Dark blue palette loop overlay and sunny yellow caudal fin.
  - Angelfish: Elongated trailing pelvic feelers with elastic sway kinematics.
- **Blushing & Eyes:**
  - Rosy blush discs on cheeks for cheerful, friendly aesthetic.
  - Cartoon eyes with layered pupils and specular highlights.

### 2.5 Camera Director & Isometric Reset (`CameraDirector.ts`)
- **Default 2.5D Isometric Position:**
  - Azimuth: $\theta = \pi / 4$ ($45^\circ$).
  - Elevation: $\phi = \pi / 3.2$ ($\approx 56^\circ$).
  - Radius: $55.0$ units.
  - Target: $(0, 0, 0)$.
- **Smooth Reset Method:**
  - `resetToIsometric(duration = 1.0)` smoothly lerps current spherical coordinates and target back to the default isometric view using ease-out cubic interpolation.
  - Cancels existing drag inertial momentum smoothly.

### 2.6 UI Controls Dock & Rich Tooltips (`OceanariumCanvas.tsx`)
- **Control Dock Components:**
  - **Reset View Button:** `RotateCcw` icon button. Triggers `gameDirector.resetCameraView()`.
  - **Feed Fish Button:** `Fish` / `Sparkles` icon button. Drops food flakes at center.
  - **Desktop / Zen Mode Button:** `Maximize2` / `Minimize2` toggle.
  - **Observation HUD:** Fish count, shiny count, camera hint.
- **Rich Hover Tooltips:**
  - Sleek glassmorphic card (`backdrop-blur-md bg-slate-900/85 border border-cyan-500/30 text-white rounded-xl shadow-xl p-3`).
  - Structure:
    - Top row: Feature Title + keyboard shortcut badge (e.g. `Reset View` + `[R]`).
    - Body text: Friendly explanation (e.g. *"Re-aligns camera to the 2.5D isometric diorama angle."*).
- **Keyboard Shortcuts:**
  - `[R]` or `[r]`: Reset to isometric view.
  - `[F]` or `[f]`: Drop food flakes.
  - `[Escape]`: Exit Desktop Mode.

---

## 3. Verification & Testing Strategy

1. **Unit Tests:**
   - Expand `frontend/tests/cartoon_fish_factory.test.js` to verify:
     - Fish mesh groups contain jaw/mouth groups, dorsal fin, anal fin, and blush decals.
     - New species markings render without material errors.
   - Add `frontend/tests/foliage_system.test.js` to test kelp, coral, and anemone generation.
   - Add `frontend/tests/bubble_system.test.js` to test particle updates, aerator streams, and mouth puff triggers.
   - Add `frontend/tests/camera_director.test.js` to test isometric reset math and coordinate constraints.
2. **Build Verification:**
   - Run `npm run build` in `frontend/` to ensure full TypeScript compilation with zero errors.
   - Run backend tests `npm test` in `backend/` to verify no regressions.
3. **Visual & Performance Smoke Test:**
   - Rebuild stack via `infra/rebuild.sh` and verify in browser:
     - Vivarium presents in crisp 2.5D isometric perspective.
     - Seabed has lively swaying kelp, colorful corals, and bubbling aerators.
     - Reset view button re-aligns camera smoothly.
     - Tooltips trigger correctly on hover.
     - Frame rate remains steady at 60fps.
