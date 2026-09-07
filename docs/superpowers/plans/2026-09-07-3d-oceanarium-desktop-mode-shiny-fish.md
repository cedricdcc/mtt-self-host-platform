# 3D Oceanarium, Desktop Submarine Mode & Shiny Fish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Oceanarium to a 3D Three.js environment featuring cartoon fish styled like the homepage pufferfish, an ambient fullscreen Desktop Mode with an autonomous research submarine, and a 1/500 shiny fish variant system across the database, gacha, and codex.

**Architecture:** A modular `ThreeGameDirector` architecture under `frontend/components/oceanarium/engine/` orchestrates Three.js rendering, procedural cartoon fish generation, 3D boids swimming physics, 3D food sinking, camera lerping, and the submarine's nature documentary patrol routine. The backend adds SQLite migration `038_shiny_fishes.sql` and updates gacha services for the 1/500 shiny roll.

**Tech Stack:** Three.js, React 18, TypeScript, Tailwind CSS, SQLite (`better-sqlite3`), Node.js / Express.

## Global Constraints
- Cartoon fish must match the cute rounded aesthetic, large expressive eyes, and glossy toon shading of the homepage pufferfish.
- Shiny fish rate is strictly 1/500 (0.2%) on gacha pull.
- Desktop Mode must support native HTML5 Fullscreen API with auto-hiding controls after 3 seconds of inactivity, returning to standard view on `Escape` key.
- Three.js lifecycle must properly dispose of all geometries, materials, textures, and animation frames on unmount.
- Standard view must retain 3D food feeding and fish selection/inspection.

---

### Task 1: Backend Database Migration & Gacha Service for Shiny Fishes

**Files:**
- Create: `backend/src/db/migrations/038_shiny_fishes.sql`
- Modify: `backend/src/services/ecosystem.service.js:110-128,235-300`
- Create: `backend/tests/shiny_gacha.test.js`

**Interfaces:**
- Consumes: `user_fishes`, `gacha_pull_logs`, `ensureUserEcosystem`
- Produces: `is_shiny` integer (0 or 1) in `user_fishes` records, gacha roll result objects, and `fetchEcosystem` / `fetchCodex` responses.

- [ ] **Step 1: Write failing test for shiny gacha migration and pull logic**

Create `backend/tests/shiny_gacha.test.js`:
```javascript
const assert = require('assert');
const { getDatabase } = require('../src/db');
const { pullGacha, fetchEcosystem, fetchCodex } = require('../src/services/ecosystem.service');

console.log('Testing Shiny Fishes DB & Gacha Service...');

const db = getDatabase();

// 1. Verify migration added is_shiny column to user_fishes
const columns = db.prepare("PRAGMA table_info(user_fishes)").all();
const hasShinyCol = columns.some(c => c.name === 'is_shiny');
assert.strictEqual(hasShinyCol, true, 'user_fishes must contain is_shiny column');

// 2. Test shiny generation flag in pullGacha
// Inject high tickets into test admin user (id 1)
db.prepare("UPDATE user_ecosystem SET tickets = 100 WHERE user_id = 1").run();

const pullRes = pullGacha(1, 1);
assert.ok(pullRes.results.length === 1);
assert.ok('is_shiny' in pullRes.results[0], 'pull result must include is_shiny boolean');

// 3. Test fetchEcosystem returns is_shiny
const eco = fetchEcosystem(1);
assert.ok(eco.fishes.length > 0);
assert.ok('is_shiny' in eco.fishes[0], 'fishes list must include is_shiny property');

console.log('Shiny Fishes backend tests PASSED!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/shiny_gacha.test.js`  
Expected: FAIL with "user_fishes must contain is_shiny column"

- [ ] **Step 3: Create migration `038_shiny_fishes.sql` and apply in `dbInit.service.js`**

Create `backend/src/db/migrations/038_shiny_fishes.sql`:
```sql
-- Migration 038: Add is_shiny column to user_fishes and gacha_pull_logs
ALTER TABLE user_fishes ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0 CHECK(is_shiny IN (0, 1));
ALTER TABLE gacha_pull_logs ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0 CHECK(is_shiny IN (0, 1));
```

Run migration or ensure `dbInit.service.js` executes pending migrations on startup.

- [ ] **Step 4: Update `backend/src/services/ecosystem.service.js`**

