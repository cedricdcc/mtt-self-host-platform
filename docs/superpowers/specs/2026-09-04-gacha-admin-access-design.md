# Gacha & Oceanarium: Superadmin, User Access Control & Admin Management Design

## 1. Overview
This specification expands the Marine Codex & Gacha Ecosystem preview on branch `feat/gacha` to support:
1. **Multi-Role Access**: Explicit access for Admins and Superadmins.
2. **Individual User Access Control**: Admin ability to grant or revoke access to the Gacha/Oceanarium for individual non-admin users.
3. **Admin Resource Management**: A dedicated administration page (`/admin/gacha`) to view user ecosystem states, toggle user access, and distribute dive tickets, food flakes, and super pellets.
4. **Conditional Navigation**: Dynamic navbar and mobile burger menu visibility strictly limited to users who have access.

---

## 2. Access Control Model

### 2.1 Universal Access Rule
A user is authorized to enter `/oceanarium` and invoke `/api/ecosystem/*` / `/api/gacha/*` endpoints if and only if:
$$\text{hasAccess} = (\text{is\_admin} = 1) \lor (\text{is\_superadmin} = \text{true}) \lor (\text{has\_gacha\_access} = 1)$$

* **Admins (`is_admin = 1` or `isAdmin: true`)**: Always have access. Cannot have their access revoked.
* **Superadmins (`is_superadmin = true` or `isSuperAdmin: true`)**: Always have access. Cannot have their access revoked.
* **Regular Users**: Default to `has_gacha_access = 0`. An admin or superadmin can toggle `has_gacha_access` to `1` or `0` via the admin management interface.

---

## 3. Database Architecture

### 3.1 Migration `038_gacha_user_access.sql`
Add `has_gacha_access` column to the `user_ecosystem` table:
```sql
ALTER TABLE user_ecosystem ADD COLUMN has_gacha_access INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_user_ecosystem_access ON user_ecosystem(has_gacha_access);
```
*(Also synchronized in `backend/src/db/migrations/schema.sql`)*.

---

## 4. Backend Architecture

### 4.1 Authentication & Session (`backend/src/routes/auth.routes.js`)
* In `GET /api/me`:
  * Fetch `has_gacha_access` from `user_ecosystem` for the logged-in user.
  * Populate `req.session.user.has_gacha_access`:
    ```javascript
    const isSuperAdmin = Boolean(req.session.user.is_superadmin);
    const isAdmin = Boolean(req.session.user.is_admin);
    const eco = db.prepare('SELECT has_gacha_access FROM user_ecosystem WHERE user_id = ?').get(req.session.user.id);
    req.session.user.has_gacha_access = Boolean(isSuperAdmin || isAdmin || (eco && eco.has_gacha_access === 1));
    ```
  * Send `has_gacha_access` in the response JSON.

### 4.2 Ecosystem Access Middleware (`backend/src/middleware/admin.middleware.js`)
* Rename/update authorization check in `admin.middleware.js`:
  ```javascript
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
    return res.status(403).json({ error: 'Oceanarium access is restricted.' });
  }
  ```
* Applied to all `/api/ecosystem/*` and `/api/gacha/*` endpoints.

### 4.3 Admin Gacha API Routes (`backend/src/routes/admin.routes.js` or `backend/src/routes/adminGacha.routes.js`)
* **`GET /api/admin/gacha/users`**:
  * Guard: `requireAdmin` (admins & superadmins).
  * Queries users joined with `user_ecosystem` and count of discovered fish from `user_fishes`:
    ```sql
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
    ORDER BY u.id ASC
    ```
* **`PATCH /api/admin/gacha/users/:id/access`**:
  * Guard: `requireAdmin`.
  * Body: `{ has_access: boolean }`.
  * Upserts `user_ecosystem` setting `has_gacha_access = 1` or `0`.
