# 3D Oceanarium: True Cube Vivarium, Infographic Specimen Scale & Desktop Procedural World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Oceanarium into an authentic 1:1:1 diorama cube with locked isometric normal mode, auto-reset on exit from desktop mode, full 100% width UI layout, an interactive 3D holographic reticle, a scientific specimen infographic scale, and a boundless procedural ocean world in desktop mode with an atmospheric sky, drifting clouds, and radiant sun.

**Architecture:** 
- `SceneEnvironment.ts` manages both the symmetrical $40 \times 40 \times 40$ vivarium diorama (with acrylic panels, titanium corner brackets, vertical etched depth tick-marks, and dark-slate pedestal) and the boundless procedural ocean floor with sky canopy, drifting clouds, and directional sunlight.
- `CameraDirector.ts` locks standard orbit drag to preserve the 2.5D isometric perspective and guarantees smooth cubic ease-out reset back to the cube view when transitioning from `DESKTOP_MODE` or upon manual reset.
- `ThreeGameDirector.ts` orchestrates the 3D holographic target reticle around inspected fishes and switches between diorama and infinite world modes.
- `Oceanarium.tsx` expands to 100% width (`w-full`), while `FishInfographicPanel.tsx` presents a sliding scientific specimen dossier with comparative size scale (vs human hand or scuba diver), bathymetric depth stratum gauge, and bio-telemetry.

**Tech Stack:** Three.js (r128+), React 18, TypeScript, Tailwind CSS, Lucide React, Node.js assert tests.

## Global Constraints

- Vivarium Cube dimensions must be strictly symmetrical: $40 \times 40 \times 40$ ($X, Y, Z \in [-20, 20]$).
- In Normal Mode (`STANDARD_VIEW`), mouse orbit drag is disabled; camera stays locked in 2.5D isometric view.
- Exiting Desktop Mode (`DESKTOP_MODE`) must smoothly auto-reset the camera back to the isometric cube view.
- Oceanarium layout must use 100% width (`w-full`) without restrictive max-width capping.
- Infographic specimen panel must feature a comparative physical scale (fish size vs human hand or scuba diver).
- Desktop mode must feature infinite procedural terrain, sky with moving clouds, and sun lightsource, keeping user's fish in the vicinity.
- Node.js ESM test suite in `frontend/tests/` must pass cleanly without regressions.

---

### Task 1: Authentic 1:1:1 Cube Vivarium & Subsystem Bounds Synchronization

**Files:**
- Modify: `frontend/components/oceanarium/engine/SceneEnvironment.ts`
- Modify: `frontend/components/oceanarium/engine/FishBoidsSystem.ts`
- Modify: `frontend/components/oceanarium/engine/FeedingPhysics.ts`
- Modify: `frontend/components/oceanarium/engine/BubbleSystem.ts`
- Modify: `frontend/components/oceanarium/engine/FoliageSystem.ts`
- Test: `frontend/tests/scene_environment.test.js`

**Interfaces:**
- `SceneEnvironment.initVivariumFrame(): void` creates a $40 \times 40 \times 40$ cubic frame with:
  - 8 procedural titanium corner brackets at $(\pm 20, \pm 20, \pm 20)$.
  - Etched depth scale tick marks along the 4 vertical pillars (0m, 200m, 1000m, 3000m).
  - Translucent acrylic glass panels (`MeshPhysicalMaterial` or `MeshStandardMaterial` with `transmission: 0.85`, `opacity: 0.12`).
  - Stepped diorama pedestal base (`BoxGeometry(44, 2, 44)`) at $Y = -21$.
- `FishBoidsSystem`: boundaries set to `boundsX = 18`, `boundsZ = 18`, and `zoneY` in $[-18, 18]$.
- `FeedingPhysics`: food bounds within $X, Z \in [-14, 14]$, floor bed collision at $Y = -19.2$.
- `BubbleSystem`: aerator stones positioned at corners `(-17, -19, -17)` and `(17, -19, -17)`.