In `fetchEcosystem`:
```javascript
SELECT uf.id as user_fish_id, uf.species_id, uf.nickname, uf.status, uf.caught_at, uf.is_favorite, uf.is_shiny,
       gs.name, gs.depth_zone, gs.rarity, gs.description, gs.visual_traits
FROM user_fishes uf
JOIN gacha_species gs ON uf.species_id = gs.id
WHERE uf.user_id = ?
ORDER BY uf.is_favorite DESC, uf.caught_at DESC
```

In `pullGacha`:
```javascript
// Evaluate 1/500 shiny chance
const isShiny = Math.random() < (1 / 500) ? 1 : 0;

// Insert fish
const insertResult = db.prepare(`
  INSERT INTO user_fishes (user_id, species_id, status, is_shiny)
  VALUES (?, ?, 'active', ?)
`).run(userId, rolled.id, isShiny);

// Log pull
db.prepare(`
  INSERT INTO gacha_pull_logs (user_id, species_id, pull_type, is_shiny)
  VALUES (?, ?, ?, ?)
`).run(userId, rolled.id, count === 10 ? 'multi' : 'single', isShiny);

results.push({
  user_fish_id: insertResult.lastInsertRowid,
  species_id: rolled.id,
  name: rolled.name,
  depth_zone: rolled.depth_zone,
  rarity: rolled.rarity,
  description: rolled.description,
  visual_traits: typeof rolled.visual_traits === 'string' ? JSON.parse(rolled.visual_traits) : rolled.visual_traits,
  is_new_discovery: !isDuplicate,
  is_shiny: Boolean(isShiny)
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node backend/tests/shiny_gacha.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/migrations/038_shiny_fishes.sql backend/src/services/ecosystem.service.js backend/tests/shiny_gacha.test.js
git commit -m "feat(backend): add shiny fish 1/500 roll and database migration"
```

---

### Task 2: Install Three.js & Build Cartoon Fish Factory

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/components/oceanarium/engine/CartoonFishFactory.ts`
- Create: `frontend/tests/cartoon_fish_factory.test.js`

**Interfaces:**
- Consumes: Species visual traits (`primary_color`, `secondary_color`, `body_type`, `scale`, `glow`), `is_shiny`
- Produces: `CartoonFishFactory.createFishMesh(species, isShiny): THREE.Group` with animated bones/fin pivots and custom toon materials.

- [ ] **Step 1: Install `three` and `@types/three` in `frontend`**

Run:
```bash
cd /data/projects/mtt-self-host-platform/frontend && npm install three && npm install -D @types/three
```

- [ ] **Step 2: Write failing unit test for `CartoonFishFactory`**

Create `frontend/tests/cartoon_fish_factory.test.js`:
```javascript
import assert from 'assert';
import * as THREE from 'three';
import { CartoonFishFactory } from '../components/oceanarium/engine/CartoonFishFactory.ts';

console.log('Testing CartoonFishFactory...');

const factory = new CartoonFishFactory();
const standardFish = factory.createFishMesh({
  id: 'azure_damselfish',
  body_type: 'oval',
  scale: 1.0,
  primary_color: '#00d2ff',
  secondary_color: '#3a7bd5',
  glow: false
}, false);

assert.ok(standardFish instanceof THREE.Group, 'Should return a THREE.Group');
assert.ok(standardFish.userData.tailPivot, 'Fish must have a tail pivot for procedural swimming animation');
assert.strictEqual(standardFish.userData.isShiny, false);

const shinyFish = factory.createFishMesh({
  id: 'clown_anemone',
  body_type: 'oval',
  scale: 0.95,
  primary_color: '#ff7e5f',
  secondary_color: '#feb47b',
  glow: false
}, true);

assert.strictEqual(shinyFish.userData.isShiny, true);
assert.ok(shinyFish.userData.sparkleEmitter, 'Shiny fish must have a sparkle emitter attachment');

