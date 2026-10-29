const { getDatabase } = require("../db/database");
const crypto = require("crypto");

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

module.exports = {
  recordEventContribution
};
