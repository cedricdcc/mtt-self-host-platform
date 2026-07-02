# Pufferfish Visual & Behavioral Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the pufferfish widget to reside in a fixed position, feature a pulsing marine halo, display a wobbly liquid-shaped water bubble prompt, and be hidden entirely on admin screens.

**Architecture:** Use CSS animations, React State, local storage configurations, and simple route check filtering inside the self-contained component `CommunityGoalWidget.tsx`.

**Tech Stack:** React, TailwindCSS, HTML5 LocalStorage, standard CSS keyframes.

## Global Constraints
- Naming conventions: Maintain all file paths as exact matches.
- Minimal logic in code changes: Only minimal changes required to implement visual/functional constraints.
- Code style: Follow standard ES6 module structures.

---

### Task 1: Stationary Placement & Admin Route Filtering

**Files:**
- Modify: `frontend/components/CommunityGoalWidget.tsx`

**Interfaces:**
- Consumes: `location.pathname` from `useLocation`
- Produces: Null return for `/admin` pages, and stationary layout styling classes for minimized state.

- [ ] **Step 1: Write static location update**
  Initialize the layout updates and add route filtering.
  Insert path checking at the beginning of the `CommunityGoalWidget` render:
  ```typescript
  const isTranslationPage = location.pathname.startsWith('/flow') || location.pathname.includes('/term/') || location.pathname.includes('/admin');
  const isAdminPage = location.pathname.startsWith('/admin');
  
  if (isAdminPage) {
    return null;
  }
  ```

- [ ] **Step 2: Update coordinate tracking to static center**
  Modify the `updateFixedPosition` handler on mount and window resize, keeping `posRef` locked to the widget center:
  ```typescript
  useEffect(() => {
    const updateFixedPosition = () => {
      posRef.current = {
        x: window.innerWidth - 80,
        y: window.innerHeight - 80
      };
    };
    updateFixedPosition();
    window.addEventListener('resize', updateFixedPosition);
    return () => window.removeEventListener('resize', updateFixedPosition);
  }, []);
  ```

- [ ] **Step 3: Remove physical mouse-following positioning**
  In the `updatePosition` loop inside the component's `useEffect`, comment out or remove:
  ```typescript
  // posRef.current.x += dx * speedFactor;
  // posRef.current.y += dy * speedFactor;
  // ...
  // setPosition({ x: clampedX, y: clampedY });
  ```