console.log('CartoonFishFactory tests PASSED!');
```

- [ ] **Step 3: Implement `CartoonFishFactory.ts`**

Build `CartoonFishFactory.ts`:
- Uses rounded geometries (squashed spheres for body, flattened capsules for pectoral/dorsal fins, rounded tail fin).
- Constructs expressive cartoon eyes: large white sphere sclera, dark pupils, and specular reflection dots.
- Sets up `userData.tailPivot`, `userData.leftFin`, and `userData.rightFin` for sine-wave rotation during the game loop.
- Uses `MeshToonMaterial` with custom gradient textures.
- If `isShiny` is true: applies pearlescent/iridescent color shifts with high specular sheen and attaches an orbiting star/sparkle particle sprite system.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --loader ts-node/esm frontend/tests/cartoon_fish_factory.test.js` or compile with Vite and run.  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/components/oceanarium/engine/CartoonFishFactory.ts frontend/tests/cartoon_fish_factory.test.js
git commit -m "feat(oceanarium): implement procedural 3D cartoon fish factory with toon materials"
```

---

### Task 3: Underwater Environment, Boids Simulation & 3D Feeding Physics

**Files:**
- Create: `frontend/components/oceanarium/engine/SceneEnvironment.ts`
- Create: `frontend/components/oceanarium/engine/FishBoidsSystem.ts`
- Create: `frontend/components/oceanarium/engine/FeedingPhysics.ts`
- Create: `frontend/tests/boids_simulation.test.js`

**Interfaces:**
- Consumes: `THREE.Scene`, `THREE.Camera`, array of user fishes
- Produces:
  - `SceneEnvironment.setup()`: water fog, depth lighting, caustic floor, plankton particles.
  - `FishBoidsSystem.update(delta, time)`: updates 3D position, yaw/pitch orientation, fin wiggles, boundary avoidance.
  - `FeedingPhysics.dropFood(position, type)` & `FeedingPhysics.update(delta)`: drops 3D flakes/pellets, triggers fish eating when close.

- [ ] **Step 1: Write failing test for boids simulation and food attraction**

Create `frontend/tests/boids_simulation.test.js`:
```javascript
import assert from 'assert';
import * as THREE from 'three';
import { FishBoidsSystem } from '../components/oceanarium/engine/FishBoidsSystem.ts';
import { FeedingPhysics } from '../components/oceanarium/engine/FeedingPhysics.ts';

console.log('Testing Boids Simulation & Feeding Physics...');

const scene = new THREE.Scene();
const boids = new FishBoidsSystem(scene);
const feeding = new FeedingPhysics(scene);

// Add test fish
const fishMesh = new THREE.Group();
fishMesh.position.set(0, 0, 0);
boids.addFish({
  user_fish_id: 1,
  species_id: 'azure_damselfish',
  depth_zone: 'sunlit',
  mesh: fishMesh
});

// Drop food pellet at (5, 10, 0)
const pellet = feeding.dropFood(new THREE.Vector3(5, 10, 0), 'flake');
assert.strictEqual(feeding.getPellets().length, 1);

// Step simulation
feeding.update(0.1);
boids.update(0.1, 1.0, feeding.getPellets());

assert.ok(pellet.mesh.position.y < 10, 'Pellet must sink downwards');
console.log('Boids & Feeding tests PASSED!');
```

- [ ] **Step 2: Implement `SceneEnvironment.ts`**
  - Atmospheric depth fog (sunlit cyan `#004875` at top, twilight `#001738` at mid, abyssal `#02040c` at bottom).
  - Ambient light + directional sunlight beam with caustic water animation.
  - Ambient rising bubble particles and floating glowing plankton sprites.

- [ ] **Step 3: Implement `FishBoidsSystem.ts`**
  - Flocking/patrol steering within depth zones (Sunlit Y: 10 to 30, Twilight Y: -10 to 10, Abyssal Y: -30 to -10).
  - Autonomous waypoint steering + collision repulsion from tank glass.
  - Food attraction: calculates nearest sinking food pellet; steers fish mouth toward pellet.
  - Procedural fin animation: oscillates `tailPivot.rotation.y = Math.sin(time * speed) * amplitude`.

- [ ] **Step 4: Implement `FeedingPhysics.ts`**
  - Spawns 3D food flakes or super pellets with slight wobble and downward gravity/drag.
  - Mouth collision detection: when fish mouth distance < 1.5 units, removes food and emits small heart/bubble particle effect.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --loader ts-node/esm frontend/tests/boids_simulation.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/components/oceanarium/engine/SceneEnvironment.ts frontend/components/oceanarium/engine/FishBoidsSystem.ts frontend/components/oceanarium/engine/FeedingPhysics.ts frontend/tests/boids_simulation.test.js
