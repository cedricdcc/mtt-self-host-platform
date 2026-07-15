const { getDatabase } = require("../db/database");
const { ensureUserStats, awardPoints } = require("./gamification.service");

/**
 * Scan all metrics for a user, check against thresholds, and unlock tiers
 * @param {number} userId - The user ID
 * @returns {Array} List of newly unlocked achievements
 */
function checkAndAwardAchievements(userId) {
  const db = getDatabase();

  // Ensure user stats exist
  ensureUserStats(userId);

  // 1. Fetch user metrics
  const stats = db.prepare("SELECT longest_streak, translations_count, reviews_count, points FROM user_stats WHERE user_id = ?").get(userId);
  
  const discussionCount = db.prepare(`
    SELECT (
      SELECT COUNT(*) FROM term_discussion_messages WHERE author_id = ?
    ) + (
      SELECT COUNT(*) FROM appeal_messages WHERE author_id = ?
    ) as total
  `).get(userId, userId).total;

  const dailyGoalsCount = db.prepare("SELECT COUNT(*) as total FROM user_daily_goals WHERE user_id = ? AND completed = 1").get(userId).total;

  const metrics = {
    streak_puffer: stats.longest_streak || 0,
    translation_angler: stats.translations_count || 0,
    review_turtle: stats.reviews_count || 0,
    discussion_dolphin: discussionCount || 0,
    reputation_stingray: stats.points || 0,
    goal_seahorse: dailyGoalsCount || 0
  };

  // 2. Fetch already unlocked tiers
  const unlocked = db.prepare("SELECT achievement_id, tier FROM user_achievements WHERE user_id = ?").all(userId);
  const unlockedSet = new Set(unlocked.map(u => `${u.achievement_id}_${u.tier}`));

  // 3. Fetch all tiers configuration
  const tiers = db.prepare("SELECT * FROM achievement_tiers ORDER BY achievement_id, tier ASC").all();

  const newUnlocks = [];

  // Run in database transaction
  db.transaction(() => {
    for (const t of tiers) {
      const key = `${t.achievement_id}_${t.tier}`;
      if (unlockedSet.has(key)) {
        continue; // Already unlocked
      }

      const userVal = metrics[t.achievement_id];
      if (userVal >= t.target_value) {
        // Unlock this tier!
        db.prepare(
          "INSERT INTO user_achievements (user_id, achievement_id, tier) VALUES (?, ?, ?)"
        ).run(userId, t.achievement_id, t.tier);

        // Award points
        awardPoints(userId, t.reward_points, `achievement_${t.achievement_id}_tier_${t.tier}`);

        // Log user activity
        db.prepare(
          "INSERT INTO user_activity (user_id, action, extra) VALUES (?, 'achievement_unlocked', ?)"
        ).run(userId, JSON.stringify({
          achievement_id: t.achievement_id,
          tier: t.tier,
          target_value: t.target_value,
          reward_points: t.reward_points
        }));

        newUnlocks.push({
          achievement_id: t.achievement_id,
          tier: t.tier,
          name: t.achievement_id, // Fallback
          target_value: t.target_value,
          reward_points: t.reward_points
        });
      }
    }
  })();

  return newUnlocks;
}

/**
 * Get all achievements with current progress for a user, criteria, unlock status, and rarity percentage
 * @param {number} userId - The user ID
 * @returns {Array} Achievements list
 */
function getUserAchievementsWithProgress(userId) {
  const db = getDatabase();

  ensureUserStats(userId);

  // Fetch metrics
  const stats = db.prepare("SELECT longest_streak, translations_count, reviews_count, points FROM user_stats WHERE user_id = ?").get(userId);
  
  const discussionCount = db.prepare(`
    SELECT (
      SELECT COUNT(*) FROM term_discussion_messages WHERE author_id = ?
    ) + (
      SELECT COUNT(*) FROM appeal_messages WHERE author_id = ?
    ) as total
  `).get(userId, userId).total;

  const dailyGoalsCount = db.prepare("SELECT COUNT(*) as total FROM user_daily_goals WHERE user_id = ? AND completed = 1").get(userId).total;

  const metrics = {
    streak_puffer: stats.longest_streak || 0,
    translation_angler: stats.translations_count || 0,
    review_turtle: stats.reviews_count || 0,
    discussion_dolphin: discussionCount || 0,
    reputation_stingray: stats.points || 0,
    goal_seahorse: dailyGoalsCount || 0
  };

  // Get total user count for rarity calculations
  const totalUsersCount = db.prepare("SELECT COUNT(*) as total FROM user_stats").get().total || 1;

  // Get achievements definitions
  const achievements = db.prepare("SELECT * FROM achievements").all();
  const tiers = db.prepare("SELECT * FROM achievement_tiers").all();
  const userUnlocks = db.prepare("SELECT achievement_id, tier, unlocked_at FROM user_achievements WHERE user_id = ?").all(userId);
  
  // Calculate rarity percentages for each tier
  const unlocksCounts = db.prepare(`
    SELECT achievement_id, tier, COUNT(DISTINCT user_id) as count 
    FROM user_achievements 
    GROUP BY achievement_id, tier
  `).all();
  
  const rarityMap = {};
  for (const uc of unlocksCounts) {
    rarityMap[`${uc.achievement_id}_${uc.tier}`] = (uc.count / totalUsersCount) * 100;
  }

  const unlockMap = {};
  for (const uu of userUnlocks) {
    unlockMap[`${uu.achievement_id}_${uu.tier}`] = uu.unlocked_at;
  }

  const result = achievements.map(a => {
    const aTiers = tiers.filter(t => t.achievement_id === a.id).map(t => {
      const key = `${t.achievement_id}_${t.tier}`;
      const unlockedAt = unlockMap[key] || null;
      const count = rarityMap[key] || 0;
      
      return {
        tier: t.tier,
        target_value: t.target_value,
        reward_points: t.reward_points,
        unlocked: !!unlockedAt,
        unlocked_at: unlockedAt,
        unlockedPercentage: parseFloat(count.toFixed(1))
      };
    });

    return {
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      currentProgress: metrics[a.id],
      tiers: aTiers
    };
  });

  return result;
}

module.exports = {
  checkAndAwardAchievements,
  getUserAchievementsWithProgress
};
