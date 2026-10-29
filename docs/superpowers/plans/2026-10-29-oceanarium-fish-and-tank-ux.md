# Oceanarium 3D Fish Species Overhaul & Multi-Zone Tank UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul all 21 collectible 3D marine species with bespoke anatomical rigs, procedural pattern textures, and biological locomotion, while upgrading the Oceanarium tank to a 3-tier vertical reef-to-abyss biome with unlocked 360° orbit/zoom/pan camera controls, an in-tank specimen roster, interactive reactions, and a live 3D turntable in the Marine Codex.

**Architecture:** Refactor `CartoonFishFactory.ts` into 8 anatomical rig builders backed by a cached HTML5 Canvas texture generator and standardized animation handles consumed by `FishBoidsSystem.ts` and a new `<Species3DPreview />` component. Upgrade `SceneEnvironment.ts` and `FoliageSystem.ts` into a 3-tier vertical biome (Sunlit Coral Shelf, Twilight Basalt Canyon, Abyssal Hydrothermal Trench) and unlock full spherical orbit, wheel-zoom, pan, and dynamic follow-cam in `CameraDirector.ts` and `ThreeGameDirector.ts`.

**Tech Stack:** React 18, TypeScript 5.8, Three.js 0.185 (`THREE`), Tailwind CSS, Lucide React, Node.js test assertions (`node frontend/tests/*.test.js`).

## Global Constraints

- All 21 species seeded in `037_gacha_ecosystem.sql` and `040_species_glb_and_admin_grants.sql` (`azure_damselfish`, `sunburst_tang`, `emerald_parrotfish`, `clown_anemone`, `golden_seahorse`, `sapphire_manta`, `solar_lionfish`, `spotted_pufferfish`, `silver_hatchet`, `glass_lantern`, `ribbon_oarfish`, `prismatic_squid`, `vampire_octo`, `coelacanth_shadow`, `ghost_grenadier`, `bioluminescent_angler`, `gulper_void`, `dumbo_specter`, `crystal_siphonophore`, `abyssal_leviathan`, `cosmic_jelly`) must have dedicated anatomical geometry, markings, and `userData.locomotionType`.
- Existing method names required by regression tests (`addCartoonEyes`, `addNibblingMouth`, `addCheekBlush`, `addSpeciesMarkings`, `addAnglerLure`, `createToonGradient`, `getShinyColor`, `createSparkleAura`, `tailPivot`, `leftFin`, `rightFin`, `dorsalFin`, `analFin`, `jawPivot`) must be preserved on `CartoonFishFactory`.
- Pointer interactions on `OceanariumCanvas` must distinguish clicks (`< 5px` travel) from camera orbit/pan drags (`>= 5px` travel) so orbiting never accidentally selects a fish or drops food.
- Frontend TypeScript build (`npm run build` inside `frontend/`) must pass with zero errors after every task.

---

### Task 1: Overhaul `CartoonFishFactory.ts` with 8 Anatomical Rig Families & Procedural Textures for All 21 Species

**Files:**
- Modify: `frontend/components/oceanarium/engine/CartoonFishFactory.ts`
- Test: `frontend/tests/cartoon_fish_factory.test.js`

**Interfaces:**
- Produces:
  - `LocomotionType = 'carangiform' | 'hover_flutter' | 'puffer' | 'rajiform' | 'upright_bob' | 'jet_pulse' | 'ear_flap' | 'medusa_pulse' | 'chain_wave' | 'anguilliform' | 'specialist_swim'`
  - `CartoonFishFactory.createFishMesh(species: FishSpeciesVisuals, isShiny?: boolean): THREE.Group` with `group.userData`:
    - `locomotionType: LocomotionType`
    - `spineSegments?: THREE.Object3D[]`
    - `leftWingInner?: THREE.Object3D`, `leftWingOuter?: THREE.Object3D`, `rightWingInner?: THREE.Object3D`, `rightWingOuter?: THREE.Object3D`
    - `bellGroup?: THREE.Object3D`, `tentacles?: THREE.Object3D[]`
    - `leftEarFin?: THREE.Object3D`, `rightEarFin?: THREE.Object3D`
    - `puffSpikes?: THREE.Object3D[]`
    - `lobeFins?: THREE.Object3D[]`
    - `escaLure?: THREE.Object3D`, `escaLight?: THREE.PointLight`
    - `tailPivot?: THREE.Object3D`, `dorsalFin?: THREE.Object3D`, `analFin?: THREE.Object3D`, `leftFin?: THREE.Object3D`, `rightFin?: THREE.Object3D`, `jawPivot?: THREE.Object3D`

- [ ] **Step 1: Update `frontend/tests/cartoon_fish_factory.test.js` with failing assertions for all 8 rig families and 21 species**

Replace `frontend/tests/cartoon_fish_factory.test.js` with:

