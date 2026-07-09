# Design Spec: Dynamic Footer and Sponsorship Logo Expansion

This document specifies the implementation of a dynamic footer on the Marine Term Translations (MTT) self-hosted platform. The footer will dynamically expand when the user scrolls to the bottom of the page, increasing the visibility of the MTT brand and the EMODnet sponsorship logo.

## Goal Description

Make the footer and the sponsored EMODnet logo grow larger when the user has scrolled to the bottom of the page (i.e., when the footer is visible in the viewport), while maintaining a compact footer size when the user is reading or browsing the main content.

## Proposed Changes

### Component Changes

#### [MODIFY] [Layout.tsx](file:///data/projects/mtt-self-host-platform/frontend/components/Layout.tsx)
- **State and Ref**:
  - Add state `isFooterVisible` (boolean).
  - Add ref `footerRef` pointing to the `<footer>` element.
  - Setup an `IntersectionObserver` inside a `useEffect` hook to observe `footerRef`.
  - Set `isFooterVisible` to `true` when 80% (`threshold: 0.8`) of the footer is visible in the viewport.
- **Footer Styling Updates**:
  - Add `footerRef` to the `<footer>` tag.
  - Change the `div` wrapper inner padding: Transition padding from `py-8` to `py-14` when `isFooterVisible` is true.
  - Apply `transition-all duration-500 ease-in-out` on transition container.
- **MTT Brand Logo & Text**:
  - Image: Transition width and height from `w-5 h-5` to `w-7 h-7`. Add `hover:scale-105 active:scale-95 transition-transform duration-200` to the brand link wrapper.
  - Text: Transition font size class from `text-base` to `text-lg`.
- **EMODnet Sponsor Logo & Text**:
  - Separator wrapper `div`: Transition gap from `gap-2` to `gap-3` and margin/paddings as needed.
  - Label text: Transition text size from `text-xs` to `text-sm`.
  - Image wrapper link: Add `hover:scale-105 active:scale-95 transition-transform duration-200`.
  - Logo Image: Transition height class from `h-6` to `h-14`.

---

## Verification Plan

### Automated Checks
- Run TypeScript compilation checks on the frontend (`npm run build`).

### Manual Verification
- Start the development server.
- Navigate to a scrollable page (e.g. `/about` or `/browse`).
- Scroll to the bottom of the page and confirm:
  - The footer height expands smoothly.
  - The EMODnet logo and the MTT logo grow larger.
  - Hovering over the logos shows a subtle scale effect.
- Scroll back up and confirm the footer returns to its standard compact height.
