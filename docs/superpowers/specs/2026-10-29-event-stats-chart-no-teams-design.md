# Event Action Stats, Time-Series Activity Bar Chart, and Team-less Events Design Specification

**Date:** 2026-10-29  
**Status:** Approved Design Spec  
**Target Branch:** `feat/gacha`  

---

## 1. Overview & Objectives

Currently, the Event Detail page ([`frontend/pages/EventDetailPage.tsx`](file:///data/projects/mtt-self-host-platform/frontend/pages/EventDetailPage.tsx)) only displays a simple overall progress bar alongside the team leaderboard. To provide deeper visibility and motivation during competitions, this feature introduces:

1. **Comprehensive Event Action Stats:** Real-time counters showing all actions taken since the event started:
   - Translations submitted in review (`TRANSLATION_CREATED` / status `review`)
   - Translations approved (`TRANSLATION_APPROVED` / status `approved`)
   - Total action points generated
   - Distinct active contributors
2. **Interactive Stacked Activity Bar Chart:**
   - Visualizes work done over time since the event began.
   - Differentiates between translations in review and approved translations in a stacked bar layout.
   - Features **smart binning** based on elapsed time ($< 48\text{h}$: hourly; $2\text{--}30\text{ days}$: daily; $> 30\text{ days}$: weekly) with manual resolution override buttons (`Smart`, `Hour`, `Day`, `Week`).
   - Includes a toggle between **"All Event Activity"** and **"My Contributions"** which filters both the chart and the summary stat cards for the logged-in user.
3. **Team-less (Individual) Event Support:**
   - Admins can configure an event with **"Individual Challenge (No Teams)"** when creating a competition.
   - When an event has no teams (`has_teams = 0`):
     - The **"Team Leaderboard"** section, team cards, join buttons, and team QR codes are completely removed from the Event Detail page.
     - An **"Individual Leaderboard"** (top contributing users, podium, points, and translations count) is rendered instead.
     - Event reward settlement awards the grand prize title to the #1 ranked individual contributor.

---

## 2. Technical Architecture & Database Changes

### 2.1 SQLite Schema Updates (`events` and `event_contributions`)

1. **`events` table:**
   - Add column:
     ```sql
     ALTER TABLE events ADD COLUMN has_teams INTEGER NOT NULL DEFAULT 1 CHECK(has_teams IN (0, 1));
     ```
   - Automatically ensured in `backend/src/services/eventService.js` (`ensureEventsTable`).

2. **`event_contributions` table:**
   - Update foreign key constraint / column definition so `team_id` is nullable:
     ```sql
     team_id TEXT REFERENCES event_teams(id) ON DELETE CASCADE
     ```
   - For SQLite, if `team_id` currently has a `NOT NULL` constraint, recreate or update the table structure cleanly during startup migration check in `ensureEventsTable()`.

### 2.2 Scoring Pipeline Updates (`scoringService.js`)

In [`backend/src/services/scoringService.js`](file:///data/projects/mtt-self-host-platform/backend/src/services/scoringService.js):
- Update `recordEventContribution(userId, translationId, actionType, category)`:
  - Query all active events matching vocabulary source (`source_id IS NULL OR source_id = termSourceId`) and target language.
  - For each matching active event:
    - If `event.has_teams === 1`, lookup `event_memberships.team_id` for `user_id`. If user is in a team, attach `team_id`; if not yet joined, store `team_id = null`.
    - If `event.has_teams === 0`, record the contribution with `team_id = null`.
  - Insert row into `event_contributions (id, event_id, team_id, user_id, translation_id, action_type, points)`.

---

## 3. Backend REST API Specifications

### 3.1 Event Creation API (`POST /api/events`)
- **Body parameters:**
  - `hasTeams`: boolean (optional, default `true`).
- Persists `has_teams` as `1` or `0`.

### 3.2 Event Analytics & Time-Series API (`GET /api/events/:id/stats`)

- **Query Parameters:**
  - `userOnly` (`boolean`, optional, default `false`): If `true` and user is authenticated (`req.user.id`), filter calculations to that user.
  - `resolution` (`'smart' | 'hour' | 'day' | 'week'`, optional, default `'smart'`):
    - When `'smart'`, determine resolution from the duration between `event.start_date` and `now`:
      - $\le 48\text{ hours}$: `'hour'`
      - $2\text{--}30\text{ days}$: `'day'`
      - $> 30\text{ days}$: `'week'`
- **Response Structure (JSON):**
  ```json
  {
    "stats": {
      "inReviewCount": 42,
      "approvedCount": 85,
      "totalActions": 127,
      "totalPoints": 1055,
      "activeContributors": 18
    },
    "timeline": {
      "resolution": "day",
      "data": [
        {
          "timestamp": "2026-10-27",
          "label": "Oct 27",
          "inReview": 10,
          "approved": 25,
          "total": 35
        }
      ]
    },
    "individualLeaderboard": [
      {
        "userId": 5,
        "name": "Jane Doe",
        "avatarUrl": null,
        "totalPoints": 320,
        "translationsCount": 32
      }
    ]
  }
  ```

### 3.3 Individual Leaderboard Query
When `event.has_teams === 0` (or requested via stats endpoint):
```sql
SELECT 
  u.id as userId,
  COALESCE(u.display_name, u.username) as name,
  u.avatar_url as avatarUrl,
  SUM(c.points) as totalPoints,
  COUNT(CASE WHEN c.action_type IN ('TRANSLATION_CREATED', 'TRANSLATION_APPROVED') THEN 1 END) as translationsCount
FROM event_contributions c
JOIN users u ON c.user_id = u.id
WHERE c.event_id = ?
GROUP BY u.id
ORDER BY totalPoints DESC
LIMIT 50;
```

---

## 4. Frontend Specifications

### 4.1 Admin Event Creation (`frontend/pages/admin/AdminEvents.tsx`)
- In the Create Competition modal:
  - Add a **"Competition Format"** control:
    - Button group or toggle: **"Team Competition"** vs **"Individual Challenge (No Teams)"**.
    - If "Individual Challenge" is selected, display informative caption: *"Participants contribute directly as individuals. No teams are created or required."*
  - Passes `hasTeams: goalMode !== ...` to `createEvent()` in [`frontend/services/eventApi.ts`](file:///data/projects/mtt-self-host-platform/frontend/services/eventApi.ts).

### 4.2 Event Detail Page (`frontend/pages/EventDetailPage.tsx`)

#### A. Analytics Header & Scope Switcher
- Placed below the main title card.
- Contains section title: **"Activity & Performance"**.
- Segmented pill toggle: **"All Event Activity"** vs **"My Contributions"**.
  - If unauthenticated user clicks "My Contributions", prompt toast: *"Please sign in to view your personal event contributions."*

#### B. 4 Summary Metric Cards
1. **In Review:** Yellow/Amber badge, showing translations submitted during the event awaiting review.
2. **Approved:** Emerald badge, showing translations approved during the event.
3. **Total Actions & Points:** Cyan badge, showing cumulative competition points.
4. **Active Contributors:** Indigo badge, showing count of unique participants (hidden or showing "1" when filtered to "My Contributions").

#### C. Interactive Stacked Bar Chart (`Recharts`)
- Wrapped in `<ResponsiveContainer height={300}>`.
- Stacked Bar elements:
  - Bottom segment: `inReview` (Amber `#f59e0b`).
  - Top segment: `approved` (Emerald `#10b981`).
- Custom Dark/Light theme tooltip displaying exact timestamp, in review, approved, and total values.
- Header controls:
  - Resolution selector buttons: `Auto (Smart)`, `Hour`, `Day`, `Week`.
  - Legend: `■ In Review` and `■ Approved`.
- Empty state: Clean friendly card if no actions have been taken yet in the selected scope.

#### D. Conditional Leaderboards
- Check `event.has_teams`:
  - **If `event.has_teams === 1`:**
    - Render existing **Team Leaderboard** with podium cards, join codes, team QR codes, and team action buttons.
  - **If `event.has_teams === 0`:**
    - Completely remove the Team Leaderboard section.
    - Render **Individual Leaderboard**:
      - Top 3 Podium: 🥇 1st Place, 🥈 2nd Place, 🥉 3rd Place cards.
      - Displays user name, points, translation count, and a badge for the active user (`✓ You`).
      - Ranked table/list for 4th place onwards.

---

## 5. Reward Settlement (`rewardService.js`)

In [`backend/src/services/rewardService.js`](file:///data/projects/mtt-self-host-platform/backend/src/services/rewardService.js):
- In `settleEventRewards(eventId)`:
  - Check `event.has_teams`:
    - If `1`: Award grand prize title to members of the 1st place team with active contributions (existing logic).
    - If `0`: Award grand prize title to the top ranked individual contributor (`LIMIT 1` with `totalPoints > 0`).

---

## 6. Testing & Verification Plan

1. **Unit & API Tests:**
   - Create competition with `hasTeams = false` and verify SQLite record has `has_teams = 0`.
   - Record contributions with `team_id = null` and confirm scoring succeeds.
   - Call `GET /api/events/:id/stats` with `resolution=hour`, `day`, `week`, and `smart`; verify correctly grouped bins.
   - Call `GET /api/events/:id/stats?userOnly=true` and verify filtered user results.
2. **Frontend UI Tests:**
   - Verify `EventDetailPage` displays the 4 stat cards with correct values.
   - Verify Recharts stacked bar chart renders and switches resolutions.
   - Verify toggle between "All Event Activity" and "My Contributions".
   - Verify that when `has_teams === 0`, "Team Leaderboard" is completely hidden and "Individual Leaderboard" is shown.
