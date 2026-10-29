# Event Action Stats, Stacked Activity Chart, and Team-less Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an event activity stats dashboard, a time-series stacked bar chart with smart binning and user filtering, and support for individual (team-less) competitions with conditional leaderboards.

**Architecture:** Extend SQLite database with `has_teams` on `events` and nullable `team_id` on `event_contributions`; update `scoringService` to track contributions regardless of team membership; add `GET /api/events/:id/stats` endpoint with smart binning; enhance `EventDetailPage.tsx` with summary cards, an interactive Recharts stacked bar chart, and conditional rendering between Team and Individual Leaderboards.

**Tech Stack:** Node.js, Express, SQLite (better-sqlite3), React 18, TypeScript, Tailwind CSS, Lucide React, Recharts.

## Global Constraints

- Preserve documentation and existing codebase conventions.
- SQLite date/time functions: UTC format (`YYYY-MM-DD HH:MM:SS` or ISO string).
- In SQLite, `has_teams` is `INTEGER NOT NULL DEFAULT 1 CHECK(has_teams IN (0, 1))`.
- Smart binning rules: $\le 48\text{h} \to \text{hour}$; $2\text{--}30\text{ days} \to \text{day}$; $> 30\text{ days} \to \text{week}$.
- Recharts version: `^3.7.0` (already installed).

---

### Task 1: Database Schema Support (`has_teams` and Nullable `team_id`)

**Files:**
- Modify: `backend/src/services/eventService.js:10-30`
- Test: `backend/tests/event_has_teams_db.test.js`

**Interfaces:**
- Consumes: SQLite DB connection via `getDatabase()`
- Produces: `ensureEventsTable()` guaranteeing `events.has_teams` exists (default 1) and `event_contributions.team_id` accepts `NULL`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/event_has_teams_db.test.js`:
```javascript
const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { ensureEventsTable } = require("../src/services/eventService");

function runTest() {
  console.log("Running Task 1: Event has_teams schema test...");
  ensureEventsTable();
  const db = getDatabase();

  // 1. Verify has_teams column in events table
  const eventCols = db.prepare("PRAGMA table_info(events)").all().map(c => c.name);
  assert.ok(eventCols.includes("has_teams"), "events table must have has_teams column");

  // 2. Verify event_contributions allows NULL team_id
  const contribTable = db.prepare("PRAGMA table_info(event_contributions)").all();
  const teamIdCol = contribTable.find(c => c.name === "team_id");
  assert.ok(teamIdCol, "event_contributions must have team_id column");
  assert.strictEqual(teamIdCol.notnull, 0, "event_contributions.team_id must allow NULL");

  console.log("PASS: Task 1 schema test passed!");
}

