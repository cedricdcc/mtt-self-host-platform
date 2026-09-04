# Gacha & Oceanarium: Superadmin, User Access Control & Admin Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Gacha Ecosystem and Oceanarium with Superadmin access, per-user access control toggled by admins, a dedicated `/admin/gacha` resource management page, and dynamic navbar visibility hiding the feature from unauthorized users.

**Architecture:** A new database column `has_gacha_access` in `user_ecosystem` tracks individual permissions. Access is granted if `is_admin = 1`, `is_superadmin = true`, or `has_gacha_access = 1`. The session and `/api/me` endpoint expose `has_gacha_access` to the client. Frontend navigation in `Layout.tsx` dynamically hides the link for users without access. An admin page `/admin/gacha` provides user search, access toggling, and instant ticket/food grant controls.

**Tech Stack:** Node.js (Express, Better-SQLite3), React 18, TypeScript, Tailwind CSS, Lucide React icons, React Router DOM, Vite.

## Global Constraints
- Oceanarium and Gacha APIs are restricted to users with `is_admin = 1`, `is_superadmin = true`, or `has_gacha_access = 1`.
- Regular users without access must receive `403 Forbidden` from `/api/ecosystem/*` and `/api/gacha/*`.
- When a user does NOT have access, Oceanarium must NOT appear in desktop navigation, mobile burger menu, or anywhere in the public view.
- Admins and Superadmins always have access and cannot have their access revoked.
- All code changes must be accompanied by automated tests and pass both backend tests and `npm run build --prefix frontend`.

---

### Task 1: Database Migration `038_gacha_user_access.sql` & Schema Sync

**Files:**
- Create: `backend/src/db/migrations/038_gacha_user_access.sql`
- Modify: `backend/src/db/migrations/schema.sql:840-855`
- Test: `backend/tests/gacha_access_migration.test.js`

**Interfaces:**
- Produces: Column `has_gacha_access INTEGER NOT NULL DEFAULT 0` in `user_ecosystem`.

- [ ] **Step 1: Write the failing migration test**

Create `backend/tests/gacha_access_migration.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_gacha_access_migration.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  const columns = db.prepare("PRAGMA table_info(user_ecosystem)").all();
  const hasAccessCol = columns.find(c => c.name === 'has_gacha_access');
  assert.ok(hasAccessCol, 'Column has_gacha_access should exist in user_ecosystem');
  assert.strictEqual(hasAccessCol.dflt_value, '0', 'Default value should be 0');

  // Insert user ecosystem without specifying has_gacha_access
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'tester', 0)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id) VALUES (1)").run();
  const row = db.prepare("SELECT has_gacha_access FROM user_ecosystem WHERE user_id = 1").get();
  assert.strictEqual(row.has_gacha_access, 0, 'has_gacha_access should default to 0');

  console.log('✓ Migration 038 test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/gacha_access_migration.test.js`
Expected: FAIL with "Column has_gacha_access should exist in user_ecosystem"

- [ ] **Step 3: Create migration and update schema.sql**

Create `backend/src/db/migrations/038_gacha_user_access.sql`:
```sql
-- Migration 038: Add user access control flag to user_ecosystem
ALTER TABLE user_ecosystem ADD COLUMN has_gacha_access INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_user_ecosystem_access ON user_ecosystem(has_gacha_access);
```

Update `backend/src/db/migrations/schema.sql` inside the `CREATE TABLE user_ecosystem` block:
```sql
    has_gacha_access INTEGER NOT NULL DEFAULT 0,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/gacha_access_migration.test.js`
Expected: PASS with "✓ Migration 038 test passed"

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/migrations/038_gacha_user_access.sql backend/src/db/migrations/schema.sql backend/tests/gacha_access_migration.test.js
git commit -m "feat(db): add migration 038 for gacha user access control"
```

---

### Task 2: Backend Access Middleware & Auth/Session Enrichment

**Files:**
- Modify: `backend/src/middleware/admin.middleware.js`
- Modify: `backend/src/routes/auth.routes.js:290-315`
- Modify: `backend/src/routes/ecosystem.routes.js`
- Modify: `backend/src/routes/gacha.routes.js`
- Test: `backend/tests/gacha_access_control.test.js`

**Interfaces:**
- Produces: `requireEcosystemAccess(req, res, next)` middleware allowing admins, superadmins, and users with `has_gacha_access = 1`.
- Exposes: `has_gacha_access: boolean` on `GET /api/me`.

- [ ] **Step 1: Write the failing access control test**

Create `backend/tests/gacha_access_control.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

