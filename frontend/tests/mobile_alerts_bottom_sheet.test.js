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
