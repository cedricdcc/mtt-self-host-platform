// Gamification service - handles points, streaks, and challenges

const { getDatabase, resolveUsernameToId } = require("../db/database");
const datetime = require("../utils/datetime");

/**
 * Helper: Resolve user identifier to user_id
 * Accepts either a numeric user_id or a username string
 * @param {number|string} userIdentifier - User ID or username
 * @returns {number|null} The user_id or null if not found
 */
function resolveUserIdentifier(userIdentifier) {
  // If it's already a number, return it
  if (typeof userIdentifier === 'number') {
    return userIdentifier;
  }
  
  // If it's a string that looks like a number, parse it
  const asNumber = parseInt(userIdentifier, 10);
  if (!isNaN(asNumber) && asNumber.toString() === userIdentifier) {
    return asNumber;
  }
  
  // Otherwise, treat it as a username and resolve to ID
  return resolveUsernameToId(userIdentifier);
}

/**
 * Initialize user stats if they don't exist
 * @param {number|string} userIdentifier - User ID or username
 */
function ensureUserStats(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    throw new Error(`User not found: ${userIdentifier}`);
  }
  
  const existing = db.prepare("SELECT user_id FROM user_stats WHERE user_id = ?").get(userId);
  
  if (!existing) {
    db.prepare(
      "INSERT INTO user_stats (user_id, points, daily_streak, longest_streak, last_active_date) VALUES (?, 0, 0, 0, NULL)"
    ).run(userId);
  }
}

/**
 * Get user statistics
 * @param {number|string} userIdentifier - User ID or username
 * @returns {object} User stats object
 */
function getUserStats(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return null;
  }
  
  ensureUserStats(userId);
  return db.prepare("SELECT * FROM user_stats WHERE user_id = ?").get(userId);
}

/**
 * Award points to a user (updates both users.reputation and user_stats.points)
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} points - Points to award
 * @param {string} reason - Reason for points
 */
function awardPoints(userIdentifier, points, reason = "general") {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    console.log("Could not award points: user not found:", userIdentifier);
    return;
  }
  
  ensureUserStats(userId);
  
  if (points <= 0) {
    return;
  }
  
  // Update users.reputation and user_stats.points atomically
  try {
    db.transaction(() => {
      db.prepare(
        "UPDATE users SET reputation = reputation + ? WHERE id = ?"
      ).run(points, userId);
      db.prepare(
        "UPDATE user_stats SET points = points + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      ).run(points, userId);
    })();
  } catch (err) {
    console.log("Could not update user reputation and stats points:", err.message);
  }
  
  // Log in reputation_events
  try {
    db.prepare(
      "INSERT INTO reputation_events (user_id, delta, reason) VALUES (?, ?, ?)"
    ).run(userId, points, reason);
  } catch (err) {
    console.log("Could not log reputation event:", err.message);
  }
  
  // Log in user_activity for traceability
  try {
    db.prepare(
      "INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)"
    ).run(userId, 'reputation_awarded', JSON.stringify({ points, reason }));
  } catch (err) {
    console.log("Could not log user activity:", err.message);
  }
}

/**
 * Get streak milestone reward based on streak count
 * @param {number} streak - Current streak
 * @returns {number} Reputation points to award (0 if no milestone)
 */
function getStreakMilestoneReward(streak) {
  const milestones = {
    3: 1,     // 3 days
    7: 2,     // 1 week
    14: 3,    // 2 weeks
    21: 4,    // 3 weeks
    30: 5,    // 1 month
    60: 10,   // 2 months
    90: 25,   // 3 months
  };
  
  return milestones[streak] || 0;
}

/**
 * Update user streak based on activity and award milestone rewards
 * @param {number|string} userIdentifier - User ID or username
 * @returns {object} Updated streak info
 */
function updateStreak(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return null;
  }
  
  ensureUserStats(userId);
  
  const stats = db.prepare("SELECT * FROM user_stats WHERE user_id = ?").get(userId);
  const today = datetime.format(datetime.now(), 'YYYY-MM-DD');
  const lastActive = stats.last_active_date;
  
  let newStreak = stats.daily_streak;
  let longestStreak = stats.longest_streak;
  let milestoneReached = false;
  
  if (!lastActive) {
    // First activity ever
    newStreak = 1;
  } else {
    const daysDiff = datetime.diff(datetime.parse(today), datetime.parse(lastActive), 'day');
    
    if (daysDiff === 0) {
      // Same day, no change
      return { 
        streak: newStreak, 
        longestStreak: longestStreak,
        isNewStreak: false,
        milestoneReward: 0
      };
    } else if (daysDiff === 1) {
      // Consecutive day
      newStreak += 1;
      milestoneReached = true;
    } else {
      // Streak broken
      newStreak = 1;
    }
  }
  
  // Update longest streak if needed
  if (newStreak > longestStreak) {
    longestStreak = newStreak;
  }
  
  // Check for streak milestone and award reputation
  const milestoneReward = milestoneReached ? getStreakMilestoneReward(newStreak) : 0;
  
  if (milestoneReward > 0) {
    // Award reputation for streak milestone
    awardPoints(userId, milestoneReward, `streak_milestone_${newStreak}_days`);
    
    // Log milestone achievement activity
    try {
      db.prepare(
        "INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)"
      ).run(userId, 'streak_milestone_achieved', JSON.stringify({ 
        streak: newStreak, 
        reward: milestoneReward 
      }));
    } catch (err) {
      console.log("Could not log streak milestone activity:", err.message);
    }
  }
  
  db.prepare(
    "UPDATE user_stats SET daily_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).run(newStreak, longestStreak, today, userId);
  
  return {
    streak: newStreak,
    longestStreak: longestStreak,
    isNewStreak: !lastActive || (lastActive !== today),
    milestoneReward: milestoneReward
  };
}