const testDbPath = path.join(__dirname, 'test_gacha_access_control.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

// Mock session helper
let mockSessionUser = null;
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = mockSessionUser ? { user: mockSessionUser } : {};
  next();
});

const ecosystemRoutes = require('../src/routes/ecosystem.routes');
const gachaRoutes = require('../src/routes/gacha.routes');
app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/gacha', gachaRoutes);

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Create test users:
  // 1: regular user (no access)
  // 2: regular user (with access)
  // 3: admin user
  // 4: superadmin user
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'regular_no_access', 0)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (1, 0)").run();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'regular_with_access', 0)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (2, 1)").run();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (3, 'admin_user', 1)").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (3, 0)").run();

  db.prepare("INSERT INTO users (id, username, is_admin, extra) VALUES (4, 'super_user', 0, '{\"is_superadmin\":true}')").run();
  db.prepare("INSERT INTO user_ecosystem (user_id, has_gacha_access) VALUES (4, 0)").run();

  // 1. Unauthenticated -> 401
  mockSessionUser = null;
  let res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 401, 'Unauthenticated request should be 401');

  // 2. Regular user without access -> 403
  mockSessionUser = { id: 1, username: 'regular_no_access', is_admin: 0 };
  res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 403, 'User without access should be 403');

  // 3. Regular user with access -> 200
  mockSessionUser = { id: 2, username: 'regular_with_access', is_admin: 0 };
  res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 200, 'User with access should be 200');

  // 4. Admin user -> 200
  mockSessionUser = { id: 3, username: 'admin_user', is_admin: 1 };
  res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 200, 'Admin should be 200');

  // 5. Superadmin user -> 200
  mockSessionUser = { id: 4, username: 'super_user', is_admin: 0, is_superadmin: true };
  res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 200, 'Superadmin should be 200');

  console.log('✓ Gacha Access Control test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/gacha_access_control.test.js`
Expected: FAIL because `regular_with_access` and `super_user` are rejected by current `requireAdmin`.

- [ ] **Step 3: Update `backend/src/middleware/admin.middleware.js` and routes**

Update `backend/src/middleware/admin.middleware.js`:
```javascript
// Access middleware for Oceanarium & Gacha preview

const { requireAuth } = require('./admin');
const { getDatabase } = require('../db/database');

/**
 * Middleware to require ecosystem access:
 * Allowed if: is_admin === 1 OR is_superadmin === true OR user_ecosystem.has_gacha_access === 1
 */
function requireEcosystemAccess(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.session.user;
  const isSuperAdmin = Boolean(user.is_superadmin);
  const isAdmin = Boolean(user.is_admin || user.isAdmin);

  if (isSuperAdmin || isAdmin) {
    return next();
  }

  const db = getDatabase();
  const eco = db.prepare('SELECT has_gacha_access FROM user_ecosystem WHERE user_id = ?').get(user.id);
  if (eco && eco.has_gacha_access === 1) {
    return next();
  }

  return res.status(403).json({ error: 'Oceanarium access is restricted. Contact an administrator for access.' });
}

module.exports = {
  requireAuth,
  requireEcosystemAccess,
  requireAdmin: requireEcosystemAccess // Backward-compatible alias for existing imports
};
```

Update `backend/src/routes/ecosystem.routes.js`:
Use `requireEcosystemAccess` for all routes.

Update `backend/src/routes/gacha.routes.js`:
Use `requireEcosystemAccess` for all routes.

Update `backend/src/routes/auth.routes.js` inside `router.get("/me", ...)`:
```javascript
    const db = getDatabase();
    try {
      const user = db.prepare('SELECT extra, is_admin FROM users WHERE username = ?').get(req.session.user.username);
      if (user && user.extra) {
        const extra = JSON.parse(user.extra);
        req.session.user.is_banned = extra.is_banned || false;
        req.session.user.ban_reason = extra.ban_reason || '';
        req.session.user.banned_at = extra.banned_at || '';
        req.session.user.is_superadmin = extra.is_superadmin || false;
      }
      const isSuperAdmin = Boolean(req.session.user.is_superadmin);
      const isAdmin = Boolean(req.session.user.is_admin || (user && user.is_admin));
      const eco = db.prepare('SELECT has_gacha_access FROM user_ecosystem WHERE user_id = ?').get(req.session.user.id);
      req.session.user.has_gacha_access = Boolean(isSuperAdmin || isAdmin || (eco && eco.has_gacha_access === 1));
    } catch (err) {
      console.error('[Me] Error checking permissions/ecosystem access:', err);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/gacha_access_control.test.js`
Expected: PASS with "✓ Gacha Access Control test passed"

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/admin.middleware.js backend/src/routes/ecosystem.routes.js backend/src/routes/gacha.routes.js backend/src/routes/auth.routes.js backend/tests/gacha_access_control.test.js
git commit -m "feat(auth): implement requireEcosystemAccess middleware and enrich /api/me with has_gacha_access"
```

---

### Task 3: Backend Admin Gacha Management API

**Files:**
- Create: `backend/src/routes/adminGacha.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/admin_gacha_api.test.js`

**Interfaces:**
- `GET /api/admin/gacha/users`: Returns list of users with ecosystem details and access flags.
- `PATCH /api/admin/gacha/users/:id/access`: Updates `has_gacha_access`.
- `POST /api/admin/gacha/users/:id/grant-resources`: Grants tickets, flakes, super pellets, or resets water quality.

- [ ] **Step 1: Write the failing Admin Gacha API test**

Create `backend/tests/admin_gacha_api.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

const testDbPath = path.join(__dirname, 'test_admin_gacha_api.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

let mockSessionUser = null;
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = mockSessionUser ? { user: mockSessionUser } : {};
  next();
});

