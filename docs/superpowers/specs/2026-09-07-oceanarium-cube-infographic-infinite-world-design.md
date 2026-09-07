# 3D Oceanarium: True Cube Vivarium, Infographic Specimen Scale & Desktop Procedural World Spec

**Date:** 2026-09-07  
**Status:** Approved in Brainstorming  
**Author:** AI Agent & User  

---

## 1. Overview & Objectives

This specification defines the comprehensive upgrade of the 3D Oceanarium experience in the MTT Platform. It transitions the visual enclosure into a geometrically authentic diorama cube, locks and guarantees isometric camera fidelity, expands layout real estate to 100% width, introduces a scientific specimen infographic scale, and expands Desktop Mode into a boundless procedural ocean world with an atmospheric sky, drifting clouds, and radiant sunlight.

Key Deliverables:
1. **Authentic 1:1:1 Cube Geometry ($40 \times 40 \times 40$):**
   - Reshape the vivarium from a rectangular box into an authentic cube with translucent acrylic glass panels, brushed titanium corner brackets, vertical etched depth tick-marks (0m to 3000m), and a stepped dark-slate pedestal base.
2. **Locked Isometric Normal View & Desktop-to-Cube Auto-Reset:**
   - In Normal Mode (`STANDARD_VIEW`), disable free orbit drag so the cube stays locked in its pristine 2.5D isometric diorama projection.
   - When returning from Desktop Mode (`DESKTOP_MODE`) to Normal Mode (or upon pressing `ESC` / clicking `Exit`), automatically execute a smooth ease-out reset back to the default isometric cube angle.
3. **100% Screen Real Estate Layout:**
   - Remove the restrictive `max-w-6xl` container in `Oceanarium.tsx`, allowing the oceanarium canvas and HUD to utilize 100% width (`w-full`) across all desktop displays.
4. **Interactive 3D Holographic Reticle & Scientific Infographic Specimen Drawer:**
   - 3D in-scene focus reticle with pulsing holographic brackets and depth leader line tracking the selected fish in real-time.
   - Sliding scientific specimen dossier (`FishInfographicPanel`) featuring:
     - **Comparative Physical Scale Ruler**: Silhouette comparison against real-world references (human hand for small fish, scuba diver for larger fish) with calculated metric length in cm/m.
     - **Bathymetric Depth Column**: Vertical water column meter pinpointing the fish's depth stratum across Sunlit (0–200m), Twilight (200–1000m), and Abyssal (1000–4000m+) zones.
     - **Bio-Telemetry & Dietary Gauges**: Vitality meter, swimming speed, food preference, and educational codex snippet.
     - **Specimen Actions**: Direct feeding trigger, Codex deep link, and smooth close/re-center.
5. **Desktop Mode Infinite Procedural World:**
   - Hide the glass cube and activate an expansive procedural infinite seabed with dynamic dunes, sand ripples, and scattered coral outcrops fading into deep-ocean atmospheric fog.
   - Atmospheric sky canopy ($Y \ge 24$) with procedural drifting clouds and a radiant physical sun lightsource casting shimmering god-ray caustics down through the water surface.
   - Anchor user fish flocking to the submarine's exploration vicinity so all collected fishes remain schooling and swimming near the viewer in the boundless sea.

---

## 2. Architectural Design & Detailed Components

### 2.1 Authentic 1:1:1 Cube Vivarium (`SceneEnvironment.ts`)
- **Dimensions:** Symmetrical cube with side length $L = 40.0$ units ($X \in [-20, 20]$, $Y \in [-20, 20]$, $Z \in [-20, 20]$).
- **Glass Panels:** 5 translucent acrylic faces (front, back, left, right, top) using `MeshPhysicalMaterial`:
  - `transmission: 0.85`
  - `roughness: 0.1`
  - `opacity: 0.12`
  - `transparent: true`
  - `color: 0x38bdf8`
  - Renders specular highlights while keeping internal aquatic life crystal clear.
- **Corner Brackets:** 8 procedural corner bracket geometries (brushed dark-metal / titanium alloy `#334155` with glowing cyan chamfers) framing each vertex of the cube.
- **Vertical Depth Scale Ticks:**
  - Etched luminous measurement ticks along the 4 vertical support pillars at depths:
    - `Y = +20`: Surface / `0m`
    - `Y = +7`: Epipelagic / `200m`
    - `Y = -7`: Mesopelagic / `1000m`
    - `Y = -20`: Abyssal Floor / `3000m`
- **Stepped Diorama Pedestal:**
  - Beveled dark slate platform (`BoxGeometry(44, 2, 44)`) positioned at $Y = -21$, grounding the cube cleanly in 3D space with subtle ambient occlusion shadow.
