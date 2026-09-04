# Admin Tank Management & Suspenseful Deep Dive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full administrative control for user aquariums (inspect fishes, rename, release/delete individual fish, configurable tank reset dialog) in `/admin/gacha`, and transform the bathyscaphe expedition into an atmospheric, suspenseful marine dive with depth descent stages, sonar anomaly anticipation, Web Audio procedural hydrophone sound effects, and theatrical rarity-graded bio-pod reveals.

**Architecture:** 
- Backend: RESTful endpoints in `adminGacha.routes.js` providing user tank inspection, single specimen deletion, nickname edits, and a configurable transactional tank reset (`user_fishes` deletion, water quality restoration, pity reset, food reset).
- Audio Engine: Zero-dependency Web Audio procedural sound synthesizer in `oceanAudio.ts` providing realistic hydrophone sonar echoes, pressure trench hum, pneumatic canister venting, and rarity fanfare stingers.
- Admin Frontend: Drawer modal in `AdminGacha.tsx` featuring specimen gallery with search/rarity filters, nickname inline edit, individual release buttons with confirmation, and a danger-styled configurable reset modal.
- Dive Experience: Overhauled state machine in `DiveStation.tsx` (`idle` -> `descent` -> `sonar_lock` -> `pod_reveal` -> `summary`) with deep-sea porthole visuals, anomaly alert banners scaling by highest pulled rarity, interactive canister unsealing with suspense delays on Epic/Legendary, and a persistent skip button.

**Tech Stack:** Node.js/Express, SQLite (`better-sqlite3`), React 18, TypeScript, Tailwind CSS, Lucide React, Web Audio API, Node Test Runner.

## Global Constraints
- All admin endpoints must be protected by `requireAdmin` middleware.
- Zero external audio/video asset files: sound must be synthesized procedurally via Web Audio API with safe no-op fallbacks for headless/unsupported environments.
- High-rarity reveals must feature real suspense (suspense delay, visual cues, sound crescendo) while always providing a "Skip / Reveal All" option.
- Tank reset must support individual checkboxes (`delete_fishes`, `reset_water`, `reset_pity`, `reset_food`) executed in a single SQLite transaction.

---

### Task 1: Backend Admin Tank & Specimen Management Endpoints

**Files:**
- Modify: `backend/src/routes/adminGacha.routes.js`
- Test: `backend/tests/admin_gacha_tank_management.test.js`

**Interfaces:**
- Consumes: `requireAdmin`, `getDatabase`
- Produces:
  - `GET /api/admin/gacha/users/:id/tank`: `{ ecosystem: object, fishes: Array<object> }`
  - `DELETE /api/admin/gacha/users/:id/fishes/:fishId`: `{ ok: true, deletedFishId: number, remainingCount: number }`
  - `PATCH /api/admin/gacha/users/:id/fishes/:fishId`: `{ ok: true, fish: object }`
  - `POST /api/admin/gacha/users/:id/reset-tank`: `{ ok: true, ecosystem: object, fishes_count: number }`

- [ ] **Step 1: Write the failing test for backend admin tank endpoints**