const adminGachaRoutes = require('../src/routes/adminGacha.routes');
app.use('/api', adminGachaRoutes);

async function run() {
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'normal_user', 0)").run();
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'admin_user', 1)").run();

  // 1. Regular user trying to access admin endpoints -> 403
  mockSessionUser = { id: 1, username: 'normal_user', is_admin: 0 };
  let res = await request(app).get('/api/admin/gacha/users');
  assert.strictEqual(res.status, 403, 'Normal user must receive 403 on admin gacha');

  // 2. Admin access -> 200
  mockSessionUser = { id: 2, username: 'admin_user', is_admin: 1 };
  res = await request(app).get('/api/admin/gacha/users');
  assert.strictEqual(res.status, 200, 'Admin should receive 200');
  assert.ok(Array.isArray(res.body.users), 'Response should contain users array');
  const target = res.body.users.find(u => u.id === 1);
  assert.ok(target, 'normal_user should be listed');
  assert.strictEqual(target.has_gacha_access, 0);

  // 3. Admin grants access to normal user
  res = await request(app)
    .patch('/api/admin/gacha/users/1/access')
    .send({ has_access: true });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.has_gacha_access, 1);

  // 4. Admin grants 10 tickets and 5 super pellets to normal user
  res = await request(app)
    .post('/api/admin/gacha/users/1/grant-resources')
    .send({ tickets: 10, super_pellets: 5 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ecosystem.dive_tickets, 10);
  assert.strictEqual(res.body.ecosystem.super_pellets, 5);

  // 5. Admin revokes access
  res = await request(app)
    .patch('/api/admin/gacha/users/1/access')
    .send({ has_access: false });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.has_gacha_access, 0);

  console.log('✓ Admin Gacha API test passed');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/admin_gacha_api.test.js`
Expected: FAIL with "Cannot find module '../src/routes/adminGacha.routes'"

- [ ] **Step 3: Implement `backend/src/routes/adminGacha.routes.js` and mount in `backend/src/app.js`**

Create `backend/src/routes/adminGacha.routes.js`:
```javascript
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin } = require('../middleware/admin');
const { apiLimiter } = require('../middleware/rateLimit');

/**
 * GET /api/admin/gacha/users
 * Returns list of users with ecosystem details and access states
 */