```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CartoonFishFactory structural invariants, 8 rig families, and 21 species...');

  const factoryPath = path.join(__dirname, '../components/oceanarium/engine/CartoonFishFactory.ts');
  assert.ok(fs.existsSync(factoryPath), 'CartoonFishFactory.ts must exist');

  const content = fs.readFileSync(factoryPath, 'utf8');

  // Core class & methods
  assert.ok(content.includes('export class CartoonFishFactory'), 'Must export CartoonFishFactory class');
  assert.ok(content.includes('createFishMesh'), 'Must implement createFishMesh method');
  assert.ok(content.includes('addCartoonEyes'), 'Must implement addCartoonEyes method');
  assert.ok(content.includes('sclera') && content.includes('pupil') && content.includes('shine'), 'Must construct eye sclera, pupil, and shine');
  assert.ok(content.includes('tailPivot') && content.includes('leftFin') && content.includes('rightFin'), 'Must assign tailPivot, leftFin, rightFin');
  assert.ok(content.includes('dorsalFin') && content.includes('analFin') && content.includes('jawPivot'), 'Must assign dorsalFin, analFin, jawPivot');
  assert.ok(content.includes('addNibblingMouth'), 'Must implement addNibblingMouth');
  assert.ok(content.includes('addCheekBlush'), 'Must implement addCheekBlush');
  assert.ok(content.includes('addSpeciesMarkings'), 'Must implement addSpeciesMarkings');
  assert.ok(content.includes('addAnglerLure'), 'Must implement addAnglerLure');
  assert.ok(content.includes('MeshToonMaterial') && content.includes('createToonGradient'), 'Must use MeshToonMaterial and createToonGradient');
  assert.ok(content.includes('isShiny') && content.includes('getShinyColor') && content.includes('createSparkleAura'), 'Must handle Shiny variants');

  // Verify all body types & specialized rig builders
  const requiredBodyChecks = [
    "bodyType === 'ray'",
    "bodyType === 'vertical'",
    "bodyType === 'spiky'",
    'buildMantaRayRig',
    'buildSeahorseRig',
    'buildCephalopodRig',
    'buildMedusaAndChainRig',
    'buildSerpentineRig',
    'buildDeepSpecialistRig',
    'createPatternTexture'
  ];
  for (const check of requiredBodyChecks) {
    assert.ok(content.includes(check), `CartoonFishFactory must include ${check}`);
  }

  // Verify locomotion types assigned on userData
  const locomotionTypes = [
    'carangiform',
    'hover_flutter',
    'puffer',
    'rajiform',
    'upright_bob',
    'jet_pulse',
    'ear_flap',
    'medusa_pulse',
    'chain_wave',
    'anguilliform',
    'specialist_swim'
  ];
  for (const loco of locomotionTypes) {
    assert.ok(content.includes(loco), `CartoonFishFactory must support locomotionType: ${loco}`);
  }

  console.log('✓ CartoonFishFactory 8 rig families and 21 species invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run `node frontend/tests/cartoon_fish_factory.test.js` to verify it fails**

Run: `node frontend/tests/cartoon_fish_factory.test.js`
Expected: FAIL with `CartoonFishFactory must include buildMantaRayRig`

- [ ] **Step 3: Implement the 8 anatomical rig builders and procedural pattern texture cache in `frontend/components/oceanarium/engine/CartoonFishFactory.ts`**

Update `frontend/components/oceanarium/engine/CartoonFishFactory.ts` so that:
1. It defines `export type LocomotionType = 'carangiform' | 'hover_flutter' | 'puffer' | 'rajiform' | 'upright_bob' | 'jet_pulse' | 'ear_flap' | 'medusa_pulse' | 'chain_wave' | 'anguilliform' | 'specialist_swim';`.
2. It implements `public createPatternTexture(speciesId: string, primaryHex: string, secondaryHex: string, isShiny: boolean): THREE.CanvasTexture | null` using an offscreen 256×256 canvas cached in `private static patternCache: Map<string, THREE.CanvasTexture>` that draws species-distinct patterns:
   - `clown_anemone`: orange base with 3 white vertical saddle bands outlined in black.
   - `emerald_parrotfish`: jade-to-turquoise gradient with diamond scale lattice.
   - `azure_damselfish`: neon blue body with deep cobalt dorsal fade and yellow tail accent.
   - `sunburst_tang`: bright lemon-to-gold radial gradient.
   - `solar_lionfish`: maroon and cream zebra vertical stripes.
   - `spotted_pufferfish`: warm amber dorsum with dark espresso spots and cream belly.
   - `sapphire_manta`: deep sapphire back with glowing cyan chevron shoulder markings.
   - `coelacanth_shadow`: dark indigo-slate scales with white mineral speckles.
   - `cosmic_jelly`: radial magenta-ultraviolet nebula starburst veins.
   - `abyssal_leviathan`: obsidian armor plates with glowing cyan tectonic seams.
   - `glass_lantern` & `silver_hatchet`: metallic silver/cyan counter-shaded sheen with glowing cyan ventral photophore dots.
3. In `buildProceduralFallbackMesh(group, species, isShiny)`, route to dedicated builders based on `species.id` and `species.body_type`:
   - `ray` / `sapphire_manta` $\rightarrow$ `buildMantaRayRig` (`locomotionType = 'rajiform'`, articulated `leftWingInner` / `leftWingOuter` and `rightWingInner` / `rightWingOuter`, cephalic horn lobes, ventral gill slits, whip tail).
   - `vertical` / `golden_seahorse` $\rightarrow$ `buildSeahorseRig` (`locomotionType = 'upright_bob'`, stacked S-curve torso rings, tubular equine snout, 5-spike coronet crown, curled prehensile tail, fluttering dorsal fan on back).
   - `squid` / `octo` / `dumbo` (`prismatic_squid`, `vampire_octo`, `dumbo_specter`) $\rightarrow$ `buildCephalopodRig`:
     - `prismatic_squid`: `locomotionType = 'jet_pulse'`, translucent diamond-finned mantle, glowing internal core, lateral eyes, 8 articulated waving arms + 2 long feeding tentacles (`userData.tentacles`).
     - `vampire_octo`: `locomotionType = 'jet_pulse'`, velvety crimson dome with dark webbing skirt, side ear-fins, 8 curved arms with glowing cyan photophore tips (`userData.tentacles`).
     - `dumbo_specter`: `locomotionType = 'ear_flap'`, rounded bell, large flapping `leftEarFin` and `rightEarFin`, cute eyes, and 8 short curled skirt tentacles (`userData.tentacles`).
   - `jelly` / `chain` (`cosmic_jelly`, `crystal_siphonophore`) $\rightarrow$ `buildMedusaAndChainRig`:
     - `cosmic_jelly`: `locomotionType = 'medusa_pulse'`, double-layered translucent hemisphere `bellGroup` with nebula pattern, 4 spiral oral arms, and 12 long neon trailing `tentacles` (no fish eyes or fish fins).
     - `crystal_siphonophore`: `locomotionType = 'chain_wave'`, 8 articulated translucent glowing nectophore bells in `spineSegments[]` with trailing bioluminescent filament ribbons.
   - `ribbon` / `eel` / `leviathan` (`ribbon_oarfish`, `gulper_void`, `abyssal_leviathan`) $\rightarrow$ `buildSerpentineRig` (`locomotionType = 'anguilliform'`):
     - Multi-segment articulated chain (`userData.spineSegments`, 7–8 segments).
     - `ribbon_oarfish`: laterally flat silver ribbon segments, continuous crimson dorsal crest along all segments, 3 tall red crown rays on head.
     - `gulper_void`: massive hinged pelican jaw (`userData.jawPivot`) on segment 0, tiny eyes, tapering dark eel segments, glowing pink tail tip bulb.
     - `abyssal_leviathan`: armored obsidian titan segments with glowing cyan fissures, dorsal scutes, 4 pectoral/pelvic flippers, horned skull crest, horizontal tail fluke.
   - `hatchet` / `ancient` / `rattail` / `angler` / `glass_lantern` $\rightarrow$ `buildDeepSpecialistRig` (`locomotionType = 'specialist_swim'`):
     - `silver_hatchet`: ultra-thin mirror blade body, upturned tubular eyes, 10 glowing cyan ventral photophore beads.
     - `glass_lantern`: semi-translucent torpedo body with internal spine, large glowing blue eyes, 8 lateral photophore beads.
     - `coelacanth_shadow`: armored slate body with white flecks, 4 fleshy stalked `lobeFins`, 3-lobed diphycercal tail.
     - `ghost_grenadier`: angular armored head, chin barbel, 5-segment tapering rattail (`spineSegments`).
     - `bioluminescent_angler`: dark abyssal orb body, huge underbite jaw (`jawPivot`) with 12 translucent inward fangs, and `addAnglerLure` attaching `userData.escaLure` and `userData.escaLight`.
   - `oval` / `disc` / `torpedo` / `spiky` (`azure_damselfish`, `sunburst_tang`, `emerald_parrotfish`, `clown_anemone`, `solar_lionfish`, `spotted_pufferfish`) $\rightarrow$ Sculpted Reef & Spined builder:
     - `solar_lionfish` sets `locomotionType = 'hover_flutter'` with 14 splayed feathered dorsal spines and wide ribbed fan pectorals.
     - `spotted_pufferfish` sets `locomotionType = 'puffer'` with cream belly, spotted top texture, and 24 radial spikes stored in `userData.puffSpikes`.
     - `emerald_parrotfish` adds a fused cyan beak on the snout; `sunburst_tang` adds a pointed snout and white caudal scalpel spine; `clown_anemone` and `azure_damselfish` apply their pattern textures and sculpted fins with `locomotionType = 'carangiform'`.

- [ ] **Step 4: Run test and frontend build to verify**

Run: `node frontend/tests/cartoon_fish_factory.test.js && cd frontend && npm run build`
Expected: PASS and clean Vite build.

- [ ] **Step 5: Commit Task 1**

```bash
git add frontend/components/oceanarium/engine/CartoonFishFactory.ts frontend/tests/cartoon_fish_factory.test.js
git commit -m "feat(oceanarium): overhaul 21 fish species with 8 anatomical rig families and procedural textures"
```

---

### Task 2: Upgrade `FishBoidsSystem.ts` with Multi-Archetype Locomotion, Boid Schooling/Separation, Biome Affinity & Boop Reactions

**Files:**
- Modify: `frontend/components/oceanarium/engine/FishBoidsSystem.ts`
- Test: `frontend/tests/boids_simulation.test.js`

**Interfaces:**
- Consumes: `group.userData` handles from `CartoonFishFactory` (`locomotionType`, `spineSegments`, `leftWingInner`, `leftWingOuter`, `rightWingInner`, `rightWingOuter`, `bellGroup`, `tentacles`, `leftEarFin`, `rightEarFin`, `puffSpikes`, `lobeFins`, `escaLure`, `tailPivot`, `dorsalFin`, `analFin`, `leftFin`, `rightFin`, `jawPivot`).
- Produces:
  - `FishBoidsSystem.animateFishMesh(mesh: THREE.Group, time: number, delta: number, speedRatio?: number, reactionTimer?: number): void` (static helper reusable by `<Species3DPreview />` in Task 5!)
  - `FishBoidsSystem.triggerReaction(fishId: number): boolean` (sets `boid.reactionTimer = 2.5` and gives velocity impulse/animation burst)

- [ ] **Step 1: Update `frontend/tests/boids_simulation.test.js` with failing assertions for multi-archetype locomotion, separation/schooling, and `triggerReaction`**

Update `frontend/tests/boids_simulation.test.js` to assert:
- `FishBoidsSystem` implements static `animateFishMesh` and instance `triggerReaction`.
- Handles locomotion types `rajiform`, `medusa_pulse`, `anguilliform`, `jet_pulse`, `upright_bob`, `puffer`.
- Applies neighbor separation (`separation`) and habitat affinity landmarks.

- [ ] **Step 2: Run `node frontend/tests/boids_simulation.test.js` to verify it fails**

Run: `node frontend/tests/boids_simulation.test.js`
Expected: FAIL with missing `animateFishMesh` / `triggerReaction`.

- [ ] **Step 3: Implement multi-archetype locomotion, Boid separation/schooling, habitat affinity, upright stabilization, and `triggerReaction` in `frontend/components/oceanarium/engine/FishBoidsSystem.ts`**

In `frontend/components/oceanarium/engine/FishBoidsSystem.ts`:
1. Add `reactionTimer: number;` to `BoidFish` (initialized to `0`).
2. Add `public triggerReaction(fishId: number): boolean`: finds the boid by `fishId`, sets `boid.reactionTimer = 2.5`, and applies a species-appropriate impulse (e.g., vertical jet hop for jelly/cephalopods, dash for reef fish, hover puff for pufferfish).
3. Add `public static animateFishMesh(mesh: THREE.Group, time: number, delta: number, speedRatio = 1.0, reactionTimer = 0): void` that animates:
   - `carangiform` / `specialist_swim`: `tailPivot`, `dorsalFin`, `analFin`, `leftFin`, `rightFin`, `jawPivot`, plus tetrapod diagonal paddling on `lobeFins` (`coelacanth_shadow`), bobbing `escaLure` (`bioluminescent_angler`), and barrel-spin on `reactionTimer > 0`.
   - `hover_flutter`: slow regal pectoral fan wave + splayed spine shimmer.
   - `puffer`: rapid fin waddle; when `reactionTimer > 0`, smoothly lerps body scale to `1.45×` and scales `puffSpikes` out to `1.8×`.
   - `rajiform`: sinusoidal wing flapping on `leftWingInner`/`leftWingOuter` and `rightWingInner`/`rightWingOuter` (`rotation.z` phase-delayed wave) + whip tail trail.
   - `upright_bob`: rapid dorsal fan flutter + prehensile `tailCurlGroup` coiling + gentle vertical bobbing.
   - `jet_pulse` / `ear_flap`: rhythmic mantle breathing contraction + phase-delayed sine wave along each tentacle in `tentacles[]` + flapping `leftEarFin`/`rightEarFin` on `dumbo_specter`.
   - `medusa_pulse` / `chain_wave`: `bellGroup` squash-and-stretch (`scale.set(1 + pulse*0.18, 1 - pulse*0.22, 1 + pulse*0.18)`) + trailing harmonic waves on `tentacles[]` or `spineSegments[]`.
   - `anguilliform`: phase-delayed S-wave rotation (`seg.rotation.y = Math.sin(time * 5.0 * swimSpeed - idx * 0.65) * 0.28`) across `spineSegments[]`, plus wide jaw opening on `gulper_void` when `reactionTimer > 0` or chasing food.
4. In `update(delta, time, foodPellets, focusOrigin)`:
   - Apply short-range separation between all nearby boids (`dist < 2.4`) and mild cohesion/alignment for same-species reef/twilight schoolers (`azure_damselfish`, `sunburst_tang`, `clown_anemone`, `silver_hatchet`, `glass_lantern`).
   - Bias waypoints for `clown_anemone` and `golden_seahorse` toward the Sunlit Coral Shelf (`Y: 7..13, Z: -14..-8`) 50% of the time, and `ghost_grenadier`, `bioluminescent_angler`, `dumbo_specter` toward the Abyssal Trench (`Y: -17.5..-10`).
   - Keep `upright_bob` (`golden_seahorse`) and `medusa_pulse` (`cosmic_jelly`) upright (`pitch` and `roll` damped toward `0`, rotating smoothly in horizontal `yaw`).

- [ ] **Step 4: Run test and frontend build to verify**

Run: `node frontend/tests/boids_simulation.test.js && cd frontend && npm run build`
Expected: PASS and clean build.

- [ ] **Step 5: Commit Task 2**

```bash
git add frontend/components/oceanarium/engine/FishBoidsSystem.ts frontend/tests/boids_simulation.test.js
git commit -m "feat(oceanarium): add multi-archetype locomotion, boid schooling, habitat affinity, and boop reactions"
```

---

### Task 3: Upgrade `SceneEnvironment.ts` and `FoliageSystem.ts` into a 3-Tier Vertical Reef-to-Abyss Biome

**Files:**
- Modify: `frontend/components/oceanarium/engine/SceneEnvironment.ts`
- Modify: `frontend/components/oceanarium/engine/FoliageSystem.ts`
- Test: `frontend/tests/scene_environment.test.js`, `frontend/tests/foliage_system.test.js`

**Interfaces:**
- Produces:
  - `SceneEnvironment`: `bathymetricBackdrop: THREE.Mesh`, `godRaysGroup: THREE.Group`, sculpted multi-zone `sandFloor` + abyssal trench baserock, stratified zone lighting (`sunlitLight`, `twilightLight`, `abyssalGlowLight`).
  - `FoliageSystem`: `createSunlitCoralShelf()`, `createTwilightCanyonWall()`, `createAbyssalHydrothermalVents()`, plus `createKelpForest()` and `createCoralsAndAnemones()`.

- [ ] **Step 1: Update `frontend/tests/scene_environment.test.js` and `frontend/tests/foliage_system.test.js` with failing assertions for 3-tier biome features**

Add assertions for `bathymetricBackdrop`, `godRaysGroup` in `scene_environment.test.js`, and `createSunlitCoralShelf`, `createTwilightCanyonWall`, `createAbyssalHydrothermalVents` in `foliage_system.test.js`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node frontend/tests/scene_environment.test.js && node frontend/tests/foliage_system.test.js`
Expected: FAIL on missing 3-tier biome methods/meshes.