Create `backend/tests/admin_gacha_tank_management.test.js`:
```javascript
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// Ensure temporary test database
const TEST_DB_PATH = path.join(__dirname, 'test_admin_gacha_tank.db');
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
process.env.DATABASE_PATH = TEST_DB_PATH;

const { getDatabase } = require('../src/db/database');
const express = require('express');
const http = require('http');

async function run() {
  const db = getDatabase();
  
  // Create test admin user and regular user
  db.prepare(`INSERT INTO users (id, username, is_admin) VALUES (101, 'test_admin', 1)`).run();
  db.prepare(`INSERT INTO users (id, username, is_admin) VALUES (102, 'test_diver', 0)`).run();
  
  // Seed ecosystem for test_diver
  db.prepare(`
    INSERT INTO user_ecosystem (user_id, tickets, food_flakes, super_pellets, water_quality, pity_counter_epic, pity_counter_legendary)
    VALUES (102, 5, 8, 2, 60, 4, 15)
  `).run();
  
  // Insert caught fishes
  db.prepare(`
    INSERT INTO user_fishes (id, user_id, species_id, nickname)
    VALUES (501, 102, 'azure_damselfish', 'Finny'),
           (502, 102, 'solar_lionfish', 'Sol')
  `).run();

  // Setup app with admin session
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 101, username: 'test_admin', is_admin: 1 } };
    next();
  });
  app.use('/api', require('../src/routes/adminGacha.routes'));

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin/gacha/users/102`;

  try {
    // 1. GET Tank
    const res1 = await fetch(`${baseUrl}/tank`);
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert.strictEqual(data1.ecosystem.water_quality, 60);
    assert.strictEqual(data1.fishes.length, 2);
    assert.strictEqual(data1.fishes[0].nickname, 'Finny');
    assert.strictEqual(data1.fishes[0].name, 'Azure Damselfish');

    // 2. PATCH Fish Nickname
    const resPatch = await fetch(`${baseUrl}/fishes/501`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bubbles' })
    });
    assert.strictEqual(resPatch.status, 200);
    const patchData = await resPatch.json();
    assert.strictEqual(patchData.fish.nickname, 'Bubbles');

    // 3. DELETE Single Fish
    const resDel = await fetch(`${baseUrl}/fishes/501`, { method: 'DELETE' });
    assert.strictEqual(resDel.status, 200);
    const delData = await resDel.json();
    assert.strictEqual(delData.deletedFishId, 501);
    assert.strictEqual(delData.remainingCount, 1);

    // 4. POST Reset Tank (delete fishes + reset water quality)
    const resReset = await fetch(`${baseUrl}/reset-tank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delete_fishes: true,
        reset_water: true,
        reset_pity: true,
        reset_food: true
      })
    });
    assert.strictEqual(resReset.status, 200);
    const resetData = await resReset.json();
    assert.strictEqual(resetData.fishes_count, 0);
    assert.strictEqual(resetData.ecosystem.water_quality, 100);
    assert.strictEqual(resetData.ecosystem.pity_counter_epic, 0);
    assert.strictEqual(resetData.ecosystem.food_flakes, 5);

    console.log('✓ Admin Gacha tank management test passed');
  } finally {
    server.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  }
}

run().catch(err => {
  console.error(err);
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/admin_gacha_tank_management.test.js`
Expected: FAIL with 404 (Cannot GET /api/admin/gacha/users/102/tank)

- [ ] **Step 3: Implement admin tank management routes in `backend/src/routes/adminGacha.routes.js`**

Add endpoints to `backend/src/routes/adminGacha.routes.js`:
- `GET /admin/gacha/users/:id/tank`:
  ```javascript
  router.get('/admin/gacha/users/:id/tank', requireAdmin, apiLimiter, (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const db = getDatabase();
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      let eco = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
      if (!eco) {
        db.prepare('INSERT INTO user_ecosystem (user_id) VALUES (?)').run(userId);
        eco = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
      }

      const fishes = db.prepare(`
        SELECT 
          uf.id,
          uf.user_id,
          uf.species_id,
          uf.nickname,
          uf.status,
          uf.caught_at,
          uf.is_favorite,
          s.name,
          s.depth_zone,
          s.rarity,
          s.visual_traits,
          s.description
        FROM user_fishes uf
        JOIN gacha_species s ON uf.species_id = s.id
        WHERE uf.user_id = ?
        ORDER BY uf.caught_at DESC, uf.id DESC
      `).all(userId);

      res.json({ ecosystem: eco, fishes });
    } catch (err) {
      console.error('[Admin Gacha] Error fetching user tank:', err);
      res.status(500).json({ error: 'Failed to fetch user tank' });
    }
  });
  ```
- `DELETE /admin/gacha/users/:id/fishes/:fishId`:
  ```javascript
  router.delete('/admin/gacha/users/:id/fishes/:fishId', requireAdmin, apiLimiter, (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const fishId = parseInt(req.params.fishId, 10);
      const db = getDatabase();

      const fish = db.prepare('SELECT id FROM user_fishes WHERE id = ? AND user_id = ?').get(fishId, userId);
      if (!fish) return res.status(404).json({ error: 'Fish not found for this user' });

      db.prepare('DELETE FROM user_fishes WHERE id = ? AND user_id = ?').run(fishId, userId);
      const remainingCount = db.prepare('SELECT COUNT(*) as count FROM user_fishes WHERE user_id = ?').get(userId).count;

      res.json({ ok: true, deletedFishId: fishId, remainingCount });
    } catch (err) {
      console.error('[Admin Gacha] Error deleting fish:', err);
      res.status(500).json({ error: 'Failed to delete fish' });
    }
  });
  ```
- `PATCH /admin/gacha/users/:id/fishes/:fishId`:
  ```javascript
  router.patch('/admin/gacha/users/:id/fishes/:fishId', requireAdmin, apiLimiter, (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const fishId = parseInt(req.params.fishId, 10);
      const { nickname, is_favorite } = req.body;
      const db = getDatabase();

      const fish = db.prepare('SELECT id FROM user_fishes WHERE id = ? AND user_id = ?').get(fishId, userId);
      if (!fish) return res.status(404).json({ error: 'Fish not found for this user' });

      const updates = [];
      const params = [];
      if (nickname !== undefined) {
        updates.push('nickname = ?');
        params.push(nickname ? nickname.trim() : null);
      }
      if (is_favorite !== undefined) {
        updates.push('is_favorite = ?');
        params.push(is_favorite ? 1 : 0);
      }

      if (updates.length > 0) {
        params.push(fishId, userId);
        db.prepare(`UPDATE user_fishes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
      }

      const updated = db.prepare('SELECT * FROM user_fishes WHERE id = ?').get(fishId);
      res.json({ ok: true, fish: updated });
    } catch (err) {
      console.error('[Admin Gacha] Error updating fish:', err);
      res.status(500).json({ error: 'Failed to update fish' });
    }
  });
  ```
- `POST /admin/gacha/users/:id/reset-tank`:
  ```javascript
  router.post('/admin/gacha/users/:id/reset-tank', requireAdmin, apiLimiter, (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const {
        delete_fishes = false,
        reset_water = false,
        reset_pity = false,
        reset_food = false
      } = req.body;
      const db = getDatabase();

      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Transaction
      const transaction = db.transaction(() => {
        if (delete_fishes) {
          db.prepare('DELETE FROM user_fishes WHERE user_id = ?').run(userId);
        }

        const ecoUpdates = [];
        if (reset_water) ecoUpdates.push('water_quality = 100');
        if (reset_pity) ecoUpdates.push('pity_counter_epic = 0, pity_counter_legendary = 0');
        if (reset_food) ecoUpdates.push('food_flakes = 5, super_pellets = 1');

        if (ecoUpdates.length > 0) {
          db.prepare(`
            INSERT OR IGNORE INTO user_ecosystem (user_id) VALUES (?)
          `).run(userId);

          db.prepare(`
            UPDATE user_ecosystem SET ${ecoUpdates.join(', ')} WHERE user_id = ?
          `).run(userId);
        }
      });

      transaction();

      const ecosystem = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
      const fishes_count = db.prepare('SELECT COUNT(*) as count FROM user_fishes WHERE user_id = ?').get(userId).count;

      res.json({ ok: true, ecosystem, fishes_count });
    } catch (err) {
      console.error('[Admin Gacha] Error resetting tank:', err);
      res.status(500).json({ error: 'Failed to reset user tank' });
    }
  });
  ```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/admin_gacha_tank_management.test.js`