git commit -m "feat(oceanarium): add scene environment, boids simulation, and 3D feeding physics"
```

---

### Task 4: Autonomous Submarine & Nature Documentary Patrol Director

**Files:**
- Create: `frontend/components/oceanarium/engine/SubmarineDirector.ts`
- Create: `frontend/tests/submarine_director.test.js`

**Interfaces:**
- Consumes: `THREE.Scene`, `FishBoidsSystem`
- Produces:
  - Submarine 3D mesh with spinning propeller, bubble trail, and spotlight.
  - `SubmarineDirector.update(delta, time)`: autonomous cruising, periodic selection of random player fish, hover deceleration, spotlight training, and observation event emit.

- [ ] **Step 1: Write failing test for `SubmarineDirector`**

Create `frontend/tests/submarine_director.test.js`:
```javascript
import assert from 'assert';
import * as THREE from 'three';
import { SubmarineDirector } from '../components/oceanarium/engine/SubmarineDirector.ts';

console.log('Testing SubmarineDirector...');

const scene = new THREE.Scene();
const subDirector = new SubmarineDirector(scene);

assert.ok(subDirector.mesh instanceof THREE.Group, 'Submarine must create a 3D mesh group');
assert.ok(subDirector.searchlight instanceof THREE.SpotLight, 'Submarine must have a spotlight');

// Test state transition to observation
let observedFish = null;
subDirector.onObservationStart = (fish) => { observedFish = fish; };

const mockFish = { id: 42, name: 'Shiny Azure Damselfish', isShiny: true, position: new THREE.Vector3(10, 5, 0) };
subDirector.triggerObservation(mockFish);

assert.strictEqual(subDirector.getState(), 'HOVERING_OBSERVATION');
assert.strictEqual(observedFish.id, 42);

console.log('SubmarineDirector tests PASSED!');
```

- [ ] **Step 2: Implement `SubmarineDirector.ts`**
  - Constructs yellow cartoon bathyscaphe with rounded hull, observation dome with warm interior light, rotating dual propellers, and forward dual spotlights.
  - Propeller bubble trail particle emitter.
  - State machine: `CRUISING` ↔ `APPROACHING_TARGET` ↔ `HOVERING_OBSERVATION`.
  - Timer-based selection: every 25–35 seconds, picks an active fish from the scene, smoothly steers to hover 4 units away, activates spotlight, and fires `onObservationStart(fishData)`.
  - After 7 seconds, fires `onObservationEnd()`, turns, and resumes `CRUISING`.

- [ ] **Step 3: Run test to verify it passes**

Run: `node --loader ts-node/esm frontend/tests/submarine_director.test.js`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/components/oceanarium/engine/SubmarineDirector.ts frontend/tests/submarine_director.test.js
git commit -m "feat(oceanarium): implement autonomous exploration submarine with nature doc patrol routines"
```

---

### Task 5: Camera Director & Three Game Director Orchestrator

**Files:**
- Create: `frontend/components/oceanarium/engine/CameraDirector.ts`
- Create: `frontend/components/oceanarium/engine/ThreeGameDirector.ts`
- Create: `frontend/tests/game_director.test.js`

**Interfaces:**
- Consumes: Canvas DOM element, user fishes array, mode change requests
- Produces: `ThreeGameDirector` instance with `setMode('STANDARD_VIEW' | 'DESKTOP_MODE')`, `feed(type)`, `selectFish(id)`, and `dispose()`.

- [ ] **Step 1: Write failing test for `ThreeGameDirector`**

Create `frontend/tests/game_director.test.js`:
```javascript
import assert from 'assert';
import { ThreeGameDirector } from '../components/oceanarium/engine/ThreeGameDirector.ts';

console.log('Testing ThreeGameDirector...');

// Mock HTMLCanvasElement
const canvas = {
  width: 800,
  height: 600,
  clientWidth: 800,
  clientHeight: 600,
  addEventListener: () => {},
  removeEventListener: () => {},
  getContext: () => ({
    getExtension: () => null,
    getParameter: () => 0,
  })
};

const director = new ThreeGameDirector(canvas);
assert.strictEqual(director.getMode(), 'STANDARD_VIEW');

director.setMode('DESKTOP_MODE');
assert.strictEqual(director.getMode(), 'DESKTOP_MODE');

director.dispose();
console.log('ThreeGameDirector tests PASSED!');
```

- [ ] **Step 2: Implement `CameraDirector.ts`**
  - Supports OrbitControls in `STANDARD_VIEW`.
  - Smooth camera lerping to depth zones (`snapToDepth('sunlit' | 'twilight' | 'abyssal')`).
  - Smooth camera lerping to frame a clicked fish in `INSPECTING_FISH`.
  - Third-person damping follow camera in `DESKTOP_MODE` tracking the submarine position + offset, with smooth cinematic pivot during fish observation.

