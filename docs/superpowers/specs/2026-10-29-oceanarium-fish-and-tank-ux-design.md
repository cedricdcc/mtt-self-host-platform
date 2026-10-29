# Oceanarium 3D Fish Species Overhaul & Multi-Zone Tank UX Design

**Date:** 2026-10-29
**Status:** Draft for Review
**Scope:** Frontend 3D Oceanarium Engine (`CartoonFishFactory`, `FishBoidsSystem`, `SceneEnvironment`, `FoliageSystem`, `CameraDirector`), `OceanariumCanvas`, `FishInfographicPanel`, and `MarineCodex`.

---

## 1. Problem Statement

The current Three.js Oceanarium has two core areas that fall short of the desired visual craft and user experience:

1. **Underdeveloped 3D Fish Species (`CartoonFishFactory.ts` & `FishBoidsSystem.ts`):**
   - Out of **21 collectible species** seeded in `gacha_species` (`037_gacha_ecosystem.sql` and `040_species_glb_and_admin_grants.sql`), 8 `body_type` values (`hatchet`, `ribbon`, `ancient`, `rattail`, `eel`, `dumbo`, `chain`, `leviathan`) are not implemented in `CartoonFishFactory.ts` at all and fall back to a plain sphere.
   - Non-fish species that *are* partially branched (`ray`, `squid`, `octo`, `jelly`, `vertical`) still receive generic fish faces, circle blush decals, pectoral fins, dorsal/anal fins, and horizontal tail fins attached at sphere coordinates—leaving jellyfish, squids, octopuses, manta rays, and seahorses without tentacles, wings, or accurate anatomy.
   - Only 2 of the 21 species (`clown_anemone` and `sunburst_tang`) have body markings.
   - Swimming animation in `FishBoidsSystem.ts` only oscillates `tailPivot`, `dorsalFin`, `analFin`, and `leftFin`/`rightFin`, lacking wing-flapping for rays, dome-pulsing and trailing tentacles for jellyfish/cephalopods, upright bobbing for seahorses, and multi-segment S-wave undulation for serpentine creatures.

2. **Restrictive Tank Camera & Flat Environment (`CameraDirector.ts`, `SceneEnvironment.ts`, `FoliageSystem.ts`, `OceanariumCanvas.tsx`, `MarineCodex.tsx`):**
   - `CameraDirector.ts` disables mouse orbit, scroll-zoom, and vertical pan in Standard View, locking the user to a single static angle.
   - The `40 × 40 × 40` tank cube has a flat bright-yellow floor slab (`Y = -20`) with all foliage placed only at `Y = -19.2`, leaving the **Sunlit** (`Y: +6..+18`) and **Twilight** (`Y: -6..+6`) zones empty and visually indistinguishable from the **Abyssal** (`Y: -18..-6`) zone.
   - Selecting a fast-swimming fish by clicking directly in 3D is difficult without an in-tank roster or Prev/Next specimen switcher, and 12 of the 21 species in `MarineCodex.tsx` lack static PNG assets and fall back to plain emojis.

---

## 2. Architecture Overview

We will adopt **Modular Archetype Rig Builders + Cached Procedural Canvas Textures + Unified Locomotion & Biome Systems**:

```
frontend/components/oceanarium/
├── engine/
│   ├── CartoonFishFactory.ts     # 8 Anatomical Rig Families + Procedural Pattern Texture Cache (all 21 species)
│   ├── FishBoidsSystem.ts        # Locomotion Animator + Boid Schooling/Separation + Biome Landmark Affinity + Boop Reactions
│   ├── SceneEnvironment.ts       # Bathymetric Gradient Backdrop + Sun God-Rays + 3-Tier Sculpted Terrain & Lighting
│   ├── FoliageSystem.ts          # 3-Tier Vertical Ecology (Sunlit Coral Shelf, Twilight Canyon Fans, Abyssal Vents & Tube Worms)
│   ├── CameraDirector.ts         # Unlocked 360° Orbit, Scroll-Zoom, Pan, Front/Iso Presets & Orbiting Follow-Cam
│   └── ThreeGameDirector.ts      # Click-vs-Drag disambiguation, Specimen Cycling, Boop Reaction trigger
├── Species3DPreview.tsx          # Interactive 3D Turntable (for Codex Modal) + Cached Offscreen 3D Thumbnail Generator
├── OceanariumCanvas.tsx          # Camera Preset Controls, Collapsible Tank Roster Bar, Prev/Next Specimen Cycling
├── FishInfographicPanel.tsx      # Prev/Next Specimen Navigation + Interactive "Boop / Startle" Reaction Button
└── MarineCodex.tsx               # Uses Species3DPreview turntable in Dossier Modal & 3D snapshots for Grid Cards
```