- **Subsystem Coordinate Bounds:**
  - `FishBoidsSystem`: bounds $X \in [-18, 18]$, $Z \in [-18, 18]$, $Y$ strata within $[-18, 18]$.
  - `FoliageSystem`: Kelp ribbons and coral reefs distributed symmetrically across the $40 \times 40$ seabed bed.
  - `FeedingPhysics`: Food spawns within $X, Z \in [-14, 14]$ and falls to $Y = -19$.
  - `BubbleSystem`: Aerators positioned at corners `(-17, -19, -17)` and `(17, -19, -17)`.

### 2.2 Camera Navigation & Guaranteed View Reset (`CameraDirector.ts`)
- **Locked Isometric Normal Mode:**
  - In `STANDARD_VIEW`, disable pointer dragging (`isDragging` will remain `false` during mouse drag events).
  - Keeps the cube rigidly positioned at:
    - $\theta = \pi / 4$ ($45^\circ$)
    - $\phi = \pi / 3.2$ ($\approx 56^\circ$)
    - $\text{Radius} = 55.0$
    - $\text{LookAt} = (0, 0, 0)$
- **Desktop-to-Cube View Reset (`resetToIsometric`):**
  - When switching from `DESKTOP_MODE` to `STANDARD_VIEW` (invoked on clicking `Exit`, pressing `ESC`, or calling `setMode('STANDARD_VIEW')`):
    - Compute starting camera position and lookAt vector from the active 3D camera.
    - Set `isResetting = true` over a $1.0\text{s}$ duration with cubic ease-out interpolation:
      $$\text{easeOut}(t) = 1 - (1 - t)^3$$
    - Smoothly glide camera position and target back to `ISOMETRIC_CENTER` and isometric spherical coordinates.
- **Inspecting Mode:**
  - Clicking a fish sets mode to `INSPECTING_FISH`, smoothly framing the fish mesh at an offset of $(0, 1.2, 5.5)$ while orienting toward the target.
  - Closing the infographic or clicking empty water triggers `resetToIsometric(0.8)` to smoothly re-center the cube.

### 2.3 In-Scene 3D Holographic Reticle (`ThreeGameDirector.ts`)
- Dedicated 3D reticle group added to the scene:
  - Outer pulsing cyan circle ring with dashed vertex indicators.
  - 4 corner targeting brackets framing the fish bounding box.
  - Vertical datum leader line dropping to the seabed to show exact depth altitude.
- Updated every frame in `animate()` to follow `selectedFish.mesh.position` smoothly.
- Fades out when deselected or switching modes.

### 2.4 100% Screen Real Estate Container (`Oceanarium.tsx` & `OceanariumCanvas.tsx`)
- **Page Wrapper:**
  - In `Oceanarium.tsx`: Replace `max-w-6xl mx-auto` with `w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4`.
  - Header, water quality meter, navigation tabs, and feed inventory expand to full width.
- **Canvas Container:**
  - In `OceanariumCanvas.tsx`: Responsive height `w-full h-[70vh] min-h-[600px] max-h-[860px]` with rounded-3xl border and glassmorphic backdrop.
  - Automatically updates renderer buffer size and camera aspect ratio on window resize.

### 2.5 Scientific Infographic Specimen Drawer (`FishInfographicPanel.tsx`)
Sliding glassmorphic panel docked on the right side of the canvas when a fish is clicked:
1. **Specimen Dossier Header:**
   - Species name, common nickname, Shiny shimmer badge, rarity ranking badge (Common / Uncommon / Rare / Epic / Legendary), favorite heart toggle.
2. **Comparative Physical Scale Visualizer (The Infographic Scale):**
   - Graphic visual bar comparing the specimen's actual length:
     - Small specimens ($< 25\text{ cm}$): Visualized against a human hand silhouette ($18\text{ cm}$).
     - Medium/Large specimens ($> 25\text{ cm}$): Visualized against a scuba diver silhouette ($1.8\text{ m}$).
   - Displays real-world metric dimensions (e.g. `Length: 26 cm • Scale: 1:7 Diver Scale`).
3. **Bathymetric Depth Stratum Column:**
   - Vertical visual gradient bar depicting ocean depth:
     - Sunlit Reef ($0 - 200\text{m}$)
     - Twilight Zone ($200 - 1000\text{m}$)
     - Abyssal Trench ($1000 - 4000\text{m}+$)
   - A pulsing cyan beacon marks the exact depth stratum of the selected fish.
4. **Bio-Telemetry & Dietary Stats:**
   - Vitality & Health gauge.
   - Cruising swim speed meter.
   - Diet preference (Flakes vs Super Pellets).
   - Habitat description snippet from Marine Codex.
5. **Specimen Actions:**
   - "Feed Flake" / "Feed Pellet" direct button.
   - "View in Codex" navigation link.
   - Close button [X] returning camera to normal isometric cube.

