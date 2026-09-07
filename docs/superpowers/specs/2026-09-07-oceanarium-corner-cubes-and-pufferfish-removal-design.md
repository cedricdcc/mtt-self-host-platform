# Oceanarium Enclosure Refinement & Pufferfish Widget Suppression Design

**Date**: 2026-09-07  
**Branch**: `feat/gacha`  
**Status**: Approved by User  

## 1. Executive Summary
This design refines the visual cleanliness of the 3D Oceanarium view by:
1. Eliminating the 8 dark-slate corner bracket cubes from the 1:1:1 vivarium diorama enclosure, creating a sleek, frameless glass aquarium aesthetic with luminous wireframe edge lines, acrylic glass faces, and etched depth ticks.
2. Suppressing the global 3D Spline pufferfish floating widget (`CommunityGoalWidget`) on all `/oceanarium` routes, eliminating visual interference with vivarium controls and underwater HUD.

---

## 2. Problem Statement
- **Corner Bracket Clutter**: In the initial 1:1:1 cube vivarium implementation, 8 brushed titanium/slate corner brackets (`BoxGeometry(2.5, 2.5, 2.5)`) were added at the vertices of the $40 \times 40 \times 40$ cube. These heavy dark blocks obscure the clean glass corners of the aquarium and detract from the sleek diorama presentation.
- **Pufferfish Widget Collision**: The community goals widget renders a floating 3D Spline pufferfish in the bottom-right corner of authenticated pages. On `/oceanarium`, this secondary 3D model collides visually and functionally with the primary 3D vivarium, the camera viewport, and the scientific infographic drawer.

---

## 3. Detailed Technical Design

### 3.1 SceneEnvironment Enclosure Clean-up (`SceneEnvironment.ts`)
- **Remove `cornerBrackets` Group**:
  - Delete `public cornerBrackets: THREE.Group | null = null;`.
  - Remove instantiation of the 8 cube meshes (`BoxGeometry(2.5, 2.5, 2.5)`) and their addition to `this.scene`.
  - Remove `this.cornerBrackets.visible = !enabled;` in `setDesktopMode(enabled: boolean)`.
  - Remove `this.scene.remove(this.cornerBrackets)` and mesh geometry/material disposal in `dispose()`.
- **Retained Structural Elements**:
  - `enclosureFrame`: Luminous cyan-blue wireframe (`LinesSegments` from `EdgesGeometry`).
  - `depthTicks`: Subtle cyan measurement tick marks along the 4 vertical support axes at 0m, 200m, 1000m, and 3000m.
  - `glassCube`: 6 double-sided transparent acrylic panels with subtle fresnel reflectance.
  - `dioramaPedestal`: Sleek dark slate base beneath the sand floor ($44 \times 2 \times 44$ at $Y = -21$).

### 3.2 Pufferfish Widget Suppression (`Layout.tsx` & `CommunityGoalWidget.tsx`)
- **Layout-Level Conditional Rendering (`Layout.tsx`)**:
  - Update `CommunityGoalWidget` rendering:
    ```tsx
    {isAuthenticated && !location.pathname.startsWith('/oceanarium') && (
      <CommunityGoalWidget className="hidden md:block" />
    )}
    ```
- **Component-Level Defensive Guard (`CommunityGoalWidget.tsx`)**:
  - In `CommunityGoalWidget.tsx`, verify route check at the top of the component:
    ```tsx
    if (location.pathname.startsWith('/oceanarium')) {
      return null;
    }
    ```
  - Prevents initializing Spline runtime, requestAnimationFrame physics loops, or global mouse/touch listeners when navigating to `/oceanarium`.

---

## 4. Testing & Verification Plan

### 4.1 Automated Tests
1. **Scene Environment Test (`frontend/tests/scene_environment.test.js`)**:
   - Assert that `SceneEnvironment.ts` does not instantiate or add `cornerBrackets` or dark vertex cubes.
   - Assert that `enclosureFrame`, `depthTicks`, `dioramaPedestal`, and `glassCube` remain intact.
2. **Pufferfish Widget Suppression Test (`frontend/tests/community-goal-widget-pufferfish.test.js` or `frontend/tests/oceanarium_pufferfish_suppression.test.js`)**:
   - Verify that `Layout.tsx` and `CommunityGoalWidget.tsx` check `location.pathname.startsWith('/oceanarium')` and suppress rendering.
3. **Full Frontend Test Suite**:
   - Run all existing Oceanarium tests to verify no regressions:
     - `node frontend/tests/scene_environment.test.js`
     - `node frontend/tests/camera_director.test.js`
     - `node frontend/tests/game_director.test.js`
     - `node frontend/tests/desktop_mode_world.test.js`
     - `node frontend/tests/oceanarium_canvas.test.js`
     - `node frontend/tests/fish_infographic.test.js`
4. **TypeScript Verification**:
   - Run `npx tsc --noEmit` in `frontend/` to confirm 0 compile/type errors.