runTest();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/event_has_teams_db.test.js`
Expected: FAIL (column `has_teams` missing or `team_id.notnull` is 1).

- [ ] **Step 3: Implement minimal schema migration in `eventService.js`**

Modify `ensureEventsTable` in `backend/src/services/eventService.js`:
```javascript
function ensureEventsTable() {
  const db = getDatabase();
  const hasEventsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").get();
  if (!hasEventsTable) {
    const migrationSql = fs.readFileSync(path.join(__dirname, "../db/migrations/035_events.sql"), "utf8");
    db.exec(migrationSql);
  } else {
    const tableInfo = db.prepare("PRAGMA table_info(events)").all();
    const colNames = tableInfo.map(c => c.name);
    if (!colNames.includes("source_id")) {
      try { db.prepare("ALTER TABLE events ADD COLUMN source_id INTEGER REFERENCES sources(source_id) ON DELETE SET NULL").run(); } catch(e){}
    }
    if (!colNames.includes("target_language")) {
      try { db.prepare("ALTER TABLE events ADD COLUMN target_language TEXT DEFAULT 'all'").run(); } catch(e){}
    }
    if (!colNames.includes("target_count")) {
      try { db.prepare("ALTER TABLE events ADD COLUMN target_count INTEGER DEFAULT 100").run(); } catch(e){}
    }
    if (!colNames.includes("is_featured_homepage")) {
      try { db.prepare("ALTER TABLE events ADD COLUMN is_featured_homepage INTEGER DEFAULT 0").run(); } catch(e){}
    }
    if (!colNames.includes("has_teams")) {
      try { db.prepare("ALTER TABLE events ADD COLUMN has_teams INTEGER NOT NULL DEFAULT 1 CHECK(has_teams IN (0, 1))").run(); } catch(e){}
    }
  }

  // Ensure event_contributions.team_id allows NULL
  const contribInfo = db.prepare("PRAGMA table_info(event_contributions)").all();
  const teamIdCol = contribInfo.find(c => c.name === "team_id");
  if (teamIdCol && teamIdCol.notnull === 1) {
    db.exec(`
      PRAGMA foreign_keys=off;
      CREATE TABLE IF NOT EXISTS event_contributions_new (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        team_id TEXT REFERENCES event_teams(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        translation_id INTEGER REFERENCES translations(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL CHECK(action_type IN ('TRANSLATION_CREATED', 'TRANSLATION_APPROVED', 'VOTE_CAST')),
        points INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO event_contributions_new SELECT * FROM event_contributions;
      DROP TABLE event_contributions;
      ALTER TABLE event_contributions_new RENAME TO event_contributions;
      PRAGMA foreign_keys=on;
    `);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/event_has_teams_db.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/eventService.js backend/tests/event_has_teams_db.test.js
git commit -m "feat(db): add has_teams column to events and allow nullable team_id in event_contributions"
```

---

### Task 2: Individual Scoring & Non-Team Contributions

**Files:**
- Modify: `backend/src/services/scoringService.js:4-51`
- Modify: `backend/src/services/eventService.js:164-203` (`createEvent`)
- Test: `backend/tests/event_individual_scoring.test.js`

**Interfaces:**
- Consumes: `createEvent({ title, description, startDate, endDate, sourceId, targetLanguage, targetCount, rewardTitle, hasTeams })`
- Produces: `recordEventContribution(userId, translationId, actionType)` recording rows even when `team_id` is null.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/event_individual_scoring.test.js`:
```javascript
const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { createEvent, deleteEvent } = require("../src/services/eventService");
const { recordEventContribution } = require("../src/services/scoringService");

function runTest() {
  console.log("Running Task 2: Individual Scoring test...");
  const db = getDatabase();

  // Ensure test user exists
  let user = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!user) {
    db.prepare("INSERT INTO users (username, email, role) VALUES ('test_scorer', 'scorer@example.com', 'user')").run();
    user = db.prepare("SELECT id FROM users WHERE username = 'test_scorer'").get();
  }

  // Create active event with hasTeams = false
  const now = new Date();
  const start = new Date(now.getTime() - 60000).toISOString();
  const end = new Date(now.getTime() + 86400000).toISOString();

  const evt = createEvent({
    title: "Solo Challenge",
    description: "No teams competition",
    startDate: start,
    endDate: end,
    hasTeams: false
  });

  assert.strictEqual(evt.has_teams, 0, "Event must be created with has_teams = 0");

  // Record translation created contribution
  const res = recordEventContribution(user.id, null, 'TRANSLATION_CREATED');
  const matched = res.find(c => c.event_id === evt.id);
  assert.ok(matched, "Contribution must be recorded for active team-less event");
  assert.strictEqual(matched.team_id, null, "Recorded contribution team_id must be null");

  // Verify in DB
  const row = db.prepare("SELECT * FROM event_contributions WHERE event_id = ?").get(evt.id);
  assert.ok(row, "Row must exist in event_contributions");
  assert.strictEqual(row.team_id, null);
  assert.strictEqual(row.points, 5);

  deleteEvent(evt.id);
  console.log("PASS: Task 2 individual scoring test passed!");
}

runTest();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/event_individual_scoring.test.js`
Expected: FAIL.

- [ ] **Step 3: Update `createEvent` and `recordEventContribution`**

In `backend/src/services/eventService.js`:
```javascript
function createEvent({ title, description, startDate, endDate, sourceId, targetLanguage, targetCount, rewardTitle, hasTeams }) {
  ensureEventsTable();
  const db = getDatabase();
  const id = `evt_${crypto.randomUUID()}`;

  const now = new Date().toISOString();
  let status = "UPCOMING";
  if (startDate <= now && endDate >= now) {
    status = "ACTIVE";
  } else if (endDate < now) {
    status = "ENDED";
  }

  const parsedSourceId = sourceId && sourceId !== "ALL" ? parseInt(sourceId, 10) : null;

  let parsedTargetCount = 100;
  if (targetCount === "highest" || targetCount === 0 || targetCount === -1 || targetCount === "0") {
    parsedTargetCount = 0;
  } else if (targetCount !== undefined && targetCount !== null) {
    parsedTargetCount = parseInt(targetCount, 10);
  }

  const parsedHasTeams = (hasTeams === false || hasTeams === 0 || hasTeams === "0" || hasTeams === "false") ? 0 : 1;

  db.prepare(`
    INSERT INTO events (id, title, description, start_date, end_date, source_id, target_language, target_count, status, has_teams)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description || "", startDate, endDate, parsedSourceId, targetLanguage || "all", parsedTargetCount, status, parsedHasTeams);

  if (rewardTitle) {
    const rewardId = `rew_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO event_rewards (id, event_id, reward_type, name)
      VALUES (?, ?, 'TITLE', ?)
    `).run(rewardId, id, rewardTitle);
  }

  return getEventById(id);
}
```

In `backend/src/services/scoringService.js`:
```javascript
function recordEventContribution(userId, translationId, actionType, category = 'ALL') {
  const db = getDatabase();

  let termSourceId = null;
  let translationLang = null;
  if (translationId) {
    const row = db.prepare(`
      SELECT t.source_id, tr.language
      FROM translations tr
      JOIN term_fields tf ON tr.term_field_id = tf.id
      JOIN terms t ON tf.term_id = t.id
      WHERE tr.id = ?
    `).get(translationId);
    if (row) {
      termSourceId = row.source_id;
      translationLang = row.language;
    }
  }

  const sId = termSourceId !== undefined && termSourceId !== null ? termSourceId : null;
  const activeEvents = db.prepare(`
    SELECT e.id as event_id, e.has_teams,
           (SELECT team_id FROM event_memberships WHERE event_id = e.id AND user_id = ? AND is_active = 1 LIMIT 1) as team_id
    FROM events e
    WHERE e.status = 'ACTIVE'
      AND (e.source_id IS NULL OR ? IS NULL OR e.source_id = ?)
      AND (e.target_language = 'all' OR ? IS NULL OR e.target_language = ?)
  `).all(userId, sId, sId, translationLang, translationLang);

  const inserted = [];
  const stmt = db.prepare(`
    INSERT INTO event_contributions (id, event_id, team_id, user_id, translation_id, action_type, points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const pointsMap = {
    'TRANSLATION_APPROVED': 10,
    'TRANSLATION_CREATED': 5,
    'VOTE_CAST': 2
  };
  const points = pointsMap[actionType] || 1;

  for (const ev of activeEvents) {
    const assignedTeamId = ev.has_teams === 1 ? (ev.team_id || null) : null;
    const id = `cnt_${crypto.randomUUID()}`;
    stmt.run(id, ev.event_id, assignedTeamId, userId, translationId || null, actionType, points);
    inserted.push({ id, event_id: ev.event_id, team_id: assignedTeamId, points });
  }

  return inserted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/event_individual_scoring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/eventService.js backend/src/services/scoringService.js backend/tests/event_individual_scoring.test.js
git commit -m "feat(scoring): support individual event contributions and has_teams flag"
```

---

### Task 3: Event Analytics & Time-Series API Endpoint

**Files:**
- Modify: `backend/src/services/eventService.js` (add `getEventStats`)
- Modify: `backend/src/controllers/eventController.js` (add `getEventStats`)
- Modify: `backend/src/routes/eventRoutes.js` (add route `GET /events/:id/stats`)
- Test: `backend/tests/event_stats_api.test.js`

**Interfaces:**
- Consumes: `GET /api/events/:id/stats?resolution=smart|hour|day|week&userOnly=true|false`
- Produces: `{ stats: { inReviewCount, approvedCount, totalActions, totalPoints, activeContributors }, timeline: { resolution, data: [...] }, individualLeaderboard: [...] }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/event_stats_api.test.js`:
```javascript
const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { createEvent, deleteEvent, getEventStats } = require("../src/services/eventService");

function runTest() {
  console.log("Running Task 3: Event Stats API service test...");
  const db = getDatabase();

  let user = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!user) {
    db.prepare("INSERT INTO users (username, email, role) VALUES ('test_stats_user', 'stats@example.com', 'user')").run();
    user = db.prepare("SELECT id FROM users WHERE username = 'test_stats_user'").get();
  }

  const now = new Date();
  const start = new Date(now.getTime() - 3600000).toISOString();
  const end = new Date(now.getTime() + 86400000).toISOString();

  const evt = createEvent({
    title: "Stats Test Event",
    startDate: start,
    endDate: end,
    hasTeams: false
  });

  // Seed sample contributions
  db.prepare(`
    INSERT INTO event_contributions (id, event_id, team_id, user_id, action_type, points, created_at)
    VALUES ('c1', ?, NULL, ?, 'TRANSLATION_CREATED', 5, ?),
           ('c2', ?, NULL, ?, 'TRANSLATION_APPROVED', 10, ?)
  `).run(evt.id, user.id, new Date(now.getTime() - 1800000).toISOString(),
         evt.id, user.id, new Date(now.getTime() - 600000).toISOString());

  // Test getEventStats default
  const result = getEventStats(evt.id, null, 'smart', false);
  assert.ok(result.stats, "Response must include stats object");
  assert.strictEqual(result.stats.inReviewCount, 1);
  assert.strictEqual(result.stats.approvedCount, 1);
  assert.strictEqual(result.stats.totalActions, 2);
  assert.strictEqual(result.stats.totalPoints, 15);
  assert.strictEqual(result.stats.activeContributors, 1);

  assert.ok(result.timeline, "Response must include timeline object");
  assert.strictEqual(result.timeline.resolution, "hour");
  assert.ok(result.timeline.data.length >= 1);

  assert.ok(Array.isArray(result.individualLeaderboard), "Must include individualLeaderboard array");
  assert.strictEqual(result.individualLeaderboard[0].userId, user.id);
  assert.strictEqual(result.individualLeaderboard[0].totalPoints, 15);

  deleteEvent(evt.id);
  console.log("PASS: Task 3 Event Stats API service test passed!");
}

runTest();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/event_stats_api.test.js`
Expected: FAIL (`getEventStats is not a function`).

- [ ] **Step 3: Implement `getEventStats` in `backend/src/services/eventService.js`**

Add to `backend/src/services/eventService.js`:
```javascript
function getEventStats(eventId, userId = null, requestedResolution = 'smart', userOnly = false) {
  ensureEventsTable();
  const db = getDatabase();

  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  if (!event) throw new Error("Event not found");

  const filterUser = (userOnly && userId) ? userId : null;

  // 1. Calculate Summary Stats
  let statsSql = `
    SELECT 
      COALESCE(SUM(CASE WHEN action_type = 'TRANSLATION_CREATED' THEN 1 ELSE 0 END), 0) as inReviewCount,
      COALESCE(SUM(CASE WHEN action_type = 'TRANSLATION_APPROVED' THEN 1 ELSE 0 END), 0) as approvedCount,
      COUNT(*) as totalActions,
      COALESCE(SUM(points), 0) as totalPoints,
      COUNT(DISTINCT user_id) as activeContributors
    FROM event_contributions
    WHERE event_id = ?
  `;
  const statsParams = [eventId];
  if (filterUser) {
    statsSql += ` AND user_id = ?`;
    statsParams.push(filterUser);
  }
  const stats = db.prepare(statsSql).get(...statsParams);

  // 2. Resolve Smart Binning Resolution
  let resolution = requestedResolution;
  if (!resolution || resolution === 'smart') {
    const startTime = new Date(event.start_date).getTime();
    const nowTime = Date.now();
    const elapsedHours = Math.max(1, (nowTime - startTime) / (1000 * 60 * 60));
    if (elapsedHours <= 48) {
      resolution = 'hour';
    } else if (elapsedHours <= 24 * 30) {
      resolution = 'day';
    } else {
      resolution = 'week';
    }
  }

  // Grouping format for SQLite
  let groupFormat;
  let labelFormat;
  if (resolution === 'hour') {
    groupFormat = "strftime('%Y-%m-%d %H:00', created_at)";
  } else if (resolution === 'week') {
    groupFormat = "strftime('%Y-W%W', created_at)";
  } else {
    resolution = 'day';
    groupFormat = "strftime('%Y-%m-%d', created_at)";
  }

  let timelineSql = `
    SELECT 
      ${groupFormat} as timestamp,
      COALESCE(SUM(CASE WHEN action_type = 'TRANSLATION_CREATED' THEN 1 ELSE 0 END), 0) as inReview,
      COALESCE(SUM(CASE WHEN action_type = 'TRANSLATION_APPROVED' THEN 1 ELSE 0 END), 0) as approved,
      COUNT(*) as total
    FROM event_contributions
    WHERE event_id = ?
  `;
  const timelineParams = [eventId];
  if (filterUser) {
    timelineSql += ` AND user_id = ?`;
    timelineParams.push(filterUser);
  }
  timelineSql += ` GROUP BY ${groupFormat} ORDER BY timestamp ASC`;
  const timelineRows = db.prepare(timelineSql).all(...timelineParams);

  const timelineData = timelineRows.map(row => ({
    timestamp: row.timestamp,
    label: row.timestamp,
    inReview: row.inReview,
    approved: row.approved,
    total: row.total
  }));

  // 3. Individual Leaderboard
  const individualLeaderboard = db.prepare(`
    SELECT 
      u.id as userId,
      COALESCE(u.display_name, u.username) as name,
      u.avatar_url as avatarUrl,
      COALESCE(SUM(c.points), 0) as totalPoints,
      COUNT(CASE WHEN c.action_type IN ('TRANSLATION_CREATED', 'TRANSLATION_APPROVED') THEN 1 END) as translationsCount
    FROM event_contributions c
    JOIN users u ON c.user_id = u.id
    WHERE c.event_id = ?
    GROUP BY u.id
    ORDER BY totalPoints DESC
    LIMIT 50
  `).all(eventId);

  return {
    stats: {
      inReviewCount: stats.inReviewCount,
      approvedCount: stats.approvedCount,
      totalActions: stats.totalActions,
      totalPoints: stats.totalPoints,
      activeContributors: stats.activeContributors
    },
    timeline: {
      resolution,
      data: timelineData
    },
    individualLeaderboard
  };
}
```
Export `getEventStats` in `module.exports` of `eventService.js`.

- [ ] **Step 4: Wire controller and route in `eventController.js` and `eventRoutes.js`**

In `backend/src/controllers/eventController.js`:
```javascript
exports.getEventStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, userOnly } = req.query;
    const userId = req.user ? req.user.id : null;
    const isUserOnly = userOnly === 'true' || userOnly === true;
    const stats = eventService.getEventStats(id, userId, resolution, isUserOnly);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

In `backend/src/routes/eventRoutes.js`:
```javascript
router.get("/events/:id/stats", optionalAuth, eventController.getEventStats);
```
*(Note: If `optionalAuth` middleware does not exist, use `(req, res, next) => { ... }` or use the existing auth token parser if header is present).*

- [ ] **Step 5: Run tests and verify they pass**

Run: `node backend/tests/event_stats_api.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/eventService.js backend/src/controllers/eventController.js backend/src/routes/eventRoutes.js backend/tests/event_stats_api.test.js
git commit -m "feat(api): add getEventStats endpoint with smart binning and individual rankings"
```

---

### Task 4: Reward Settlement for Individual Events

**Files:**
- Modify: `backend/src/services/rewardService.js:80-140`
- Test: `backend/tests/event_reward_individual.test.js`

**Interfaces:**
- Consumes: `settleEventRewards(eventId)`
- Produces: Rewards top individual contributor when `event.has_teams === 0`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/event_reward_individual.test.js`:
```javascript
const assert = require("assert");
const { getDatabase } = require("../src/db/database");
const { createEvent, deleteEvent } = require("../src/services/eventService");
const { settleEventRewards } = require("../src/services/rewardService");

function runTest() {
  console.log("Running Task 4: Individual Reward Settlement test...");
  const db = getDatabase();

  let user = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!user) {
    db.prepare("INSERT INTO users (username, email, role) VALUES ('solo_champ', 'champ@example.com', 'user')").run();
    user = db.prepare("SELECT id FROM users WHERE username = 'solo_champ'").get();
  }

  const evt = createEvent({
    title: "Solo Champ Event",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-01-02T00:00:00.000Z",
    hasTeams: false,
    rewardTitle: "Solo Legend 2026"
  });

  // Insert contribution
  db.prepare(`
    INSERT INTO event_contributions (id, event_id, team_id, user_id, action_type, points)
    VALUES ('c_solo', ?, NULL, ?, 'TRANSLATION_APPROVED', 50)
  `).run(evt.id, user.id);

  const res = settleEventRewards(evt.id);
  assert.strictEqual(res.settled, true);
  assert.strictEqual(res.awardedCount, 1);

  // Verify user reward
  const rewardRow = db.prepare(`
    SELECT ur.*, r.name as title_name 
    FROM user_rewards ur
    JOIN event_rewards r ON ur.reward_id = r.id
    WHERE ur.user_id = ? AND r.event_id = ?
  `).get(user.id, evt.id);
  assert.ok(rewardRow);
  assert.strictEqual(rewardRow.title_name, "Solo Legend 2026");

  deleteEvent(evt.id);
  console.log("PASS: Task 4 Individual Reward Settlement test passed!");
}

runTest();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/tests/event_reward_individual.test.js`
Expected: FAIL.

- [ ] **Step 3: Update `settleEventRewards` in `rewardService.js`**

In `backend/src/services/rewardService.js`:
Check `event.has_teams`. If `event.has_teams === 0`:
```javascript
  if (event.has_teams === 0) {
    const topIndividual = db.prepare(`
      SELECT user_id, SUM(points) as total_points
      FROM event_contributions
      WHERE event_id = ?
      GROUP BY user_id
      HAVING total_points > 0
      ORDER BY total_points DESC
      LIMIT 1
    `).get(eventId);

    if (!topIndividual) {
      return { settled: false, reason: "No qualifying individual contributions found." };
    }

    const reward = db.prepare("SELECT * FROM event_rewards WHERE event_id = ? AND reward_type = 'TITLE' LIMIT 1").get(eventId);
    if (!reward) {
      return { settled: false, reason: "No profile title configured for this event." };
    }

    let awardedCount = 0;
    const existing = db.prepare("SELECT id FROM user_rewards WHERE user_id = ? AND reward_id = ?").get(topIndividual.user_id, reward.id);
    if (!existing) {
      const urId = `ur_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO user_rewards (id, user_id, reward_id, is_equipped)
        VALUES (?, ?, ?, 1)
      `).run(urId, topIndividual.user_id, reward.id);
      awardedCount++;
    }

    const winnerUser = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(topIndividual.user_id);
    return {
      settled: true,
      teamName: winnerUser ? (winnerUser.display_name || winnerUser.username) : "Individual Winner",
      awardedCount,
      titleName: reward.name
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node backend/tests/event_reward_individual.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/rewardService.js backend/tests/event_reward_individual.test.js
git commit -m "feat(rewards): settle grand prize title for individual events"
```

---

### Task 5: Frontend API Types, Service & Admin Events Toggle

**Files:**
- Modify: `frontend/types.ts`
- Modify: `frontend/services/eventApi.ts`
- Modify: `frontend/pages/admin/AdminEvents.tsx`
- Test: `frontend/tests/admin_event_has_teams.test.js`

**Interfaces:**
- Consumes: `fetchEventStats(eventId, resolution?, userOnly?)`, `createEvent({ ..., hasTeams })`
- Produces: `has_teams` in `Event` interface, admin toggle UI for Team vs Individual challenge.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/admin_event_has_teams.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Task 5: Admin Events hasTeams TDD test...");

  const adminPath = path.join(__dirname, '../pages/admin/AdminEvents.tsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');

  // Verify AdminEvents contains hasTeams state and toggle UI
  assert.ok(adminContent.includes("hasTeams"), "AdminEvents must manage hasTeams state");
  assert.ok(adminContent.includes("Individual Challenge") || adminContent.includes("No Teams"), "AdminEvents must provide Individual Challenge option");

  const typesPath = path.join(__dirname, '../types.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  assert.ok(typesContent.includes("has_teams"), "types.ts Event interface must include has_teams");

  console.log("PASS: Task 5 Admin Events hasTeams test passed!");
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/admin_event_has_teams.test.js`
Expected: FAIL.

- [ ] **Step 3: Update `frontend/types.ts`, `frontend/services/eventApi.ts`, and `frontend/pages/admin/AdminEvents.tsx`**

In `frontend/types.ts`:
```typescript
export interface EventStatsSummary {
  inReviewCount: number;
  approvedCount: number;
  totalActions: number;
  totalPoints: number;
  activeContributors: number;
}

export interface EventTimelinePoint {
  timestamp: string;
  label: string;
  inReview: number;
  approved: number;
  total: number;
}

export interface IndividualLeaderboardEntry {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  totalPoints: number;
  translationsCount: number;
}

export interface EventStatsResponse {
  stats: EventStatsSummary;
  timeline: {
    resolution: 'hour' | 'day' | 'week';
    data: EventTimelinePoint[];
  };
  individualLeaderboard: IndividualLeaderboardEntry[];
}
```
Add `has_teams?: number;` to `Event` interface.

In `frontend/services/eventApi.ts`:
Add `hasTeams?: boolean;` to `createEvent` params.
Add `fetchEventStats`:
```typescript
export const fetchEventStats = async (
  eventId: string,
  resolution: string = 'smart',
  userOnly: boolean = false
): Promise<EventStatsResponse> => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/events/${eventId}/stats?resolution=${resolution}&userOnly=${userOnly}`, { headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch event stats');
  }
  return res.json();
};
```

In `frontend/pages/admin/AdminEvents.tsx`:
Add `const [hasTeams, setHasTeams] = useState(true);`
In `handleCreateEvent`: pass `hasTeams` to `createEvent`.
In modal JSX: Add Competition Format selector:
```tsx
<div>
  <label className="block text-xs font-semibold text-slate-300 mb-1">Competition Format</label>
  <div className="grid grid-cols-2 gap-3">
    <button
      type="button"
      onClick={() => setHasTeams(true)}
      className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
        hasTeams ? "bg-cyan-600/30 border-cyan-500 text-cyan-300" : "bg-slate-800 border-slate-700 text-slate-400"
      }`}
    >
      👥 Team Competition
    </button>
    <button
      type="button"
      onClick={() => setHasTeams(false)}
      className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
        !hasTeams ? "bg-cyan-600/30 border-cyan-500 text-cyan-300" : "bg-slate-800 border-slate-700 text-slate-400"
      }`}
    >
      👤 Individual Challenge (No Teams)
    </button>
  </div>
  {!hasTeams && (
    <p className="text-[11px] text-slate-400 mt-1">Participants contribute directly as individuals. No teams are created or required.</p>
  )}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/tests/admin_event_has_teams.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/types.ts frontend/services/eventApi.ts frontend/pages/admin/AdminEvents.tsx frontend/tests/admin_event_has_teams.test.js
git commit -m "feat(admin): add competition format toggle for team vs individual events"
```

---

### Task 6: Event Detail Page Activity Stats & Recharts Stacked Bar Chart

**Files:**
- Create: `frontend/components/EventActivityChart.tsx`
- Modify: `frontend/pages/EventDetailPage.tsx`
- Test: `frontend/tests/event_detail_analytics.test.js`

**Interfaces:**
- Consumes: `fetchEventStats(eventId, resolution, userOnly)`
- Produces: 4 summary cards (In Review, Approved, Points, Contributors), Recharts stacked bar chart with resolution pills (`Auto`, `Hour`, `Day`, `Week`) and user toggle (`All Activity` vs `My Contributions`).

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/event_detail_analytics.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Task 6: Event Detail Analytics TDD test...");

  const detailPath = path.join(__dirname, '../pages/EventDetailPage.tsx');
  const detailContent = fs.readFileSync(detailPath, 'utf8');

  // Verify EventDetailPage includes stats fetching, scope toggle, and chart
  assert.ok(detailContent.includes("fetchEventStats"), "EventDetailPage must call fetchEventStats");
  assert.ok(detailContent.includes("EventActivityChart"), "EventDetailPage must render EventActivityChart");
  assert.ok(detailContent.includes("userOnly") || detailContent.includes("scope"), "EventDetailPage must support user-only toggle");

  const chartPath = path.join(__dirname, '../components/EventActivityChart.tsx');
  assert.ok(fs.existsSync(chartPath), "EventActivityChart.tsx must exist");
  const chartContent = fs.readFileSync(chartPath, 'utf8');
  assert.ok(chartContent.includes("BarChart"), "EventActivityChart must use Recharts BarChart");
  assert.ok(chartContent.includes("inReview"), "EventActivityChart must include inReview bar");
  assert.ok(chartContent.includes("approved"), "EventActivityChart must include approved bar");

  console.log("PASS: Task 6 Event Detail Analytics test passed!");
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/event_detail_analytics.test.js`
Expected: FAIL (`EventActivityChart.tsx does not exist`).

- [ ] **Step 3: Implement `frontend/components/EventActivityChart.tsx`**

Create `frontend/components/EventActivityChart.tsx`:
```tsx
import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { EventTimelinePoint } from '../types';

interface EventActivityChartProps {
  data: EventTimelinePoint[];
  resolution: 'hour' | 'day' | 'week';
  selectedResolution: string;
  onResolutionChange: (res: string) => void;
}

export const EventActivityChart: React.FC<EventActivityChartProps> = ({
  data,
  resolution,
  selectedResolution,
  onResolutionChange
}) => {
  const resolutions = [
    { id: 'smart', label: `Auto (${resolution})` },
    { id: 'hour', label: 'Hourly' },
    { id: 'day', label: 'Daily' },
    { id: 'week', label: 'Weekly' }
  ];

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity Over Time</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Work completed since competition started (In Review vs Approved)
          </p>
        </div>

        {/* Resolution selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
          {resolutions.map((r) => (
            <button
              key={r.id}
              onClick={() => onResolutionChange(r.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                selectedResolution === r.id
                  ? 'bg-white dark:bg-cyan-600 text-cyan-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-400 text-sm">
          No contribution activity recorded yet for this timeframe.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => {
                  if (resolution === 'hour') return val.split(' ')[1] || val;
                  if (resolution === 'day') return val.slice(5);
                  return val;
                }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const inRev = payload.find(p => p.dataKey === 'inReview')?.value || 0;
                  const app = payload.find(p => p.dataKey === 'approved')?.value || 0;
                  const tot = Number(inRev) + Number(app);
                  return (
                    <div className="bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl p-3 text-xs space-y-1">
                      <div className="font-semibold text-slate-300 mb-1">{label}</div>
                      <div className="flex items-center justify-between gap-4 text-amber-400">
                        <span>📝 In Review:</span>
                        <span className="font-bold">{inRev}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400">
                        <span>✅ Approved:</span>
                        <span className="font-bold">{app}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-4 text-white font-bold">
                        <span>Total Actions:</span>
                        <span>{tot}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(val) => (
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {val === 'inReview' ? 'In Review' : 'Approved'}
                  </span>
                )}
              />
              <Bar dataKey="inReview" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="inReview" />
              <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="approved" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Update `frontend/pages/EventDetailPage.tsx` to include summary cards and chart**

Import `EventActivityChart`, `fetchEventStats`, `EventStatsResponse`.
Add state:
- `eventStats: EventStatsResponse | null`
- `userOnly: boolean` (default false)
- `chartResolution: string` (default 'smart')
Fetch stats in `loadEvent` and whenever `userOnly` or `chartResolution` changes.
Render summary metric cards and `<EventActivityChart>` with the "All Activity" vs "My Contributions" pill toggle.

- [ ] **Step 5: Run test to verify it passes**

Run: `node frontend/tests/event_detail_analytics.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/EventActivityChart.tsx frontend/pages/EventDetailPage.tsx frontend/tests/event_detail_analytics.test.js
git commit -m "feat(ui): add event activity stat cards and stacked bar chart with smart binning"
```

---

### Task 7: Conditional Leaderboards (Team vs Individual)

**Files:**
- Create: `frontend/components/EventIndividualLeaderboard.tsx`
- Modify: `frontend/pages/EventDetailPage.tsx`
- Test: `frontend/tests/event_conditional_leaderboard.test.js`

**Interfaces:**
- Consumes: `event.has_teams`, `eventStats.individualLeaderboard`
- Produces: Completely removes Team Leaderboard when `event.has_teams === 0` and renders Individual Leaderboard instead.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/event_conditional_leaderboard.test.js`:
```javascript
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  console.log("Running Task 7: Conditional Leaderboard TDD test...");

  const detailPath = path.join(__dirname, '../pages/EventDetailPage.tsx');
  const detailContent = fs.readFileSync(detailPath, 'utf8');

  // Verify EventDetailPage checks has_teams for conditional leaderboard
  assert.ok(detailContent.includes("has_teams === 0") || detailContent.includes("!event.has_teams"), "EventDetailPage must conditionally render based on has_teams");
  assert.ok(detailContent.includes("EventIndividualLeaderboard"), "EventDetailPage must render EventIndividualLeaderboard");

  const indPath = path.join(__dirname, '../components/EventIndividualLeaderboard.tsx');
  assert.ok(fs.existsSync(indPath), "EventIndividualLeaderboard.tsx must exist");
  const indContent = fs.readFileSync(indPath, 'utf8');
  assert.ok(indContent.includes("Individual Leaderboard") || indContent.includes("Top Contributors"), "Must have leaderboard title");

  console.log("PASS: Task 7 Conditional Leaderboard test passed!");
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/tests/event_conditional_leaderboard.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `frontend/components/EventIndividualLeaderboard.tsx`**

Create `frontend/components/EventIndividualLeaderboard.tsx`:
```tsx
import React from 'react';
import { Trophy, Award, User as UserIcon } from 'lucide-react';
import { IndividualLeaderboardEntry } from '../types';

interface EventIndividualLeaderboardProps {
  contributors: IndividualLeaderboardEntry[];
  currentUserId?: number;
}

export const EventIndividualLeaderboard: React.FC<EventIndividualLeaderboardProps> = ({
  contributors,
  currentUserId
}) => {
  const top3 = contributors.slice(0, 3);
  const remaining = contributors.slice(3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" /> Individual Leaderboard
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {contributors.length} active contributors
        </span>
      </div>

      {contributors.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
          No individual contributions recorded yet. Start translating to take the top spot!
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {top3.map((entry, idx) => {
              const isMe = currentUserId && entry.userId === currentUserId;
              return (
                <div
                  key={entry.userId}
                  className={`bg-white dark:bg-slate-800/90 border rounded-2xl p-6 shadow-lg relative overflow-hidden transition ${
                    isMe
                      ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40"
                      : idx === 0
                      ? "border-amber-400 dark:border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent"
                      : idx === 1
                      ? "border-slate-300 dark:border-slate-500/50 bg-gradient-to-b from-slate-400/10 via-slate-400/5 to-transparent"
                      : "border-amber-700/40 dark:border-amber-700/50 bg-gradient-to-b from-amber-700/10 via-amber-700/5 to-transparent"
                  }`}
                >
                  {isMe && (
                    <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-emerald-500 text-white font-bold text-[10px] uppercase rounded-full shadow-sm">
                      ✓ You
                    </div>
                  )}

                  <div className="text-3xl mb-2">
                    {idx === 0 ? "🥇 1st Place" : idx === 1 ? "🥈 2nd Place" : "🥉 3rd Place"}
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-2">
                    <UserIcon size={18} className="text-slate-400" />
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate max-w-[200px]">
                      {entry.name}
                    </h3>
                  </div>

                  <p className="text-cyan-600 dark:text-cyan-400 font-mono font-extrabold text-2xl">
                    {entry.totalPoints} pts
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {entry.translationsCount} translations
                  </p>
                </div>
              );
            })}
          </div>

          {/* 4th Place Onwards */}
          {remaining.length > 3 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Other Contributors
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {remaining.map((entry, idx) => {
                  const isMe = currentUserId && entry.userId === currentUserId;
                  return (
                    <div
                      key={entry.userId}
                      className={`bg-white dark:bg-slate-800/90 border rounded-xl p-4 flex items-center justify-between shadow-sm transition ${
                        isMe
                          ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-400 text-sm">#{idx + 4}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              {entry.name}
                            </span>
                            {isMe && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.translationsCount} translations
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {entry.totalPoints} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Update `frontend/pages/EventDetailPage.tsx` to conditionally render Leaderboard**

In `EventDetailPage.tsx`:
```tsx
{event.has_teams === 0 ? (
  <EventIndividualLeaderboard
    contributors={eventStats?.individualLeaderboard || []}
    currentUserId={user?.id}
  />
) : (
  <>
    {/* Existing Team Leaderboard */}
  </>
)}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node frontend/tests/event_conditional_leaderboard.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/EventIndividualLeaderboard.tsx frontend/pages/EventDetailPage.tsx frontend/tests/event_conditional_leaderboard.test.js
git commit -m "feat(ui): conditionally render team vs individual leaderboard based on has_teams"
```

---

### Task 8: Verification & End-to-End Regression Testing

**Files:**
- Test: `backend/tests/event_stats_api.test.js`
- Test: `backend/tests/event_individual_scoring.test.js`
- Test: `backend/tests/event_reward_individual.test.js`
- Test: `frontend/tests/admin_event_has_teams.test.js`
- Test: `frontend/tests/event_detail_analytics.test.js`
- Test: `frontend/tests/event_conditional_leaderboard.test.js`

- [ ] **Step 1: Run all backend tests**

Run: `node backend/tests/event_has_teams_db.test.js && node backend/tests/event_individual_scoring.test.js && node backend/tests/event_stats_api.test.js && node backend/tests/event_reward_individual.test.js`
Expected: All 4 test suites PASS.

- [ ] **Step 2: Run all frontend tests**

Run: `node frontend/tests/admin_event_has_teams.test.js && node frontend/tests/event_detail_analytics.test.js && node frontend/tests/event_conditional_leaderboard.test.js`
Expected: All 3 test suites PASS.

- [ ] **Step 3: Run existing event regression tests**

Run: `node backend/tests/event_scoring.test.js && node backend/tests/event_api.test.js && node backend/tests/event_rewards.test.js && node frontend/tests/event-homepage-visibility.test.js`
Expected: All regression test suites PASS.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify all event stats, chart, and individual leaderboard tests pass"
```