- [ ] **Step 3: Implement Bathymetric Backdrop, Animated God-Rays & Sculpted Seabed in `SceneEnvironment.ts` and 3-Tier Biome Ecology in `FoliageSystem.ts`**

1. In `frontend/components/oceanarium/engine/SceneEnvironment.ts`:
   - Add `public bathymetricBackdrop: THREE.Mesh | null = null;` and `public godRaysGroup: THREE.Group | null = null;`.
   - In `initVivariumFrame()`:
     - Create a vertical gradient canvas texture (`#0284c7` Sunlit $\rightarrow$ `#1e3a8a` Twilight $\rightarrow$ `#070b14` Abyssal) mapped onto a `40 × 40` backdrop plane at `Z = -HALF_CUBE - 0.15` (hidden in `DESKTOP_MODE`).
     - Create `godRaysGroup` with 5 angled translucent light shafts (`CylinderGeometry(0.8, 3.8, 16, 12, 1, true)` with `AdditiveBlending`) descending through the Sunlit zone (`Y = +19` down to `Y = +5`), gently shimmering in `update()`.
     - Sculpt `sandFloor` vertex heights so the outer perimeter forms warm sandy reef dunes while the central/rear basin dips into a dark volcanic trench, and add a bioluminescent cyan-violet point light (`abyssalGlowLight`) near the trench floor (`Y = -16`).