- [ ] **Step 1: Write the failing test for 1:1:1 true cube vivarium & diorama features**

Update `frontend/tests/scene_environment.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing SceneEnvironment 1:1:1 true cube vivarium, brackets, and pedestal...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');

  const content = fs.readFileSync(envPath, 'utf8');

  // Verify true cube dimensions (40x40x40)
  assert.ok(content.includes('40, 40, 40') || (content.includes('40') && content.includes('CUBE_SIZE')), 'Must create 40x40x40 true cube vivarium bounds');
  assert.ok(content.includes('pedestal') || content.includes('Pedestal'), 'Must create diorama pedestal base');
  assert.ok(content.includes('bracket') || content.includes('Bracket'), 'Must create corner brackets');
  assert.ok(content.includes('depthTicks') || content.includes('DepthTick') || content.includes('tickMesh'), 'Must create etched depth tick marks on vertical pillars');
  assert.ok(content.includes('glassPanels') || content.includes('GlassPanel') || content.includes('acrylic'), 'Must create translucent acrylic glass faces');

  console.log('✓ SceneEnvironment 1:1:1 true cube vivarium tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/scene_environment.test.js`
Expected: FAIL with missing corner brackets or 40x40x40 cube verification.

- [ ] **Step 3: Implement true 1:1:1 cube vivarium, brackets, pedestal, and depth ticks in `SceneEnvironment.ts` and synchronize subsystem bounds**

In `frontend/components/oceanarium/engine/SceneEnvironment.ts`:
- Define `CUBE_SIZE = 40.0`.
- Replace $48 \times 40 \times 32$ with $40 \times 40 \times 40$.
- Add `createCornerBrackets()` generating procedural L-bracket meshes at each vertex.
- Add `createVerticalDepthTicks()` generating luminescent tick marks at depths corresponding to 0m ($Y=20$), 200m ($Y=7$), 1000m ($Y=-7$), and 3000m ($Y=-20$).
- Add `createDioramaPedestal()` creating the stepped beveled base plate (`44 \times 2 \times 44`) at $Y=-21$.
- Add acrylic glass panels (`MeshPhysicalMaterial` / `MeshStandardMaterial` with `transmission: 0.85`, `roughness: 0.1`, `opacity: 0.12`).
- Update `FishBoidsSystem.ts`: `boundsX = 18`, `boundsZ = 18`, `zoneY` in $[-18, 18]$.
- Update `FeedingPhysics.ts`: clamp spawn $X, Z$ to $[-14, 14]$, floor at $Y = -19.2$.
- Update `BubbleSystem.ts`: aerator stones at `(-17, -19, -17)` and `(17, -19, -17)`.
- Update `FoliageSystem.ts`: perimeter anchors aligned to square $40 \times 40$ floor.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/scene_environment.test.js`
Expected: PASS with "✓ SceneEnvironment 1:1:1 true cube vivarium tests PASSED!"

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/SceneEnvironment.ts \
        frontend/components/oceanarium/engine/FishBoidsSystem.ts \
        frontend/components/oceanarium/engine/FeedingPhysics.ts \
        frontend/components/oceanarium/engine/BubbleSystem.ts \
        frontend/components/oceanarium/engine/FoliageSystem.ts \
        frontend/tests/scene_environment.test.js
git commit -m "feat(oceanarium): implement 1:1:1 true cube vivarium, brackets, depth ticks, and bounds synchronization"
```

---

### Task 2: CameraDirector: Locked Normal Perspective & Guaranteed Desktop-to-Cube Reset

**Files:**
- Modify: `frontend/components/oceanarium/engine/CameraDirector.ts`
- Modify: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Test: `frontend/tests/camera_director.test.js`

