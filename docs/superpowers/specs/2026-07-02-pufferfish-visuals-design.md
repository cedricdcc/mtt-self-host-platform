# Pufferfish Visual & Behavioral Improvements Design

This design document outlines the visual polish, behavior changes, and positioning improvements for the floating pufferfish widget on the bottom right of the screen.

## Objectives
- Make the floating pufferfish less intrusive by pinning it to a fixed position at the bottom-right corner rather than having it physically follow the user's cursor.
- Maintain premium micro-interactions by keeping the 3D looking-at and body tilt tracking relative to the mouse.
- Add an elegant marine-colored pulsing halo behind the fish to enhance aesthetics.
- Implement an animated, wobbly liquid-shaped water bubble prompt explaining the widget's purpose, with automatic fade-out and permanent user dismissal.
- Hide the widget entirely on all pages within the admin section (routes starting with `/admin`).

## Proposed Changes

### Frontend Components

#### [MODIFY] [CommunityGoalWidget.tsx](file:///data/projects/mtt-self-host-platform/frontend/components/CommunityGoalWidget.tsx)

- **Stationary Positioning:** 
  - Change the minimized widget container from dynamic pixel offset styling to standard Tailwind classes (`fixed bottom-6 right-6 z-50`).
  - Remove code in the physics/animation loop that moves the physical widget coordinate position (`setPosition({ x: clampedX, y: clampedY })`).
- **Cursor Look-At Orientation:**
  - Update `posRef` on mount and resize to the static widget center (`window.innerWidth - 80`, `window.innerHeight - 80`).
  - Maintain the existing body and eye rotation tracking so the 3D spline model faces the cursor.
- **Marine Halo Effect:**
  - Add two visual styling elements behind the Spline canvas container:
    - Gradient pulse backdrop: `bg-gradient-to-tr from-cyan-400/25 to-blue-500/25 rounded-full blur-md animate-pulse`
    - Ripple ring: `border border-cyan-400/40 rounded-full animate-ping opacity-75` with a slow `3s` duration overlay.
- **Water Bubble Prompt:**
  - Design a glassmorphic water bubble tooltip (`absolute right-28 bottom-4 w-48`).
  - Styling: `bg-sky-100/90 dark:bg-sky-950/90 border border-sky-300/40 p-3 rounded-3xl rounded-br-sm shadow-[0_8px_32px_rgba(14,165,233,0.15)]`.
  - Add self-contained CSS styles for float and liquid-wobble animations:
    ```css
    @keyframes bubbleFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes liquidWobble {
      0%, 100% { border-radius: 1.5rem 1.5rem 1.5rem 0.25rem; }
      33% { border-radius: 1.6rem 1.4rem 1.5rem 0.25rem; }
      66% { border-radius: 1.4rem 1.6rem 1.45rem 0.25rem; }
    }
    ```
  - State and control flow:
    - Initialize `showBubble` state to `false`.
    - Check `localStorage.getItem('communityGoalsBubbleDismissed')`. If not `'true'`, schedule a `2s` delay timeout to set `showBubble(true)`.
    - Schedule an `8s` delay timeout to hide the bubble automatically after display if no hover occurs.
    - Provide a manual close button (`X`) which saves the dismissed state in `localStorage` to avoid showing it on subsequent reloads.
    - Dismiss the bubble and save the state to `localStorage` when the fish is clicked (expanded).
- **Admin Section Filtering:**
  - Check `const isAdminPage = location.pathname.startsWith('/admin')`.
  - If `isAdminPage` is true, return `null` immediately to hide the widget on all admin screens.

## Verification Plan

### Manual Verification
- Verify the fish remains in the bottom-right corner and does not float behind the mouse.
- Verify that moving the mouse still causes the fish's eyes and head to follow the cursor.
- Verify the wobbly liquid water bubble shows up after `2s` on non-admin pages, and disappears after `8s` or when the close button is clicked.
- Verify that clicking the close button or expanding the widget sets `localStorage` and keeps the bubble hidden on refresh.
- Navigate to `/admin`, `/admin/users`, `/admin/harvest`, etc., and verify the pufferfish widget is completely hidden.