Expected: PASS with output `✓ Admin Gacha tank management test passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/adminGacha.routes.js backend/tests/admin_gacha_tank_management.test.js
git commit -m "feat(api): add admin tank management and reset endpoints"
```

---

### Task 2: Web Audio Synthesizer Engine for Marine Atmosphere & Anticipation

**Files:**
- Create: `frontend/services/oceanAudio.ts`
- Test: `frontend/tests/ocean_audio.test.js`

**Interfaces:**
- Produces:
  - `playSonarPing(frequency?: number, depthRatio?: number): void`
  - `playTrenchDrone(): () => void` (returns stop function)
  - `playAnomalyAlert(rarity: 'common'|'uncommon'|'rare'|'epic'|'legendary'): void`
  - `playCanisterHiss(): void`
  - `playRevealStinger(rarity: string): void`

- [ ] **Step 1: Write test for audio engine in `frontend/tests/ocean_audio.test.js`**

```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioPath = path.join(__dirname, '../services/oceanAudio.ts');

assert.ok(fs.existsSync(audioPath), 'oceanAudio.ts must exist');
const content = fs.readFileSync(audioPath, 'utf8');

assert.ok(content.includes('playSonarPing'), 'Must export playSonarPing');
assert.ok(content.includes('playTrenchDrone'), 'Must export playTrenchDrone');
assert.ok(content.includes('playAnomalyAlert'), 'Must export playAnomalyAlert');
assert.ok(content.includes('playCanisterHiss'), 'Must export playCanisterHiss');
assert.ok(content.includes('playRevealStinger'), 'Must export playRevealStinger');

console.log('✓ Ocean audio service structure verified');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/ocean_audio.test.js`
Expected: FAIL (file does not exist)

- [ ] **Step 3: Implement `frontend/services/oceanAudio.ts`**