/**
 * Increment translation count
 * @param {number|string} userIdentifier - User ID or username
 */
function incrementTranslationCount(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return;
  }
  
  ensureUserStats(userId);
  
  db.prepare(
    "UPDATE user_stats SET translations_count = translations_count + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).run(userId);
}

/**
 * Increment review count
 * @param {number|string} userIdentifier - User ID or username
 */
function incrementReviewCount(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return;
  }
  
  ensureUserStats(userId);
  
  db.prepare(
    "UPDATE user_stats SET reviews_count = reviews_count + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).run(userId);
}

/**
 * Get or create daily challenges for a user
 * @param {number|string} userIdentifier - User ID or username
 * @returns {array} Array of daily challenges
 */
function getDailyChallenges(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return [];
  }
  
  const today = datetime.format(datetime.now(), 'YYYY-MM-DD');
  
  // Get existing challenges for today
  const existing = db.prepare(
    "SELECT * FROM daily_challenges WHERE user_id = ? AND challenge_date = ?"
  ).all(userId, today);
  
  if (existing.length > 0) {
    return existing;
  }
  
  // Create new challenges for today with reputation rewards
  const challenges = [
    { type: 'translate_5', target: 5, points: 5 },  // 5 reputation for 5 translations
    { type: 'review_10', target: 10, points: 5 },   // 5 reputation for 10 reviews
  ];
  
  challenges.forEach(challenge => {
    db.prepare(
      "INSERT INTO daily_challenges (user_id, challenge_date, challenge_type, target_count, points_reward) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, today, challenge.type, challenge.target, challenge.points);
  });
  
  return db.prepare(
    "SELECT * FROM daily_challenges WHERE user_id = ? AND challenge_date = ?"
  ).all(userId, today);
}

/**
 * Update challenge progress
 * @param {number|string} userIdentifier - User ID or username
 * @param {string} challengeType - Type of challenge
 * @param {number} increment - Amount to increment (default 1)
 */
function updateChallengeProgress(userIdentifier, challengeType, increment = 1) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return null;
  }
  
  const today = datetime.format(datetime.now(), 'YYYY-MM-DD');
  
  const challenge = db.prepare(
    "SELECT * FROM daily_challenges WHERE user_id = ? AND challenge_date = ? AND challenge_type = ?"
  ).get(userId, today, challengeType);
  
  if (!challenge) {
    return null;
  }
  
  const newCount = challenge.current_count + increment;
  const isCompleted = newCount >= challenge.target_count ? 1 : 0;
  
  db.prepare(
    `UPDATE daily_challenges 
     SET current_count = ?, 
         completed = ?, 
         completed_at = CASE WHEN ? = 1 AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END
     WHERE id = ?`
  ).run(newCount, isCompleted, isCompleted, challenge.id);
  
  // Award reputation points if just completed
  if (isCompleted && !challenge.completed) {
    awardPoints(userId, challenge.points_reward, `challenge_${challengeType}_completed`);
    
    // Log challenge completion activity for traceability
    try {
      db.prepare(
        "INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)"
      ).run(userId, 'daily_challenge_completed', JSON.stringify({ 
        challengeType,
        target: challenge.target_count,
        reward: challenge.points_reward
      }));
    } catch (err) {
      console.log("Could not log challenge completion activity:", err.message);
    }
  }
  
  return db.prepare("SELECT * FROM daily_challenges WHERE id = ?").get(challenge.id);
}

/**
 * Start a new flow session
 * @param {number|string} userIdentifier - User ID or username
 * @returns {object} Session object
 */
function startFlowSession(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return null;
  }
  
  const result = db.prepare(
    "INSERT INTO flow_sessions (user_id) VALUES (?)"
  ).run(userId);
  
  return db.prepare("SELECT * FROM flow_sessions WHERE id = ?").get(result.lastInsertRowid);
}

/**
 * Update flow session stats
 * @param {number} sessionId - Session ID
 * @param {object} updates - Updates to apply
 */