2. In `frontend/components/oceanarium/engine/FoliageSystem.ts`:
   - Implement `public createSunlitCoralShelf(): void`: builds raised limestone reef ledges & a coral arch in the Sunlit zone (`Y: +6.5 to +11.5`, along rear-left and rear-right walls) populated with colorful staghorn corals, brain corals, swaying emerald sea-blades, and pulsing sea anemones.
   - Implement `public createTwilightCanyonWall(): void`: builds stepped slate/indigo basalt canyon outcrops in the Twilight zone (`Y: -5 to +4`, along rear/side walls) with bioluminescent violet gorgonian sea-fans and glowing cyan sponge chimneys.
   - Implement `public createAbyssalHydrothermalVents(): void`: builds 3 volcanic black-smoker vent chimneys on the Abyssal trench floor (`Y = -19.2`) with glowing cyan/amber mineral fissures, clusters of crimson-tipped giant tube worms, and translucent crystal spires.

- [ ] **Step 4: Run tests and frontend build to verify**

Run: `node frontend/tests/scene_environment.test.js && node frontend/tests/foliage_system.test.js && cd frontend && npm run build`
Expected: PASS and clean build.

- [ ] **Step 5: Commit Task 3**

```bash
git add frontend/components/oceanarium/engine/SceneEnvironment.ts frontend/components/oceanarium/engine/FoliageSystem.ts frontend/tests/scene_environment.test.js frontend/tests/foliage_system.test.js
git commit -m "feat(oceanarium): build 3-tier vertical reef-to-abyss biome scaping, god-rays, and hydrothermal vents"
```

