# 3D Oceanarium: 2.5D Isometric Vivarium, Foliage, Detail & Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 3D Oceanarium into a bright, vibrant 2.5D isometric glass cube vivarium with tropical azure lighting, procedural seabed foliage (swaying kelp, corals, anemones), dynamic aerator bubbles & mouth puffs, enhanced cartoon fish details (nibbling jaws, fin crests, markings, blush), and a UI dock with interactive tooltips and an isometric view reset button.

**Architecture:** A modular Three.js engine extension: `VivariumCube` geometry & tropical azure lighting in `SceneEnvironment.ts`, procedural seabed ecology in `FoliageSystem.ts`, multi-source particle physics in `BubbleSystem.ts`, facial/fin kinematics in `CartoonFishFactory.ts`, spherical interpolation reset in `CameraDirector.ts`, all orchestrated by `ThreeGameDirector.ts` and interfaced via React controls with rich glassmorphic tooltips in `OceanariumCanvas.tsx`.

**Tech Stack:** React 18, Three.js 0.185, TypeScript 5.8, Tailwind CSS, Lucide React, Node.js assert testing.

## Global Constraints
- Material Constraint: `MeshToonMaterial` in Three.js does NOT support `roughness` or `metalness`. Cel/toon shading uses `gradientMap` and diffuse color only.
- 60 FPS Performance Budget: Use shared geometries, low polygon counts, and instanced/recycled particle buffers.
- Vivarium Diorama Bounds: All swimming and decorations are bounded within 48 wide $\times$ 40 high $\times$ 32 deep (`x: [-24, 24], y: [-20, 20], z: [-16, 16]`).
- Clean Architecture: No circular dependencies between engine components; `ThreeGameDirector` acts as the single orchestrator.
- Keyboard Navigation: `[R]` resets view, `[F]` drops food, `[ESC]` toggles Desktop Mode.

---

### Task 1: CameraDirector 2.5D Isometric Default & Smooth View Reset

**Files:**
- Modify: `frontend/components/oceanarium/engine/CameraDirector.ts`
- Test: `frontend/tests/camera_director.test.js`

**Interfaces:**
- Consumes: Three.js `PerspectiveCamera`, `Spherical`, `Vector3`.
- Produces: `CameraDirector.resetToIsometric(duration?: number): void`, default isometric positioning (`theta = Math.PI / 4`, `phi = Math.PI / 3.2`, `radius = 55.0`).

- [ ] **Step 1: Write the failing test for CameraDirector isometric view & reset**