### 2.6 Desktop Mode Infinite Procedural World (`SceneEnvironment.ts`)
- **Procedural Infinite Ocean Floor:**
  - Dynamically generated procedural terrain grid ($120 \times 120$ units) centered around the camera/submarine.
  - Procedural dune elevation using trigonometric wave functions:
    $$y = -20 + \sin(x \cdot 0.08) \cdot 1.5 + \cos(z \cdot 0.06) \cdot 1.2$$
  - Seamlessly scrolls with camera movement to create the illusion of an infinite ocean floor.
  - Horizon fades softly into deep azure distance fog (`THREE.FogExp2(0x0284c7, 0.010)`).
- **Atmospheric Sky & Moving Clouds ($Y \ge 24$):**
  - Atmospheric sky hemisphere above the ocean surface with azure-to-white horizon gradient.
  - Procedural cumulus cloud layer drifting across the sky:
    $$\text{offset}_u = \text{time} \cdot 0.015, \quad \text{offset}_v = \text{time} \cdot 0.008$$
  - Radiant directional Sun (`sunLight`) with glowing corona disc projecting shimmering underwater caustic light shafts.
- **Fish Vicinity Flocking (`FishBoidsSystem.ts`):**
  - In `DESKTOP_MODE`, boid attraction centroid dynamically tracks within a $28\text{ unit}$ radius of the submarine, ensuring the user's fish collection remains swimming and visible around the viewer rather than dispersing into the infinite expanse.
- **Mode Toggle Transitions:**
  - Entering Desktop Mode: Cube panels, brackets, and pedestal hide; infinite terrain and sky fade in.
  - Exiting Desktop Mode: Infinite terrain and sky hide; diorama cube and pedestal restore; camera triggers `resetToIsometric(1.0)`.

---

## 3. Data Flow & State Management

```
User Action: Click Fish
   │
   ▼
ThreeGameDirector: raycaster hits Fish Group
   │
   ├──> CameraDirector: inspectFish(mesh) [Smooth glide to specimen]
   ├──> ThreeGameDirector: attach 3D Holographic Reticle to fish position
   └──> OceanariumCanvas: setSelectedFish(fish)
            │
            ▼
        Renders <FishInfographicPanel /> (Right slide-over)
        - Comparative Size Scale (Hand / Diver)
        - Bathymetric Column (Depth stratum)
        - Bio-telemetry & Diet
        - Quick Feed / Favorite / Codex Action
```

```
User Action: Exit Desktop Mode (ESC or Click Exit)
   │
   ▼
OceanariumCanvas: handleSetDesktopMode(false)
   │
   ▼
ThreeGameDirector: setMode('STANDARD_VIEW')
   │
   ├──> SceneEnvironment: setDesktopMode(false)
   │       [Fades out infinite seabed & sky, restores diorama cube & pedestal]
   ├──> FishBoidsSystem: setDesktopMode(false)
   │       [Restores cubic boid boundaries]
   └──> CameraDirector: setMode('STANDARD_VIEW')
           │
           ▼
        Automatically triggers resetToIsometric(1.0)
        [Cubic ease-out interpolation from submarine coordinates to isometric cube]
```

---

## 4. Verification & Testing Plan

### 4.1 Automated Tests (`frontend/tests/`)
1. **`camera_director.test.js`**:
   - Verify `CameraDirector` locks orbit drag in `STANDARD_VIEW`.
   - Verify `setMode('STANDARD_VIEW')` automatically invokes `resetToIsometric()`.
   - Verify `ISOMETRIC_RADIUS`, `ISOMETRIC_THETA`, `ISOMETRIC_PHI`, and `ISOMETRIC_CENTER` constants.
2. **`scene_environment.test.js`**:
   - Verify true cube dimensions ($40 \times 40 \times 40$).
   - Verify procedural infinite terrain and sky system methods in `SceneEnvironment.ts`.
   - Verify corner brackets and diorama pedestal initialization.
3. **`game_director.test.js`**:
   - Verify 3D target reticle creation and tracking in `ThreeGameDirector`.
   - Verify mode switching hooks between `STANDARD_VIEW` and `DESKTOP_MODE`.
4. **`fish_infographic.test.js`** (New):
   - Verify metric scale calculation logic (hand vs diver threshold).
   - Verify bathymetric zone mapping for Sunlit, Twilight, and Abyssal fish.

### 4.2 Visual & Manual Verification
- Verify that on desktop displays, the Oceanarium page expands to 100% width with no restricted `max-w-6xl` margins.
- Verify that dragging the mouse in normal mode does NOT rotate the cube.
- Click a fish and verify:
  - 3D holographic reticle frames the fish.
  - Camera glides closer to the fish.
  - Infographic panel slides in with the comparative size scale, depth gauge, and telemetry.
- Enter Desktop Mode and verify:
  - The cube dissolves into an infinite ocean floor.
  - Above the water, a radiant sun and moving clouds are visible.
  - User's fish school in the vicinity of the submarine.
- Exit Desktop Mode (press ESC or click Exit) and verify:
  - Camera smoothly eases out and re-centers exactly on the 1:1:1 diorama cube.