function updateFlowSession(sessionId, updates) {
  const db = getDatabase();
  
  const setClauses = [];
  const values = [];
  
  if (updates.translations_completed !== undefined) {
    setClauses.push("translations_completed = translations_completed + ?");
    values.push(updates.translations_completed);
  }
  
  if (updates.reviews_completed !== undefined) {
    setClauses.push("reviews_completed = reviews_completed + ?");
    values.push(updates.reviews_completed);
  }
  
  if (updates.points_earned !== undefined) {
    setClauses.push("points_earned = points_earned + ?");
    values.push(updates.points_earned);
  }
  
  values.push(sessionId);
  
  db.prepare(
    `UPDATE flow_sessions SET ${setClauses.join(", ")} WHERE id = ?`
  ).run(...values);
}

/**
 * End a flow session
 * @param {number} sessionId - Session ID
 * @returns {object} Final session stats
 */
function endFlowSession(sessionId) {
  const db = getDatabase();
  
  db.prepare(
    "UPDATE flow_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(sessionId);
  
  return db.prepare("SELECT * FROM flow_sessions WHERE id = ?").get(sessionId);
}

/**
 * Get leaderboard by points
 * @param {number} limit - Number of users to return
 * @returns {array} Top users
 */
function getLeaderboard(limit = 10) {
  const db = getDatabase();
  
  return db.prepare(
    `SELECT us.user_id, us.points, us.daily_streak, u.username, u.reputation
     FROM user_stats us
     LEFT JOIN users u ON us.user_id = u.id
     ORDER BY us.points DESC
     LIMIT ?`
  ).all(limit);
}

/**
 * Get or create daily goal for a user
 * Daily goal = 5 translations or reviews combined
 * @param {number|string} userIdentifier - User ID or username
 * @returns {object} Daily goal object
 */
function getDailyGoal(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return null;
  }
  
  const today = datetime.format(datetime.now(), 'YYYY-MM-DD');
  
  // Get existing goal for today
  let goal = db.prepare(
    "SELECT * FROM user_daily_goals WHERE user_id = ? AND goal_date = ?"
  ).get(userId, today);
  
  if (!goal) {
    // Create new goal for today
    db.prepare(
      "INSERT INTO user_daily_goals (user_id, goal_date, target_count) VALUES (?, ?, ?)"
    ).run(userId, today, 5);
    
    goal = db.prepare(
      "SELECT * FROM user_daily_goals WHERE user_id = ? AND goal_date = ?"
    ).get(userId, today);
  }
  
  return goal;
}

/**
 * Update daily goal progress
 * Called when user completes a translation or review
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} increment - Amount to increment (default 1)
 * @returns {object|null} Updated goal object
 */
function updateDailyGoalProgress(userIdentifier, increment = 1) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  const { applyReputationChange } = require("./reputation.service");
  
  if (!userId) {
    return null;
  }
  
  const goal = getDailyGoal(userId);
  
  if (!goal) {
    return null;
  }
  
  const newCount = goal.current_count + increment;
  const wasCompleted = goal.completed === 1;
  const isCompleted = newCount >= goal.target_count ? 1 : 0;
  
  // Update goal and check if we should award reward (atomically)
  // Only award if: becoming completed AND not already rewarded
  const shouldReward = isCompleted && !wasCompleted && !goal.rewarded;
  
  db.prepare(
    `UPDATE user_daily_goals 
     SET current_count = ?, 
         completed = ?, 
         rewarded = CASE WHEN ? = 1 AND completed = 0 AND rewarded = 0 THEN 1 ELSE rewarded END,
         completed_at = CASE WHEN ? = 1 AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(newCount, isCompleted, isCompleted, isCompleted, goal.id);
  
  // Get updated goal to check if reward was applied
  const updatedGoal = db.prepare("SELECT * FROM user_daily_goals WHERE id = ?").get(goal.id);
  
  // Award reputation if reward flag was just set (from 0 to 1)
  if (shouldReward && updatedGoal.rewarded === 1) {
    applyReputationChange(userId, 5, 'daily_goal_completed');
    
    // Log activity
    try {
      db.prepare(
        "INSERT INTO user_activity (user_id, action, extra) VALUES (?, ?, ?)"
      ).run(userId, 'daily_goal_completed', JSON.stringify({ 
        date: goal.goal_date,
        target: goal.target_count,
        reward: 5
      }));
    } catch (err) {
      console.log("Could not log daily goal completion activity:", err.message);
    }
  }
  
  return updatedGoal;
}

module.exports = {
  resolveUserIdentifier,
  ensureUserStats,
  getUserStats,
  awardPoints,
  updateStreak,
  incrementTranslationCount,
  incrementReviewCount,
  getDailyChallenges,
  updateChallengeProgress,
  startFlowSession,
  updateFlowSession,
  endFlowSession,
  getLeaderboard,
  getDailyGoal,
  updateDailyGoalProgress,
};