---

## 3. Detailed Component Design

### 3.1. 3D Species Anatomy & Markings (`CartoonFishFactory.ts`)

Every species in `gacha_species` maps to one of **8 anatomical rig families**. Each rig exposes standardized animation handles on `group.userData` (`locomotionType`, `spineSegments`, `wingPivots`, `bellGroup`, `tentacles`, `tailPivot`, `dorsalFin`, `leftFin`, `rightFin`, `jawPivot`, `escaLure`, `puffSpikes`) and uses a cached `THREE.CanvasTexture` generator (`getPatternTexture(speciesId, primaryHex, secondaryHex, isShiny)`) so markings are crisp and memory-efficient.

#### Family 1: Sculpted Reef Swimmers (`locomotionType: 'carangiform'`)
- **`azure_damselfish`**: Sleek laterally-compressed ovoid body; electric cyan-to-cobalt gradient texture with bright yellow forked caudal fin and black eye-bar.
- **`sunburst_tang`**: Deep laterally-compressed disc profile with pointed snout, continuous swept dorsal/anal fins, bright lemon-gold gradient texture, and white surgeonfish caudal spine ("scalpel") at the tail base.
- **`emerald_parrotfish`**: Robust fusiform torpedo body; diamond-lattice jade/turquoise scale texture, rose-gold operculum cheek patch, and a distinct fused cyan beak at the snout.
- **`clown_anemone`**: Rounded reef body with three black-bordered white saddle stripes texture (`clown` pattern) and rounded black-rimmed paddle fins.

#### Family 2: Ornate Spined & Inflatable (`locomotionType: 'hover_flutter' | 'puffer'`)
- **`solar_lionfish` (`hover_flutter`)**: Banded crimson-and-ivory body texture; 14 splayed feathered dorsal spine rays along the back and two wide fan-like ribbed pectoral wings.
- **`spotted_pufferfish` (`puffer`)**: Globose body with golden spotted dorsal pattern, cream belly, stubby pectoral paddles, and 24 radial conical spines (`userData.puffSpikes`). When startled/booped, smoothly inflates body scale to `1.45×` and extends spikes for 2.5 seconds.

#### Family 3: Pelagic Winged Rays (`locomotionType: 'rajiform'`)
- **`sapphire_manta`**: Flattened diamond disc with articulated 2-joint left and right triangular pectoral wings (`leftWingInner` $\rightarrow$ `leftWingOuter`, `rightWingInner` $\rightarrow$ `rightWingOuter`), forward-projecting cephalic horn lobes flanking a wide terminal mouth, pale ventral belly with 5 pairs of gill slits, bioluminescent cyan dorsal chevron markings, and a slender whip tail. Does not attach generic spherical fish fins or cheek blush.

#### Family 4: Upright Syngnathids (`locomotionType: 'upright_bob'`)
- **`golden_seahorse`**: Vertical S-curved torso built from stacked ridged segments, equine tubular snout, 5-point coronet crown, curled prehensile tail (`tailCurlGroup`), and a translucent fluttering dorsal fan on the back. Stabilized upright in `FishBoidsSystem`.

