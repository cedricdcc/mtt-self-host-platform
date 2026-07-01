# Translation Consensus and Multi-Vote Review System Design

## Overview
Currently, translations transition immediately to an `approved` or `rejected` status upon a single user review. This lack of verification is not robust. This document details the design for a multi-vote, reputation-weighted translation consensus review system. The system scales the required vote weight based on the language's active translator activity, allows experienced users to carry more vote weight, and implements a 3-day fallback timeout to auto-approve uncontested translations.

---

## User Review Required
> [!IMPORTANT]
> - Admins can manually bypass the consensus system on the admin dashboard by choosing to force-approve or force-reject a translation, which updates status instantly.
> - The consensus system recalculates the status dynamically upon each new review submission. Once approved or rejected, the translation is locked and can no longer receive reviews.

---

## Proposed Changes

### Section A: Database Schema & Migration

#### [NEW] [032_translation_reviews.sql](file:///data/projects/mtt-self-host-platform/backend/src/db/migrations/032_translation_reviews.sql)
A new migration file to create a dedicated table storing all cast review votes, including voter username/id, vote type (`approve` or `reject`), and any rejection reasons. A unique constraint ensures a user cannot vote twice on the same translation.

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

---

### Section B: Consensus Logic (Backend)

#### [MODIFY] [flow.service.js](file:///data/projects/mtt-self-host-platform/backend/src/services/flow.service.js)
Modify `submitReview` to incorporate the consensus logic:
1. **Self-Review Check**: Ensure `resolvedUserId` is not the creator or last modifier of the translation.
2. **Duplicate Check**: Query `translation_reviews` to check if `resolvedUserId` has already reviewed the translation.
3. **Record Vote**: Insert the vote into `translation_reviews` table.
4. **Determine Threshold**:
   * Calculate active translators for the language in the last 30 days:
     ```sql
     SELECT COUNT(DISTINCT COALESCE(modified_by_id, created_by_id)) as count
     FROM translations
     WHERE language = ? 
       AND (created_at >= datetime('now', '-30 days') OR updated_at >= datetime('now', '-30 days'))
       AND COALESCE(modified_by_id, created_by_id) IS NOT NULL
     ```
   * Set approval weight threshold:
     * Active count $\le$ 2 $\rightarrow$ threshold = 1
     * Active count is 3 to 5 $\rightarrow$ threshold = 2
     * Active count > 5 $\rightarrow$ threshold = 3
5. **Calculate Consensus Score**:
   * Get all reviews for the translation.
   * For each voter, retrieve their reputation and calculate vote weight: `weight = 1 + floor(reputation / 100)` (cap at 4).
   * Calculate `net_score = approvals_weight - rejections_weight`.
   * If `net_score >= threshold`:
     * Transition translation status to `approved`.
     * Award translator and participants points.
   * If `net_score <= -threshold`:
     * Transition translation status to `rejected`.
     * Apply translator reputation penalty.
   * Otherwise:
     * Keep status in `review` (or `discussion`).
6. **Activity Log**:
   * Log cast vote as `translation_reviewed` action.
   * Log status change to `translation_status_changed` ONLY when the status actually changes to `approved` or `rejected`.

---

### Section C: Auto-Approval Background Task

#### [MODIFY] [flow.service.js](file:///data/projects/mtt-self-host-platform/backend/src/services/flow.service.js)
Add `autoApproveExpiredTranslations` utility function:
* Query translations in `review` or `discussion` status older than 3 days:
  ```sql
  SELECT t.id, t.language, t.value, t.term_field_id, tf.term_id 
  FROM translations t
  JOIN term_fields tf ON t.term_field_id = tf.id
  WHERE t.status IN ('review', 'discussion') 
    AND t.created_at <= datetime('now', '-3 days')
  ```
* For each, calculate approvals and rejections. If approvals count $\ge$ 1 and rejections count == 0:
  * Update translation status to `approved`.
  * Award approval reward to the translator.
  * Log `translation_status_changed` activity.

#### [MODIFY] [taskDispatcher.service.js](file:///data/projects/mtt-self-host-platform/backend/src/services/taskDispatcher.service.js)
Hook `autoApproveExpiredTranslations` into `startTaskDispatcher` to run on startup and hourly.

---

### Section D: Admin Dashboard UI

#### [MODIFY] [admin.routes.js](file:///data/projects/mtt-self-host-platform/backend/src/routes/admin.routes.js)
Add `GET /api/admin/translations/pending-consensus` endpoint:
* Query translations in `review`/`discussion` status.
* Calculate active translators count, threshold, voter names/reputation/vote-weights, cumulative score, and time remaining until the 3-day auto-approval.
* Return this breakdown to the client.

#### [MODIFY] [api.ts](file:///data/projects/mtt-self-host-platform/frontend/services/api.ts)
Add `getPendingConsensusReviews` call.

#### [MODIFY] [AdminTranslations.tsx](file:///data/projects/mtt-self-host-platform/frontend/pages/admin/AdminTranslations.tsx)
* Add tab selection: "All Translations" and "Pending Consensus Reviews".
* Render table displaying:
  * Translation value, field name, and language.
  * Consensus status (Current Score / Required Threshold, Active Translators).
  * Hoverable voter list detail (Usernames, vote cast, reputation, and vote weight).
  * Auto-approval remaining time.
  * "Approve" and "Reject" manual overrides.

---

## Verification Plan

### Automated Tests
* Create unit tests in `backend/tests/consensus.test.js` covering:
  * Vote weight calculation for different user reputations.
  * Consensus threshold evaluation based on active translator counts.
  * Auto-approval worker triggers on expired positive translations.
  * Self-review and duplicate review rejection errors.

### Manual Verification
* Run backend server and client dev servers.
* Submit a translation in the flow.
* Review the translation with a standard user and verify status stays in `review`.
* Review with a high-reputation user and verify it meets consensus and auto-approves.
* Access `/admin/translations` and test the manual admin overrides.
