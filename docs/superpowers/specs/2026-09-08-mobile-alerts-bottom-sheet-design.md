# Mobile Alerts Bottom Sheet Specification & Design

## 1. Problem Statement
In `frontend/components/NotificationBell.tsx`, the mobile notification popover is positioned with:
```css
absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-96 max-w-[calc(100vw-2rem)]
```
Because the mobile "Alerts" bell item is located at the far right edge of the bottom navigation bar (`BottomNav.tsx`), this relative horizontal translation causes roughly half of the 384px-wide dropdown to overflow off the right edge of mobile screens. Users cannot comfortably read notifications or interact with action buttons (e.g. Accept/Decline invitations, Mark all as read, or View all notifications).

## 2. Goals & Success Criteria
- **Zero Horizontal Overflow:** Notifications on mobile must never overflow or render off-screen regardless of device width (including 320px, 375px, 390px, and 414px viewports).
- **Native Mobile Bottom Sheet:** On mobile (`isMobile={true}`), clicking Alerts opens an ergonomic slide-up sheet anchored to the bottom of the screen (`fixed inset-x-0 bottom-0`) with a dimmed backdrop.
- **Easy Dismissal:** Can be dismissed via tapping the backdrop overlay, tapping a dedicated `X` close button in the header, or tapping any notification / footer link that navigates away.
- **Background Scroll Locking:** While the sheet is open on mobile, page background scrolling is disabled to prevent disorienting background scroll drift.
- **Desktop Parity & Isolation:** Desktop notifications continue to use the standard anchored dropdown popover (`absolute right-0 mt-2 w-96`) without regression.

## 3. Architecture & Visual Specifications

### 3.1 Mobile Bottom Sheet Layout
When `isMobile` is true and `isOpen` is true:
- **Backdrop Overlay:**
  - Classes: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity`
  - Action: `onClick={() => setIsOpen(false)}`
- **Sheet Surface:**
  - Classes: `fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-200`
- **Top Drag Handle:**
  - Visual affordance: `<div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />`
- **Header:**
  - Flex layout: `flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800`
  - Left: Title `Notifications & Invitations` with badge count.
  - Right: "Mark all as read" button (if unread > 0) + close button (`X` icon, `p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500`).
- **Scrollable Notification Area:**
  - Classes: `flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-800`
  - Contains **Invitations** and **Notifications** sections matching the existing item formats.
- **Footer:**
  - Classes: `p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80`
  - "View all notifications" link that closes the modal on click.

### 3.2 Body Scroll Lock
```typescript
useEffect(() => {
  if (isMobile && isOpen) {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }
}, [isMobile, isOpen]);
```

### 3.3 Desktop Popover
When `isMobile` is false:
- Renders unchanged within the existing desktop container with `absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)]`.

## 4. Testing & Verification Strategy
- **Unit & Structural Test (`frontend/tests/mobile_alerts_bottom_sheet.test.js`):**
  - Verify `NotificationBell.tsx` renders a `fixed inset-x-0 bottom-0` sheet when `isMobile` is true.
  - Verify presence of backdrop overlay (`fixed inset-0 bg-black/60`).
  - Verify presence of mobile close button (`X` icon).
  - Verify body scroll lock handling in `useEffect`.
  - Verify absence of off-screen offset classes like `right-1/2 translate-x-1/2` when `isMobile` is true.
- **Regression Testing:**
  - Run all frontend test suites (`node -e ...`) to ensure no regressions in existing navigation or notification components.
  - Run frontend production build (`npm run build --prefix frontend`).
