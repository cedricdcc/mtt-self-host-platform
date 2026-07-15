# Design Spec: Footer Scroll Animation & Test Setup

This document specifies the implementation of a scroll-triggered footer padding animation and the setup of the frontend testing infrastructure.

## Goal Description

Introduce an elegant scroll animation that increases the global footer's padding (making it larger) when the user scrolls to the absolute end of the page, and retracts it to the original size when the user scrolls up. The implementation will use React scroll listeners and Tailwind transitions, and will be built following Test-Driven Development (TDD) principles.

## Proposed Changes

### Test Infrastructure

To support TDD on the React frontend, we will install and configure Vitest and React Testing Library (RTL).

#### [MODIFY] [package.json](file:///data/projects/mtt-self-host-platform/frontend/package.json)
- Add the following `devDependencies`:
  - `vitest`: `^2.0.0`
  - `@testing-library/react`: `^14.0.0`
  - `@testing-library/jest-dom`: `^6.0.0`
  - `jsdom`: `^22.0.0`
- Add a new npm script: `"test": "vitest run"`

#### [MODIFY] [vite.config.ts](file:///data/projects/mtt-self-host-platform/frontend/vite.config.ts)
- Extend the configuration return object to include a `test` block targeting the `jsdom` environment:
  ```typescript
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
  ```

#### [NEW] [setup.ts](file:///data/projects/mtt-self-host-platform/frontend/src/test/setup.ts)
- Import `@testing-library/jest-dom` to make assertions available in tests.

---

### Component changes

#### [MODIFY] [Layout.tsx](file:///data/projects/mtt-self-host-platform/frontend/components/Layout.tsx)
- Add state: `const [isAtBottom, setIsAtBottom] = useState(false);`
- Introduce a scroll listener inside `useEffect` that checks:
  ```typescript
  const handleScroll = () => {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    // Set isAtBottom to true if scrolled to within 10px of the bottom
    setIsAtBottom(windowHeight + scrollTop >= documentHeight - 10);
  };
  ```
- Listen to the window `scroll` event, fire the handler once on mount, and clean up on unmount.
- Apply dynamic padding Tailwind classes and transition class on the wrapper `div` inside the footer:
  - Add `transition-all duration-500 ease-in-out`
  - Render `py-16` if `isAtBottom` is true, otherwise render `py-8`.

#### [NEW] [Layout.test.tsx](file:///data/projects/mtt-self-host-platform/frontend/components/Layout.test.tsx)
- Create a unit test to verify:
  1. The footer initially renders with the default `py-8` padding class.
  2. Mocking scroll coordinates at the bottom of the page and dispatching a `scroll` event updates the padding to `py-16`.
  3. Mocking scroll coordinates above the bottom and dispatching a `scroll` event retracts the padding back to `py-8`.

---

## Verification Plan

### Automated Tests
- Run `npm run test` in the `frontend` directory to execute frontend tests.
- Run `npm run build` in the `frontend` directory to ensure no compilation/type errors are introduced.

### Manual Verification
- Scroll down to the bottom of the homepage/about page in the browser and observe the smooth expansion of the footer.
- Scroll back up and verify the footer returns to its original size.