* **`POST /api/admin/gacha/users/:id/grant-resources`**:
  * Guard: `requireAdmin`.
  * Body: `{ tickets?: number, food_flakes?: number, super_pellets?: number, reset_water?: boolean }`.
  * Updates or initializes `user_ecosystem` row, adding specified amounts.

---

## 5. Frontend Architecture

### 5.1 Auth State & Types (`frontend/context/AuthContext.tsx`, `frontend/types.ts`)
* In `frontend/types.ts`:
  * Add `hasGachaAccess?: boolean` to `User` interface.
  * Add `AdminGachaUser` interface for the admin list.
* In `frontend/context/AuthContext.tsx`:
  * Set `hasGachaAccess: Boolean(data.has_gacha_access || data.is_admin || data.is_superadmin)`.
  * Ensure `isSuperAdmin` is accurately populated from `data.is_superadmin`.

### 5.2 Navigation & Visibility (`frontend/components/Layout.tsx`)
* Determine visibility:
  ```typescript
  const canAccessOceanarium = Boolean(user && (user.isAdmin || user.isSuperAdmin || user.hasGachaAccess));
  ```
* **Desktop Navbar**: Render `<Link to="/oceanarium">` with `Fish` icon only when `canAccessOceanarium` is `true`.
* **Mobile Burger Menu**: Render the Oceanarium menu item only when `canAccessOceanarium` is `true`.
* If `canAccessOceanarium` is `false`, the element is completely absent from the DOM.

### 5.3 Routing (`frontend/components/OceanariumRoute.tsx` & `frontend/App.tsx`)
* Create `OceanariumRoute.tsx`:
  * Protects `/oceanarium`.
  * If unauthenticated, redirects to `/login`.
  * If authenticated without access, redirects to `/dashboard` with warning toast.
* Add `/admin/gacha` to `frontend/App.tsx` wrapped in `<AdminRoute>`.

### 5.4 Admin Management Page (`frontend/pages/admin/AdminGacha.tsx`)
* **KPI Header**:
  * Card 1: Total Users with Access (count of admins + superadmins + users with `has_gacha_access = 1`).
  * Card 2: Total Tickets in Circulation.
  * Card 3: Total Marine Life Discovered.
* **Controls**:
  * Real-time search bar (by username).
  * Table with columns: User (avatar, name, role badge), Access Toggle (switch or button), Tickets (+1, +5, +10 quick buttons), Food / Pellets, Water Quality, and "Manage" button.
  * "Manage Resources" modal: numeric inputs to grant/adjust dive tickets, food flakes, super pellets, or restore water to 100%.
* **Admin Dashboard Entry**:
  * Card in `AdminDashboard.tsx` linking to `/admin/gacha`.

---

## 6. Verification Plan

### 6.1 Backend Tests
1. **`backend/tests/gacha_access_migration.test.js`**:
   * Runs migration `038_gacha_user_access.sql`.
   * Verifies column existence, default values, and index.
2. **`backend/tests/gacha_access_control.test.js`**:
   * Tests `/api/ecosystem`:
     * User without access -> `403`.
     * User granted `has_gacha_access = 1` -> `200`.
     * Admin user -> `200`.
     * Superadmin user -> `200`.
   * Tests `/api/admin/gacha/users` and `/grant-resources`:
     * Regular user -> `403`.
     * Admin -> `200`.
     * Resource grant modifies `dive_tickets`, `food_flakes`, `super_pellets`, `water_quality`.
3. **Full Regression Test**:
   * Run entire backend test suite (`npm test --prefix backend`).

### 6.2 Frontend Verification
1. **Frontend Tests**:
   * Unit test for `Layout.tsx` navbar rendering conditionally based on `isAdmin`, `isSuperAdmin`, and `hasGachaAccess`.
   * Unit test for `OceanariumRoute.tsx` redirect logic.
2. **Build Validation**:
   * Run `npm run build --prefix frontend` ensuring clean Vite compilation with 0 TypeScript/ESLint errors.