```typescript
// Procedural Web Audio API sound synthesizer for deep sea diving & gacha reveals
// Runs client-side with zero external assets; safely handles browsers without audio context

class OceanAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playSonarPing(frequency = 750, depthRatio = 0.5): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Lower frequency & higher filter dampening as depth increases
      const pitch = Math.max(300, frequency * (1 - depthRatio * 0.4));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, ctx.currentTime + 0.8);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200 - depthRatio * 600, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }

  playTrenchDrone(): () => void {
    try {
      const ctx = this.getContext();
      if (!ctx) return () => {};

      // Sub-bass drone for deep water pressure
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(55, ctx.currentTime); // A1 note

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.0);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      return () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          setTimeout(() => {
            try { osc.stop(); } catch {}
          }, 450);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  playAnomalyAlert(rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      if (rarity === 'legendary') {
        // Alarming emergency beacon + heavy sub tremor
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, ctx.currentTime + i * 0.2);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + i * 0.2 + 0.15);

          gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.2);
          osc.stop(ctx.currentTime + i * 0.2 + 0.2);
        }
      } else if (rarity === 'epic') {
        // Mysterious violet chime pulse
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3); // E5

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      } else if (rarity === 'rare') {
        // Azure high sonar chirp
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        // Gentle standard sonar blip
        this.playSonarPing(800, 0.4);
      }
    } catch {}
  }

  playCanisterHiss(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      // Filtered noise buffer for steam hiss
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2500, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {}
  }

  playRevealStinger(rarity: string): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const baseNotes: Record<string, number[]> = {
        legendary: [261.63, 329.63, 392.00, 523.25, 659.25, 783.99], // C Major triumphant arpeggio
        epic: [329.63, 440.00, 554.37, 659.25], // E Major chord
        rare: [440.00, 554.37, 659.25], // A chord
        uncommon: [523.25, 659.25],
        common: [587.33]
      };

      const notes = baseNotes[rarity] || baseNotes.common;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = rarity === 'legendary' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        const volume = rarity === 'legendary' ? 0.15 : 0.08;
        gain.gain.setValueAtTime(volume, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.9);
      });
    } catch {}
  }
}

export const oceanAudio = new OceanAudioEngine();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/ocean_audio.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/services/oceanAudio.ts frontend/tests/ocean_audio.test.js
git commit -m "feat(audio): implement Web Audio procedural ocean synthesizer"
```

---

### Task 3: Admin UI User Tank Drawer & Configurable Tank Reset Modal

**Files:**
- Create: `frontend/components/admin/AdminTankDrawer.tsx`
- Modify: `frontend/pages/admin/AdminGacha.tsx`
- Modify: `frontend/types.ts`
- Test: `frontend/tests/admin_tank_drawer.test.js`

**Interfaces:**
- Consumes: `/api/admin/gacha/users/:id/tank`, `/api/admin/gacha/users/:id/fishes/:fishId`, `/api/admin/gacha/users/:id/reset-tank`
- Produces: Visual drawer component mounted in `AdminGacha.tsx` for any selected user.

- [ ] **Step 1: Write test for AdminTankDrawer in `frontend/tests/admin_tank_drawer.test.js`**

```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drawerPath = path.join(__dirname, '../components/admin/AdminTankDrawer.tsx');
const adminGachaPath = path.join(__dirname, '../pages/admin/AdminGacha.tsx');

assert.ok(fs.existsSync(drawerPath), 'AdminTankDrawer.tsx must exist');
const drawerContent = fs.readFileSync(drawerPath, 'utf8');

assert.ok(drawerContent.includes('reset-tank'), 'Drawer must include reset-tank API call');
assert.ok(drawerContent.includes('delete_fishes'), 'Drawer must support delete_fishes option');
assert.ok(drawerContent.includes('reset_water'), 'Drawer must support reset_water option');
assert.ok(drawerContent.includes('reset_pity'), 'Drawer must support reset_pity option');
assert.ok(drawerContent.includes('reset_food'), 'Drawer must support reset_food option');

const pageContent = fs.readFileSync(adminGachaPath, 'utf8');
assert.ok(pageContent.includes('AdminTankDrawer'), 'AdminGacha must embed AdminTankDrawer');
assert.ok(pageContent.includes('Manage Tank') || pageContent.includes('manage-tank'), 'AdminGacha must have Manage Tank trigger');

console.log('✓ Admin tank drawer integration test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/admin_tank_drawer.test.js`
Expected: FAIL (`AdminTankDrawer.tsx` does not exist)

- [ ] **Step 3: Update `frontend/types.ts` to add tank & fish types**

Ensure `AdminUserFish` and `AdminUserTankResponse` are in `frontend/types.ts`:
```typescript
export interface AdminUserFish {
  id: number;
  user_id: number;
  species_id: string;
  nickname: string | null;
  status: 'active' | 'dormant';
  caught_at: string;
  is_favorite: number;
  name: string;
  depth_zone: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  visual_traits: string;
  description: string;
}

export interface AdminUserTankResponse {
  ecosystem: UserEcosystem;
  fishes: AdminUserFish[];
}
```