- [ ] **Step 3: Implement `ThreeGameDirector.ts`**
  - Initializes WebGLRenderer, SceneEnvironment, CartoonFishFactory, FishBoidsSystem, SubmarineDirector, and CameraDirector.
  - Runs 60fps game loop via `requestAnimationFrame`.
  - Manages Raycasting for clicking fish and dropping food.
  - Full lifecycle cleanup: unregisters event listeners, disposes geometries/materials/textures, cancels RAF.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --loader ts-node/esm frontend/tests/game_director.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/CameraDirector.ts frontend/components/oceanarium/engine/ThreeGameDirector.ts frontend/tests/game_director.test.js
git commit -m "feat(oceanarium): implement camera director and main ThreeGameDirector orchestrator"
```

---

### Task 6: React UI Integration: Desktop Mode, Fullscreen, and Shiny Codex

**Files:**
- Modify: `frontend/components/oceanarium/OceanariumCanvas.tsx`
- Modify: `frontend/pages/Oceanarium.tsx`
- Modify: `frontend/components/oceanarium/MarineCodex.tsx`
- Modify: `frontend/components/oceanarium/DiveStation.tsx`

**Interfaces:**
- Consumes: `ThreeGameDirector`, `ecosystemData`, `codexData`
- Produces:
  - Desktop Mode toggle with fullscreen immersion, auto-hiding exit HUD, and nature doc observation cards.
  - Marine Codex with shiny star toggle and shiny discovery tracker.
  - Dive Station with golden/prismatic sparkle fanfare on 1/500 shiny pull.

- [ ] **Step 1: Update `OceanariumCanvas.tsx` to host `ThreeGameDirector`**
  - Mounts `<canvas>` and initializes `ThreeGameDirector`.
  - Passes fish data and water quality.
  - Connects click-to-feed and click-to-inspect.
  - Adds Desktop Mode HUD: observation card (*“Observing: Shiny Azure Damselfish”*), auto-hiding on mouse idle, and ESC key listener.

- [ ] **Step 2: Update `Oceanarium.tsx` with Desktop Mode Button**
  - Adds a prominent **"Desktop Mode"** button in header with `Monitor` icon.
  - Handles `document.documentElement.requestFullscreen()` and triggers director's `setMode('DESKTOP_MODE')`.
  - Gracefully exits fullscreen on ESC.

- [ ] **Step 3: Update `MarineCodex.tsx` for Shiny Variants**
  - Adds a Shiny Star icon button on each species card.
  - Toggling the star shows the shiny variant palette and lore.
  - Displays shiny collection stats header: *“Shiny Discoveries: X / 20”*.

- [ ] **Step 4: Update `DiveStation.tsx` for Shiny Reveal Fanfare**
  - When `pulledFish.is_shiny` is true, trigger rainbow/golden confetti and *“✨ ULTRA RARE SHINY DISCOVERY! ✨”* banner.

- [ ] **Step 5: Verify frontend build compiles with Vite**

Run: `cd /data/projects/mtt-self-host-platform/frontend && npm run build`  
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/oceanarium/OceanariumCanvas.tsx frontend/pages/Oceanarium.tsx frontend/components/oceanarium/MarineCodex.tsx frontend/components/oceanarium/DiveStation.tsx
git commit -m "feat(oceanarium): connect React UI with desktop mode fullscreen, submarine HUD, and shiny codex"
```

---

### Task 7: End-to-End Verification & Automated Test Suite

**Files:**
- Create: `backend/scripts/grant_shiny_fish.js`
- Test: All automated backend and frontend test suites

- [ ] **Step 1: Create admin helper script to grant a shiny fish for testing**

Create `backend/scripts/grant_shiny_fish.js`:
```javascript
const { getDatabase } = require('../src/db');
const db = getDatabase();

db.prepare(`
  INSERT INTO user_fishes (user_id, species_id, nickname, status, is_shiny)
  VALUES (1, 'azure_damselfish', 'Sparky', 'active', 1)
`).run();

console.log('Granted Shiny Azure Damselfish to admin user (ID 1)');
```

- [ ] **Step 2: Run all backend tests**

Run: `cd /data/projects/mtt-self-host-platform/backend && npm test`  
Expected: All tests PASS.

- [ ] **Step 3: Run all frontend tests**

Run: `cd /data/projects/mtt-self-host-platform/frontend && npm test` (or node test runners)  
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/grant_shiny_fish.js
git commit -m "test(oceanarium): add admin shiny fish grant script and verify test suites"
```
