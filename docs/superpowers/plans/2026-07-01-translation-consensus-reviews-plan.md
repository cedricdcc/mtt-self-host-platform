# Translation Consensus and Multi-Vote Review System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reputation-weighted translation consensus review system with a database migration, updated backend review/consensus flow services, an hourly background auto-approval fallback task, and a new React admin dashboard UI tab to inspect and override pending consensus reviews.

**Architecture:** We will create a `translation_reviews` table to log all review votes. The backend consensus service will calculate the required approval threshold based on active translators in the past 30 days, assign vote weights based on reviewer reputation, and transition status to approved/rejected dynamically. An hourly task will auto-approve positive uncontested translations older than 3 days.

**Tech Stack:** Node.js, Express, SQLite (via `better-sqlite3`), React (Vite/TypeScript), TailwindCSS.

## Global Constraints
- Database migrations must be sequentially numbered and added to `backend/src/db/migrations/`.
- Prevent self-reviews (a translator cannot review their own work).
- Prevent duplicate reviews (a user can only review a translation once).
- Vote weight formula: `weight = 1 + floor(reputation / 100)` (capped at 4).
- Active translator definition: A user who created or modified a translation in the specific language in the last 30 days.
- Consensus thresholds:
  - $\le 2$ active translators $\rightarrow$ required weight = 1
  - $3$ to $5$ active translators $\rightarrow$ required weight = 2
  - $> 5$ active translators $\rightarrow$ required weight = 3
- Fallback auto-approval timeout: 3 days (requires $\ge 1$ approval weight and 0 rejections).
- Frequent atomic commits per task.

---

### Task 1: Database Migration for translation_reviews

**Files:**
- Create: `backend/src/db/migrations/032_translation_reviews.sql`
- Create: `backend/tests/migration.test.js`