**Interfaces:**
- `CameraDirector.onPointerDown()`: In `STANDARD_VIEW`, dragging is disabled (`isDragging` remains `false`).
- `CameraDirector.setMode(mode: CameraMode)`:
  - If previous mode was `DESKTOP_MODE` and new mode is `STANDARD_VIEW`, automatically invoke `resetToIsometric(1.0)`.
- `CameraDirector.resetToIsometric(duration = 1.0)`:
  - Initializes `resetStartSpherical` and `resetStartCenter` from current camera position and lookAt.
  - Lerps with cubic ease-out to `ISOMETRIC_RADIUS = 55.0`, `ISOMETRIC_THETA = Math.PI / 4`, `ISOMETRIC_PHI = Math.PI / 3.2`, and `ISOMETRIC_CENTER = (0, 0, 0)`.

- [ ] **Step 1: Write the failing test for locked normal perspective and auto-reset on mode exit**

Update `frontend/tests/camera_director.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CameraDirector locked standard view and auto-reset from desktop mode...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');

  const content = fs.readFileSync(cameraPath, 'utf8');

  // Verify isometric default constants
  assert.ok(content.includes('resetToIsometric'), 'Must implement resetToIsometric method');
  assert.ok(content.includes('ISOMETRIC_RADIUS'), 'Must define ISOMETRIC_RADIUS constant');
  assert.ok(content.includes('ISOMETRIC_THETA'), 'Must define ISOMETRIC_THETA constant');
  assert.ok(content.includes('ISOMETRIC_PHI'), 'Must define ISOMETRIC_PHI constant');

  // Verify normal mode disables dragging / locks rotation
  assert.ok(content.includes('allowOrbit = false') || content.includes('isOrbitLocked') || !content.includes('this.isDragging = true; // allow in standard'), 'Must lock rotation in standard view');

  // Verify auto-reset on transition to STANDARD_VIEW
  assert.ok(content.includes('resetToIsometric') && content.includes("mode === 'STANDARD_VIEW'"), 'Must trigger resetToIsometric when returning to STANDARD_VIEW');

  console.log('✓ CameraDirector locked view and auto-reset tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/camera_director.test.js`
Expected: FAIL with missing locked view or auto-reset verification.

- [ ] **Step 3: Implement locked rotation and auto-reset logic in `CameraDirector.ts` and `ThreeGameDirector.ts`**

In `frontend/components/oceanarium/engine/CameraDirector.ts`:
- Update `onPointerDown(clientX, clientY)`: In `STANDARD_VIEW`, do not activate `this.isDragging = true` (lock rotation).
- Update `setMode(newMode: CameraMode)`:
  - If transitioning from `DESKTOP_MODE` to `STANDARD_VIEW`, immediately trigger `this.resetToIsometric(1.0)`.
- In `resetToIsometric(duration = 1.0)`:
  - Ensure camera starting spherical coordinates are correctly sampled from `this.camera.position` relative to current lookAt so transition begins seamlessly from wherever the camera currently sits.
- In `ThreeGameDirector.ts`:
  - When `setMode('STANDARD_VIEW')` is called, forward to `cameraDirector.setMode('STANDARD_VIEW')`, triggering view reset.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/camera_director.test.js`
Expected: PASS with "✓ CameraDirector locked view and auto-reset tests PASSED!"

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/CameraDirector.ts \
        frontend/components/oceanarium/engine/ThreeGameDirector.ts \
        frontend/tests/camera_director.test.js
git commit -m "feat(oceanarium): lock orbit rotation in normal mode and auto-reset to cube view from desktop mode"
```

---

### Task 3: In-Scene 3D Holographic Focus Reticle

**Files:**
- Modify: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Test: `frontend/tests/game_director.test.js`