---

### Task 4: Unlock Interactive Camera Controls (`CameraDirector.ts` & `ThreeGameDirector.ts`) with 360° Orbit, Scroll-Zoom, Pan, Front/Iso Presets & Orbiting Follow-Cam

**Files:**
- Modify: `frontend/components/oceanarium/engine/CameraDirector.ts`
- Modify: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Test: `frontend/tests/camera_director.test.js`, `frontend/tests/game_director.test.js`

**Interfaces:**
- Produces:
  - `CameraDirector.snapToFrontView(duration?: number): void`
  - `CameraDirector.onPointerDown(clientX: number, clientY: number, isPan?: boolean): void`
  - `CameraDirector.onPointerMove(clientX: number, clientY: number): void`
  - `CameraDirector.onWheel(deltaY: number): void`
  - `ThreeGameDirector.snapToFrontView(): void`
  - `ThreeGameDirector.selectFishById(userFishId: number): UserFish | null`
  - `ThreeGameDirector.boopFish(userFishId: number): boolean`
  - `ThreeGameDirector.handleWheel(deltaY: number): void`

- [ ] **Step 1: Update `frontend/tests/camera_director.test.js` and `frontend/tests/game_director.test.js` with failing assertions**

Update `frontend/tests/camera_director.test.js` to verify:
- `resetToIsometric`, `snapToFrontView`, `onWheel`, `onPointerDown`, `onPointerMove`, `onPointerUp`.
- Orbit dragging updates `this.spherical.theta` and `this.spherical.phi`.
- `INSPECTING_FISH` mode uses `this.spherical` relative to `this.inspectingTarget.position` so the user can orbit and zoom around a followed fish.
Update `frontend/tests/game_director.test.js` to verify `selectFishById`, `boopFish`, `snapToFrontView`, and `handleWheel`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node frontend/tests/camera_director.test.js && node frontend/tests/game_director.test.js`
Expected: FAIL on missing `snapToFrontView` / `onWheel` / `selectFishById` / `boopFish`.

- [ ] **Step 3: Implement unlocked 360° orbit, zoom, pan, front view preset, and orbiting follow-cam in `CameraDirector.ts` and `ThreeGameDirector.ts`**

1. In `frontend/components/oceanarium/engine/CameraDirector.ts`:
   - Add `public isPanning: boolean = false;`.
   - Implement `public snapToFrontView(duration = 0.9): void`: smoothly transitions `spherical` to `(radius: 48, phi: Math.PI / 2, theta: 0)` and `centerOffset` to `(0, 0, 0)`.
   - In `inspectFish(fishMesh: THREE.Object3D)`: if not already in `INSPECTING_FISH`, initialize `this.spherical.set(12.0, Math.PI / 2.2, Math.PI / 6)` so the user starts at a flattering 3/4 macro angle and can freely orbit/zoom around the swimming fish.
   - Unlock `onPointerDown(clientX, clientY, isPan = false)`: sets `this.isDragging = true; this.isPanning = isPan; this.isResetting = false; this.previousMousePosition = { x: clientX, y: clientY };`.
   - Implement `onPointerMove(clientX, clientY)`:
     - When `isDragging`: compute `dx = clientX - previousMousePosition.x` and `dy = clientY - previousMousePosition.y`.
     - If `isPanning` (and not `INSPECTING_FISH`): pan `centerOffset.y` by `dy * 0.06` (clamped `[-18, 18]`) and `centerOffset.x` by `-dx * 0.06` (clamped `[-16, 16]`).
     - Otherwise (orbiting in `STANDARD_VIEW` or `INSPECTING_FISH`): update `this.spherical.theta -= dx * 0.007` and `this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi - dy * 0.007, 0.2, Math.PI - 0.2)`.
   - Implement `public onWheel(deltaY: number): void`: adjusts `this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius + deltaY * 0.025, this.mode === 'INSPECTING_FISH' ? 5.5 : 12.0, this.mode === 'INSPECTING_FISH' ? 24.0 : 82.0)`.
   - Update `updateInspectingCamera(delta)`: compute `const fishPos = this.inspectingTarget.position; const offset = new THREE.Vector3().setFromSpherical(this.spherical); const desiredPos = fishPos.clone().add(offset);` and smoothly lerp `this.camera.position` and `this.currentLookAt` (`fishPos`).
2. In `frontend/components/oceanarium/engine/ThreeGameDirector.ts`:
   - Add `public snapToFrontView(): void { this.detachReticle(); this.cameraDirector.snapToFrontView(0.9); }`
   - Add `public handleWheel(deltaY: number): void { this.cameraDirector.onWheel(deltaY); }`
   - Add `public selectFishById(userFishId: number): UserFish | null`: looks up the boid in `this.boidsSystem.getAllFishes()`, attaches the reticle, calls `this.cameraDirector.inspectFish(boid.mesh)`, invokes `this.callbacks.onFishSelected?.(rawFish)`, and returns `rawFish`.
   - Add `public boopFish(userFishId: number): boolean`: calls `this.boidsSystem.triggerReaction(userFishId)` and emits a celebratory bubble puff (`this.bubbleSystem.emitFishMouthPuff(boid.mesh.position, 6)`).
   - Update `handlePointerDown(clientX, clientY, rect, isPan = false)` so clicking an already-selected fish triggers `this.boopFish(rawFish.user_fish_id)`!

- [ ] **Step 4: Run tests and frontend build to verify**

Run: `node frontend/tests/camera_director.test.js && node frontend/tests/game_director.test.js && cd frontend && npm run build`
Expected: PASS and clean build.

- [ ] **Step 5: Commit Task 4**

```bash
git add frontend/components/oceanarium/engine/CameraDirector.ts frontend/components/oceanarium/engine/ThreeGameDirector.ts frontend/tests/camera_director.test.js frontend/tests/game_director.test.js
git commit -m "feat(oceanarium): unlock 360 orbit, wheel zoom, pan, front view preset, and orbiting follow-cam"
```

---

### Task 5: Tank Roster Bar, Specimen Cycling/Boop UI & Interactive 3D Turntable in Marine Codex

**Files:**
- Create: `frontend/components/oceanarium/Species3DPreview.tsx`
- Modify: `frontend/components/oceanarium/OceanariumCanvas.tsx`
- Modify: `frontend/components/oceanarium/FishInfographicPanel.tsx`
- Modify: `frontend/components/oceanarium/MarineCodex.tsx`
- Test: `frontend/tests/oceanarium_canvas.test.js`, `frontend/tests/fish_infographic.test.js`, `frontend/tests/marine_codex_cards.test.js`

**Interfaces:**
- Consumes: `CartoonFishFactory`, `FishBoidsSystem.animateFishMesh`, `ThreeGameDirector.selectFishById`, `ThreeGameDirector.boopFish`, `ThreeGameDirector.snapToFrontView`, `ThreeGameDirector.handleWheel`.
- Produces:
  - `<Species3DPreview species={GachaSpecies} isShiny={boolean} interactive?: boolean className?: string />`
  - Upgraded `OceanariumCanvas` with click-vs-drag threshold (`5px`), wheel zoom, Front Glass `[F]` + Isometric `[R]` view buttons, collapsible Tank Specimen Roster bar, and Prev/Next fish cycling.
  - Upgraded `FishInfographicPanel` with `onPrevFish`, `onNextFish`, `onBoopFish`, `totalFishes`, `currentIndex`.
  - Upgraded `MarineCodex` rendering `<Species3DPreview interactive={true} />` in the inspection modal and 3D thumbnail snapshots on discovered Codex cards.

- [ ] **Step 1: Update `frontend/tests/oceanarium_canvas.test.js`, `frontend/tests/fish_infographic.test.js`, and `frontend/tests/marine_codex_cards.test.js` with failing assertions**

Add assertions for:
- `OceanariumCanvas.tsx`: `snapToFrontView`, `handleWheel`, collapsible specimen roster (`isRosterOpen` / `Specimens in Tank`), and click-vs-drag threshold.
- `FishInfographicPanel.tsx`: `onPrevFish`, `onNextFish`, `onBoopFish` (`Boop Specimen`).
- `MarineCodex.tsx` & `Species3DPreview.tsx`: `Species3DPreview` component existence and integration in `MarineCodex.tsx`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node frontend/tests/oceanarium_canvas.test.js && node frontend/tests/fish_infographic.test.js && node frontend/tests/marine_codex_cards.test.js`
Expected: FAIL on missing `Species3DPreview`, `onPrevFish`/`onBoopFish`, and `snapToFrontView`.