- [ ] **Step 1: Write the failing test**
  Create the test file `backend/tests/migration.test.js` to assert the database contains the `translation_reviews` table.
  ```javascript
  // backend/tests/migration.test.js
  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');

  const testDbPath = path.join(__dirname, '../data/test_migration.db');
  process.env.SQLITE_DB_PATH = testDbPath;

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const { getDatabase } = require('../src/db/database');
  const { initializeDatabase } = require('../src/services/dbInit.service');

  async function run() {
    console.log("Running migration test...");
    
    // Initialize database (should run migration)
    initializeDatabase();
    
    const db = getDatabase();
    
    // Test if the table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='translation_reviews'"
    ).get();
    
    assert.ok(tableCheck, "Table 'translation_reviews' should exist");
    
    // Check columns
    const columns = db.prepare("PRAGMA table_info(translation_reviews)").all();
    const columnNames = columns.map(c => c.name);
    assert.deepStrictEqual(
      columnNames,
      ['id', 'translation_id', 'user_id', 'action', 'rejection_reason', 'created_at'],
      "Columns should match schema specification"
    );
    
    console.log("✓ Migration test passed successfully!");
    
    // Clean up
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }

  run().catch(err => {
    console.error("Test Failed:", err.message);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `node backend/tests/migration.test.js`
  Expected: FAIL with "AssertionError [ERR_ASSERTION]: Table 'translation_reviews' should exist"

- [ ] **Step 3: Write minimal implementation**
  Create the migration SQL script: `backend/src/db/migrations/032_translation_reviews.sql`
  ```sql
  -- Migration: 032_translation_reviews.sql
  CREATE TABLE IF NOT EXISTS translation_reviews (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      translation_id INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action         TEXT NOT NULL CHECK(action IN ('approve', 'reject')),
      rejection_reason TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(translation_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_translation_reviews_translation_id ON translation_reviews(translation_id);
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `node backend/tests/migration.test.js`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add backend/tests/migration.test.js backend/src/db/migrations/032_translation_reviews.sql
  git commit -m "feat: add translation_reviews migration and verification test"
  ```

---

### Task 2: Consensus Logic implementation in submitReview

**Files:**
- Create: `backend/tests/consensus.test.js`
- Modify: `backend/src/services/flow.service.js:440-642`

- [ ] **Step 1: Write the failing test**
  Create the test file `backend/tests/consensus.test.js` verifying consensus thresholds, voter weights, self-reviews, and duplicates.
  ```javascript
  // backend/tests/consensus.test.js
  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');

  const testDbPath = path.join(__dirname, '../data/test_consensus.db');
  process.env.SQLITE_DB_PATH = testDbPath;

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const { getDatabase } = require('../src/db/database');
  const { initializeDatabase } = require('../src/services/dbInit.service');
  const flowService = require('../src/services/flow.service');

  async function run() {
    console.log("Running consensus logic test...");
    initializeDatabase();
    const db = getDatabase();

    // 1. Setup mock data
    db.prepare("INSERT INTO users (id, username, reputation) VALUES (1, 'translator', 10)").run();
    db.prepare("INSERT INTO users (id, username, reputation) VALUES (2, 'voter1', 50)").run(); // weight 1
    db.prepare("INSERT INTO users (id, username, reputation) VALUES (3, 'voter2', 150)").run(); // weight 2
    db.prepare("INSERT INTO users (id, username, reputation) VALUES (4, 'voter3', 350)").run(); // weight 4
    
    // Active translators setup (voter1 and translator active in 'nl' in last 30 days)
    db.prepare("INSERT INTO terms (id, uri) VALUES (10, 'http://example.com/term1')").run();
    db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (20, 10, 'label', 'Original')").run();
    
    // Translator created translation 30
    db.prepare(`
      INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
      VALUES (30, 20, 'nl', 'Vertaling', 'review', 1, datetime('now'))
    `).run();

    // Voter1 active translation to make active count = 2 in last 30 days for 'nl'
    db.prepare(`
      INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
      VALUES (31, 20, 'nl', 'Vertaling 2', 'approved', 2, datetime('now'))
    `).run();

    // Test Self-Review Block
    assert.throws(() => {
      flowService.submitReview({
        userId: 1, // translator
        translationId: 30,
        action: 'approve'
      });
    }, /cannot review your own/i);

    // Voter 1 approves. Since active translators = 2 ('translator' & 'voter1'), threshold is 1 vote weight.
    // Voter 1 has reputation 50 -> weight = 1 + floor(50/100) = 1.
    // This should immediately approve the translation!
    const result1 = flowService.submitReview({
      userId: 2,
      translationId: 30,
      action: 'approve'
    });
    
    assert.strictEqual(result1.success, true);
    const trans = db.prepare("SELECT status FROM translations WHERE id = 30").get();
    assert.strictEqual(trans.status, 'approved', "Translation should be approved when reaching threshold");

    // Test Duplicate Review Block
    db.prepare("UPDATE translations SET status = 'review' WHERE id = 30").run();
    db.prepare("DELETE FROM translation_reviews").run();
    flowService.submitReview({ userId: 2, translationId: 30, action: 'approve' });
    assert.throws(() => {
      flowService.submitReview({
        userId: 2, // duplicate
        translationId: 30,
        action: 'approve'
      });
    }, /already reviewed/i);

    console.log("✓ Consensus logic tests passed!");
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }

  run().catch(err => {
    console.error("Test Failed:", err.message);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `node backend/tests/consensus.test.js`
  Expected: FAIL with "AssertionError [ERR_ASSERTION]: cannot review your own" (or similar validation error/throw failures).

- [ ] **Step 3: Write minimal implementation**
  Modify `backend/src/services/flow.service.js`. Replace the lines inside `submitReview` dealing with the review update (around lines 440-642) with:
  - Check user isn't reviewer:
    ```javascript
    if (translation.created_by_id === resolvedUserId || translation.modified_by_id === resolvedUserId) {
      throw new Error('You cannot review your own translation');
    }
    ```
  - Check for duplicate vote:
    ```javascript
    const existingVote = db.prepare(
      "SELECT id FROM translation_reviews WHERE translation_id = ? AND user_id = ?"
    ).get(translationId, resolvedUserId);
    if (existingVote) {
      throw new Error('You have already reviewed this translation');
    }
    ```
  - Write the vote:
    ```javascript
    db.prepare(
      "INSERT INTO translation_reviews (translation_id, user_id, action, rejection_reason) VALUES (?, ?, ?, ?)"
    ).run(translationId, resolvedUserId, action, action === 'reject' && rejectionReason ? rejectionReason.trim() : null);
    ```
  - Count active translators:
    ```javascript
    const activeTranslators = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(modified_by_id, created_by_id)) as count
      FROM translations
      WHERE language = ? 
        AND (created_at >= datetime('now', '-30 days') OR updated_at >= datetime('now', '-30 days'))
        AND COALESCE(modified_by_id, created_by_id) IS NOT NULL
    `).get(translation.language).count;
    ```
  - Tiered threshold:
    ```javascript
    let threshold = 1;
    if (activeTranslators > 2 && activeTranslators <= 5) {
      threshold = 2;
    } else if (activeTranslators > 5) {
      threshold = 3;
    }
    ```
  - Gather all reviews and calculate voter weights and net score:
    ```javascript
    const reviews = db.prepare(`
      SELECT tr.action, u.reputation 
      FROM translation_reviews tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.translation_id = ?
    `).all(translationId);

    let netScore = 0;
    for (const r of reviews) {
      const weight = Math.min(4, 1 + Math.floor((r.reputation || 0) / 100));
      if (r.action === 'approve') {
        netScore += weight;
      } else {
        netScore -= weight;
      }
    }
    ```
  - Determine status transition:
    ```javascript
    let nextStatus = 'review';
    if (translation.status === 'discussion') {
      nextStatus = 'discussion';
    }

    if (netScore >= threshold) {
      nextStatus = 'approved';
    } else if (netScore <= -threshold) {
      nextStatus = 'rejected';
    }
    ```
  - Apply the database status updates, activity logs, and rewards ONLY when the status transitions:
    ```javascript
    if (nextStatus !== oldStatus) {
      db.prepare(
        "UPDATE translations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(nextStatus, translationId);
      
      // Award translator rewards or apply penalty
      const translatorUserId = translation.modified_by_id || translation.created_by_id;
      if (translatorUserId) {
        if (nextStatus === 'approved') {
          const { applyApprovalReward } = require("./reputation.service");
          applyApprovalReward(translatorUserId, translationId);
          // Award rewards to other discussion participants
          try {
            const participants = db.prepare(
              "SELECT DISTINCT user_id FROM discussion_participants WHERE translation_id = ?"
            ).all(translationId);
            for (const participant of participants) {
              if (participant.user_id !== translatorUserId) {
                applyApprovalReward(participant.user_id, translationId);
              }
            }
          } catch (pe) {}
        } else if (nextStatus === 'rejected') {
          const { applyRejectionPenalty } = require("./reputation.service");
          applyRejectionPenalty(translatorUserId, translationId);
        }
      }

      // Log translation_status_changed activity
      const activityExtra = { 
        sessionId,
        old_status: oldStatus,
        new_status: nextStatus,
        language: translation.language,
        translation_value: translation.value
      };
      if (nextStatus === 'rejected' && action === 'reject' && rejectionReason) {
        activityExtra.rejection_reason = rejectionReason.trim();
      }
      db.prepare(
        "INSERT INTO user_activity (user_id, action, term_id, term_field_id, translation_id, extra) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(resolvedUserId, 'translation_status_changed', translation.term_id, translation.term_field_id, translationId, JSON.stringify(activityExtra));
    }
    ```
  - Log `translation_reviewed` as standard activity on every review cast.

- [ ] **Step 4: Run test to verify it passes**
  Run: `node backend/tests/consensus.test.js`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add backend/src/services/flow.service.js
  git commit -m "feat: implement consensus evaluation inside submitReview service"
  ```

---

### Task 3: Auto-Approval Background Scheduler

**Files:**
- Create: `backend/tests/auto-approval.test.js`
- Modify: `backend/src/services/flow.service.js` (Append auto-approve function)
- Modify: `backend/src/services/taskDispatcher.service.js` (Run hourly)

- [ ] **Step 1: Write the failing test**
  Create the test file `backend/tests/auto-approval.test.js`.
  ```javascript
  // backend/tests/auto-approval.test.js
  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');

  const testDbPath = path.join(__dirname, '../data/test_auto_approval.db');
  process.env.SQLITE_DB_PATH = testDbPath;

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const { getDatabase } = require('../src/db/database');
  const { initializeDatabase } = require('../src/services/dbInit.service');
  const flowService = require('../src/services/flow.service');

  async function run() {
    console.log("Running auto-approval task test...");
    initializeDatabase();
    const db = getDatabase();

    db.prepare("INSERT INTO users (id, username, reputation) VALUES (1, 'translator', 10)").run();
    db.prepare("INSERT INTO users (id, username, reputation) VALUES (2, 'voter1', 50)").run();
    db.prepare("INSERT INTO terms (id, uri) VALUES (10, 'http://example.com/term')").run();
    db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (20, 10, 'label', 'Original')").run();

    // 1. Expired translation older than 3 days
    db.prepare(`
      INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
      VALUES (40, 20, 'nl', 'Expired Approved', 'review', 1, datetime('now', '-4 days'))
    `).run();
    // Add 1 approval
    db.prepare("INSERT INTO translation_reviews (translation_id, user_id, action) VALUES (40, 2, 'approve')").run();

    // 2. Expired translation with a rejection (should NOT auto-approve)
    db.prepare(`
      INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
      VALUES (41, 20, 'nl', 'Expired Contested', 'review', 1, datetime('now', '-4 days'))
    `).run();
    db.prepare("INSERT INTO translation_reviews (translation_id, user_id, action) VALUES (41, 2, 'reject')").run();

    // 3. New translation (< 3 days) with approval (should NOT auto-approve yet)
    db.prepare(`
      INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
      VALUES (42, 20, 'nl', 'New Translation', 'review', 1, datetime('now', '-1 days'))
    `).run();
    db.prepare("INSERT INTO translation_reviews (translation_id, user_id, action) VALUES (42, 2, 'approve')").run();

    // Trigger auto-approval worker
    flowService.autoApproveExpiredTranslations();

    // Verify results
    const t40 = db.prepare("SELECT status FROM translations WHERE id = 40").get();
    assert.strictEqual(t40.status, 'approved', "T40 should be approved");

    const t41 = db.prepare("SELECT status FROM translations WHERE id = 41").get();
    assert.strictEqual(t41.status, 'review', "T41 should remain in review (has rejection)");

    const t42 = db.prepare("SELECT status FROM translations WHERE id = 42").get();
    assert.strictEqual(t42.status, 'review', "T42 should remain in review (not expired)");

    console.log("✓ Auto-approval task tests passed!");
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }

  run().catch(err => {
    console.error("Test Failed:", err.message);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `node backend/tests/auto-approval.test.js`
  Expected: FAIL with "TypeError: flowService.autoApproveExpiredTranslations is not a function"

- [ ] **Step 3: Write minimal implementation**
  Add the following function at the end of `backend/src/services/flow.service.js` (before `module.exports`):
  ```javascript
  function autoApproveExpiredTranslations() {
    const db = getDatabase();
    
    // Find translations in review/discussion created >= 3 days ago
    const expired = db.prepare(`
      SELECT t.id, t.language, t.value, t.term_field_id, tf.term_id, t.created_by_id, t.modified_by_id
      FROM translations t
      JOIN term_fields tf ON t.term_field_id = tf.id
      WHERE t.status IN ('review', 'discussion') 
        AND t.created_at <= datetime('now', '-3 days')
    `).all();

    for (const t of expired) {
      const votes = db.prepare(`
        SELECT action FROM translation_reviews WHERE translation_id = ?
      `).all(t.id);

      const approvals = votes.filter(v => v.action === 'approve').length;
      const rejections = votes.filter(v => v.action === 'reject').length;

      if (approvals >= 1 && rejections === 0) {
        db.prepare(
          "UPDATE translations SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(t.id);

        const translatorUserId = t.modified_by_id || t.created_by_id;
        if (translatorUserId) {
          const { applyApprovalReward } = require("./reputation.service");
          applyApprovalReward(translatorUserId, t.id);
        }

        const activityExtra = {
          old_status: 'review',
          new_status: 'approved',
          language: t.language,
          translation_value: t.value,
          note: 'Auto-approved by system consensus timeout fallback'
        };
        // Log system auto-approval (user_id = null or system user if exists. We use null)
        db.prepare(`
          INSERT INTO user_activity (user_id, action, term_id, term_field_id, translation_id, extra)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(null, 'translation_status_changed', t.term_id, t.term_field_id, t.id, JSON.stringify(activityExtra));
        
        console.log(`Auto-approved translation ${t.id} due to 3-day timeout consensus`);
      }
    }
  }
  ```
  Ensure it is exported in `module.exports` of `flow.service.js`.

  Then, modify `backend/src/services/taskDispatcher.service.js` to call this hourly inside `startTaskDispatcher`:
  ```javascript
  // backend/src/services/taskDispatcher.service.js (Modify startTaskDispatcher)
  function startTaskDispatcher(intervalMs = 60000) {
    console.log(`Starting task dispatcher (interval: ${intervalMs}ms)`);
    
    checkAndDispatchScheduledTasks();
    
    // Run auto-approval immediately and hourly
    const { autoApproveExpiredTranslations } = require("./flow.service");
    try {
      autoApproveExpiredTranslations();
    } catch (e) {
      console.error("Failed to run autoApproveExpiredTranslations on startup:", e.message);
    }

    setInterval(() => {
      checkAndDispatchScheduledTasks();
    }, intervalMs);

    // Hourly interval (3600000 ms) for auto-approvals
    setInterval(() => {
      try {
        autoApproveExpiredTranslations();
      } catch (e) {
        console.error("Failed to run autoApproveExpiredTranslations hourly:", e.message);
      }
    }, 3600000);
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `node backend/tests/auto-approval.test.js`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add backend/src/services/flow.service.js backend/src/services/taskDispatcher.service.js
  git commit -m "feat: add auto-approval timeout scheduler background task"
  ```

---

### Task 4: Admin API consensus endpoint

**Files:**
- Create: `backend/tests/admin-api.test.js`
- Modify: `backend/src/routes/admin.routes.js`

- [ ] **Step 1: Write the failing test**
  Create the test file `backend/tests/admin-api.test.js`.
  ```javascript
  // backend/tests/admin-api.test.js
  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');

  const testDbPath = path.join(__dirname, '../data/test_admin_api.db');
  process.env.SQLITE_DB_PATH = testDbPath;

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const { getDatabase } = require('../src/db/database');
  const { initializeDatabase } = require('../src/services/dbInit.service');
  
  // Minimal test of consensus endpoint helper query
  async function run() {
    console.log("Running admin endpoint query test...");
    initializeDatabase();
    const db = getDatabase();

    db.prepare("INSERT INTO users (id, username, reputation) VALUES (1, 'translator', 10)").run();
    db.prepare("INSERT INTO users (id, username, reputation) VALUES (2, 'voter1', 120)").run(); // rep 120 -> weight 2
    db.prepare("INSERT INTO terms (id, uri) VALUES (10, 'http://example.com/term')").run();
    db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (20, 10, 'label', 'Original')").run();
    db.prepare(`
      INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
      VALUES (50, 20, 'nl', 'Vertaling', 'review', 1, datetime('now'))
    `).run();
    db.prepare("INSERT INTO translation_reviews (translation_id, user_id, action) VALUES (50, 2, 'approve')").run();

    // Query mimicking the endpoint logic
    const pending = db.prepare(`
      SELECT t.id, t.language, t.value, t.created_at, tf.field_uri, term.uri
      FROM translations t
      JOIN term_fields tf ON t.term_field_id = tf.id
      JOIN terms term ON tf.term_id = term.id
      WHERE t.status IN ('review', 'discussion')
    `).all();

    assert.strictEqual(pending.length, 1);
    
    const votes = db.prepare(`
      SELECT tr.action, tr.user_id, u.username, u.reputation
      FROM translation_reviews tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.translation_id = ?
    `).all(pending[0].id);

    assert.strictEqual(votes.length, 1);
    assert.strictEqual(votes[0].username, 'voter1');
    assert.strictEqual(votes[0].reputation, 120);

    console.log("✓ Admin API query tests passed!");
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }

  run().catch(err => {
    console.error("Test Failed:", err.message);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `node backend/tests/admin-api.test.js`
  Expected: PASS (as this is just verification of table query paths before routing setup).

- [ ] **Step 3: Write minimal implementation**
  Add the endpoint in `backend/src/routes/admin.routes.js` (above `router.put("/admin/translations/:id/status")`):
  ```javascript
  router.get("/admin/translations/pending-consensus", requireAdmin, apiLimiter, (req, res) => {
    const db = getDatabase();
    try {
      const pending = db.prepare(`
        SELECT t.id, t.language, t.value, t.created_at, t.status, tf.field_uri, term.uri,
               COALESCE(modified_user.username, created_user.username) as translator_username
        FROM translations t
        JOIN term_fields tf ON t.term_field_id = tf.id
        JOIN terms term ON tf.term_id = term.id
        LEFT JOIN users created_user ON t.created_by_id = created_user.id
        LEFT JOIN users modified_user ON t.modified_by_id = modified_user.id
        WHERE t.status IN ('review', 'discussion')
        ORDER BY t.created_at ASC
      `).all();

      const result = pending.map(t => {
        // Active translators in past 30 days
        const activeTranslators = db.prepare(`
          SELECT COUNT(DISTINCT COALESCE(modified_by_id, created_by_id)) as count
          FROM translations
          WHERE language = ? 
            AND (created_at >= datetime('now', '-30 days') OR updated_at >= datetime('now', '-30 days'))
            AND COALESCE(modified_by_id, created_by_id) IS NOT NULL
        `).get(t.language).count;

        let threshold = 1;
        if (activeTranslators > 2 && activeTranslators <= 5) {
          threshold = 2;
        } else if (activeTranslators > 5) {
          threshold = 3;
        }

        // Get reviews
        const reviews = db.prepare(`
          SELECT tr.action, tr.user_id, u.username, u.reputation, tr.created_at
          FROM translation_reviews tr
          JOIN users u ON tr.user_id = u.id
          WHERE tr.translation_id = ?
        `).all(t.id);

        let approvalsWeight = 0;
        let rejectionsWeight = 0;

        const voteBreakdown = reviews.map(r => {
          const weight = Math.min(4, 1 + Math.floor((r.reputation || 0) / 100));
          if (r.action === 'approve') {
            approvalsWeight += weight;
          } else {
            rejectionsWeight += weight;
          }
          return {
            username: r.username,
            action: r.action,
            reputation: r.reputation || 0,
            weight
          };
        });

        // Calculate time remaining until 3 days limit
        const createdMs = new Date(t.created_at + "Z").getTime(); // Ensure UTC parse
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const timeRemainingMs = Math.max(0, (createdMs + threeDaysMs) - nowMs);
        const daysRemaining = timeRemainingMs / (24 * 60 * 60 * 1000);

        return {
          id: t.id,
          language: t.language,
          value: t.value,
          created_at: t.created_at,
          status: t.status,
          field_uri: t.field_uri,
          uri: t.uri,
          translator_username: t.translator_username || 'Unknown',
          activeTranslators,
          threshold,
          approvalsWeight,
          rejectionsWeight,
          netScore: approvalsWeight - rejectionsWeight,
          daysRemaining,
          reviews: voteBreakdown
        };
      });

      res.json({ success: true, pending: result });
    } catch (err) {
      console.error('[Admin API] Error fetching pending consensus:', err);
      res.status(500).json({ error: 'Failed to fetch pending consensus reviews' });
    }
  });
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `node backend/tests/admin-api.test.js`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add backend/src/routes/admin.routes.js backend/tests/admin-api.test.js
  git commit -m "feat: add admin API endpoint for pending consensus reviews"
  ```

---

### Task 5: Admin Translations React Dashboard & Frontend API

**Files:**
- Modify: `frontend/services/api.ts` (Add API calls)
- Modify: `frontend/pages/admin/AdminTranslations.tsx` (Add consensus review tab)

- [ ] **Step 1: Write the failing test**
  We will verify typescript builds correctly.
  Run: `npm run build --prefix frontend` or `npx tsc --noEmit --project frontend/tsconfig.json`
  Expected: PASS (if no compiler errors)

- [ ] **Step 2: Write minimal implementation**
  Add the API wrapper inside `frontend/services/api.ts`:
  ```typescript
  // frontend/services/api.ts (Inside backendApi class)
  public async getPendingConsensusReviews(): Promise<{ pending: any[] }> {
    return this.get('/admin/translations/pending-consensus');
  }
  ```

  Then modify `frontend/pages/admin/AdminTranslations.tsx` to add the tab and panel:
  * Define state variables:
    ```typescript
    const [activeTab, setActiveTab] = useState<'all' | 'consensus'>('all');
    const [pendingConsensus, setPendingConsensus] = useState<any[]>([]);
    const [loadingConsensus, setLoadingConsensus] = useState(false);
    ```
  * Add function to fetch consensus:
    ```typescript
    const fetchPendingConsensus = async () => {
      setLoadingConsensus(true);
      try {
        const response = await backendApi.getPendingConsensusReviews();
        setPendingConsensus(response.pending);
      } catch (error) {
        toast.error("Failed to fetch pending reviews");
      } finally {
        setLoadingConsensus(false);
      }
    };
    ```
  * Update hooks:
    ```typescript
    useEffect(() => {
      if (activeTab === 'consensus') {
        fetchPendingConsensus();
      } else {
        fetchTranslations();
      }
    }, [page, statusFilter, languageFilter, activeTab]);
    ```
  * Update manual action callback:
    ```typescript
    const handleOverrideStatus = async (translationId: number, status: string) => {
      try {
        await backendApi.updateTranslationStatus(translationId, status);
        toast.success(`Translation status forced to ${status}`);
        if (activeTab === 'consensus') {
          fetchPendingConsensus();
        } else {
          fetchTranslations();
        }
      } catch (error: any) {
        toast.error(error.message || "Override failed");
      }
    };
    ```
  * Insert UI tabs and the pending reviews grid inside the return:
    * Tabs render code:
      ```tsx
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-marine-600 text-marine-600 dark:text-marine-400 dark:border-marine-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          All Translations
        </button>
        <button
          onClick={() => setActiveTab('consensus')}
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'consensus'
              ? 'border-marine-600 text-marine-600 dark:text-marine-400 dark:border-marine-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Pending Consensus Reviews
          {pendingConsensus.length > 0 && (
            <span className="bg-marine-100 text-marine-800 dark:bg-marine-900/50 dark:text-marine-300 text-xs px-2 py-0.5 rounded-full">
              {pendingConsensus.length}
            </span>
          )}
        </button>
      </div>
      ```
    * Render Table for `activeTab === 'consensus'`:
      ```tsx
      {activeTab === 'consensus' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loadingConsensus ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-marine-500" size={32} />
            </div>
          ) : pendingConsensus.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              No translations are currently pending consensus.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Translation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Translators / Threshold</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Votes Cast</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Auto-Approve Fallback</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Override Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {pendingConsensus.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-white max-w-sm truncate">{item.value}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Lang: <span className="font-semibold">{item.language.toUpperCase()}</span> | Field: {item.field_uri.split('#').pop() || item.field_uri}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          Submitted by: <span className="font-medium">{item.translator_username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                        <div>Active: {item.activeTranslators}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Required: {item.threshold} vote weight</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          item.netScore > 0 
                            ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' 
                            : item.netScore < 0 
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' 
                              : 'bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400'
                        }`}>
                          {item.netScore > 0 ? `+${item.netScore}` : item.netScore}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.reviews.length === 0 ? (
                          <span className="text-xs text-slate-400">No reviews yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {item.reviews.map((r: any, idx: number) => (
                              <span 
                                key={idx} 
                                title={`Reputation: ${r.reputation} | Vote Weight: ${r.weight}`}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium ${
                                  r.action === 'approve'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                }`}
                              >
                                {r.username} ({r.action === 'approve' ? '+' : '-'}{r.weight})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {item.daysRemaining > 0 ? (
                          <span>{item.daysRemaining.toFixed(1)} days left</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Auto-approving next run</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOverrideStatus(item.id, 'approved')}
                            className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded text-xs transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOverrideStatus(item.id, 'rejected')}
                            className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-xs transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      ```

- [ ] **Step 3: Run typescript compilation to verify correctness**
  Run: `npx tsc --noEmit --project frontend/tsconfig.json`
  Expected: PASS (No errors)

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git add frontend/services/api.ts frontend/pages/admin/AdminTranslations.tsx
  git commit -m "feat: implement frontend React view for consensus review audits"
  ```
