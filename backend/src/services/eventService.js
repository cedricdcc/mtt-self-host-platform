const fs = require("fs");
const path = require("path");
const { getDatabase } = require("../db/database");
const crypto = require("crypto");

function ensureEventsTable() {
  const db = getDatabase();
  const hasEventsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").get();
  if (!hasEventsTable) {
    const migrationSql = fs.readFileSync(path.join(__dirname, "../db/migrations/035_events.sql"), "utf8");
    db.exec(migrationSql);
  }
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

function getEventSources() {
  const db = getDatabase();
  const hasSources = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'").get();
  if (!hasSources) return [];
  return db.prepare("SELECT source_id, source_path as name, source_type FROM sources ORDER BY source_path ASC").all();
}

function getAllEvents() {
  ensureEventsTable();
  const db = getDatabase();
  const events = db.prepare(`
    SELECT e.*, COALESCE(s.source_path, s.graph_name, 'Collection #' || s.source_id) as source_name,
           COALESCE((SELECT SUM(points) FROM event_contributions WHERE event_id = e.id), 0) as current_count,
           (SELECT name FROM event_rewards WHERE event_id = e.id AND reward_type = 'TITLE' LIMIT 1) as reward_title
    FROM events e
    LEFT JOIN sources s ON e.source_id = s.source_id
    ORDER BY e.start_date DESC
  `).all();

  return events.map(evt => {
    const teams = db.prepare(`
      SELECT t.*, 
             COUNT(DISTINCT m.user_id) as member_count,
             COALESCE(SUM(c.points), 0) as total_points
      FROM event_teams t
      LEFT JOIN event_memberships m ON t.id = m.team_id AND m.is_active = 1
      LEFT JOIN event_contributions c ON t.id = c.team_id
      WHERE t.event_id = ?
      GROUP BY t.id
      ORDER BY total_points DESC
    `).all(evt.id);
    return { ...evt, teams };
  });
}

function getEventById(eventId, userId = null) {
  ensureEventsTable();
  const db = getDatabase();
  const event = db.prepare(`
    SELECT e.*, COALESCE(s.source_path, s.graph_name, 'Collection #' || s.source_id) as source_name,
           COALESCE((SELECT SUM(points) FROM event_contributions WHERE event_id = e.id), 0) as current_count,
           (SELECT name FROM event_rewards WHERE event_id = e.id AND reward_type = 'TITLE' LIMIT 1) as reward_title
    FROM events e
    LEFT JOIN sources s ON e.source_id = s.source_id
    WHERE e.id = ?
  `).get(eventId);

  if (!event) return null;

  let user_team_id = null;
  if (userId) {
    const mem = db.prepare("SELECT team_id FROM event_memberships WHERE event_id = ? AND user_id = ? AND is_active = 1").get(eventId, userId);
    if (mem) user_team_id = mem.team_id;
  }

  const teams = db.prepare(`
    SELECT t.*, 
           COUNT(DISTINCT m.user_id) as member_count,
           COALESCE(SUM(c.points), 0) as total_points
    FROM event_teams t
    LEFT JOIN event_memberships m ON t.id = m.team_id AND m.is_active = 1
    LEFT JOIN event_contributions c ON t.id = c.team_id
    WHERE t.event_id = ?
    GROUP BY t.id
    ORDER BY total_points DESC
  `).all(eventId).map(t => ({
    ...t,
    is_user_member: user_team_id ? t.id === user_team_id : false
  }));

  return { ...event, user_team_id, teams };
}


function createTeam(eventId, name, imageUrl, createdByUserId) {
  ensureEventsTable();
  const db = getDatabase();
  const id = `team_${crypto.randomUUID()}`;
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase() || "TEAM";
  
  let joinCode;
  let inserted = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    joinCode = `TM-${cleanName}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    try {
      db.prepare(`
        INSERT INTO event_teams (id, event_id, name, image_url, join_code, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, eventId, name, imageUrl || null, joinCode, createdByUserId || null);
      inserted = true;
      break;
    } catch (err) {
      if (!err.message.includes("UNIQUE constraint failed: event_teams.join_code")) {
        throw err;
      }
    }
  }

  if (!inserted) {
    throw new Error("Failed to generate unique team join code");
  }

  return db.prepare("SELECT * FROM event_teams WHERE id = ?").get(id);
}

