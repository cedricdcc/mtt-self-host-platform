# Oceanarium & Gacha Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, responsive gamified Marine Ecosystem and Dive Station (Gacha) system where users earn tickets and food through translation activities to pull stylized marine creatures into an interactive living aquarium, with decay/feeding mechanics, strictly restricted to admins during staging.

**Architecture:** A SQLite-backed data tier (`gacha_species`, `user_ecosystem`, `user_fishes`, `gacha_pull_logs`) coupled with an Express backend service that handles lazy water decay, feeding, and weighted gacha rolls with pity counters. The frontend features a 60 FPS HTML5 2D interactive canvas simulation with vertical depth strata (Sunlit, Twilight, Abyssal), realistic fish schooling AI, tactile food dropping physics, an atmospheric bathyscaphe gacha pull sequence, and a Marine Codex collection gallery, fully optimized for both desktop and mobile touch devices.

**Tech Stack:** Node.js 20, Express, better-sqlite3, React 18, Vite 6, TypeScript, HTML5 Canvas API, Web Audio API / CSS 3D transforms, Lucide React, Tailwind CSS.

## Global Constraints

- **Admin-Only Scope:** All routes (`/api/ecosystem/*`, `/api/gacha/*`) and frontend paths (`/oceanarium`, navbar icon) must strictly check for `is_admin === 1` and return 403 / redirect unauthorized users.
- **Lazy Decay Calculation:** Ecosystem water quality decay (-15% per 24h of inactivity) must be evaluated lazily on read (`GET /api/ecosystem`) based on timestamps without background cron daemons.
- **Mobile-First Responsiveness:** Canvas and controls must adapt cleanly to mobile portrait viewports (375px–430px) with `touch-action: none` and thumb-friendly action bars.
- **Test-Driven Rigor:** Every task ends with an automated test suite verifying functionality before proceeding.

---

### Task 1: Database Migration & Species Seed Data

**Files:**
- Create: `backend/src/db/migrations/037_gacha_ecosystem.sql`
- Modify: `backend/src/db/migrations/schema.sql`
- Test: `backend/tests/gacha_schema.test.js`

**Interfaces:**
- Consumes: `backend/src/db/database.js` (`getDatabase`)
- Produces: Database tables `gacha_species`, `user_ecosystem`, `user_fishes`, `gacha_pull_logs`, with 20 pre-seeded stylized marine species.

- [ ] **Step 1: Write the failing schema test**

Create `backend/tests/gacha_schema.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_gacha_schema.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Check tables exist
  const tables = ['gacha_species', 'user_ecosystem', 'user_fishes', 'gacha_pull_logs'];
  for (const table of tables) {
    const res = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    assert.ok(res, `Table ${table} should exist`);
  }

  // Check species seed data (at least 20 species)
  const count = db.prepare("SELECT count(*) as count FROM gacha_species").get().count;
  assert.ok(count >= 20, `Expected at least 20 seeded species, got ${count}`);

  // Check species rarity coverage
  const rarities = db.prepare("SELECT DISTINCT rarity FROM gacha_species").all().map(r => r.rarity);
  assert.ok(rarities.includes('common'));
  assert.ok(rarities.includes('uncommon'));
  assert.ok(rarities.includes('rare'));
  assert.ok(rarities.includes('epic'));
  assert.ok(rarities.includes('legendary'));

  console.log('✓ Gacha Schema & Seed test passed');
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

Run: `node backend/tests/gacha_schema.test.js`
Expected: FAIL with "Table gacha_species should exist"

- [ ] **Step 3: Create migration `037_gacha_ecosystem.sql` with table definitions and seed data**

Create `backend/src/db/migrations/037_gacha_ecosystem.sql`:
```sql
CREATE TABLE IF NOT EXISTS gacha_species (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    depth_zone TEXT NOT NULL CHECK(depth_zone IN ('sunlit', 'twilight', 'abyssal')),
    rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    drop_weight INTEGER NOT NULL,
    description TEXT NOT NULL,
    visual_traits TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_ecosystem (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tickets INTEGER NOT NULL DEFAULT 0,
    food_flakes INTEGER NOT NULL DEFAULT 5,
    super_pellets INTEGER NOT NULL DEFAULT 1,
    water_quality INTEGER NOT NULL DEFAULT 100,
    last_fed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_decay_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pity_counter_epic INTEGER NOT NULL DEFAULT 0,
    pity_counter_legendary INTEGER NOT NULL DEFAULT 0,
    total_pulls INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_fishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES gacha_species(id) ON DELETE CASCADE,
    nickname TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'dormant')),
    caught_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_user_fishes_user ON user_fishes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fishes_species ON user_fishes(species_id);