#### Family 5: Cephalopods (`locomotionType: 'jet_pulse' | 'ear_flap'`)
- **`prismatic_squid` (`jet_pulse`)**: Translucent refractive torpedo mantle (`transmission: 0.65`) with diamond terminal fins, glowing violet-cyan internal core organ, lateral eyes near the mantle base, 8 articulated short arms, and 2 long clubs.
- **`vampire_octo` (`jet_pulse`)**: Velvety dark-crimson dome mantle with 2 side ear-fins and 8 curved arms connected by a flared webbed skirt, with glowing cyan bioluminescent photophore spheres at each arm tip and eye rim.
- **`dumbo_specter` (`ear_flap`)**: Cute rounded bell body with prominent paddle-like ear fins (`leftEarFin`, `rightEarFin`), expressive eyes, and a short scalloped skirt of 8 stubby curled tentacles.

#### Family 6: Medusae & Colonial Chains (`locomotionType: 'medusa_pulse' | 'chain_wave'`)
- **`cosmic_jelly` (`medusa_pulse`)**: Double-layered translucent hemisphere bell with radial ultraviolet/magenta nebula vein texture, 4 frilly spiral oral arms in the center, and 12 thin neon trailing tentacles arranged around the bell margin. No fish eyes, mouth, or fins.
- **`crystal_siphonophore` (`chain_wave`)**: Articulated colonial chain of 8 translucent cyan-green nectophore bells (`spineSegments[]`) linked along a glowing central stem with trailing bioluminescent tentilla filaments.

#### Family 7: Deep-Sea Serpentine & Titans (`locomotionType: 'anguilliform'`)
- **`ribbon_oarfish`**: 8-segment articulated laterally-compressed silver ribbon body (`spineSegments[]`), full-length crimson dorsal fin membrane, and a crown of 3 elongated red cephalic rays above the head.
- **`gulper_void`**: Oversized hinged pelican jaw (`jawPivot`, 40% of head length) with tiny eyes and a 7-segment tapering whip-like serpentine tail ending in a glowing pink photophore bulb.
- **`abyssal_leviathan`**: Colossal 8-segment armored apex titan with obsidian-plated spine segments, glowing cyan tectonic seam markings, jagged dorsal scutes, 4 swept pectoral/pelvic flippers, horned skull crest, and a broad horizontal fluke.

#### Family 8: Deep-Sea Pelagic Specialists (`locomotionType: 'specialist_swim'`)
- **`silver_hatchet`**: Ultra-thin mirror-silver blade profile with deep keel belly, upward-pointing tubular eyes, and a row of 10 glowing cyan ventral photophores along the keel.
- **`glass_lantern`**: Semi-translucent streamlined body with internal spine silhouette, large iridescent blue eyes, and 8 glowing cyan lateral photophore pearls.
- **`coelacanth_shadow`**: Heavy prehistoric indigo-slate armored body with white mineral fleck texture, 4 fleshy stalked lobe-fins (`leftFrontLobe`, `rightFrontLobe`, `leftRearLobe`, `rightRearLobe`), and an authentic 3-lobed diphycercal tail with epicaudal lobe.
- **`ghost_grenadier`**: Large angular armored head with glowing pale eyes, sensory chin barbel, and a long tapering multi-segment rattail.
- **`bioluminescent_angler`**: Globose midnight-black abyssal body, cavernous underbite jaw lined with 12 translucent inward-curved fangs, and a dorsal illicium stalk tipping forward with a glowing cyan esca orb + `THREE.PointLight`.

---

### 3.2. Multi-Zone Tank Environment (`SceneEnvironment.ts` & `FoliageSystem.ts`)