- [ ] **Step 3: Create `frontend/components/oceanarium/Species3DPreview.tsx` and update `FishInfographicPanel.tsx`, `OceanariumCanvas.tsx`, and `MarineCodex.tsx`**

1. Create `frontend/components/oceanarium/Species3DPreview.tsx`:
   - Supports two modes:
     - `interactive = true` (used in `MarineCodex` Dossier Modal): mounts a dedicated WebGL canvas with `CartoonFishFactory.createFishMesh()`, studio three-point lighting, `FishBoidsSystem.animateFishMesh()` running at 60 FPS, and pointer-drag 360° turntable rotation + auto-turntable spin.
     - `interactive = false` (used on discovered `MarineCodex` grid cards when a static PNG is missing or for 3D preview): renders a cached `256×256` 3D snapshot (`Map<string, string>` keyed by `${species.id}_${isShiny}`) via a shared offscreen renderer so all 21 species have crisp 3D portraits without spinning up 21 simultaneous WebGL contexts.
2. Update `frontend/components/oceanarium/FishInfographicPanel.tsx`:
   - Add props: `onPrevFish?: () => void`, `onNextFish?: () => void`, `onBoopFish?: () => void`, `fishIndex?: number`, `totalFishes?: number`.
   - Render a sleek `← Prev` | `Specimen X of N` | `Next →` navigation bar when `totalFishes > 1`.
   - Add a **`⚡ Boop Specimen`** button next to **`🍞 Feed Specimen`** that triggers `onBoopFish` (and plays a fun toast/visual pulse).