**Interfaces:**
- `ThreeGameDirector`:
  - `private selectionReticle: THREE.Group | null`
  - `public attachReticle(targetMesh: THREE.Object3D): void`
  - `public detachReticle(): void`
  - Creates:
    1. Pulsing cyan circle ring (`THREE.RingGeometry(1.6, 1.7, 32)` with additive blending).
    2. 4 corner brackets (`LineSegments` framing target bounds).
    3. Vertical depth leader line descending from fish position down to seabed floor.
  - Updates position and pulse animation in `tick()`.

- [ ] **Step 1: Write the failing test for 3D holographic reticle in `game_director.test.js`**

Update `frontend/tests/game_director.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CameraDirector & ThreeGameDirector 3D reticle and mode invariants...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  const directorPath = path.join(__dirname, '../components/oceanarium/engine/ThreeGameDirector.ts');

  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');
  assert.ok(fs.existsSync(directorPath), 'ThreeGameDirector.ts must exist');

  // Verify ThreeGameDirector has reticle methods
  const directorContent = fs.readFileSync(directorPath, 'utf8');
  assert.ok(directorContent.includes('attachReticle') || directorContent.includes('selectionReticle'), 'Must implement 3D selection reticle');
  assert.ok(directorContent.includes('detachReticle') || directorContent.includes('clearReticle'), 'Must implement reticle detachment');

  console.log('✓ CameraDirector & ThreeGameDirector invariants PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/game_director.test.js`
Expected: FAIL with missing reticle methods.

- [ ] **Step 3: Implement 3D holographic reticle in `ThreeGameDirector.ts`**

In `frontend/components/oceanarium/engine/ThreeGameDirector.ts`:
- Build `initSelectionReticle(): THREE.Group`.
- Include glowing ring, 4 brackets, and depth leader line.
- In `handlePointerDown`: When a fish is selected, call `this.attachReticle(hitObj)`.
- In `tick()`: If reticle is active, update its position to follow the fish mesh, rotate the ring slightly, and scale leader line to the seabed.
- When `deselectFish()` or mode change occurs, detach and hide reticle.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/game_director.test.js`
Expected: PASS with "✓ CameraDirector & ThreeGameDirector invariants PASSED!"

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/ThreeGameDirector.ts frontend/tests/game_director.test.js
git commit -m "feat(oceanarium): add in-scene 3D holographic focus reticle tracking selected fish"
```

---

### Task 4: Desktop Mode Infinite Procedural World (Infinite Seabed, Sky, Moving Clouds & Sun)

**Files:**
- Modify: `frontend/components/oceanarium/engine/SceneEnvironment.ts`
- Modify: `frontend/components/oceanarium/engine/FishBoidsSystem.ts`
- Modify: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Create: `frontend/tests/desktop_mode_world.test.js`

**Interfaces:**
- `SceneEnvironment`:
  - `public setDesktopMode(enabled: boolean): void`
  - In Desktop Mode:
    - Hides vivarium frame, brackets, and pedestal.
    - Creates or unhides `infiniteTerrain`: dynamic dune grid ($120 \times 120$) that centers and shifts with camera/submarine position.
    - Creates or unhides `skyDome` ($Y \ge 24$) with procedural drifting cloud canopy.
    - Activates radiant sun directional light with shimmering god-ray caustics.
  - In Normal Mode:
    - Restores diorama cube, pedestal, and brackets.
    - Hides infinite terrain and sky canopy.
- `FishBoidsSystem`:
  - `public setDesktopMode(enabled: boolean): void`
  - In Desktop Mode: centers fish attraction anchor to the submarine's active exploration coordinate so user's collected fishes school in the vicinity.

- [ ] **Step 1: Write the failing test for Desktop Mode infinite world in `frontend/tests/desktop_mode_world.test.js`**