- [ ] **Step 4: Update minimized wrapper HTML classes**
  Change the minimized wrapper div return output layout coordinates:
  ```typescript
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${className}`}
      style={{
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
  ```

- [ ] **Step 5: Verify build success**
  Run: `npm run build` inside `frontend/` directory to make sure compilation finishes cleanly.

- [ ] **Step 6: Commit changes**
  ```bash
  git add frontend/components/CommunityGoalWidget.tsx
  git commit -m "feat: implement stationary pufferfish positioning and admin routing checks"
  ```

---

### Task 2: Marine Halo Animation

**Files:**
- Modify: `frontend/components/CommunityGoalWidget.tsx`

**Interfaces:**
- Consumes: Inline HTML structures for minimized state
- Produces: CSS-driven pulsing marine halo circles layered behind the canvas.

- [ ] **Step 1: Insert halo elements**
  Add background styling elements inside the minimized button container:
  ```typescript
  <div
    ref={containerRef}
    onClick={toggleMinimize}
    className="relative w-28 h-28 flex items-center justify-center cursor-pointer z-10"
    role="button"
    aria-label="Show community goals"
  >
    {/* Pulse glow background */}
    <div className="absolute w-20 h-20 bg-gradient-to-tr from-cyan-400/25 to-blue-500/25 rounded-full blur-md animate-pulse z-0" />
    
    {/* Concentric ripple outer ring */}
    <div className="absolute w-16 h-16 rounded-full border border-cyan-400/40 animate-ping opacity-75 z-0" style={{ animationDuration: '3s' }} />

    {/* 3D Spline Scene (Pufferfish) ... */}
  ```

- [ ] **Step 2: Verify build success**
  Run: `npm run build` inside `frontend/` to confirm no styling typos.

- [ ] **Step 3: Commit changes**
  ```bash
  git add frontend/components/CommunityGoalWidget.tsx
  git commit -m "feat: add pulsing marine halo animations behind the pufferfish"
  ```

---

### Task 3: Liquid Water Bubble Prompt & local storage dismissal

**Files:**
- Modify: `frontend/components/CommunityGoalWidget.tsx`

**Interfaces:**
- Consumes: LocalStorage keys, React useState
- Produces: Auto-timed wobbly tooltip bubble prompt with manual dismissal.

- [ ] **Step 1: Set up state variables**
  Add a state variable for managing visibility of the water bubble prompt:
  ```typescript
  const [showBubble, setShowBubble] = useState(false);
  ```

- [ ] **Step 2: Add inline keyframe animation styles**
  Include a `<style>` block for the float and wobbly wobble liquid custom animations inside the widget render block:
  ```typescript
  <style>{`
    @keyframes bubbleFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes liquidWobble {
      0%, 100% { border-radius: 1.5rem 1.5rem 1.5rem 0.25rem; }
      33% { border-radius: 1.6rem 1.4rem 1.5rem 0.25rem; }
      66% { border-radius: 1.4rem 1.6rem 1.45rem 0.25rem; }
    }
    .water-bubble {
      animation: bubbleFloat 4s ease-in-out infinite, liquidWobble 6s ease-in-out infinite;
    }
  `}</style>
  ```

- [ ] **Step 3: Implement display timers and page state checks**
  Add a `useEffect` block managing timing thresholds:
  ```typescript
  useEffect(() => {
    if (!isMinimized) {
      setShowBubble(false);
      return;
    }

    const dismissed = localStorage.getItem('communityGoalsBubbleDismissed') === 'true';
    if (dismissed) return;

    // Show after 2s delay
    const showTimer = setTimeout(() => {
      setShowBubble(true);
    }, 2000);

    // Hide after 8s of visibility (10s total from mount/minimize)
    const hideTimer = setTimeout(() => {
      setShowBubble(false);
    }, 10000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isMinimized]);
  ```

- [ ] **Step 4: Render the tooltip markup**
  Render the bubble next to the fish inside the minimized container return:
  ```typescript
  {/* Water bubble text prompt */}
  {showBubble && (
    <div 
      className="absolute right-28 bottom-4 w-48 bg-sky-100/95 dark:bg-sky-950/95 border border-sky-200/50 dark:border-sky-800/40 p-3 shadow-[0_8px_32px_rgba(14,165,233,0.15)] text-slate-800 dark:text-slate-100 text-xs z-30 water-bubble pointer-events-auto cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="pr-4 font-medium leading-relaxed">
        Click the fish to see the goals you can complete!
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowBubble(false);
          localStorage.setItem('communityGoalsBubbleDismissed', 'true');
        }}
        className="absolute top-1 right-2 text-sky-500 hover:text-sky-700 font-bold text-sm"
        aria-label="Close guide"
      >
        &times;
      </button>
    </div>
  )}
  ```

- [ ] **Step 5: Dismiss bubble on fish click**
  Update `toggleMinimize` to dismiss the bubble:
  ```typescript
  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('communityGoalsMinimized', String(newState));
    if (!newState) {
      setShowBubble(false);
      localStorage.setItem('communityGoalsBubbleDismissed', 'true');
    }
  };
  ```

- [ ] **Step 6: Verify build success**
  Run: `npm run build` in `frontend/` to check final compilation.

- [ ] **Step 7: Commit changes**
  ```bash
  git add frontend/components/CommunityGoalWidget.tsx
  git commit -m "feat: implement liquid water bubble layout guides with auto-hiding and local storage state"
  ```