3. Update `frontend/components/oceanarium/OceanariumCanvas.tsx`:
   - Track pointer down coordinates (`pointerDownRef = useRef<{ x: number; y: number; isDragging: boolean } | null>(null)`).
   - On `onPointerDown`: initiate camera orbit/pan (`director.cameraDirector.onPointerDown(e.clientX, e.clientY, e.button === 2 || e.shiftKey)`).
   - On `onPointerMove`: if distance from `pointerDownRef` exceeds `5px`, mark `isDragging = true` and call `director.handlePointerMove(e.clientX, e.clientY)`.
   - On `onPointerUp`: call `director.handlePointerUp()`. Only if `!isDragging`, perform raycast fish selection / food drop (`director.handlePointerDown(...)`).
   - Attach `onWheel={(e) => directorRef.current?.handleWheel(e.deltaY)}`.
   - Add a **Front Glass View `[F]`** button next to **Reset Isometric View `[R]`** in the top-right dock (and bind keyboard shortcut `F`).
   - Add a **Collapsible Specimen Roster Bar** at the bottom-center of Standard View listing all `fishes` with quick-click chips to select/follow any fish in the tank, plus `handlePrevFish` and `handleNextFish` wired into `<FishInfographicPanel />`.
4. Update `frontend/components/oceanarium/MarineCodex.tsx`:
   - In the Inspect Modal ("Field Guide Dossier"), render `<Species3DPreview species={inspectingSpecies} isShiny={inspectingShiny} interactive={true} />` inside the specimen showcase box with a `"Drag to rotate 3D model"` badge.
   - In the Species Card Grid, when a discovered species lacks a static PNG (`hasImgError` or no PNG in `/public/species/`), render `<Species3DPreview species={species} isShiny={Boolean(species.discovered_shiny)} interactive={false} />` so all 21 species display rich 3D portraits instead of fallback emojis.

- [ ] **Step 4: Run all Oceanarium frontend tests and full production build**

Run:
```bash
node frontend/tests/cartoon_fish_factory.test.js && \
node frontend/tests/boids_simulation.test.js && \
node frontend/tests/scene_environment.test.js && \
node frontend/tests/foliage_system.test.js && \
node frontend/tests/camera_director.test.js && \
node frontend/tests/game_director.test.js && \
node frontend/tests/oceanarium_canvas.test.js && \
node frontend/tests/fish_infographic.test.js && \
node frontend/tests/marine_codex_cards.test.js && \
cd frontend && npm run build
```
Expected: All 9 test suites PASS and `vite build` succeeds with zero errors.

- [ ] **Step 5: Commit Task 5**

```bash
git add frontend/components/oceanarium/Species3DPreview.tsx frontend/components/oceanarium/OceanariumCanvas.tsx frontend/components/oceanarium/FishInfographicPanel.tsx frontend/components/oceanarium/MarineCodex.tsx frontend/tests/oceanarium_canvas.test.js frontend/tests/fish_infographic.test.js frontend/tests/marine_codex_cards.test.js
git commit -m "feat(oceanarium): add tank specimen roster, prev/next cycling, boop reaction UI, and 3D codex turntable"
```