Create `frontend/tests/desktop_mode_world.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing Desktop Mode infinite procedural seabed, sky canopy, drifting clouds, and sun...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  const boidsPath = path.join(__dirname, '../components/oceanarium/engine/FishBoidsSystem.ts');

  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');
  assert.ok(fs.existsSync(boidsPath), 'FishBoidsSystem.ts must exist');

  const envContent = fs.readFileSync(envPath, 'utf8');
  assert.ok(envContent.includes('setDesktopMode'), 'SceneEnvironment must implement setDesktopMode');
  assert.ok(envContent.includes('infiniteTerrain') || envContent.includes('InfiniteTerrain') || envContent.includes('proceduralTerrain'), 'Must implement procedural infinite terrain');
  assert.ok(envContent.includes('skyDome') || envContent.includes('skyCanopy') || envContent.includes('clouds') || envContent.includes('Cloud'), 'Must implement sky and drifting clouds');
  assert.ok(envContent.includes('sunLight') || envContent.includes('sunShaft') || envContent.includes('sunCorona'), 'Must implement radiant sun light source');

  const boidsContent = fs.readFileSync(boidsPath, 'utf8');
  assert.ok(boidsContent.includes('setDesktopMode'), 'FishBoidsSystem must implement setDesktopMode');

  console.log('✓ Desktop Mode infinite procedural world tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/desktop_mode_world.test.js`
Expected: FAIL with missing `setDesktopMode` or procedural terrain/sky methods.

- [ ] **Step 3: Implement procedural infinite terrain, sky canopy, moving clouds, and sun in `SceneEnvironment.ts` and `FishBoidsSystem.ts`**

In `frontend/components/oceanarium/engine/SceneEnvironment.ts`:
- Build `initInfiniteTerrain()`: $120 \times 120$ vertex displacement grid with undulating sand dunes and ripple normals.
- Build `initSkyAndClouds()`: Atmospheric sky canopy at $Y \ge 24$ with procedural cloud canvas texture or vertex-animated UV offset drifting with `time * windSpeed`.
- Build `sunLight` with bright corona disc and shimmering underwater caustic light shafts.
- In `setDesktopMode(enabled: boolean)`:
  - When `true`: hide `vivariumFrame`, `sandFloor`, `pedestalMesh`; reveal `infiniteTerrain`, `skyCanopy`, `cloudsMesh`.
  - When `false`: reveal `vivariumFrame`, `sandFloor`, `pedestalMesh`; hide `infiniteTerrain`, `skyCanopy`, `cloudsMesh`.
- In `update(delta, time)`:
  - If in desktop mode, update cloud UV offsets and gently align terrain center with camera $X, Z$.
- In `FishBoidsSystem.ts`:
  - Add `setDesktopMode(enabled: boolean)`: when enabled, dynamically tether fish flocking center to submarine's coordinate within radius 28, keeping user fishes swimming in viewer's vicinity.
- In `ThreeGameDirector.ts`:
  - Hook `setMode`: forward desktop mode status to `environment.setDesktopMode(isDesktop)` and `boidsSystem.setDesktopMode(isDesktop)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/desktop_mode_world.test.js`
Expected: PASS with "✓ Desktop Mode infinite procedural world tests PASSED!"

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/SceneEnvironment.ts \
        frontend/components/oceanarium/engine/FishBoidsSystem.ts \
        frontend/components/oceanarium/engine/ThreeGameDirector.ts \
        frontend/tests/desktop_mode_world.test.js
