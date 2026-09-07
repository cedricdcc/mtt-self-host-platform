# Oceanarium Enclosure Refinement & Pufferfish Widget Suppression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the 8 dark corner bracket cubes from the 1:1:1 vivarium diorama cube and suppress the bottom-right floating 3D pufferfish widget on `/oceanarium` routes.

**Architecture:** 
- In `SceneEnvironment.ts`, remove the `cornerBrackets` group and meshes while retaining clean luminous wireframe edge lines, glass panels, depth ticks, and pedestal.
- In `Layout.tsx` and `CommunityGoalWidget.tsx`, introduce path checks for `/oceanarium` to suppress mounting and rendering of the community goal pufferfish widget.

**Tech Stack:** Three.js, React, React Router, Vite, Jest / Node.js assert tests.

## Global Constraints
- Keep 1:1:1 diorama cube geometry ($40 \times 40 \times 40$).
- Retain glowing edge lines (`enclosureFrame`), depth ticks (`depthTicks`), glass faces (`glassCube`), and pedestal base (`dioramaPedestal`).
- Completely suppress the floating pufferfish widget on any route matching or starting with `/oceanarium`.
- Maintain 100% test pass rate across backend and frontend test suites.

---

### Task 1: Remove Corner Bracket Cubes from SceneEnvironment

**Files:**
- Modify: `frontend/components/oceanarium/engine/SceneEnvironment.ts`
- Test: `frontend/tests/scene_environment.test.js`

**Interfaces:**
- Consumes: `THREE.Scene`, `HALF_CUBE = 20`
- Produces: Clean glass vivarium enclosure with no dark corner bracket cubes

- [ ] **Step 1: Update the unit test in `frontend/tests/scene_environment.test.js` to assert absence of `cornerBrackets`**

```javascript
// In frontend/tests/scene_environment.test.js:
// Assert that cornerBrackets property is undefined/null and not instantiated in the scene
assert.strictEqual(
  sceneEnv.cornerBrackets,
  undefined,
  "cornerBrackets group must be removed for clean rimless aquarium edges"
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/scene_environment.test.js`  
Expected: FAIL with "cornerBrackets group must be removed for clean rimless aquarium edges"

- [ ] **Step 3: Remove `cornerBrackets` from `SceneEnvironment.ts`**

In `frontend/components/oceanarium/engine/SceneEnvironment.ts`:
- Remove `public cornerBrackets: THREE.Group | null = null;` property.
- Remove lines 160-177 (creation of `cornerBrackets`, `bracketGeo`, `bracketMat`, 8 box meshes, and `this.scene.add(this.cornerBrackets)`).
- Remove `if (this.cornerBrackets) this.cornerBrackets.visible = !enabled;` from `setDesktopMode`.
- Remove `if (this.cornerBrackets) { this.scene.remove(this.cornerBrackets); ... }` from `dispose`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/scene_environment.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/engine/SceneEnvironment.ts frontend/tests/scene_environment.test.js
git commit -m "refactor(oceanarium): remove dark corner bracket cubes from vivarium cube"
```

---

### Task 2: Suppress Pufferfish Widget on Oceanarium Routes

**Files:**
- Modify: `frontend/components/Layout.tsx`
- Modify: `frontend/components/CommunityGoalWidget.tsx`
- Test: `frontend/tests/oceanarium_pufferfish_suppression.test.js`

**Interfaces:**
- Consumes: `useLocation().pathname`
- Produces: Complete suppression of `<CommunityGoalWidget />` on `/oceanarium`

- [ ] **Step 1: Write test `frontend/tests/oceanarium_pufferfish_suppression.test.js`**

```javascript
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const layoutSource = fs.readFileSync(
  path.join(__dirname, "../components/Layout.tsx"),
  "utf8"
);
const widgetSource = fs.readFileSync(
  path.join(__dirname, "../components/CommunityGoalWidget.tsx"),
  "utf8"
);

console.log("Testing Oceanarium pufferfish widget suppression...");

// 1. Layout checks location.pathname before rendering CommunityGoalWidget
assert.ok(
  layoutSource.includes("!location.pathname.startsWith('/oceanarium')") ||
  layoutSource.includes("location.pathname !== '/oceanarium'"),
  "Layout.tsx must conditionally exclude CommunityGoalWidget on oceanarium routes"
);

// 2. CommunityGoalWidget has early return guard for /oceanarium
assert.ok(
  widgetSource.includes("location.pathname.startsWith('/oceanarium')"),
  "CommunityGoalWidget.tsx must include guard for /oceanarium route"
);

console.log("✓ Oceanarium pufferfish suppression tests PASSED!");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_pufferfish_suppression.test.js`  
Expected: FAIL

- [ ] **Step 3: Update `Layout.tsx` and `CommunityGoalWidget.tsx`**

In `frontend/components/Layout.tsx`:
```tsx
{/* Community Goals Widget - hidden on mobile and hidden on oceanarium */}
{isAuthenticated && !location.pathname.startsWith('/oceanarium') && (
  <CommunityGoalWidget className="hidden md:block" />
)}
```

In `frontend/components/CommunityGoalWidget.tsx`:
Add early guard:
```tsx
  if (location.pathname.startsWith('/oceanarium')) {
    return null;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_pufferfish_suppression.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Layout.tsx frontend/components/CommunityGoalWidget.tsx frontend/tests/oceanarium_pufferfish_suppression.test.js
git commit -m "fix(oceanarium): suppress community goal pufferfish widget on oceanarium routes"
```

---

### Task 3: Full Verification and Type Checking

**Files:**
- Test all frontend and backend tests

- [ ] **Step 1: Run complete test suite**

Run:
```bash
node backend/tests/mail_service.test.js && \
node frontend/tests/scene_environment.test.js && \
node frontend/tests/camera_director.test.js && \
node frontend/tests/game_director.test.js && \
node frontend/tests/desktop_mode_world.test.js && \
node frontend/tests/oceanarium_canvas.test.js && \
node frontend/tests/desktop_mode_ui.test.js && \
node frontend/tests/fish_infographic.test.js && \
node frontend/tests/oceanarium_pufferfish_suppression.test.js
```
Expected: All tests PASS with exit code 0.

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`  
Expected: 0 errors.