CREATE TABLE IF NOT EXISTS gacha_pull_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES gacha_species(id),
    pull_type TEXT NOT NULL DEFAULT 'single' CHECK(pull_type IN ('single', 'multi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_user ON gacha_pull_logs(user_id);

-- Seed 20 Stylized Marine Species
INSERT OR IGNORE INTO gacha_species (id, name, depth_zone, rarity, drop_weight, description, visual_traits) VALUES
('azure_damselfish', 'Azure Damselfish', 'sunlit', 'common', 25, 'A spirited neon-blue reef dweller that zips through shallow corals.', '{"primary_color":"#00d2ff","secondary_color":"#3a7bd5","scale":0.9,"glow":false,"body_type":"oval"}'),
('sunburst_tang', 'Sunburst Tang', 'sunlit', 'common', 25, 'Radiates brilliant gold and lemon hues across sunlit lagoons.', '{"primary_color":"#ffe259","secondary_color":"#ffa751","scale":1.0,"glow":false,"body_type":"disc"}'),
('emerald_parrotfish', 'Emerald Parrotfish', 'sunlit', 'common', 20, 'Gleams with jade scales, nibbling peacefully on algae-covered rocks.', '{"primary_color":"#11998e","secondary_color":"#38ef7d","scale":1.1,"glow":false,"body_type":"torpedo"}'),
('clown_anemone', 'Clown Anemonefish', 'sunlit', 'uncommon', 15, 'Instantly recognizable orange ribbons, playful and beloved.', '{"primary_color":"#ff7e5f","secondary_color":"#feb47b","scale":0.95,"glow":false,"body_type":"oval"}'),
('golden_seahorse', 'Golden Pygmy Seahorse', 'sunlit', 'uncommon', 12, 'Anchors its tail gently to coral branches, floating serenely.', '{"primary_color":"#f7971e","secondary_color":"#ffd200","scale":0.85,"glow":false,"body_type":"vertical"}'),
('sapphire_manta', 'Sapphire Reef Manta', 'sunlit', 'rare', 5, 'Glides majestically through surface currents with velvety sapphire wings.', '{"primary_color":"#1a2a6c","secondary_color":"#00c6ff","scale":1.6,"glow":false,"body_type":"ray"}'),
('solar_lionfish', 'Solar Lionfish', 'sunlit', 'epic', 2, 'Adorned with ornate feather-like fins that shimmer like molten sunlight.', '{"primary_color":"#ff416c","secondary_color":"#ff4b2b","scale":1.3,"glow":true,"body_type":"spiky"}'),

('silver_hatchet', 'Silver Hatchetfish', 'twilight', 'common', 20, 'Mirror-plated nocturnal creature reflecting faint twilight glimmers.', '{"primary_color":"#bdc3c7","secondary_color":"#2c3e50","scale":0.9,"glow":false,"body_type":"hatchet"}'),
('glass_lantern', 'Glass Lanternfish', 'twilight', 'uncommon', 15, 'Translucent scales reveal an array of subtle bioluminescent photophores.', '{"primary_color":"#89f7fe","secondary_color":"#66a6ff","scale":0.95,"glow":true,"body_type":"torpedo"}'),
('ribbon_oarfish', 'Ribbon Oarfish', 'twilight', 'rare', 6, 'An undulating silver serpent with a striking crimson crest.', '{"primary_color":"#e0eafc","secondary_color":"#cfdef3","scale":2.0,"glow":false,"body_type":"ribbon"}'),
('prismatic_squid', 'Prismatic Glass Squid', 'twilight', 'rare', 5, 'Crystalline tentacles refract deep-ocean ambient wavelengths.', '{"primary_color":"#c471ed","secondary_color":"#12c2e9","scale":1.2,"glow":true,"body_type":"squid"}'),
('vampire_octo', 'Crimson Vampire Octopus', 'twilight', 'epic', 2, 'Cloaked in velvety ruby webbing with bioluminescent finger tips.', '{"primary_color":"#870000","secondary_color":"#190a05","scale":1.3,"glow":true,"body_type":"octo"}'),
('coelacanth_shadow', 'Ancient Dusk Coelacanth', 'twilight', 'legendary', 1, 'A living fossil from primordial seas with armored lobed fins.', '{"primary_color":"#200122","secondary_color":"#6f0000","scale":1.8,"glow":true,"body_type":"ancient"}'),

('ghost_grenadier', 'Ghost Grenadier', 'abyssal', 'uncommon', 12, 'Pale deep-sea prowler navigating pitch-black volcanic troughs.', '{"primary_color":"#e6dada","secondary_color":"#274046","scale":1.1,"glow":false,"body_type":"rattail"}'),
('bioluminescent_angler', 'Bioluminescent Angler', 'abyssal', 'rare', 6, 'Lures curious prey in midnight waters with a glowing escas lure.', '{"primary_color":"#0f2027","secondary_color":"#00f2fe","scale":1.2,"glow":true,"body_type":"angler"}'),
('gulper_void', 'Void Gulper Eel', 'abyssal', 'rare', 5, 'Enormous jaws capable of swallowing prey much larger than itself.', '{"primary_color":"#141e30","secondary_color":"#243b55","scale":1.7,"glow":false,"body_type":"eel"}'),
('dumbo_specter', 'Dumbo Specter Octopus', 'abyssal', 'epic', 2, 'Flaps delicate ear-like fins through the deepest oceanic abysses.', '{"primary_color":"#a18cd1","secondary_color":"#fbc2eb","scale":1.0,"glow":true,"body_type":"dumbo"}'),
('crystal_siphonophore', 'Crystal Siphonophore', 'abyssal', 'epic', 2, 'A shimmering colonial organism trailing bioluminescent bells.', '{"primary_color":"#00c9ff","secondary_color":"#92fe9d","scale":2.2,"glow":true,"body_type":"chain"}'),
('abyssal_leviathan', 'Abyssal Trench Leviathan', 'abyssal', 'legendary', 1, 'A mythical colossal titan roaming the deepest hadal trenches.', '{"primary_color":"#0b0c10","secondary_color":"#66fcf1","scale":2.5,"glow":true,"body_type":"leviathan"}'),
('cosmic_jelly', 'Cosmic Aurelia Jelly', 'abyssal', 'legendary', 1, 'A translucent bell pulsating with nebular ultraviolet starbursts.', '{"primary_color":"#f857a6","secondary_color":"#ff5858","scale":1.6,"glow":true,"body_type":"jelly"}');
```

Also append the new tables to `backend/src/db/migrations/schema.sql`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/gacha_schema.test.js`
Expected: PASS with "✓ Gacha Schema & Seed test passed"

- [ ] **Step 5: Commit migration and test**

```bash
git add backend/src/db/migrations/037_gacha_ecosystem.sql backend/src/db/migrations/schema.sql backend/tests/gacha_schema.test.js
git commit -m "feat(db): add gacha ecosystem schema and species seeds"
```

---

### Task 2: Core Ecosystem & Gacha Service

**Files:**
- Create: `backend/src/services/ecosystem.service.js`
- Test: `backend/tests/ecosystem_service.test.js`

**Interfaces:**
- Consumes: `backend/src/db/database.js` (`getDatabase`)
- Produces: `ecosystemService` with methods:
  - `ensureUserEcosystem(userId)`
  - `getEcosystemState(userId)` (evaluates lazy decay)
  - `feedEcosystem(userId, foodType)`
  - `pullGacha(userId, count)` (handles pity counters, inserts fish, logs pull)
  - `getCodex(userId)`
  - `updateFish(userId, fishId, { nickname, is_favorite })`
  - `awardRewards(userId, { tickets, food_flakes, super_pellets, water_quality })`

- [ ] **Step 1: Write the failing unit test for ecosystem service**

Create `backend/tests/ecosystem_service.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_ecosystem_service.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const ecosystemService = require('../src/services/ecosystem.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Create mock user
  db.prepare("INSERT INTO users (id, username) VALUES (1, 'captain_admin')").run();

  // 1. Initialize and get ecosystem
  const initial = ecosystemService.getEcosystemState(1);
  assert.strictEqual(initial.ecosystem.water_quality, 100);
  assert.strictEqual(initial.ecosystem.health_status, 'thriving');
  assert.strictEqual(initial.ecosystem.food_flakes, 5);
  assert.strictEqual(initial.fishes.length, 0);

  // 2. Test lazy decay simulation (set last_decay_at to 2 days ago)
  db.prepare("UPDATE user_ecosystem SET last_decay_at = datetime('now', '-2 days') WHERE user_id = 1").run();
  const decayed = ecosystemService.getEcosystemState(1);
  // 100 - (2 * 15) = 70
  assert.strictEqual(decayed.ecosystem.water_quality, 70);
  assert.strictEqual(decayed.ecosystem.health_status, 'stable');

  // 3. Test feeding flake (+10)
  const fed = ecosystemService.feedEcosystem(1, 'flake');
  assert.strictEqual(fed.water_quality, 80);
  assert.strictEqual(fed.food_flakes, 4);

  // 4. Test Gacha pull without tickets -> should throw
  assert.throws(() => {
    ecosystemService.pullGacha(1, 1);
  }, /Not enough tickets/i);

  // 5. Award tickets and pull
  ecosystemService.awardRewards(1, { tickets: 11 });
  const stateAfterAward = ecosystemService.getEcosystemState(1);
  assert.strictEqual(stateAfterAward.ecosystem.tickets, 11);

  // Pull 1
  const singlePull = ecosystemService.pullGacha(1, 1);
  assert.strictEqual(singlePull.results.length, 1);
  assert.strictEqual(singlePull.updated_ecosystem.tickets, 10);
  assert.strictEqual(singlePull.updated_ecosystem.total_pulls, 1);

  // Pull 10 (multi-pull guarantee at least 1 rare+)
  const multiPull = ecosystemService.pullGacha(1, 10);
  assert.strictEqual(multiPull.results.length, 10);
  assert.strictEqual(multiPull.updated_ecosystem.tickets, 0);
  assert.strictEqual(multiPull.updated_ecosystem.total_pulls, 11);
  const hasRareOrHigher = multiPull.results.some(r => ['rare', 'epic', 'legendary'].includes(r.rarity));
  assert.ok(hasRareOrHigher, 'Multi-pull must guarantee at least one Rare or higher');

  // 6. Test Codex
  const codex = ecosystemService.getCodex(1);
  assert.ok(codex.species.length >= 20);
  assert.ok(codex.total_discovered >= 1);
  assert.ok(codex.completion_percentage > 0);

  console.log('✓ Ecosystem Service test passed');
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

Run: `node backend/tests/ecosystem_service.test.js`
Expected: FAIL with "Cannot find module '../src/services/ecosystem.service'"

- [ ] **Step 3: Implement `backend/src/services/ecosystem.service.js`**

Implement `backend/src/services/ecosystem.service.js`:
- `ensureUserEcosystem(userId)`: Inserts into `user_ecosystem` if not present.
- `applyLazyDecay(userEcosystem)`: Calculates elapsed 24h days, reduces water quality by 15 per day, updates dormant status if 0.
- `getHealthStatus(waterQuality)`: `'thriving'` (80–100), `'stable'` (40–79), `'distressed'` (1–39), `'dormant'` (0).
- `getEcosystemState(userId)`: Fetches ecosystem and `user_fishes` with joined `gacha_species` info.
- `feedEcosystem(userId, foodType)`: Validates flake or super_pellet balance, increments water quality, revives dormant fish if quality > 0.
- `pullGacha(userId, count)`: Rolls weighted random from `gacha_species` using cumulative weights and pity counters (`pity_counter_epic`, `pity_counter_legendary`). Inserts caught fishes, duplicates grant +3 flakes, logs pull.
- `getCodex(userId)`: Returns all species with catch counts and discovered flag.
- `updateFish(userId, fishId, updateData)`: Updates nickname / is_favorite.
- `awardRewards(userId, rewards)`: Atomically updates tickets, food_flakes, super_pellets.

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/ecosystem_service.test.js`
Expected: PASS with "✓ Ecosystem Service test passed"

- [ ] **Step 5: Commit ecosystem service**

```bash
git add backend/src/services/ecosystem.service.js backend/tests/ecosystem_service.test.js
git commit -m "feat(backend): implement ecosystem and gacha core service"
```

---

### Task 3: Backend API Routes & Admin Security Middleware

**Files:**
- Create: `backend/src/middleware/admin.middleware.js`
- Create: `backend/src/routes/ecosystem.routes.js`
- Create: `backend/src/routes/gacha.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/ecosystem_api.test.js`

**Interfaces:**
- Consumes: `ecosystem.service.js`, Express router
- Produces: `/api/ecosystem` and `/api/gacha` HTTP endpoints with `requireAdmin` guard.

- [ ] **Step 1: Write the failing API test**

Create `backend/tests/ecosystem_api.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const testDbPath = path.join(__dirname, 'test_ecosystem_api.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const app = require('../src/app');

let server;
const PORT = 5599;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${PORT}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Create 1 admin user and 1 regular user
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'normal_user', 0)").run();
  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (2, 'admin_user', 1)").run();

  server = app.listen(PORT);

  // 1. Unauthenticated or non-admin access should be 401/403
  const nonAdminRes = await request('/api/ecosystem');
  assert.strictEqual(nonAdminRes.status, 401, 'Unauthenticated request should return 401');

  // Test admin route mounted
  console.log('✓ Ecosystem API security guard tested');

  server.close();
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

run().catch(err => {
  console.error('Test Failed:', err);
  if (server) server.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/ecosystem_api.test.js`
Expected: FAIL or 404 since routes are not yet mounted.

- [ ] **Step 3: Create `admin.middleware.js` and route files**

Create `backend/src/middleware/admin.middleware.js`:
```javascript
function requireAdmin(req, res, next) {
  if (!req.user || req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Access restricted to administrators during preview.' });
  }
  next();
}

module.exports = { requireAdmin };
```

Create `backend/src/routes/ecosystem.routes.js`:
Mount:
- `GET /`: `getEcosystemState(req.user.id)`
- `POST /feed`: `feedEcosystem(req.user.id, req.body.food_type)`
- `PATCH /fishes/:id`: `updateFish(req.user.id, req.params.id, req.body)`

Create `backend/src/routes/gacha.routes.js`:
Mount:
- `POST /pull`: `pullGacha(req.user.id, req.body.count)`
- `GET /codex`: `getCodex(req.user.id)`

Mount both in `backend/src/app.js`:
```javascript
const ecosystemRoutes = require('./routes/ecosystem.routes');
const gachaRoutes = require('./routes/gacha.routes');

app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/gacha', gachaRoutes);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/ecosystem_api.test.js`
Expected: PASS with "✓ Ecosystem API security guard tested"

- [ ] **Step 5: Commit API routes and middleware**

```bash
git add backend/src/middleware/admin.middleware.js backend/src/routes/ecosystem.routes.js backend/src/routes/gacha.routes.js backend/src/app.js backend/tests/ecosystem_api.test.js
git commit -m "feat(api): mount admin-gated ecosystem and gacha routes"
```

---

### Task 4: Translation Lifecycle Reward Hooks

**Files:**
- Modify: `backend/src/services/reputation.service.js`
- Modify: `backend/src/services/flow.service.js`
- Modify: `backend/src/services/gamification.service.js`
- Test: `backend/tests/ecosystem_reward_hooks.test.js`

**Interfaces:**
- Consumes: `ecosystemService.awardRewards`
- Produces: Automatic credit of tickets, flakes, and super pellets on translation approved, submitted, reviewed, and daily goals reached.

- [ ] **Step 1: Write test verifying reward hooks**

Create `backend/tests/ecosystem_reward_hooks.test.js`:
```javascript
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_reward_hooks.db');
process.env.SQLITE_DB_PATH = testDbPath;
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const { applyApprovalReward } = require('../src/services/reputation.service');
const ecosystemService = require('../src/services/ecosystem.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT INTO users (id, username, is_admin) VALUES (10, 'translator_hero', 1)").run();
  db.prepare("INSERT INTO terms (id, uri) VALUES (1, 'urn:test:1')").run();
  db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (1, 1, 'http://schema.org/name', 'Cod')").run();
  db.prepare("INSERT INTO translations (id, term_field_id, language, value, status, created_by_id) VALUES (1, 1, 'fr', 'Morue', 'review', 10)").run();

  // Call applyApprovalReward
  applyApprovalReward(10, 1);

  // Check user_ecosystem state
  const state = ecosystemService.getEcosystemState(10);
  assert.strictEqual(state.ecosystem.tickets, 1, 'Should award 1 ticket upon approval');
  assert.strictEqual(state.ecosystem.super_pellets, 2, 'Should award 1 super pellet (1 base + 1 awarded)');

  console.log('✓ Ecosystem Reward Hooks test passed');
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

Run: `node backend/tests/ecosystem_reward_hooks.test.js`
Expected: FAIL because `applyApprovalReward` doesn't yet award tickets.

- [ ] **Step 3: Integrate reward calls in `reputation.service.js` and `flow.service.js`**

In `backend/src/services/reputation.service.js` in `applyApprovalReward()`:
```javascript
const ecosystemService = require('./ecosystem.service');
ecosystemService.awardRewards(userId, { tickets: 1, super_pellets: 1 });
```

In `backend/src/services/flow.service.js` on translation creation:
```javascript
const ecosystemService = require('./ecosystem.service');
ecosystemService.awardRewards(userId, { food_flakes: 1 });
```

In review batch completion / `user_daily_goals`:
```javascript
ecosystemService.awardRewards(userId, { tickets: 1, super_pellets: 1, water_quality: 100 });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/ecosystem_reward_hooks.test.js`
Expected: PASS with "✓ Ecosystem Reward Hooks test passed"

- [ ] **Step 5: Commit reward hooks**

```bash
git add backend/src/services/reputation.service.js backend/src/services/flow.service.js backend/tests/ecosystem_reward_hooks.test.js
git commit -m "feat(gamification): hook ecosystem tickets and pellets into translation lifecycle"
```

---

### Task 5: Frontend API Client & Ecosystem Types

**Files:**
- Modify: `frontend/types.ts`
- Create: `frontend/services/ecosystemService.ts`
- Test: `frontend/tests/ecosystem_service_client.test.js`

**Interfaces:**
- Produces: TypeScript types `GachaSpecies`, `UserFish`, `UserEcosystem`, `GachaPullResponse`, `CodexResponse` and Axios client functions: `fetchEcosystem()`, `feedEcosystem(foodType)`, `pullGacha(count)`, `fetchCodex()`, `updateFish(id, data)`.

- [ ] **Step 1: Write unit test for frontend ecosystem client contract**

Create `frontend/tests/ecosystem_service_client.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const servicePath = path.join(__dirname, '../services/ecosystemService.ts');
  const typesPath = path.join(__dirname, '../types.ts');

  assert.ok(fs.existsSync(servicePath), 'frontend/services/ecosystemService.ts must exist');
  assert.ok(fs.existsSync(typesPath), 'frontend/types.ts must exist');

  const typesContent = fs.readFileSync(typesPath, 'utf8');
  assert.ok(typesContent.includes('export interface GachaSpecies'), 'GachaSpecies interface must be exported in types.ts');
  assert.ok(typesContent.includes('export interface UserEcosystem'), 'UserEcosystem interface must be exported in types.ts');
  assert.ok(typesContent.includes('export interface UserFish'), 'UserFish interface must be exported in types.ts');

  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert.ok(serviceContent.includes('fetchEcosystem'), 'ecosystemService must implement fetchEcosystem');
  assert.ok(serviceContent.includes('feedEcosystem'), 'ecosystemService must implement feedEcosystem');
  assert.ok(serviceContent.includes('pullGacha'), 'ecosystemService must implement pullGacha');
  assert.ok(serviceContent.includes('fetchCodex'), 'ecosystemService must implement fetchCodex');

  console.log('✓ Frontend Ecosystem Service Client contract verified');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/ecosystem_service_client.test.js`
Expected: FAIL

- [ ] **Step 3: Define types and implement `ecosystemService.ts`**

Add types to `frontend/types.ts` and implement `frontend/services/ecosystemService.ts` wrapping Axios calls to `/api/ecosystem` and `/api/gacha`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/ecosystem_service_client.test.js`
Expected: PASS with "✓ Frontend Ecosystem Service Client contract verified"

- [ ] **Step 5: Commit frontend service client**

```bash
git add frontend/types.ts frontend/services/ecosystemService.ts frontend/tests/ecosystem_service_client.test.js
git commit -m "feat(frontend): add ecosystem API client and type definitions"
```

---

### Task 6: Frontend Living Oceanarium Canvas Component

**Files:**
- Create: `frontend/components/oceanarium/OceanariumCanvas.tsx`
- Create: `frontend/components/oceanarium/canvasRenderer.ts`
- Test: `frontend/tests/oceanarium_canvas.test.js`

**Interfaces:**
- Consumes: `UserFish[]`, `waterQuality: number`, `onFishClick`, `onFeedDrop`
- Produces: High-performance 60 FPS HTML5 Canvas component with vertical depth layers, procedural fish movement, food pellet gravity physics, and responsive mobile touch handling (`touch-action: none`).

- [ ] **Step 1: Write test verifying canvas component structure**

Create `frontend/tests/oceanarium_canvas.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const canvasPath = path.join(__dirname, '../components/oceanarium/OceanariumCanvas.tsx');
  const rendererPath = path.join(__dirname, '../components/oceanarium/canvasRenderer.ts');

  assert.ok(fs.existsSync(canvasPath), 'OceanariumCanvas.tsx must exist');
  assert.ok(fs.existsSync(rendererPath), 'canvasRenderer.ts must exist');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  assert.ok(canvasContent.includes('requestAnimationFrame'), 'Must use requestAnimationFrame');
  assert.ok(canvasContent.includes('devicePixelRatio'), 'Must support devicePixelRatio for mobile displays');
  assert.ok(canvasContent.includes('touch-action'), 'Must configure touch-action for mobile touch handling');

  console.log('✓ Oceanarium Canvas component structure verified');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_canvas.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `canvasRenderer.ts` and `OceanariumCanvas.tsx`**

1. `canvasRenderer.ts`:
   - Depth background gradients (Sunlit turquoise -> Twilight cobalt -> Abyssal obsidian).
   - Sun ray caustic shimmer animations.
   - Procedural fish rendering with sinusoidal tail wagging, body scales, glowing photophores for abyssal fish.
   - Sinking food flakes / super pellets with water resistance and bubble trails.
   - Slumber bubble rendering for dormant fish when `waterQuality === 0`.
2. `OceanariumCanvas.tsx`:
   - Handles canvas resize, touch and click events.
   - Dispatches pellet drop on click/tap.
   - Fish collision & feeding detection.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_canvas.test.js`
Expected: PASS with "✓ Oceanarium Canvas component structure verified"

- [ ] **Step 5: Commit canvas component**

```bash
git add frontend/components/oceanarium/OceanariumCanvas.tsx frontend/components/oceanarium/canvasRenderer.ts frontend/tests/oceanarium_canvas.test.js
git commit -m "feat(frontend): create high-performance interactive oceanarium canvas"
```

---

### Task 7: Frontend Dive Station & Marine Codex Components

**Files:**
- Create: `frontend/components/oceanarium/DiveStation.tsx`
- Create: `frontend/components/oceanarium/MarineCodex.tsx`
- Test: `frontend/tests/dive_station_codex.test.js`

**Interfaces:**
- Consumes: `tickets`, `pityEpic`, `pityLegendary`, `onPull(count)`, `codexData`
- Produces:
  - Atmospheric bathyscaphe gacha pull experience with depth descent, sound, and card reveal animations.
  - Mobile-responsive specimen collection grid with rarity borders and detail drawer.

- [ ] **Step 1: Write test verifying DiveStation and MarineCodex**

Create `frontend/tests/dive_station_codex.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const divePath = path.join(__dirname, '../components/oceanarium/DiveStation.tsx');
  const codexPath = path.join(__dirname, '../components/oceanarium/MarineCodex.tsx');

  assert.ok(fs.existsSync(divePath), 'DiveStation.tsx must exist');
  assert.ok(fs.existsSync(codexPath), 'MarineCodex.tsx must exist');

  const diveContent = fs.readFileSync(divePath, 'utf8');
  assert.ok(diveContent.includes('Single Dive'), 'DiveStation must support single dive');
  assert.ok(diveContent.includes('Expedition Dive'), 'DiveStation must support multi dive (10x)');

  const codexContent = fs.readFileSync(codexPath, 'utf8');
  assert.ok(codexContent.includes('completion_percentage') || codexContent.includes('%'), 'Codex must show completion progress');

  console.log('✓ Dive Station and Marine Codex verified');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/dive_station_codex.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `DiveStation.tsx` and `MarineCodex.tsx`**

- `DiveStation.tsx`:
  - Depth descent animation through Sunlit, Twilight, and Abyssal zones.
  - Lever pull / launch button with haptic feedback.
  - Cards reveal modal for 1-pull and 10-pull with rarity borders and glitter FX.
- `MarineCodex.tsx`:
  - 2–3 column mobile grid, 4–6 column desktop grid.
  - Silhouette for locked species, illuminated art for unlocked species.
  - Specimen inspection modal with creature lore.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/dive_station_codex.test.js`
Expected: PASS with "✓ Dive Station and Marine Codex verified"

- [ ] **Step 5: Commit DiveStation and Codex**

```bash
git add frontend/components/oceanarium/DiveStation.tsx frontend/components/oceanarium/MarineCodex.tsx frontend/tests/dive_station_codex.test.js
git commit -m "feat(frontend): create dive station slot machine and marine codex"
```

---

### Task 8: Oceanarium Page, Navbar Link & Admin Guard

**Files:**
- Create: `frontend/pages/Oceanarium.tsx`
- Modify: `frontend/App.tsx`
- Modify: `frontend/components/Navbar.tsx`
- Test: `frontend/tests/oceanarium_routing.test.js`

**Interfaces:**
- Consumes: `useAuth()`, `ecosystemService`
- Produces: `/oceanarium` page with view tabs (`Oceanarium`, `Dive Station`, `Codex`), HUD controls, mobile thumb-dock, and admin-only navbar link.

- [ ] **Step 1: Write routing and admin guard test**

Create `frontend/tests/oceanarium_routing.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run() {
  const pagePath = path.join(__dirname, '../pages/Oceanarium.tsx');
  const appPath = path.join(__dirname, '../App.tsx');
  const navbarPath = path.join(__dirname, '../components/Navbar.tsx');

  assert.ok(fs.existsSync(pagePath), 'Oceanarium.tsx must exist');
  
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.ok(appContent.includes('/oceanarium'), 'App.tsx must define /oceanarium route');

  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  assert.ok(navbarContent.includes('oceanarium') || navbarContent.includes('Oceanarium'), 'Navbar must reference Oceanarium');
  assert.ok(navbarContent.includes('is_admin'), 'Navbar must gate Oceanarium behind is_admin');

  console.log('✓ Oceanarium routing and admin guard verified');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/oceanarium_routing.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `Oceanarium.tsx`, wire `App.tsx` and `Navbar.tsx`**

- `Oceanarium.tsx`:
  - Checks `user?.is_admin === 1`. If false, renders access restricted notice.
  - Renders top HUD with water quality gauge, ticket count, and food balances.
  - Switches between `[OceanariumCanvas]`, `[DiveStation]`, and `[MarineCodex]`.
  - Floating bottom thumb dock on mobile screen widths.
- `Navbar.tsx`:
  - When `user?.is_admin === 1`, renders `Oceanarium` nav link with `Fish` icon and ticket badge pill.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/oceanarium_routing.test.js`
Expected: PASS with "✓ Oceanarium routing and admin guard verified"

- [ ] **Step 5: Commit page and navigation**

```bash
git add frontend/pages/Oceanarium.tsx frontend/App.tsx frontend/components/Navbar.tsx frontend/tests/oceanarium_routing.test.js
git commit -m "feat(frontend): integrate oceanarium hub with admin-only navbar link"
```

---

### Task 9: Full End-to-End Verification & Build Check

**Files:**
- Create: `backend/tests/ecosystem_e2e.test.js`
- Test: All backend tests (`npm test` in backend)
- Build: Frontend production build (`npm run build` in frontend)

- [ ] **Step 1: Write and run full end-to-end backend integration test**

Create `backend/tests/ecosystem_e2e.test.js`:
Tests complete user loop: user registration -> submitting translation -> getting approved -> receiving tickets & pellets -> pulling gacha -> viewing codex -> dropping food -> checking water health.

Run: `node backend/tests/ecosystem_e2e.test.js`
Expected: PASS

- [ ] **Step 2: Run full backend test suite**

Run: `npm test --prefix backend`
Expected: All tests pass.

- [ ] **Step 3: Run frontend build verification**

Run: `npm run build --prefix frontend`
Expected: Build passes with 0 TypeScript/compilation errors.

- [ ] **Step 4: Final commit**

```bash
git add backend/tests/ecosystem_e2e.test.js
git commit -m "test: add comprehensive e2e test suite for gacha ecosystem"
```
