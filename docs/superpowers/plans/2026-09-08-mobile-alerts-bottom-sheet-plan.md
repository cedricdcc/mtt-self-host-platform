# Mobile Alerts Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the mobile alerts/notifications popover into an ergonomic, full-screen-bounded mobile bottom sheet that eliminates off-screen horizontal cutoff and provides one-handed touch interactions.

**Architecture:** On mobile (`isMobile={true}`), the alerts dropdown in `NotificationBell.tsx` renders a fixed bottom sheet (`fixed inset-x-0 bottom-0 max-h-[85vh]`) with a dimmed backdrop overlay (`fixed inset-0 bg-black/60`) and body scroll lock. Desktop view preserves the anchored dropdown popover (`absolute right-0 mt-2 w-96`).

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, Node.js.

## Global Constraints
- Exact component: `frontend/components/NotificationBell.tsx`.
- Must not overflow on mobile screens of any width (down to 320px).
- Desktop notification dropdown layout and behavior must remain completely intact.
- Must lock `document.body` scrolling when the mobile bottom sheet is open.
- Tapping the backdrop or the close button (`X`) must dismiss the sheet.

---

### Task 1: Mobile Alerts Bottom Sheet Component & Tests

**Files:**
- Modify: `frontend/components/NotificationBell.tsx`
- Test: `frontend/tests/mobile_alerts_bottom_sheet.test.js`

**Interfaces:**
- Consumes: `isMobile: boolean` prop in `NotificationBellProps`
- Produces: Responsive notification presentation (anchored dropdown for desktop, fixed bottom sheet with backdrop for mobile)

- [ ] **Step 1: Write the failing test for mobile bottom sheet structure**

```javascript
// frontend/tests/mobile_alerts_bottom_sheet.test.js
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(__dirname, '../components/NotificationBell.tsx');

assert.ok(fs.existsSync(componentPath), 'NotificationBell.tsx must exist');
const content = fs.readFileSync(componentPath, 'utf8');

// 1. Must use fixed inset-x-0 bottom-0 on mobile
assert.ok(
  content.includes('fixed inset-x-0 bottom-0') || content.includes('inset-x-0 bottom-0'),
  'NotificationBell must render a fixed bottom sheet anchored to the bottom of the viewport on mobile'
);

// 2. Must render a dimmed backdrop overlay on mobile
assert.ok(
  content.includes('fixed inset-0 bg-black') || content.includes('fixed inset-0'),
  'NotificationBell must render a backdrop overlay when mobile sheet is open'
);

// 3. Must not use relative translate-x-1/2 on mobile that causes right-side overflow
assert.ok(
  !content.includes('right-1/2 translate-x-1/2 mb-2 w-96'),
  'NotificationBell must not use right-1/2 translate-x-1/2 which offsets the popover off-screen'
);

// 4. Must include an explicit close button with X icon
assert.ok(
  content.includes('X') && content.includes('lucide-react'),
  'NotificationBell must import and render X icon for mobile dismissal'
);

// 5. Must handle body scroll locking when mobile sheet is open
assert.ok(
  content.includes('document.body.style.overflow'),
  'NotificationBell must lock document.body.style.overflow when open on mobile'
);

console.log('✓ Mobile Alerts Bottom Sheet structural tests passed!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/mobile_alerts_bottom_sheet.test.js`  
Expected: FAIL with assertion error (missing `fixed inset-x-0 bottom-0` or `X` icon).

- [ ] **Step 3: Implement Mobile Bottom Sheet in `NotificationBell.tsx`**

1. Import `X` from `lucide-react`:
```tsx
import { Bell, Check, X as CheckX, AlertCircle, Trash2, X } from 'lucide-react';
```

2. Add body scroll lock effect:
```tsx
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

3. Update mobile vs desktop rendering:
- When `isMobile`:
```tsx
{isOpen && (
  <>
    {/* Dimmed Backdrop */}
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
      aria-hidden="true"
    />

    {/* Bottom Sheet Modal */}
    <div 
      className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications and Invitations"
    >
      {/* Drag Handle */}
      <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">Notifications & Invitations</h3>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            aria-label="Close notifications"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Scrollable Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Invitations & Notifications list content */}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex-shrink-0">
        <button
          onClick={() => {
            setIsOpen(false);
            navigate('/notifications');
          }}
          className="w-full py-2.5 px-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors"
        >
          View all notifications
        </button>
      </div>
    </div>
  </>
)}
```

- When `!isMobile`: preserve the existing desktop `absolute right-0 mt-2 w-96 ...` popover.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/mobile_alerts_bottom_sheet.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/NotificationBell.tsx frontend/tests/mobile_alerts_bottom_sheet.test.js
git commit -m "feat(ui): convert mobile alerts to native bottom sheet with backdrop"
```

---

### Task 2: Full System Verification & Regression Testing

**Files:**
- Test all backend and frontend test suites

- [ ] **Step 1: Run backend test suite**
Run: `npm test --prefix backend`  
Expected: PASS (0 failures).

- [ ] **Step 2: Run frontend test suite**
Run: `node -e "const fs = require('fs'), cp = require('child_process'), path = require('path'); const files = fs.readdirSync('frontend/tests').filter(f => f.endsWith('.test.js')); let failed = 0; files.forEach(f => { try { cp.execSync('node ' + path.join('frontend/tests', f), { stdio: 'inherit' }); } catch (e) { console.error('FAILED:', f); failed++; } }); console.log('Total:', files.length, 'Failed:', failed); process.exit(failed > 0 ? 1 : 0);"`  
Expected: Total: 44, Failed: 0.

- [ ] **Step 3: Run frontend production build**
Run: `npm run build --prefix frontend`  
Expected: Vite build succeeds with exit code 0.

- [ ] **Step 4: Final commit**
```bash
git commit --allow-empty -m "chore: verify mobile alerts bottom sheet across test suites"
```