function joinTeam(eventId, identifier, userId) {
  ensureEventsTable();
  const db = getDatabase();
  
  // Find team by team_id or join_code
  let team = db.prepare("SELECT * FROM event_teams WHERE event_id = ? AND (id = ? OR join_code = ?)").get(eventId, identifier, identifier);
  if (!team) throw new Error("Team not found");

  // Check existing active membership for this user in this event
  const existingMem = db.prepare("SELECT * FROM event_memberships WHERE event_id = ? AND user_id = ? AND is_active = 1").get(eventId, userId);
  if (existingMem) {
    if (existingMem.team_id === team.id) {
      return { success: true, teamId: team.id, teamName: team.name, message: "Already a member of this team" };
    }
    throw new Error("You are already locked into a team for this competition. Team switching is not allowed.");
  }

  // Insert new active membership
  const membershipId = `mem_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO event_memberships (id, event_id, team_id, user_id, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(membershipId, eventId, team.id, userId);

  return { success: true, teamId: team.id, teamName: team.name };
}


function createEvent({ title, description, startDate, endDate, sourceId, targetLanguage, targetCount, rewardTitle }) {
  ensureEventsTable();
  const db = getDatabase();
  const id = `evt_${crypto.randomUUID()}`;

  // Determine initial status based on start_date
  const now = new Date().toISOString();
  let status = "UPCOMING";
  if (startDate <= now && endDate >= now) {
    status = "ACTIVE";
  } else if (endDate < now) {
    status = "ENDED";
  }

  const parsedSourceId = sourceId && sourceId !== "ALL" ? parseInt(sourceId, 10) : null;

  // Handle target count mode: 0 or "highest" means team with most translations wins
  let parsedTargetCount = 100;
  if (targetCount === "highest" || targetCount === 0 || targetCount === -1 || targetCount === "0") {
    parsedTargetCount = 0; // 0 represents "Highest Count Wins"
  } else if (targetCount !== undefined && targetCount !== null) {
    parsedTargetCount = parseInt(targetCount, 10);
  }

  db.prepare(`
    INSERT INTO events (id, title, description, start_date, end_date, source_id, target_language, target_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description || "", startDate, endDate, parsedSourceId, targetLanguage || "all", parsedTargetCount, status);

  // If a custom reward title name was provided, create an event_rewards entry
  if (rewardTitle) {
    const rewardId = `rew_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO event_rewards (id, event_id, reward_type, name)
      VALUES (?, ?, 'TITLE', ?)
    `).run(rewardId, id, rewardTitle);
  }

  return getEventById(id);
}

function updateEventStatus(eventId, status) {
  ensureEventsTable();
  const db = getDatabase();
  db.prepare("UPDATE events SET status = ? WHERE id = ?").run(status, eventId);
  if (status === 'ENDED') {
    const rewardService = require("./rewardService");
    try {
      rewardService.settleEventRewards(eventId);
    } catch (e) {
      console.error("[Event Reward Settle Error]", e);
    }
  }
  return getEventById(eventId);
}

function deleteTeam(eventId, teamId) {
  ensureEventsTable();
  const db = getDatabase();
  db.prepare("DELETE FROM event_contributions WHERE team_id = ?").run(teamId);
  db.prepare("DELETE FROM event_memberships WHERE team_id = ?").run(teamId);
  const result = db.prepare("DELETE FROM event_teams WHERE id = ? AND event_id = ?").run(teamId, eventId);
  return { success: result.changes > 0 };
}

function deleteEvent(eventId) {
  ensureEventsTable();
  const db = getDatabase();
  db.prepare("DELETE FROM event_rewards WHERE event_id = ?").run(eventId);
  db.prepare("DELETE FROM event_contributions WHERE event_id = ?").run(eventId);
  db.prepare("DELETE FROM event_memberships WHERE event_id = ?").run(eventId);
  db.prepare("DELETE FROM event_teams WHERE event_id = ?").run(eventId);
  const result = db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
  return { success: result.changes > 0 };
}

function setFeaturedHomepageEvent(eventId) {
  ensureEventsTable();
  const db = getDatabase();
  db.prepare("UPDATE events SET is_featured_homepage = 0").run();
  if (eventId) {
    db.prepare("UPDATE events SET is_featured_homepage = 1 WHERE id = ?").run(eventId);
    return getEventById(eventId);
  }
  return null;
}

module.exports = {
  ensureEventsTable,
  getEventSources,
  getAllEvents,
  getEventById,
  createEvent,
  updateEventStatus,
  createTeam,
  joinTeam,
  deleteTeam,
  deleteEvent,
  setFeaturedHomepageEvent
};