router.get('/admin/gacha/users', requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const search = req.query.q ? `%${req.query.q.trim()}%` : null;

    let query = `
      SELECT 
        u.id,
        u.username,
        u.is_admin,
        u.extra,
        COALESCE(e.has_gacha_access, 0) as has_gacha_access,
        COALESCE(e.dive_tickets, 0) as dive_tickets,
        COALESCE(e.food_flakes, 0) as food_flakes,
        COALESCE(e.super_pellets, 0) as super_pellets,
        COALESCE(e.water_quality, 100) as water_quality,
        (SELECT COUNT(*) FROM user_fishes WHERE user_id = u.id) as fishes_count
      FROM users u
      LEFT JOIN user_ecosystem e ON u.id = e.user_id
    `;
    const params = [];

    if (search) {
      query += ` WHERE u.username LIKE ? `;
      params.push(search);
    }

    query += ` ORDER BY u.id ASC LIMIT 200 `;

    const rows = db.prepare(query).all(...params);

    const users = rows.map(r => {
      let isSuperAdmin = false;
      try {
        if (r.extra) {
          const extra = JSON.parse(r.extra);
          isSuperAdmin = Boolean(extra.is_superadmin);
        }
      } catch (e) {}

      return {
        id: r.id,
        username: r.username,
        is_admin: r.is_admin,
        is_superadmin: isSuperAdmin,
        has_gacha_access: r.has_gacha_access,
        dive_tickets: r.dive_tickets,
        food_flakes: r.food_flakes,
        super_pellets: r.super_pellets,
        water_quality: r.water_quality,
        fishes_count: r.fishes_count
      };
    });

    const summary = {
      total_users_with_access: db.prepare(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        LEFT JOIN user_ecosystem e ON u.id = e.user_id
        WHERE u.is_admin = 1 OR e.has_gacha_access = 1
      `).get().count,
      total_tickets_in_circulation: db.prepare(`
        SELECT COALESCE(SUM(dive_tickets), 0) as total FROM user_ecosystem
      `).get().total,
      total_fishes_caught: db.prepare(`
        SELECT COUNT(*) as total FROM user_fishes
      `).get().total
    };

    res.json({ users, summary });
  } catch (err) {
    console.error('[Admin Gacha] Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch gacha user list' });
  }
});

/**
 * PATCH /api/admin/gacha/users/:id/access
 * Toggles or sets user access to the Gacha / Oceanarium
 */
router.patch('/admin/gacha/users/:id/access', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { has_access } = req.body;
    const accessVal = has_access ? 1 : 0;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Upsert into user_ecosystem
    db.prepare(`
      INSERT INTO user_ecosystem (user_id, has_gacha_access)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET has_gacha_access = excluded.has_gacha_access
    `).run(userId, accessVal);

    res.json({ ok: true, userId, has_gacha_access: accessVal });
  } catch (err) {
    console.error('[Admin Gacha] Error updating access:', err);
    res.status(500).json({ error: 'Failed to update user access' });
  }
});

/**
 * POST /api/admin/gacha/users/:id/grant-resources
 * Grants tickets, food flakes, super pellets, or resets water quality
 */
router.post('/admin/gacha/users/:id/grant-resources', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { tickets = 0, food_flakes = 0, super_pellets = 0, reset_water = false } = req.body;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure ecosystem exists
    db.prepare(`
      INSERT OR IGNORE INTO user_ecosystem (user_id) VALUES (?)
    `).run(userId);

    let query = `
      UPDATE user_ecosystem
      SET dive_tickets = MAX(0, dive_tickets + ?),
          food_flakes = MAX(0, food_flakes + ?),
          super_pellets = MAX(0, super_pellets + ?)
    `;
    const params = [parseInt(tickets, 10) || 0, parseInt(food_flakes, 10) || 0, parseInt(super_pellets, 10) || 0];

    if (reset_water) {
      query += `, water_quality = 100 `;
    }

    query += ` WHERE user_id = ? `;
    params.push(userId);

    db.prepare(query).run(...params);

    const updated = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
    res.json({ ok: true, ecosystem: updated });
  } catch (err) {
    console.error('[Admin Gacha] Error granting resources:', err);
    res.status(500).json({ error: 'Failed to grant resources' });
  }
});

module.exports = router;
```

Update `backend/src/app.js`:
Mount `const adminGachaRoutes = require('./routes/adminGacha.routes');` with `app.use('/api', adminGachaRoutes);`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/admin_gacha_api.test.js`
Expected: PASS with "✓ Admin Gacha API test passed"

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/adminGacha.routes.js backend/src/app.js backend/tests/admin_gacha_api.test.js
git commit -m "feat(api): implement admin gacha management endpoints"
```

---

### Task 4: Frontend Auth State, Types & OceanariumRoute Guard

**Files:**
- Modify: `frontend/types.ts:16-30, 240-270`
- Modify: `frontend/context/AuthContext.tsx:85-115`
- Create: `frontend/components/OceanariumRoute.tsx`
- Modify: `frontend/App.tsx:50-55, 260-270`
- Test: `frontend/tests/oceanarium_route_guard.test.js`

**Interfaces:**
- `hasGachaAccess?: boolean` on `User` in `frontend/types.ts`.
- `AdminGachaUser` and `AdminGachaResponse` in `frontend/types.ts`.
- `<OceanariumRoute>` component wrapping `/oceanarium`.

- [ ] **Step 1: Write the failing OceanariumRoute test**

Create `frontend/tests/oceanarium_route_guard.test.js`:
```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const oceanariumRoutePath = path.join(__dirname, '../components/OceanariumRoute.tsx');
assert.ok(fs.existsSync(oceanariumRoutePath), 'OceanariumRoute.tsx should exist');

const content = fs.readFileSync(oceanariumRoutePath, 'utf8');
assert.ok(content.includes('hasGachaAccess'), 'Should check hasGachaAccess');
assert.ok(content.includes('isAdmin'), 'Should check isAdmin');
assert.ok(content.includes('isSuperAdmin'), 'Should check isSuperAdmin');

console.log('✓ OceanariumRoute guard test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_route_guard.test.js`
Expected: FAIL with "OceanariumRoute.tsx should exist"

- [ ] **Step 3: Update types, AuthContext, create OceanariumRoute, and update App.tsx**

Update `frontend/types.ts`:
1. In `interface User`:
   ```typescript
   hasGachaAccess?: boolean;
   ```
2. Add Admin Gacha types:
   ```typescript
   export interface AdminGachaUser {
     id: number;
     username: string;
     is_admin: number;
     is_superadmin: boolean;
     has_gacha_access: number;
     dive_tickets: number;
     food_flakes: number;
     super_pellets: number;
     water_quality: number;
     fishes_count: number;
   }

   export interface AdminGachaSummary {
     total_users_with_access: number;
     total_tickets_in_circulation: number;
     total_fishes_caught: number;
   }

   export interface AdminGachaResponse {
     users: AdminGachaUser[];
     summary: AdminGachaSummary;
   }
   ```

Update `frontend/context/AuthContext.tsx`:
```typescript
isAdmin: Boolean(data.is_admin),
isSuperAdmin: Boolean(data.is_superadmin),
hasGachaAccess: Boolean(data.has_gacha_access || data.is_admin || data.is_superadmin),
```

Create `frontend/components/OceanariumRoute.tsx`:
```tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Waves } from 'lucide-react';

interface OceanariumRouteProps {
  children: React.ReactNode;
}

const OceanariumRoute: React.FC<OceanariumRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasAccess = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.hasGachaAccess);

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="p-4 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full mb-4">
          <Waves size={48} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Oceanarium Access Restricted</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
          The Oceanarium and Gacha Expedition are currently in private preview. Contact an administrator to request access.
        </p>
        <Navigate to="/dashboard" replace />
      </div>
    );
  }

  return <>{children}</>;
};

export default OceanariumRoute;
```

Update `frontend/App.tsx`:
1. Import `OceanariumRoute` and `AdminGacha` (lazy or direct).
2. Protect `/oceanarium` with `<OceanariumRoute>`.
3. Add route `/admin/gacha` protected with `<AdminRoute>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_route_guard.test.js`
Expected: PASS with "✓ OceanariumRoute guard test passed"

- [ ] **Step 5: Commit**

```bash
git add frontend/types.ts frontend/context/AuthContext.tsx frontend/components/OceanariumRoute.tsx frontend/App.tsx frontend/tests/oceanarium_route_guard.test.js
git commit -m "feat(frontend): add OceanariumRoute guard and user access state mapping"
```

---

### Task 5: Dynamic Navbar & Mobile Burger Visibility

**Files:**
- Modify: `frontend/components/Layout.tsx:165-176, 250-260`
- Test: `frontend/tests/oceanarium_navbar_visibility.test.js`

**Interfaces:**
- Oceanarium nav link is rendered only if `canAccessOceanarium = Boolean(user && (user.isAdmin || user.isSuperAdmin || user.hasGachaAccess))`.

- [ ] **Step 1: Write the failing navbar visibility test**

Create `frontend/tests/oceanarium_navbar_visibility.test.js`:
```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, '../components/Layout.tsx');
const content = fs.readFileSync(layoutPath, 'utf8');

// Ensure canAccessOceanarium condition exists and checks all 3 criteria
assert.ok(
  content.includes('canAccessOceanarium'),
  'Layout.tsx should define canAccessOceanarium'
);
assert.ok(
  content.includes('user.hasGachaAccess') || content.includes('hasGachaAccess'),
  'Layout.tsx should check hasGachaAccess'
);
assert.ok(
  content.includes('user.isSuperAdmin') || content.includes('isSuperAdmin'),
  'Layout.tsx should check isSuperAdmin'
);

console.log('✓ Oceanarium Navbar visibility test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_navbar_visibility.test.js`
Expected: FAIL because `Layout.tsx` does not yet have `canAccessOceanarium`.

- [ ] **Step 3: Update `frontend/components/Layout.tsx`**

In `frontend/components/Layout.tsx`:
Add helper check before render:
```typescript
const canAccessOceanarium = Boolean(user && (user.isAdmin || user.isSuperAdmin || user.hasGachaAccess));
```

Update desktop navigation (lines ~166-175):
```tsx
{/* Admin Link */}
{(user?.isAdmin || user?.isSuperAdmin) && (
  <Link to="/admin" className={`${isActive('/admin')} flex items-center gap-1`}>
     <ShieldCheck size={16} /> Admin
  </Link>
)}

{/* Oceanarium Link */}
{canAccessOceanarium && (
  <Link to="/oceanarium" className={`${isActive('/oceanarium')} flex items-center gap-1.5`}>
     <Fish size={16} className="text-cyan-500" /> Oceanarium
  </Link>
)}
```

Update mobile burger menu (lines ~250-260):
```tsx
{canAccessOceanarium && (
  <Link 
    to="/oceanarium" 
    className="block px-4 py-2.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 font-medium"
  >
    <Fish size={16} />
    <span>Oceanarium</span>
  </Link>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_navbar_visibility.test.js`
Expected: PASS with "✓ Oceanarium Navbar visibility test passed"

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Layout.tsx frontend/tests/oceanarium_navbar_visibility.test.js
git commit -m "feat(nav): dynamically show oceanarium link strictly when user has access"
```

---

### Task 6: Frontend Admin Gacha Page & Admin Dashboard Card

**Files:**
- Create: `frontend/pages/admin/AdminGacha.tsx`
- Modify: `frontend/pages/AdminDashboard.tsx:10-25, 570-595`
- Test: `frontend/tests/admin_gacha_page.test.js`

**Interfaces:**
- Page at `/admin/gacha` to search users, toggle access, and grant tickets/food flakes/super pellets.
- New card in `AdminDashboard.tsx` linking to `/admin/gacha`.

- [ ] **Step 1: Write the failing Admin Gacha page test**

Create `frontend/tests/admin_gacha_page.test.js`:
```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminGachaPath = path.join(__dirname, '../pages/admin/AdminGacha.tsx');
assert.ok(fs.existsSync(adminGachaPath), 'AdminGacha.tsx should exist');

const content = fs.readFileSync(adminGachaPath, 'utf8');
assert.ok(content.includes('/admin/gacha/users'), 'Should call admin gacha users endpoint');
assert.ok(content.includes('grant-resources'), 'Should support grant-resources API');
assert.ok(content.includes('has_access'), 'Should support toggling access');

const adminDashboardPath = path.join(__dirname, '../pages/AdminDashboard.tsx');
const dashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
assert.ok(dashboardContent.includes('/admin/gacha'), 'AdminDashboard should link to /admin/gacha');

console.log('✓ Admin Gacha Page & Dashboard Link test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/admin_gacha_page.test.js`
Expected: FAIL with "AdminGacha.tsx should exist"

- [ ] **Step 3: Implement `frontend/pages/admin/AdminGacha.tsx` and update `AdminDashboard.tsx`**

Create `frontend/pages/admin/AdminGacha.tsx`:
- Header with back arrow to `/admin`, Title "Oceanarium & Gacha Management".
- Summary KPI badges: Total Users with Access, Total Dive Tickets, Total Fish Discovered.
- Search input with debounce/immediate filter.
- Responsive table with User (avatar, username, superadmin/admin badge), Access status (toggle switch or button), Tickets (+1, +5, +10 quick buttons), Food/Pellets, Water Quality, and "Manage" button.
- Modal to grant custom tickets, food flakes, super pellets, and full water quality restoration.
- Mobile friendly card layout on small screens.

Update `frontend/pages/AdminDashboard.tsx`:
Add card in the grid:
```tsx
{/* Oceanarium & Gacha Management */}
<div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 transition-all shadow-sm">
  <div className="flex items-center justify-between mb-4">
    <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl">
      <Fish size={24} />
    </div>
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
      Preview
    </span>
  </div>
  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Oceanarium & Gacha</h3>
  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
    Manage user preview access, distribute dive tickets, and inspect ecosystem status.
  </p>
  <Link to="/admin/gacha" className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors">
    Manage Ecosystem &rarr;
  </Link>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/admin_gacha_page.test.js`
Expected: PASS with "✓ Admin Gacha Page & Dashboard Link test passed"

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/admin/AdminGacha.tsx frontend/pages/AdminDashboard.tsx frontend/tests/admin_gacha_page.test.js
git commit -m "feat(admin): add AdminGacha management page and dashboard card"
```

---

### Task 7: Full End-to-End Test Suite & Build Verification

**Files:**
- Create: `backend/tests/gacha_admin_access_e2e.test.js`

**Interfaces:**
- Verifies complete flow: user registration -> regular user denied access -> admin grants access via API -> user accesses oceanarium -> admin grants 5 tickets -> user spends ticket on slot pull -> admin revokes access -> user denied access again.

- [ ] **Step 1: Write and run end-to-end test**

Create `backend/tests/gacha_admin_access_e2e.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

const testDbPath = path.join(__dirname, 'test_gacha_admin_access_e2e.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

let mockSessionUser = null;
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = mockSessionUser ? { user: mockSessionUser } : {};
  next();
});

const ecosystemRoutes = require('../src/routes/ecosystem.routes');
const gachaRoutes = require('../src/routes/gacha.routes');
const adminGachaRoutes = require('../src/routes/adminGacha.routes');

app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/gacha', gachaRoutes);
app.use('/api', adminGachaRoutes);

async function run() {
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'diver_dan', 0)").run();
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'admiral_admin', 1)").run();

  // 1. diver_dan has no access initially
  mockSessionUser = { id: 1, username: 'diver_dan', is_admin: 0 };
  let res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 403, 'Should be 403 forbidden without access');

  // 2. admiral_admin lists users and grants access to diver_dan
  mockSessionUser = { id: 2, username: 'admiral_admin', is_admin: 1 };
  res = await request(app).patch('/api/admin/gacha/users/1/access').send({ has_access: true });
  assert.strictEqual(res.status, 200);

  // 3. admiral_admin grants 5 tickets to diver_dan
  res = await request(app).post('/api/admin/gacha/users/1/grant-resources').send({ tickets: 5 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ecosystem.dive_tickets, 5);

  // 4. diver_dan can now access ecosystem and sees 5 tickets
  mockSessionUser = { id: 1, username: 'diver_dan', is_admin: 0 };
  res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ecosystem.dive_tickets, 5);

  // 5. diver_dan performs a gacha pull
  res = await request(app).post('/api/gacha/pull').send({ count: 1 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.results.length, 1);
  assert.strictEqual(res.body.tickets_remaining, 4);

  // 6. admiral_admin revokes access from diver_dan
  mockSessionUser = { id: 2, username: 'admiral_admin', is_admin: 1 };
  res = await request(app).patch('/api/admin/gacha/users/1/access').send({ has_access: false });
  assert.strictEqual(res.status, 200);

  // 7. diver_dan is now rejected again
  mockSessionUser = { id: 1, username: 'diver_dan', is_admin: 0 };
  res = await request(app).get('/api/ecosystem');
  assert.strictEqual(res.status, 403);

  console.log('✓ Full Gacha Admin Access E2E test passed successfully!');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
```

Run: `node backend/tests/gacha_admin_access_e2e.test.js`
Expected: PASS with "✓ Full Gacha Admin Access E2E test passed successfully!"

- [ ] **Step 2: Run full backend test suite**

Run: `npm test --prefix backend`
Expected: PASS (all tests passing)

- [ ] **Step 3: Run frontend production build**

Run: `npm run build --prefix frontend`
Expected: PASS (Vite build succeeds with 0 errors)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/gacha_admin_access_e2e.test.js
git commit -m "test(e2e): add end-to-end tests for gacha admin access control lifecycle"
```
