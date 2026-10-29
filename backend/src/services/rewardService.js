const { getDatabase } = require("../db/database");
const crypto = require("crypto");

function awardRewardToUser(userId, rewardId) {
  const db = getDatabase();
  const existing = db.prepare("SELECT * FROM user_rewards WHERE user_id = ? AND reward_id = ?").get(userId, rewardId);
  if (existing) return existing.id;

  const id = `urew_${crypto.randomUUID()}`;
  const hasEquipped = db.prepare("SELECT id FROM user_rewards WHERE user_id = ? AND is_equipped = 1").get(userId);
  const isEquipped = hasEquipped ? 0 : 1;

  db.prepare(`
    INSERT INTO user_rewards (id, user_id, reward_id, is_equipped)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, rewardId, isEquipped);
  return id;
}

function settleEventRewards(eventId) {
  const db = getDatabase();
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  if (!event) {
    return { settled: false, reason: "Event not found" };
  }

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

    const existing = db.prepare("SELECT id FROM user_rewards WHERE user_id = ? AND reward_id = ?").get(topIndividual.user_id, reward.id);
    const awardedId = awardRewardToUser(topIndividual.user_id, reward.id);
    const awardedCount = existing ? 0 : (awardedId ? 1 : 0);

    const winnerUser = db.prepare("SELECT username, extra FROM users WHERE id = ?").get(topIndividual.user_id);
    let displayName = winnerUser ? winnerUser.username : "Individual Winner";
    if (winnerUser && winnerUser.extra) {
      try {
        const extra = JSON.parse(winnerUser.extra);
        if (extra && (extra.display_name || extra.name)) {
          displayName = extra.display_name || extra.name;
        }
      } catch (e) {}
    }

    return {
      settled: true,
      teamName: displayName,
      awardedCount,
      titleName: reward.name,
      userIds: [topIndividual.user_id]
    };
  }

  const reward = db.prepare("SELECT * FROM event_rewards WHERE event_id = ? AND reward_type = 'TITLE'").get(eventId);
  if (!reward) {
    return { settled: false, reason: "No reward defined for this event" };
  }

  // Find winning team with highest total points > 0
  const winningTeam = db.prepare(`
    SELECT t.id, t.name, COALESCE(SUM(c.points), 0) as total_points
    FROM event_teams t
    LEFT JOIN event_contributions c ON t.id = c.team_id
    WHERE t.event_id = ?
    GROUP BY t.id
    HAVING total_points > 0
    ORDER BY total_points DESC
    LIMIT 1
  `).get(eventId);

  if (!winningTeam) {
    return { settled: false, reason: "No qualifying winning team with points" };
  }

  // Find active members of winning team who contributed points
  const winningUsers = db.prepare(`
    SELECT DISTINCT m.user_id, COALESCE(SUM(c.points), 0) as user_points
    FROM event_memberships m
    JOIN event_contributions c ON m.team_id = c.team_id AND m.user_id = c.user_id AND c.event_id = ?
    WHERE m.event_id = ? AND m.team_id = ? AND m.is_active = 1 AND c.points > 0
    GROUP BY m.user_id
  `).all(eventId, eventId, winningTeam.id);

  const awardedUserIds = [];
  for (const u of winningUsers) {
    awardRewardToUser(u.user_id, reward.id);
    awardedUserIds.push(u.user_id);
  }

  return {
    settled: true,
    teamName: winningTeam.name,
    awardedCount: awardedUserIds.length,
    userIds: awardedUserIds
  };
}

function getUserTitles(userId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT ur.id as user_reward_id, ur.is_equipped, COALESCE(ur.unlocked_at, CURRENT_TIMESTAMP) as awarded_at,
           r.id as reward_id, r.name as title_name,
           e.id as event_id, e.title as event_title, e.end_date as event_end_date,
           t.name as winning_team_name,
           COALESCE((SELECT SUM(points) FROM event_contributions WHERE event_id = e.id AND user_id = ur.user_id), 0) as user_points
    FROM user_rewards ur
    JOIN event_rewards r ON ur.reward_id = r.id
    JOIN events e ON r.event_id = e.id
    LEFT JOIN event_memberships m ON m.event_id = e.id AND m.user_id = ur.user_id AND m.is_active = 1
    LEFT JOIN event_teams t ON m.team_id = t.id
    WHERE ur.user_id = ? AND r.reward_type = 'TITLE'
    GROUP BY ur.id
    ORDER BY ur.unlocked_at DESC
  `).all(userId);
}

function equipUserTitle(userId, rewardId) {
  const db = getDatabase();
  // Unequip all existing titles for this user
  db.prepare(`
    UPDATE user_rewards 
    SET is_equipped = 0 
    WHERE user_id = ? AND reward_id IN (SELECT id FROM event_rewards WHERE reward_type = 'TITLE')
  `).run(userId);

  // Equip target title if provided
  if (rewardId) {
    db.prepare("UPDATE user_rewards SET is_equipped = 1 WHERE user_id = ? AND reward_id = ?").run(userId, rewardId);
  }

  return { success: true, titles: getUserTitles(userId) };
}

module.exports = {
  awardRewardToUser,
  settleEventRewards,
  getUserTitles,
  equipUserTitle
};