- [ ] **Step 4: Implement `frontend/components/admin/AdminTankDrawer.tsx`**

Build the drawer supporting:
- Specimen gallery with search input and rarity filter pills.
- Inline nickname editing.
- Single-click specimen deletion with confirmation popover.
- Configurable "Reset Tank" dialog with checkboxes for `delete_fishes`, `reset_water`, `reset_pity`, `reset_food`.
- Automatic refresh of parent user state upon deletion or reset.

- [ ] **Step 5: Integrate `AdminTankDrawer` into `frontend/pages/admin/AdminGacha.tsx`**

Add "Manage Tank" action button on each user row in the table, setting `tankUser` state to open the drawer.

- [ ] **Step 6: Run test to verify it passes**

Run: `node frontend/tests/admin_tank_drawer.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/components/admin/AdminTankDrawer.tsx frontend/pages/admin/AdminGacha.tsx frontend/types.ts frontend/tests/admin_tank_drawer.test.js
git commit -m "feat(admin): add aquarium management drawer and configurable tank reset dialog"
```

---

### Task 4: Overhaul Diving Experience with Marine Suspense & Pod Reveal

**Files:**
- Modify: `frontend/components/oceanarium/DiveStation.tsx`
- Test: `frontend/tests/dive_station_suspense.test.js`

**Interfaces:**
- Consumes: `ecosystem`, `onPull`, `onBackToTank`, `oceanAudio`
- Produces: Multi-stage dive experience (`idle` -> `descent` -> `sonar_lock` -> `pod_reveal` -> `summary`)

- [ ] **Step 1: Write test for DiveStation suspense flow in `frontend/tests/dive_station_suspense.test.js`**

```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stationPath = path.join(__dirname, '../components/oceanarium/DiveStation.tsx');

assert.ok(fs.existsSync(stationPath), 'DiveStation.tsx must exist');
const content = fs.readFileSync(stationPath, 'utf8');

assert.ok(content.includes('sonar_lock') || content.includes('Sonar Anomaly'), 'Must feature sonar lock/anomaly stage');
assert.ok(content.includes('oceanAudio'), 'Must use oceanAudio engine');
assert.ok(content.includes('Skip') || content.includes('Reveal All'), 'Must include Skip / Reveal All option');
assert.ok(content.includes('Sunlit') && content.includes('Abyssal'), 'Must reference depth zones');

console.log('✓ DiveStation suspense mechanics verified');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/dive_station_suspense.test.js`
Expected: FAIL (current DiveStation does not yet import `oceanAudio` or have `sonar_lock`)

- [ ] **Step 3: Implement overhauled `DiveStation.tsx`**

1. Depth descent viewport with dynamic lighting (Sunlit -> Twilight -> Abyssal) and digital depth gauge.
2. Radar anomaly anticipation phase with banner/strobe alert graded by the highest rarity in the pull (`legendary` = crimson alarm + screen shake, `epic` = violet pulse, `rare` = azure shimmer, `common` = cyan ping).
3. Pod unsealing stage:
   - Bio-containment canisters with click-to-open mechanics.
   - For Epic/Legendary: 1.2s suspense pause with steam venting, glowing eyes silhouette, and explosive shockwave particle burst.
   - Top-corner "Skip to Summary" button.
4. Expedition research manifest summary grid.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/dive_station_suspense.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/oceanarium/DiveStation.tsx frontend/tests/dive_station_suspense.test.js
git commit -m "feat(oceanarium): overhaul diving experience with depth zones, sonar suspense, and pod reveals"
```

---

### Task 5: End-to-End Verification & Production Build

**Files:**
- Test: `frontend/tests/*`, `backend/tests/*`

- [ ] **Step 1: Run all frontend unit tests**

```bash
node frontend/tests/admin_tank_drawer.test.js && \
node frontend/tests/ocean_audio.test.js && \
node frontend/tests/dive_station_suspense.test.js && \
node frontend/tests/admin_gacha_page.test.js && \
node frontend/tests/oceanarium_guard_superadmin.test.js
```
Expected: All tests PASS.

- [ ] **Step 2: Run all backend tests**

```bash
npm test --prefix backend
```
Expected: All backend test suites exit with code 0.

- [ ] **Step 3: Compile frontend bundle**

```bash
npm run build --prefix frontend
```
Expected: Vite build succeeds in dist/ with zero TypeScript errors.

- [ ] **Step 4: Update Walkthrough documentation**

Update `walkthrough.md` with features and verification evidence.