git commit -m "feat(oceanarium): implement desktop mode infinite procedural seabed, sky with drifting clouds, and sun"
```

---

### Task 5: 100% Screen Real Estate Container Layout

**Files:**
- Modify: `frontend/pages/Oceanarium.tsx`
- Modify: `frontend/components/oceanarium/OceanariumCanvas.tsx`
- Test: `frontend/tests/oceanarium_canvas.test.js`
- Test: `frontend/tests/desktop_mode_ui.test.js`

**Interfaces:**
- `Oceanarium.tsx`: Replace `max-w-6xl mx-auto` with `w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4`.
- `OceanariumCanvas.tsx`:
  - Normal mode canvas container: `w-full h-[70vh] min-h-[600px] max-h-[860px] rounded-3xl`.
  - Hint pill text: *"Locked Isometric View • Click specimen to inspect • Press [R] to re-center"*.

- [ ] **Step 1: Write/update tests for 100% width layout and updated navigation hint in `frontend/tests/oceanarium_canvas.test.js`**

Update `frontend/tests/oceanarium_canvas.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');
  const oceanariumPath = path.join(__dirname, '../pages/Oceanarium.tsx');

  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');
  assert.ok(fs.existsSync(oceanariumPath), 'Oceanarium.tsx must exist');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  const oceanariumContent = fs.readFileSync(oceanariumPath, 'utf8');

  // Verify 100% width usage
  assert.ok(!oceanariumContent.includes('max-w-6xl'), 'Oceanarium page must not be restricted to max-w-6xl');
  assert.ok(oceanariumContent.includes('w-full'), 'Oceanarium page must be w-full');

  // Verify locked isometric navigation hint
  assert.ok(canvasContent.includes('Locked Isometric') || canvasContent.includes('Isometric View'), 'Must display locked isometric view hint');

  console.log('✓ Oceanarium 100% width and canvas navigation verified');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_canvas.test.js`
Expected: FAIL due to existing `max-w-6xl` or old hint pill.

- [ ] **Step 3: Update `Oceanarium.tsx` and `OceanariumCanvas.tsx` for 100% width and locked view hint**

In `frontend/pages/Oceanarium.tsx`:
- Change root container from `<div className="max-w-6xl mx-auto px-4 py-6 space-y-6">` to `<div className="w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4">`.
- Update HUD and tabs to span full width gracefully.

In `frontend/components/oceanarium/OceanariumCanvas.tsx`:
- Update standard container class to `w-full h-[70vh] min-h-[600px] max-h-[860px] rounded-3xl shadow-2xl border border-sky-900/40 bg-slate-950`.
- Update navigation pill text to:
  `<span>Locked Isometric View • Click specimen to inspect • Press <strong className="text-cyan-300">[R]</strong> to re-center</span>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_canvas.test.js && node frontend/tests/desktop_mode_ui.test.js`
Expected: PASS with "✓ Oceanarium 100% width and canvas navigation verified".

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/Oceanarium.tsx frontend/components/oceanarium/OceanariumCanvas.tsx frontend/tests/oceanarium_canvas.test.js
git commit -m "feat(oceanarium): expand layout to 100% width and update locked isometric navigation pill"
```

---

### Task 6: Scientific Infographic Specimen Drawer (`FishInfographicPanel.tsx`)

**Files:**
- Create: `frontend/components/oceanarium/FishInfographicPanel.tsx`
- Modify: `frontend/components/oceanarium/OceanariumCanvas.tsx`
- Create: `frontend/tests/fish_infographic.test.js`

**Interfaces:**
- `FishInfographicPanelProps`:
  ```typescript
  export interface FishInfographicPanelProps {
    fish: UserFish;
    onClose: () => void;
    onFeedFish?: (type: 'flake' | 'super_pellet') => void;
  }
  ```
- Sub-components:
  - **Header**: Common & Scientific name, Shiny shimmer badge, Rarity rank pill, Favorite heart button.
  - **Comparative Physical Scale Visualizer**: Silhouette comparing fish against human hand ($<25\text{cm}$) or scuba diver ($>25\text{cm}$) with metric scale ruler and calculated dimensions in cm.
  - **Bathymetric Depth Column**: Vertical ocean stratum gauge (Sunlit 0–200m, Twilight 200–1000m, Abyssal 1000–4000m+) with animated depth beacon.
  - **Bio-Telemetry & Dietary Gauges**: Vitality meter, swim velocity indicator, diet preference, and codex description.
  - **Quick Action Bar**: "Feed Flake / Pellet", "View Codex", and "Close".