1. **Bathymetric Backdrop & Stratified Lighting (`SceneEnvironment.ts`):**
   - Add a vertical gradient backdrop plane on the rear exterior (`Z = -HALF_CUBE - 0.1`) painted via `CanvasTexture` transitioning smoothly from **Sunlit Tropical Cyan** (`#0284c7`, `Y: +6..+20`) $\rightarrow$ **Twilight Pelagic Indigo** (`#1e3a8a`, `Y: -6..+6`) $\rightarrow$ **Abyssal Midnight Trench** (`#090d16`, `Y: -20..-6`).
   - Add **5 Animated Volumetric Sun God-Ray Shafts** descending at a slight angle from the water ceiling (`Y = +20` down to `Y = +4`), gently pulsing in opacity with `Math.sin(time * 0.7 + idx)`.
   - Replace the flat yellow box floor (`0xfde047`) with a **Sculpted Multi-Zone Seabed**: warm sandy dunes along the perimeter tapering into a deep basaltic abyssal trench in the center/rear.

2. **3-Tier Vertical Biome Scaping (`FoliageSystem.ts`):**
   - **Tier 1 — Sunlit Reef Terrace (`Y: +6 to +12`):**
     - Sculpted coral limestone shelves and a natural reef arch mounted along the rear-left (`X: -18..-8, Y: +7, Z: -14`) and rear-right (`X: +8..+18, Y: +8, Z: -13`) walls.
     - Populated with staghorn corals, brain corals, swaying emerald kelp, and pulsing sea anemones at `Y: +7.5..+11`, giving Sunlit reef fish a vibrant upper-tank habitat.
   - **Tier 2 — Twilight Canyon Wall (`Y: -6 to +5`):**
     - Stepped slate-indigo basalt outcrops along the middle walls (`Y: -4..+3, Z: -15`) adorned with bioluminescent violet sea-fans and glowing cyan sponge chimneys.
   - **Tier 3 — Abyssal Volcanic Trench (`Y: -19.5 to -7`):**
     - 3 **Hydrothermal Vent Chimneys** on the trench floor with glowing cyan/amber fissures, clusters of crimson-tipped giant tube worms, and translucent crystal spires.

---

### 3.3. Interactive Camera & Controls (`CameraDirector.ts` & `OceanariumCanvas.tsx`)

1. **Unlocked Orbit, Scroll-Zoom & Vertical Pan (`CameraDirector.ts`):**
   - **Orbit (Left-Drag):** Adjusts `spherical.theta` (unbounded 360°) and `spherical.phi` (clamped to `[0.25, Math.PI - 0.25]`).
   - **Zoom (Mouse Wheel / Pinch):** Adjusts `spherical.radius` clamped to `[10, 82]`.
   - **Pan (Right-Drag or `Shift` + Left-Drag):** Moves `centerOffset` within `X: [-16, 16], Y: [-18, 18], Z: [-16, 16]`.
   - **Click vs. Drag Disambiguation (`ThreeGameDirector.ts` & `OceanariumCanvas.tsx`):**
     - Record `pointerDownPos` on `pointerdown`. During `pointermove`, if distance exceeds `5px`, mark gesture as a camera drag.
     - Only trigger fish selection or food drop on `pointerup` when total pointer travel was `< 5px`.
2. **Camera Presets & Dynamic Orbiting Follow-Cam:**
   - **Isometric View (`[R]`):** `radius: 56, theta: Math.PI / 4, phi: Math.PI / 2.6, center: (0, 0, 0)`.
   - **Front Glass View (`[F]`):** `radius: 48, theta: 0, phi: Math.PI / 2, center: (0, 0, 0)`.
   - **Depth Zone Jumps (`Sunlit 0m`, `Twilight 500m`, `Abyssal 2500m`):** Smoothly interpolates `centerOffset.y` to `+12`, `0`, or `-13` with `radius: 30` while keeping orbit/zoom active.
   - **Orbiting Follow-Cam (`INSPECTING_FISH`):** Smoothly sets `centerOffset` to track `inspectingTarget.position` every frame while allowing the user to orbit (`theta`, `phi`) and zoom (`radius: [6, 24]`) around the moving fish.

---

### 3.4. Boid Behaviors, Roster Bar, Specimen Cycling & 3D Codex (`FishBoidsSystem.ts`, `OceanariumCanvas.tsx`, `FishInfographicPanel.tsx`, `Species3DPreview.tsx`, `MarineCodex.tsx`)