Create `frontend/tests/camera_director.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing CameraDirector isometric default and resetToIsometric...');

  const cameraPath = path.join(__dirname, '../components/oceanarium/engine/CameraDirector.ts');
  assert.ok(fs.existsSync(cameraPath), 'CameraDirector.ts must exist');

  const content = fs.readFileSync(cameraPath, 'utf8');

  // Verify isometric default constants
  assert.ok(content.includes('resetToIsometric'), 'Must implement resetToIsometric method');
  assert.ok(content.includes('ISOMETRIC_RADIUS'), 'Must define ISOMETRIC_RADIUS constant');
  assert.ok(content.includes('ISOMETRIC_THETA'), 'Must define ISOMETRIC_THETA constant');
  assert.ok(content.includes('ISOMETRIC_PHI'), 'Must define ISOMETRIC_PHI constant');

  console.log('✓ CameraDirector tests PASSED!');
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
Expected: FAIL with "Must implement resetToIsometric method"

- [ ] **Step 3: Implement isometric defaults and reset animation in CameraDirector.ts**

Update `frontend/components/oceanarium/engine/CameraDirector.ts`:
- Define constants:
  ```typescript
  export const ISOMETRIC_RADIUS = 55.0;
  export const ISOMETRIC_THETA = Math.PI / 4; // 45 degrees
  export const ISOMETRIC_PHI = Math.PI / 3.2; // ~56 degrees elevation
  export const ISOMETRIC_CENTER = new THREE.Vector3(0, 0, 0);
  ```
- Set initial `spherical`: `new THREE.Spherical(ISOMETRIC_RADIUS, ISOMETRIC_PHI, ISOMETRIC_THETA)`.
- Set initial camera position and center offset `(0, 0, 0)`.
- Add reset lerp state:
  ```typescript
  private isResetting: boolean = false;
  private resetProgress: number = 0;
  private resetDuration: number = 1.0;
  private resetStartSpherical: THREE.Spherical = new THREE.Spherical();
  private resetStartCenter: THREE.Vector3 = new THREE.Vector3();
  ```
- Implement `public resetToIsometric(duration = 1.0): void`:
  ```typescript
  public resetToIsometric(duration = 1.0): void {
    this.mode = 'STANDARD_VIEW';
    this.inspectingTarget = null;
    this.isDragging = false;
    this.isResetting = true;
    this.resetProgress = 0;
    this.resetDuration = duration;
    this.resetStartSpherical.copy(this.spherical);
    this.resetStartCenter.copy(this.centerOffset);
  }
  ```
- In `updateStandardCamera(delta: number)`:
  If `this.isResetting`, smoothly interpolate `spherical.radius`, `spherical.phi`, `spherical.theta`, and `centerOffset` towards target using cubic ease-out:
  ```typescript
  if (this.isResetting) {
    this.resetProgress += delta / this.resetDuration;
    const t = Math.min(1.0, this.resetProgress);
    const easeOut = 1 - Math.pow(1 - t, 3);

    this.spherical.radius = THREE.MathUtils.lerp(this.resetStartSpherical.radius, ISOMETRIC_RADIUS, easeOut);
    this.spherical.phi = THREE.MathUtils.lerp(this.resetStartSpherical.phi, ISOMETRIC_PHI, easeOut);
    this.spherical.theta = THREE.MathUtils.lerp(this.resetStartSpherical.theta, ISOMETRIC_THETA, easeOut);
    this.centerOffset.lerpVectors(this.resetStartCenter, ISOMETRIC_CENTER, easeOut);

    if (t >= 1.0) {
      this.isResetting = false;
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/camera_director.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/engine/CameraDirector.ts frontend/tests/camera_director.test.js
git commit -m "feat(oceanarium): implement 2.5D isometric view default and reset in CameraDirector"
```

---

### Task 2: SceneEnvironment Tropical Azure Lighting & Glass Vivarium Framing

**Files:**
- Modify: `frontend/components/oceanarium/engine/SceneEnvironment.ts`
- Test: `frontend/tests/scene_environment.test.js`

**Interfaces:**
- Consumes: Three.js `Scene`, `LineSegments`, `BoxGeometry`, `MeshToonMaterial`.
- Produces: Glass diorama boundary box `48w x 40h x 32d` with cyan edge lines, warm sandy floor bed, translucent water ceiling, and tropical azure lighting.

- [ ] **Step 1: Write the failing test for SceneEnvironment vivarium and azure palette**

Create `frontend/tests/scene_environment.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing SceneEnvironment vivarium diorama and azure palette...');

  const envPath = path.join(__dirname, '../components/oceanarium/engine/SceneEnvironment.ts');
  assert.ok(fs.existsSync(envPath), 'SceneEnvironment.ts must exist');

  const content = fs.readFileSync(envPath, 'utf8');

  // Verify vivarium glass frame & dimensions
  assert.ok(content.includes('initVivariumFrame'), 'Must implement initVivariumFrame method');
  assert.ok(content.includes('48') && content.includes('40') && content.includes('32'), 'Must create 48x40x32 vivarium bounds');
  assert.ok(content.includes('LineSegments'), 'Must create glowing cyan edge wireframe');
  assert.ok(content.includes('sandFloor'), 'Must add sandy ocean floor bed');
  assert.ok(content.includes('waterSurface'), 'Must add translucent water surface ceiling');

  // Verify tropical azure lighting palette
  assert.ok(content.includes('0x0284c7') || content.includes('0x38bdf8'), 'Must use vibrant cyan/azure lighting');

  console.log('✓ SceneEnvironment tests PASSED!');
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
Expected: FAIL with "Must implement initVivariumFrame method"

- [ ] **Step 3: Implement vivarium diorama frame & tropical azure lighting in SceneEnvironment.ts**

Update `frontend/components/oceanarium/engine/SceneEnvironment.ts`:
- Adjust lighting in constructor:
  - Fog: `new THREE.FogExp2(0x0284c7, 0.012)` (vibrant azure water fog instead of 0x041830 navy).
  - Ambient light: `new THREE.AmbientLight(0x38bdf8, 1.4)` (bright tropical sky blue).
  - Sunlight: `new THREE.DirectionalLight(0xe0f2fe, 2.2)` at `(15, 35, 20)` with warm azure radiance.
  - Rim light: `new THREE.DirectionalLight(0x06b6d4, 1.2)` at `(-20, -15, -15)`.
- Add `private initVivariumFrame(): void`:
  - Wireframe edges:
    ```typescript
    const boxGeo = new THREE.BoxGeometry(48, 40, 32);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      linewidth: 2
    });
    const frameEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.scene.add(frameEdges);
    ```
  - Sandy ocean floor plate:
    ```typescript
    const floorGeo = new THREE.BoxGeometry(48, 1.5, 32);
    const floorMat = new THREE.MeshToonMaterial({
      color: 0xfde047 // warm golden coral sand
    });
    this.sandFloor = new THREE.Mesh(floorGeo, floorMat);
    this.sandFloor.position.set(0, -20, 0);
    this.scene.add(this.sandFloor);
    ```
  - Translucent water surface ceiling:
    ```typescript
    const waterGeo = new THREE.PlaneGeometry(48, 32);
    const waterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.waterSurface = new THREE.Mesh(waterGeo, waterMat);
    this.waterSurface.rotation.x = Math.PI / 2;
    this.waterSurface.position.set(0, 20, 0);
    this.scene.add(this.waterSurface);
    ```
- Update `updateWaterQuality(quality: number)` to interpolate between pristine turquoise azure (`0x0284c7`), balanced reef blue (`0x0369a1`), and murky lagoon (`0x164e63`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/scene_environment.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/engine/SceneEnvironment.ts frontend/tests/scene_environment.test.js
git commit -m "feat(oceanarium): add 2.5D glass vivarium frame and tropical azure lighting in SceneEnvironment"
```

---

### Task 3: Procedural Seabed Foliage System (Kelp, Corals & Anemones)

**Files:**
- Create: `frontend/components/oceanarium/engine/FoliageSystem.ts`
- Test: `frontend/tests/foliage_system.test.js`

**Interfaces:**
- Consumes: Three.js `Scene`, `Group`, `MeshToonMaterial`.
- Produces: `FoliageSystem` with `update(delta: number, time: number): void`, animating kelp sway, branch/brain corals, and pulsing sea anemones.

- [ ] **Step 1: Write the failing test for FoliageSystem**

Create `frontend/tests/foliage_system.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing FoliageSystem seabed ecology...');

  const foliagePath = path.join(__dirname, '../components/oceanarium/engine/FoliageSystem.ts');
  assert.ok(fs.existsSync(foliagePath), 'FoliageSystem.ts must exist');

  const content = fs.readFileSync(foliagePath, 'utf8');

  // Verify class and methods
  assert.ok(content.includes('export class FoliageSystem'), 'Must export FoliageSystem');
  assert.ok(content.includes('createKelpForest'), 'Must implement createKelpForest');
  assert.ok(content.includes('createCoralsAndAnemones'), 'Must implement createCoralsAndAnemones');
  assert.ok(content.includes('update('), 'Must implement update animation loop');
  assert.ok(content.includes('dispose('), 'Must implement dispose method');

  // Verify procedural sway kinematics
  assert.ok(content.includes('Math.sin'), 'Must use harmonic sine kinematics for kelp sway');
  assert.ok(content.includes('anemones'), 'Must animate pulsing anemones');

  console.log('✓ FoliageSystem tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/foliage_system.test.js`  
Expected: FAIL with "FoliageSystem.ts must exist"

- [ ] **Step 3: Implement FoliageSystem.ts**

Create `frontend/components/oceanarium/engine/FoliageSystem.ts`:
- Define `KelpRibbon` interface with segments array and base position.
- Define `Anemone` interface with tentacle meshes and breathing phase.
- Implement `FoliageSystem`:
  - `createKelpForest()`:
    - Generate 8–12 kelp ribbons distributed along rear (`z: -14 to -10`) and side perimeters (`x: -21 to -17` and `x: 17 to 21`).
    - Each ribbon consists of 5–7 connected planar segments rising from seabed `y = -19.2` up to `y = 5`.
    - Material: `MeshToonMaterial` in emerald green (`0x059669`) with lime tips (`0x84cc16`).
  - `createCoralsAndAnemones()`:
    - Staghorn branch clusters: Cylinder meshes angled outwards in coral peach (`0xfb7185`) and violet (`0xa855f7`).
    - Brain corals: `DodecahedronGeometry` / `SphereGeometry` with rippled amber toon material (`0xf59e0b`).
    - Pulsing anemones: Rings of tapering cylinder tentacles in luminous cyan (`0x06b6d4`) and magenta (`0xec4899`).
  - `update(delta: number, time: number)`:
    - Kelp sway: calculate wave displacement per segment `dx = Math.sin(time * 2.0 + segIndex * 0.45) * (segIndex * 0.12)`.
    - Anemone pulse: scale tentacles rhythmically `scale = 1.0 + Math.sin(time * 3.0 + phase) * 0.15`.
  - `dispose()`: traverse and dispose all geometries and materials.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/foliage_system.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/engine/FoliageSystem.ts frontend/tests/foliage_system.test.js
git commit -m "feat(oceanarium): implement FoliageSystem with swaying kelp, corals and anemones"
```

---

### Task 4: Dynamic Bubble Dynamics (Corner Aerators & Fish Mouth Puffs)

**Files:**
- Create: `frontend/components/oceanarium/engine/BubbleSystem.ts`
- Test: `frontend/tests/bubble_system.test.js`

**Interfaces:**
- Consumes: Three.js `Scene`, `Vector3`, `InstancedMesh` / `BufferGeometry`.
- Produces: `BubbleSystem` with `emitFishMouthPuff(position: THREE.Vector3, count?: number): void`, continuous corner aerator columns at `(-18, -19, -10)` and `(18, -19, -10)`, surface pop particles, and luminous marine snow.

- [ ] **Step 1: Write the failing test for BubbleSystem**

Create `frontend/tests/bubble_system.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log('Testing BubbleSystem corner aerators and mouth puffs...');

  const bubblePath = path.join(__dirname, '../components/oceanarium/engine/BubbleSystem.ts');
  assert.ok(fs.existsSync(bubblePath), 'BubbleSystem.ts must exist');

  const content = fs.readFileSync(bubblePath, 'utf8');

  // Verify class and methods
  assert.ok(content.includes('export class BubbleSystem'), 'Must export BubbleSystem');
  assert.ok(content.includes('emitFishMouthPuff'), 'Must implement emitFishMouthPuff method');
  assert.ok(content.includes('aerators'), 'Must manage corner aerators');
  assert.ok(content.includes('update('), 'Must implement update loop');
  assert.ok(content.includes('dispose('), 'Must implement dispose method');

  // Verify corner positions
  assert.ok(content.includes('-18') && content.includes('18'), 'Must place aerators in dual corners');

  console.log('✓ BubbleSystem tests PASSED!');
}

try {
  run();
} catch (err) {
  console.error('Test Failure:', err.message);
  process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/bubble_system.test.js`  
Expected: FAIL with "BubbleSystem.ts must exist"

- [ ] **Step 3: Implement BubbleSystem.ts**

Create `frontend/components/oceanarium/engine/BubbleSystem.ts`:
- Aerator Bubbler Stones:
  - Add small dark pebble stones at `(-18, -19.2, -10)` and `(18, -19.2, -10)`.
  - Recycle 40–50 rising bubble particles per column:
    - Position `(x, y, z)` with initial `y = -19`.
    - Upward velocity $v_y \in [4.0, 7.0]$ units/sec.
    - Lateral wobble: $x = x_0 + \sin(\text{time} \cdot 3.5 + id) \cdot 0.35$.
    - Breach trigger: when $y \ge 19.5$, trigger 3 tiny pop particles and reset to aerator base.
- Fish Mouth Bubble Puffs:
  - Pre-allocated pool of 30 puff bubbles.
  - `public emitFishMouthPuff(position: THREE.Vector3, count = 3): void`:
    - Activates `count` dormant puff particles starting at `position`.
    - Gives upward velocity with subtle random spread: $v_x \in [-0.5, 0.5], v_y \in [2.5, 4.0], v_z \in [-0.5, 0.5]$.
    - Fades out opacity over 2.5 seconds.
- Luminous Plankton / Marine Snow:
  - 60 gently floating particles with cyan shimmer (`0xa5f3fc`).
- `update(delta: number, time: number)`:
  - Advances aerator bubbles, updates mouth puff particles, updates drifting marine snow.
- `dispose()`: Cleans up geometries, textures, and materials.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/bubble_system.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/engine/BubbleSystem.ts frontend/tests/bubble_system.test.js
git commit -m "feat(oceanarium): implement BubbleSystem with dual corner aerators and fish mouth puffs"
```

---

### Task 5: Enhanced Cartoon Fish Models (Nibbling Jaws, Fin Crests & Markings)

**Files:**
- Modify: `frontend/components/oceanarium/engine/CartoonFishFactory.ts`
- Modify: `frontend/tests/cartoon_fish_factory.test.js`

**Interfaces:**
- Consumes: Species data, `MeshToonMaterial`.
- Produces: Fish mesh groups with `jawPivot` group, `dorsalFin` mesh, `analFin` mesh, species markings (clownfish bands, tang palette loops, puffer spines), and rosy cheek blush decals (`#f472b6`).

- [ ] **Step 1: Update cartoon fish factory test with new features**

Update `frontend/tests/cartoon_fish_factory.test.js` to assert:
```javascript
  // Verify nibbling mouth/jaw pivot
  assert.ok(content.includes('jawPivot'), 'Must assign jawPivot for mouth nibbling kinematics');
  assert.ok(content.includes('addNibblingMouth'), 'Must implement addNibblingMouth');

  // Verify dorsal and anal fin crests
  assert.ok(content.includes('dorsalFin'), 'Must assign dorsalFin crest');
  assert.ok(content.includes('analFin'), 'Must assign analFin crest');

  // Verify species-specific markings & cheek blush
  assert.ok(content.includes('addCheekBlush'), 'Must add rosy cartoon cheek blush decals');
  assert.ok(content.includes('addSpeciesMarkings'), 'Must implement addSpeciesMarkings');
  assert.ok(content.includes('clownfish') || content.includes('stripes'), 'Must handle clownfish white bands');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/cartoon_fish_factory.test.js`  
Expected: FAIL with "Must assign jawPivot for mouth nibbling kinematics"

- [ ] **Step 3: Implement nibbling jaws, fin crests, species markings & cheek blush**

In `frontend/components/oceanarium/engine/CartoonFishFactory.ts`:
- Add `addNibblingMouth(bodyGroup: THREE.Group, color: number, scale: number)`:
  - Upper lip: fixed small curved mesh.
  - Lower jaw: `jawPivot = new THREE.Group()` placed at mouth base `(0, -0.15, length * 0.5)`. Lower lip mesh attached. `userData.jawPivot = jawPivot`.
- Add `addFinCrests(bodyGroup: THREE.Group, color: number, scale: number)`:
  - Dorsal fin: `dorsalFin = new THREE.Mesh(...)` attached to top ridge. `userData.dorsalFin = dorsalFin`.
  - Anal fin: `analFin = new THREE.Mesh(...)` attached to lower rear belly. `userData.analFin = analFin`.
- Add `addCheekBlush(bodyGroup: THREE.Group, scale: number)`:
  - Two small soft pink (`0xf472b6`) circular discs positioned below and slightly behind the eyes on the left and right sides.
- Add `addSpeciesMarkings(bodyGroup: THREE.Group, speciesId: string, scale: number)`:
  - If clownfish / anemonefish: 3 distinct white ring decals with dark borders encircling the body.
  - If blue tang / surgeonfish: royal blue body with curved dark palette loop and sunny yellow tail.
  - If pufferfish: rounded soft spine spheres distributed across the belly.
  - If angelfish: elongated trailing pelvic feeler fins.
- In `updateFishKinematics(mesh: THREE.Object3D, delta: number, speed: number, isFeeding = false)`:
  - Animate `jawPivot.rotation.x`: gentle idle nibble `0.06 * Math.sin(time * 4.0)` or rapid feeding nibble `0.22 * Math.sin(time * 12.0)`.
  - Animate `dorsalFin.rotation.y` and `analFin.rotation.y` with slight phase lag relative to tail fin.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/cartoon_fish_factory.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/engine/CartoonFishFactory.ts frontend/tests/cartoon_fish_factory.test.js
git commit -m "feat(oceanarium): add nibbling jaws, fin crests, species markings and cheek blush to fish models"
```

---

### Task 6: Integrate FoliageSystem & BubbleSystem into ThreeGameDirector

**Files:**
- Modify: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Modify: `frontend/tests/game_director.test.js`

**Interfaces:**
- Consumes: `FoliageSystem`, `BubbleSystem`, `FeedingPhysics`.
- Produces: `ThreeGameDirector.resetCameraView()`, integrated bubble puff on feed success, synchronized frame updates for foliage and bubbles.

- [ ] **Step 1: Write test updates in game_director.test.js**

Update `frontend/tests/game_director.test.js`:
```javascript
  assert.ok(content.includes('foliageSystem'), 'Must instantiate FoliageSystem');
  assert.ok(content.includes('bubbleSystem'), 'Must instantiate BubbleSystem');
  assert.ok(content.includes('resetCameraView'), 'Must expose resetCameraView method');
  assert.ok(content.includes('emitFishMouthPuff'), 'Must emit bubble puffs on feeding');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/game_director.test.js`  
Expected: FAIL with "Must instantiate FoliageSystem"

- [ ] **Step 3: Integrate FoliageSystem and BubbleSystem into ThreeGameDirector.ts**

In `frontend/components/oceanarium/engine/ThreeGameDirector.ts`:
- Import `FoliageSystem` and `BubbleSystem`.
- Add member variables:
  ```typescript
  public foliageSystem: FoliageSystem;
  public bubbleSystem: BubbleSystem;
  ```
- In constructor:
  - Initialize `this.foliageSystem = new FoliageSystem(this.scene);`
  - Initialize `this.bubbleSystem = new BubbleSystem(this.scene);`
  - In `this.feedingPhysics.onFoodConsumed`: emit bubble puff at fish mouth position via `this.bubbleSystem.emitFishMouthPuff(fishPos, 4);`.
- Add public method:
  ```typescript
  public resetCameraView(duration = 1.0): void {
    this.cameraDirector.resetToIsometric(duration);
  }
  ```
- In game loop `animate()`:
  - `this.foliageSystem.update(delta, time);`
  - `this.bubbleSystem.update(delta, time);`
- In `dispose()`:
  - Dispose `this.foliageSystem.dispose();` and `this.bubbleSystem.dispose();`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/game_director.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/engine/ThreeGameDirector.ts frontend/tests/game_director.test.js
git commit -m "feat(oceanarium): integrate FoliageSystem and BubbleSystem into ThreeGameDirector"
```

---

### Task 7: UI Controls Dock with Reset View Button, Rich Tooltips & Keyboard Shortcuts

**Files:**
- Modify: `frontend/components/oceanarium/OceanariumCanvas.tsx`
- Test: `frontend/tests/oceanarium_canvas.test.js`

**Interfaces:**
- Consumes: `RotateCcw`, `Sparkles`, `Maximize2`, `Minimize2` from `lucide-react`, `ThreeGameDirector.resetCameraView()`.
- Produces: Sleek glassmorphic control dock with animated hover tooltips (Title, Description, Shortcut Badge) and keyboard shortcut listener for `[R]`.

- [ ] **Step 1: Write tests for UI dock and tooltips in oceanarium_canvas.test.js**

Update `frontend/tests/oceanarium_canvas.test.js`:
```javascript
  assert.ok(content.includes('RotateCcw'), 'Must import RotateCcw icon for reset view');
  assert.ok(content.includes('resetCameraView'), 'Must call resetCameraView on button click');
  assert.ok(content.includes('Reset View'), 'Must display Reset View tooltip/label');
  assert.ok(content.includes('tooltip') || content.includes('group-hover'), 'Must provide interactive tooltips');
  assert.ok(content.includes('e.key === \'r\'') || content.includes('e.key === \'R\''), 'Must listen for R key to reset view');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_canvas.test.js`  
Expected: FAIL with "Must import RotateCcw icon for reset view"

- [ ] **Step 3: Implement Reset View button, rich tooltips and hotkeys in OceanariumCanvas.tsx**

In `frontend/components/oceanarium/OceanariumCanvas.tsx`:
- Import `RotateCcw` from `lucide-react`.
- Add `handleResetView`:
  ```typescript
  const handleResetView = () => {
    if (directorRef.current) {
      directorRef.current.resetCameraView(1.0);
    }
  };
  ```
- Add keyboard listener in `useEffect`:
  ```typescript
  if ((e.key === 'r' || e.key === 'R') && !isDesktopMode) {
    handleResetView();
  }
  ```
- Build reusable `DockButtonWithTooltip` component or markup:
  - Glassmorphic button: `p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 text-cyan-300 border border-cyan-500/30 shadow-lg hover:border-cyan-400 hover:scale-105 transition-all group relative`.
  - Tooltip card: `absolute bottom-full mb-3 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col w-52 p-2.5 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md pointer-events-none z-30 transition-all`:
    - Top row: Title + shortcut pill (e.g., `<span className="font-bold text-white text-xs">Reset View</span> <kbd className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700/50 text-[10px] text-cyan-300">R</kbd>`).
    - Body text: `<p className="text-[11px] text-slate-300 mt-1 leading-snug">Return camera to default 2.5D isometric diorama perspective.</p>`.
- Add controls to bottom/top dock:
  - **Reset View [R]:** Returns to 2.5D isometric view.
  - **Drop Food [F]:** Drops food flakes into water.
  - **Desktop Mode [ESC]:** Fullscreen immersion.
  - **Camera Hint:** Subtle pill badge displaying *"Drag to rotate • Scroll to zoom"*.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_canvas.test.js`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add frontend/components/oceanarium/OceanariumCanvas.tsx frontend/tests/oceanarium_canvas.test.js
git commit -m "feat(oceanarium): add Reset View button, rich hover tooltips and R key shortcut in UI dock"
```

---

### Task 8: Full Verification, TypeScript Compilation & Visual Smoke Test

**Files:**
- Test: all unit tests across `frontend/tests/`
- Build: `frontend/`

- [ ] **Step 1: Run all frontend unit tests**

Run:
```bash
node frontend/tests/camera_director.test.js
node frontend/tests/scene_environment.test.js
node frontend/tests/foliage_system.test.js
node frontend/tests/bubble_system.test.js
node frontend/tests/cartoon_fish_factory.test.js
node frontend/tests/game_director.test.js
node frontend/tests/oceanarium_canvas.test.js
```
Expected: All tests pass with zero errors.

- [ ] **Step 2: Run frontend production build**

Run: `npm run build` in `frontend/`  
Expected: Build succeeds with 0 TypeScript/Vite errors.

- [ ] **Step 3: Rebuild platform stack and perform smoke verification**

Run: `sudo bash infra/rebuild.sh`  
Verify via browser or subagent:
- Oceanarium loads directly into 2.5D isometric vivarium perspective with glowing glass frame edges.
- Swaying kelp ribbons, corals, and breathing anemones are visible on the seabed.
- Dual corner aerators and fish feeding bubble puffs activate smoothly.
- Fish have animated jaws, fin crests, cheek blush, and species markings.
- Hovering UI dock buttons displays rich tooltips with hotkey badges.
- Clicking Reset View or pressing `[R]` smoothly returns the camera to the default isometric view.
- Frame rate maintains smooth 60 FPS.

- [ ] **Step 4: Commit all final changes**

Run:
```bash
git add .
git commit -m "feat(oceanarium): complete 2.5D isometric vivarium, animated foliage, bubbles, fish details and UI tooltips"
```