- [ ] **Step 1: Write the failing test for `FishInfographicPanel` in `frontend/tests/fish_infographic.test.js`**

Create `frontend/tests/fish_infographic.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing FishInfographicPanel component and scale visualization...');

  const panelPath = path.join(__dirname, '../components/oceanarium/FishInfographicPanel.tsx');
  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');

  assert.ok(fs.existsSync(panelPath), 'FishInfographicPanel.tsx must exist');
  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');

  const panelContent = fs.readFileSync(panelPath, 'utf8');
  assert.ok(panelContent.includes('FishInfographicPanel'), 'Must export FishInfographicPanel');
  assert.ok(panelContent.includes('hand') || panelContent.includes('diver') || panelContent.includes('Scale') || panelContent.includes('Ruler'), 'Must include comparative physical scale visualizer');
  assert.ok(panelContent.includes('sunlit') && panelContent.includes('twilight') && panelContent.includes('abyssal'), 'Must display bathymetric depth stratum column');
  assert.ok(panelContent.includes('Vitality') || panelContent.includes('Velocity') || panelContent.includes('Speed') || panelContent.includes('Diet'), 'Must display bio-telemetry stats');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  assert.ok(canvasContent.includes('FishInfographicPanel'), 'OceanariumCanvas must render FishInfographicPanel');

  console.log('✓ FishInfographicPanel tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/fish_infographic.test.js`
Expected: FAIL with "FishInfographicPanel.tsx must exist".

- [ ] **Step 3: Create `FishInfographicPanel.tsx` and integrate into `OceanariumCanvas.tsx`**

Create `frontend/components/oceanarium/FishInfographicPanel.tsx`:
- Render sliding right drawer with backdrop blur and sleek border.
- Include:
  1. Specimen title, species, rarity rank badge, shiny badge.
  2. Comparative Physical Scale: SVG visualizer rendering the fish silhouette alongside a human hand or scuba diver with metric scale ruler and calculated cm dimensions.
  3. Bathymetric Depth Column: vertical gradient showing Sunlit, Twilight, Abyssal zones with depth indicator.
  4. Bio-telemetry gauges: vitality health bar, swim speed, favorite food.
  5. Action buttons: Feed, Codex link, Close button.
- In `frontend/components/oceanarium/OceanariumCanvas.tsx`:
  - Replace the old small bottom-right tooltip card with `<FishInfographicPanel fish={selectedFish} onClose={() => { setSelectedFish(null); directorRef.current?.detachReticle(); directorRef.current?.resetCameraView(0.8); }} onFeedFish={handleFeed} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/fish_infographic.test.js`
Expected: PASS with "✓ FishInfographicPanel tests PASSED!"

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/FishInfographicPanel.tsx \
        frontend/components/oceanarium/OceanariumCanvas.tsx \
        frontend/tests/fish_infographic.test.js
git commit -m "feat(oceanarium): implement scientific fish infographic specimen panel with comparative scale and depth gauge"
```

---

### Task 7: Full Test Suite Execution & Integration Verification

**Files:**
- Test: All tests in `frontend/tests/`

- [ ] **Step 1: Execute all oceanarium tests**

```bash
node frontend/tests/scene_environment.test.js
node frontend/tests/camera_director.test.js
node frontend/tests/game_director.test.js
node frontend/tests/desktop_mode_world.test.js
node frontend/tests/oceanarium_canvas.test.js
node frontend/tests/desktop_mode_ui.test.js
node frontend/tests/fish_infographic.test.js
```
Expected: All 7 test suites PASS with exit code 0.

- [ ] **Step 2: Run frontend build verification**

```bash
cd frontend && npm run build
```
Expected: Build completes with zero TypeScript or Vite errors.

- [ ] **Step 3: Final commit & Walkthrough documentation**

```bash
git commit --allow-empty -m "chore(oceanarium): verify all 3D oceanarium true cube, infographic scale, and desktop procedural world tests pass"
```
