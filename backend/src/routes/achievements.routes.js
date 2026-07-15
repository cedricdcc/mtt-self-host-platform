const express = require("express");
const router = express.Router();
const { getDatabase } = require("../db/database");
const { requireAdmin } = require("../middleware/admin");
const { apiLimiter } = require("../middleware/rateLimit");
const { getUserAchievementsWithProgress } = require("../services/achievement.service");

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

/**
 * Handler for GET /api/gamification/achievements
 */
async function getAchievementsHandler(req, res) {
  try {
    const sessionUserId = req.session.user.id || req.session.user.user_id;
    const userId = req.query?.userId ? parseInt(req.query.userId, 10) : sessionUserId;
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId provided' });
    }
    const achievements = getUserAchievementsWithProgress(userId);
    res.json(achievements);
  } catch (error) {
    console.error('[Achievements API] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve user achievements' });
  }
}

/**
 * Handler for GET /api/admin/achievements
 */
async function getAdminAchievementsHandler(req, res) {
  try {
    const db = getDatabase();
    const achievements = db.prepare("SELECT * FROM achievements").all();
    const tiers = db.prepare("SELECT * FROM achievement_tiers ORDER BY achievement_id, tier ASC").all();

    const result = achievements.map(a => {
      return {
        ...a,
        tiers: tiers.filter(t => t.achievement_id === a.id)
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[Admin Achievements API] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin achievements settings' });
  }
}

/**
 * Handler for PUT /api/admin/achievements/:achievementId/tiers/:tier
 */
async function updateAchievementTierHandler(req, res) {
  try {
    const { achievementId, tier } = req.params;
    const { target_value, reward_points } = req.body;

    const parsedTier = parseInt(tier, 10);
    const parsedTarget = parseInt(target_value, 10);
    const parsedReward = parseInt(reward_points, 10);

    if (isNaN(parsedTier) || isNaN(parsedTarget) || isNaN(parsedReward) || parsedTarget < 0 || parsedReward < 0) {
      return res.status(400).json({ error: 'Invalid criteria values provided' });
    }

    const db = getDatabase();

    // Verify achievement exists
    const existing = db.prepare(
      "SELECT * FROM achievement_tiers WHERE achievement_id = ? AND tier = ?"
    ).get(achievementId, parsedTier);

    if (!existing) {
      return res.status(404).json({ error: 'Achievement tier not found' });
    }

    // Update
    db.prepare(`
      UPDATE achievement_tiers 
      SET target_value = ?, reward_points = ? 
      WHERE achievement_id = ? AND tier = ?
    `).run(parsedTarget, parsedReward, achievementId, parsedTier);

    // Log admin action
    const adminUserId = req.session.user.id || req.session.user.user_id;
    db.prepare(`
      INSERT INTO user_activity (user_id, action, extra)
      VALUES (?, 'admin_achievement_criteria_updated', ?)
    `).run(adminUserId, JSON.stringify({ achievementId, tier: parsedTier, target_value: parsedTarget, reward_points: parsedReward }));

    res.json({ success: true, message: 'Achievement criteria updated successfully' });
  } catch (error) {
    console.error('[Admin Achievements API] Update error:', error);
    res.status(500).json({ error: 'Failed to update achievement criteria' });
  }
}

// Router registrations
router.get("/gamification/achievements", apiLimiter, requireAuth, getAchievementsHandler);
router.get("/admin/achievements", requireAdmin, apiLimiter, getAdminAchievementsHandler);
router.put("/admin/achievements/:achievementId/tiers/:tier", requireAdmin, apiLimiter, updateAchievementTierHandler);

module.exports = router;
module.exports.getAchievementsHandler = getAchievementsHandler;
module.exports.getAdminAchievementsHandler = getAdminAchievementsHandler;
module.exports.updateAchievementTierHandler = updateAchievementTierHandler;