1. **Natural Boid Behaviors & Reactions (`FishBoidsSystem.ts`):**
   - **Separation & Schooling:** All fish apply short-range separation (`dist < 2.2`) so meshes never overlap; schooling species (`azure_damselfish`, `sunburst_tang`, `clown_anemone`, `silver_hatchet`, `glass_lantern`) add mild alignment/cohesion with same-species neighbors.
   - **Habitat Landmark Affinity:** `clown_anemone` and `golden_seahorse` bias 50% of their waypoints toward the Sunlit Coral Shelf (`Y: +7.5..+12, Z: -14..-9`); `ghost_grenadier`, `bioluminescent_angler`, and `dumbo_specter` bias waypoints toward the Abyssal Trench & Vents (`Y: -17..-10`).
   - **Upright Stabilization:** `golden_seahorse` and `cosmic_jelly` orient via horizontal `yaw` only, keeping their vertical axis upright with gentle harmonic sway.
   - **`triggerReaction(fishId)` ("Boop / Startle"):** Sets `boid.reactionTimer = 2.5`. Pufferfish inflates to `1.45×` and extends spikes; Anglerfish/Gulper opens jaw wide and pulses lure intensity; Cephalopods/Jellyfish execute a fast jet burst; Reef fish/Manta perform a joyful barrel spin and emit mouth bubbles.

2. **Collapsible Tank Roster & Infographic Cycling (`OceanariumCanvas.tsx` & `FishInfographicPanel.tsx`):**
   - **Bottom Specimen Roster Drawer:** A collapsible pill bar at the bottom of `OceanariumCanvas.tsx` showing the count of active fish (`Specimens in Tank (N)`) and expandable into a horizontal strip of fish chips (color dot, name, Shiny badge, depth zone). Clicking any chip selects and follows that fish.
   - **Prev / Next & Boop in `FishInfographicPanel.tsx`:**
     - Header includes `← Prev` and `Next →` buttons to cycle through `fishes` without closing the drawer.
     - Action bar includes a **`⚡ Boop Specimen`** button alongside **`🍞 Feed Specimen`** that triggers `director.boopFish(fish.user_fish_id)`.

3. **Interactive 3D Codex Turntable & 3D Card Thumbnails (`Species3DPreview.tsx` & `MarineCodex.tsx`):**
   - **`<Species3DPreview species={...} isShiny={...} mode="interactive" | "thumbnail" />`:**
     - **`mode="interactive"` (Codex Inspection Modal):** Renders a dedicated WebGL canvas with an orbitable 3D fish mesh built by `CartoonFishFactory`, playing its live idle locomotion (`FishBoidsSystem.animateMesh(...)`) with dramatic rim lighting. Toggling **Standard Form** vs. **Shiny Form** updates the 3D mesh live.
     - **`mode="thumbnail"` (Codex Grid Cards):** Uses a shared singleton offscreen renderer to capture and cache a crisp `256×256` data-URL portrait for any discovered species (especially the 12 species without static PNGs), ensuring all 21 species display detailed 3D artwork in the Codex grid.

---

## 4. Verification & Testing Plan

1. **Unit & Component Tests:**
   - Verify `CartoonFishFactory.createFishMesh()` constructs valid `THREE.Group` hierarchies with the expected `userData.locomotionType` and anatomical parts for all **21 species IDs** (both Standard and Shiny variants).
   - Verify `FishBoidsSystem` updates locomotion animations across all 8 rig families, enforces separation, and executes `triggerReaction()` (`reactionTimer` & puffer inflation).
   - Verify `CameraDirector` handles orbit drag, wheel zoom, pan, front/isometric presets, and orbiting follow-cam state transitions.
2. **Build & Live Browser Verification:**
   - Run frontend TypeScript check and production build (`npm run build`).
   - Rebuild stack via `bash ./infra/rebuild.sh` and verify the Oceanarium 3D tank, camera controls, roster bar, specimen reactions, and Marine Codex 3D turntable.
