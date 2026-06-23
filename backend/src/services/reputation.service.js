// Reputation service - handles reputation system functions with shield protection

const { getDatabase, resolveUsernameToId, getUserById } = require("../db/database");

/**
 * Reputation tier thresholds and rules
 * Based on the reputation shield system:
 * - 0-99: Full cascading penalties, new users
 * - 100-499: Capped at -10, regular contributors
 * - 500-999: Capped at -5, trusted users
 * - ≥1000: Immune to rejection penalties, veterans/moderators
 */
const REPUTATION_TIERS = {
  VETERAN: 1000,
  TRUSTED: 500,
  REGULAR: 100,
  NEW_USER: 0,
};

/**
 * Base penalty for rejected translations
 */
const BASE_REJECTION_PENALTY = -5;

/**
 * Base penalty for false rejections
 */
const BASE_FALSE_REJECTION_PENALTY = -10;

/**
 * Days to look back for cascading rejection penalty
 */
const REJECTION_LOOKBACK_DAYS = 14;

/**
 * Reputation rewards for positive actions
 */
const REPUTATION_REWARDS = {
  TRANSLATION_APPROVED: 5,   // Reward when translation is approved
  TRANSLATION_MERGED: 10,    // Reward when translation is merged (final acceptance)
  TRANSLATION_CREATED: 1,    // Small reward for creating a new translation
};

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
 * Get a user's current reputation
 * @param {number|string} userIdentifier - User ID or username
 * @returns {number} The user's reputation (0 if not found)
 */
function getUserReputation(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return 0;
  }
  
  const user = db
    .prepare("SELECT reputation FROM users WHERE id = ?")
    .get(userId);
  return user ? user.reputation : 0;
}

/**
 * Count recent rejections for a user within the lookback period
 * @param {number|string} userIdentifier - User ID or username
 * @param {number|null} excludeTranslationId - Optional translation ID to exclude from count
 * @returns {number} Count of recent rejections
 */
function countRecentRejections(userIdentifier, excludeTranslationId = null) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return 0;
  }
  
  // Use parameterized query with string interpolation for lookback days
  // Since REJECTION_LOOKBACK_DAYS is a constant defined in this module, we use it safely
  const lookbackModifier = `-${REJECTION_LOOKBACK_DAYS} days`;
  let query = `
    SELECT COUNT(*) AS cnt
    FROM translations t
    WHERE t.status = 'rejected'
      AND (t.created_by_id = ? OR t.modified_by_id = ?)
      AND t.updated_at >= datetime('now', ?)
  `;

  const params = [userId, userId, lookbackModifier];

  if (excludeTranslationId !== null) {
    query += " AND t.id != ?";
    params.push(excludeTranslationId);
  }

  const result = db.prepare(query).get(...params);
  return result ? result.cnt : 0;
}

/**
 * Calculate the raw cascading rejection penalty based on recent rejections
 * Now uses configurable rules from the database
 * @param {number} recentRejectionCount - Number of recent rejections
 * @returns {number} The raw penalty amount (negative number)
 */
function calculateRawRejectionPenalty(recentRejectionCount) {
  const db = getDatabase();
  
  try {
    // Get rules from database
    const basePenalty = db.prepare('SELECT rule_value FROM reputation_rules WHERE rule_name = ?')
      .get('BASE_REJECTION_PENALTY')?.rule_value || BASE_REJECTION_PENALTY;
    
    const increment = db.prepare('SELECT rule_value FROM reputation_rules WHERE rule_name = ?')
      .get('REJECTION_PENALTY_INCREMENT')?.rule_value || BASE_REJECTION_PENALTY;
    
    const maxPenalty = db.prepare('SELECT rule_value FROM reputation_rules WHERE rule_name = ?')
      .get('MAX_REJECTION_PENALTY')?.rule_value || -50;
    
    // Calculate penalty: base + (increment * count of recent rejections)
    const rawPenalty = basePenalty + (increment * recentRejectionCount);
    
    // Apply max penalty cap (both values are negative, so we use Math.max to get less severe penalty)
    return Math.max(rawPenalty, maxPenalty);
  } catch (err) {
    // Fallback to hardcoded values if database query fails
    console.error('Error fetching rejection penalty rules:', err.message);
    return BASE_REJECTION_PENALTY * (1 + recentRejectionCount);
  }
}

/**
 * Apply reputation shield to a penalty based on user's reputation level
 * @param {number} rawPenalty - The raw penalty amount (negative number)
 * @param {number} reputation - The user's current reputation
 * @returns {number} The shielded penalty amount (may be less severe or 0)
 */
function applyReputationShield(rawPenalty, reputation) {
  if (reputation >= REPUTATION_TIERS.VETERAN) {
    // Veterans rejection penalty capped at -2
    return Math.max(rawPenalty, -2);
  } else if (reputation >= REPUTATION_TIERS.TRUSTED) {
    // Trusted users capped at -5
    return Math.max(rawPenalty, -5);
  } else if (reputation >= REPUTATION_TIERS.REGULAR) {
    // Regular contributors capped at -10
    return Math.max(rawPenalty, -10);
  } else {
    // New users receive full cascading penalty
    return rawPenalty;
  }
}

/**
 * Calculate the rejection penalty with reputation shield for a user
 * @param {number|string} userIdentifier - User ID or username
 * @param {number|null} excludeTranslationId - Optional translation ID to exclude from count
 * @returns {{ rawPenalty: number, shieldedPenalty: number, reputation: number, recentCount: number }}
 */
function calculateRejectionPenalty(userIdentifier, excludeTranslationId = null) {
  const reputation = getUserReputation(userIdentifier);
  const recentCount = countRecentRejections(userIdentifier, excludeTranslationId);
  const rawPenalty = calculateRawRejectionPenalty(recentCount);
  const shieldedPenalty = applyReputationShield(rawPenalty, reputation);

  return {
    rawPenalty,
    shieldedPenalty,
    reputation,
    recentCount,
  };
}

/**
 * Calculate the false rejection penalty with reputation shield
 * @param {number|string} userIdentifier - User ID or username
 * @returns {{ rawPenalty: number, shieldedPenalty: number, reputation: number }}
 */
function calculateFalseRejectionPenalty(userIdentifier) {
  const reputation = getUserReputation(userIdentifier);
  const rawPenalty = BASE_FALSE_REJECTION_PENALTY;

  let shieldedPenalty;
  if (reputation >= REPUTATION_TIERS.VETERAN) {
    // Veterans false rejection penalty capped at -2
    shieldedPenalty = -2;
  } else if (reputation >= REPUTATION_TIERS.TRUSTED) {
    // Trusted users get -5 instead of -10
    shieldedPenalty = -5;
  } else {
    // Everyone else gets full penalty
    shieldedPenalty = rawPenalty;
  }

  return {
    rawPenalty,
    shieldedPenalty,
    reputation,
  };
}

/**
 * Record a reputation event in the database
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} delta - The reputation change amount
 * @param {string} reason - The reason for the change
 * @param {number|null} translationId - Optional related translation ID
 * @param {object|null} extra - Optional extra data to store as JSON
 * @returns {number} The inserted event ID
 */
function recordReputationEvent(
  userIdentifier,
  delta,
  reason,
  translationId = null,
  extra = null
) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    throw new Error(`User not found: ${userIdentifier}`);
  }

  // First record user activity
  const activityStmt = db.prepare(`
    INSERT INTO user_activity (user_id, action, translation_id, extra)
    VALUES (?, ?, ?, ?)
  `);
  const activityInfo = activityStmt.run(
    userId,
    reason,
    translationId,
    extra ? JSON.stringify(extra) : null
  );

  // Then record reputation event
  const stmt = db.prepare(`
    INSERT INTO reputation_events (user_id, delta, reason, related_activity_id)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(userId, delta, reason, activityInfo.lastInsertRowid);
  return info.lastInsertRowid;
}

/**
 * Apply a reputation change to a user
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} delta - The reputation change amount (positive or negative)
 * @param {string} reason - The reason for the change
 * @param {number|null} translationId - Optional related translation ID
 * @param {object|null} extra - Optional extra data for the event
 * @returns {{ newReputation: number, eventId: number } | null} Result or null if user not found
 */
function applyReputationChange(
  userIdentifier,
  delta,
  reason,
  translationId = null,
  extra = null
) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return null;
  }

  // Check if user exists first
  const userExists = db
    .prepare("SELECT 1 FROM users WHERE id = ?")
    .get(userId);

  if (!userExists) {
    return null;
  }

  if (delta === 0) {
    // No change needed, but still record the event if there's a reason
    const eventId = recordReputationEvent(
      userId,
      delta,
      reason,
      translationId,
      extra
    );
    const reputation = getUserReputation(userId);
    return { newReputation: reputation, eventId };
  }

  // Update user reputation
  db.prepare(
    "UPDATE users SET reputation = reputation + ? WHERE id = ?"
  ).run(delta, userId);

  // Record the event
  const eventId = recordReputationEvent(
    userId,
    delta,
    reason,
    translationId,
    extra
  );

  // Get new reputation
  const newReputation = getUserReputation(userId);

  return { newReputation, eventId };
}

/**
 * Apply rejection penalty to a user (with shield protection)
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} translationId - The rejected translation ID
 * @returns {{ applied: boolean, penalty: number, rawPenalty: number, shielded: boolean, newReputation: number | null }}
 */
function applyRejectionPenalty(userIdentifier, translationId) {
  const penaltyInfo = calculateRejectionPenalty(userIdentifier, translationId);
  const { rawPenalty, shieldedPenalty, reputation, recentCount } = penaltyInfo;

  // Only apply if there's actually a penalty
  if (shieldedPenalty >= 0) {
    return {
      applied: false,
      penalty: 0,
      rawPenalty,
      shielded: true,
      newReputation: reputation,
    };
  }

  const result = applyReputationChange(
    userIdentifier,
    shieldedPenalty,
    "translation_rejected",
    translationId,
    {
      raw_penalty: rawPenalty,
      shielded_penalty: shieldedPenalty,
      recent_rejections: recentCount,
      reputation_at_time: reputation,
    }
  );

  // If user doesn't exist, applyReputationChange returns null
  if (!result) {
    return {
      applied: false,
      penalty: 0,
      rawPenalty,
      shielded: false,
      newReputation: null,
    };
  }

  return {
    applied: true,
    penalty: shieldedPenalty,
    rawPenalty,
    shielded: shieldedPenalty > rawPenalty,
    newReputation: result.newReputation,
  };
}

/**
 * Apply false rejection penalty to a user (with shield protection)
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} translationId - The translation ID that was falsely rejected
 * @returns {{ applied: boolean, penalty: number, rawPenalty: number, shielded: boolean, newReputation: number | null }}
 */
function applyFalseRejectionPenalty(userIdentifier, translationId) {
  const penaltyInfo = calculateFalseRejectionPenalty(userIdentifier);
  const { rawPenalty, shieldedPenalty, reputation } = penaltyInfo;

  // Only apply if there's actually a penalty
  if (shieldedPenalty >= 0) {
    return {
      applied: false,
      penalty: 0,
      rawPenalty,
      shielded: true,
      newReputation: reputation,
    };
  }

  const result = applyReputationChange(
    userIdentifier,
    shieldedPenalty,
    "false_rejection",
    translationId,
    {
      original_penalty: rawPenalty,
      shielded_penalty: shieldedPenalty,
      reputation_at_time: reputation,
    }
  );

  // If user doesn't exist, applyReputationChange returns null
  if (!result) {
    return {
      applied: false,
      penalty: 0,
      rawPenalty,
      shielded: false,
      newReputation: null,
    };
  }

  return {
    applied: true,
    penalty: shieldedPenalty,
    rawPenalty,
    shielded: shieldedPenalty > rawPenalty,
    newReputation: result.newReputation,
  };
}

/**
 * Check if a user is immune to rejection penalties
 * @param {number|string} userIdentifier - User ID or username
 * @returns {boolean} True if user is immune
 */
function isImmuneToRejectionPenalty(userIdentifier) {
  return false;
}

/**
 * Get the reputation tier name for a user
 * @param {number|string} userIdentifier - User ID or username
 * @returns {string} The tier name (veteran, trusted, regular, or new_user)
 */
function getReputationTierName(userIdentifier) {
  const reputation = getUserReputation(userIdentifier);

  if (reputation >= REPUTATION_TIERS.VETERAN) {
    return "veteran";
  } else if (reputation >= REPUTATION_TIERS.TRUSTED) {
    return "trusted";
  } else if (reputation >= REPUTATION_TIERS.REGULAR) {
    return "regular";
  } else {
    return "new_user";
  }
}

/**
 * Get reputation tier info for a user
 * @param {number|string} userIdentifier - User ID or username
 * @returns {{ reputation: number, tier: string, maxPenalty: number | null, immuneToRejection: boolean }}
 */
function getReputationTierInfo(userIdentifier) {
  const reputation = getUserReputation(userIdentifier);
  const tier = getReputationTierName(userIdentifier);

  let maxPenalty;
  let immuneToRejection;

  if (reputation >= REPUTATION_TIERS.VETERAN) {
    maxPenalty = -2;
    immuneToRejection = false;
  } else if (reputation >= REPUTATION_TIERS.TRUSTED) {
    maxPenalty = -5;
    immuneToRejection = false;
  } else if (reputation >= REPUTATION_TIERS.REGULAR) {
    maxPenalty = -10;
    immuneToRejection = false;
  } else {
    maxPenalty = null; // No cap for new users
    immuneToRejection = false;
  }

  return {
    reputation,
    tier,
    maxPenalty,
    immuneToRejection,
  };
}

/**
 * Generic function to apply a reputation reward
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} reward - The reward amount
 * @param {string} reason - The reason for the reward
 * @param {number} translationId - The translation ID
 * @returns {{ applied: boolean, reward: number, newReputation: number | null }}
 */
function applyReward(userIdentifier, reward, reason, translationId) {
  const result = applyReputationChange(
    userIdentifier,
    reward,
    reason,
    translationId,
    { reward }
  );

  if (!result) {
    return {
      applied: false,
      reward: 0,
      newReputation: null,
    };
  }

  return {
    applied: true,
    reward,
    newReputation: result.newReputation,
  };
}

/**
 * Apply reputation reward when a translation is approved
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} translationId - The translation ID
 * @returns {{ applied: boolean, reward: number, newReputation: number | null }}
 */
function applyApprovalReward(userIdentifier, translationId) {
  return applyReward(
    userIdentifier,
    REPUTATION_REWARDS.TRANSLATION_APPROVED,
    "translation_approved",
    translationId
  );
}

/**
 * Apply reputation reward when a translation is merged
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} translationId - The translation ID
 * @returns {{ applied: boolean, reward: number, newReputation: number | null }}
 */
function applyMergeReward(userIdentifier, translationId) {
  return applyReward(
    userIdentifier,
    REPUTATION_REWARDS.TRANSLATION_MERGED,
    "translation_merged",
    translationId
  );
}

/**
 * Apply reputation reward when a translation is created
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} translationId - The translation ID
 * @returns {{ applied: boolean, reward: number, newReputation: number | null }}
 */
function applyCreationReward(userIdentifier, translationId) {
  return applyReward(
    userIdentifier,
    REPUTATION_REWARDS.TRANSLATION_CREATED,
    "translation_created",
    translationId
  );
}

/**
 * Apply appropriate reputation changes when a translation status changes (for admin actions)
 * @param {number|string} userIdentifier - User ID or username who created the translation
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {number} translationId - The translation ID
 * @returns {object} Result of the reputation change
 */
function applyReputationForTranslationStatusChange(userIdentifier, oldStatus, newStatus, translationId) {
  // Only apply changes for certain status transitions
  if (oldStatus === newStatus) {
    return { applied: false, message: 'No status change' };
  }
  
  // Apply rewards
  if (newStatus === 'approved' && oldStatus !== 'approved') {
    return applyApprovalReward(userIdentifier, translationId);
  } else if (newStatus === 'merged' && oldStatus !== 'merged') {
    return applyMergeReward(userIdentifier, translationId);
  } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
    return applyRejectionPenalty(userIdentifier, translationId);
  }
  
  return { applied: false, message: 'No reputation change for this transition' };
}

module.exports = {
  // Constants
  REPUTATION_TIERS,
  BASE_REJECTION_PENALTY,
  BASE_FALSE_REJECTION_PENALTY,
  REJECTION_LOOKBACK_DAYS,
  REPUTATION_REWARDS,

  // Core functions
  resolveUserIdentifier,
  getUserReputation,
  countRecentRejections,
  calculateRawRejectionPenalty,
  applyReputationShield,
  calculateRejectionPenalty,
  calculateFalseRejectionPenalty,
  recordReputationEvent,
  applyReputationChange,

  // High-level penalty functions
  applyRejectionPenalty,
  applyFalseRejectionPenalty,

  // High-level reward functions
  applyApprovalReward,
  applyMergeReward,
  applyCreationReward,

  // Admin helper functions
  applyReputationForTranslationStatusChange,

  // Utility functions
  isImmuneToRejectionPenalty,
  getReputationTierName,
  getReputationTierInfo,

  // Reputation history functions
  getReputationHistory,
  getReputationHistoryAggregated,

  // Reputation rules functions
  getReputationRules,
  updateReputationRule,
  previewRuleChange,
};

/**
 * Get full reputation history for a user
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} limit - Maximum number of events to return (default: 100)
 * @returns {Array} Array of reputation events
 */
function getReputationHistory(userIdentifier, limit = 100) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return [];
  }

  const events = db
    .prepare(`
      SELECT 
        re.id,
        re.delta,
        re.reason,
        re.created_at,
        re.related_activity_id
      FROM reputation_events re
      WHERE re.user_id = ?
      ORDER BY datetime(re.created_at) DESC
      LIMIT ?
    `)
    .all(userId, limit);

  return events;
}

/**
 * Get aggregated reputation history for a user (for graphing)
 * Returns daily aggregated data with running total
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} days - Number of days to look back (default: 90)
 * @returns {Array} Array of { date, delta, cumulative_reputation, event_count }
 */
function getReputationHistoryAggregated(userIdentifier, days = 90) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(userIdentifier);
  
  if (!userId) {
    return [];
  }

  // Get daily aggregated reputation changes
  const aggregated = db
    .prepare(`
      WITH RECURSIVE dates(date) AS (
        SELECT DATE('now', '-' || ? || ' days')
        UNION ALL
        SELECT DATE(date, '+1 day')
        FROM dates
        WHERE date < DATE('now')
      ),
      daily_events AS (
        SELECT 
          DATE(re.created_at) as event_date,
          SUM(re.delta) as daily_delta,
          COUNT(*) as event_count
        FROM reputation_events re
        WHERE re.user_id = ?
          AND DATE(re.created_at) >= DATE('now', '-' || ? || ' days')
        GROUP BY DATE(re.created_at)
      )
      SELECT 
        dates.date,
        COALESCE(de.daily_delta, 0) as delta,
        COALESCE(de.event_count, 0) as event_count
      FROM dates
      LEFT JOIN daily_events de ON dates.date = de.event_date
      ORDER BY dates.date ASC
    `)
    .all(days, userId, days);

  // Calculate cumulative reputation
  const currentRep = getUserReputation(userId);
  const totalDeltaInPeriod = aggregated.reduce((sum, day) => sum + day.delta, 0);
  let runningTotal = currentRep - totalDeltaInPeriod;

  return aggregated.map(day => {
    runningTotal += day.delta;
    return {
      date: day.date,
      delta: day.delta,
      cumulative_reputation: runningTotal,
      event_count: day.event_count
    };
  });
}

/**
 * Get all reputation rules
 * @returns {Array} Array of reputation rules
 */
function getReputationRules() {
  const db = getDatabase();
  
  try {
    const rules = db
      .prepare(`
        SELECT 
          id,
          rule_name,
          rule_value,
          description,
          updated_at,
          updated_by_id
        FROM reputation_rules
        ORDER BY rule_name ASC
      `)
      .all();
    
    return rules;
  } catch (err) {
    // Table might not exist in older databases
    console.error('Error fetching reputation rules:', err.message);
    return [];
  }
}

/**
 * Update a reputation rule
 * @param {string} ruleName - Name of the rule to update
 * @param {number} newValue - New value for the rule
 * @param {number|string} updatedBy - User ID or username of admin making the change
 * @returns {boolean} True if updated successfully
 */
function updateReputationRule(ruleName, newValue, updatedBy) {
  const db = getDatabase();
  const userId = resolveUserIdentifier(updatedBy);
  
  if (!userId) {
    throw new Error('Invalid user');
  }

  try {
    const result = db
      .prepare(`
        UPDATE reputation_rules
        SET rule_value = ?,
            updated_at = CURRENT_TIMESTAMP,
            updated_by_id = ?
        WHERE rule_name = ?
      `)
      .run(newValue, userId, ruleName);
    
    return result.changes > 0;
  } catch (err) {
    console.error('Error updating reputation rule:', err.message);
    throw err;
  }
}

/**
 * Preview the impact of changing a reputation rule on historical data
 * This simulates what reputation scores would have been if the rule had different values
 * @param {string} ruleName - Name of the rule to preview
 * @param {number} newValue - Proposed new value
 * @param {number} sampleSize - Number of users to sample (default: 10)
 * @returns {object} Preview data showing before/after reputation for sample users
 */
function previewRuleChange(ruleName, newValue, sampleSize = 10) {
  const db = getDatabase();
  
  // Get the current rule value
  const currentRule = db
    .prepare('SELECT rule_value FROM reputation_rules WHERE rule_name = ?')
    .get(ruleName);
  
  if (!currentRule) {
    throw new Error('Rule not found');
  }
  
  const currentValue = currentRule.rule_value;
  const delta = newValue - currentValue;
  
  // Determine which events would be affected based on rule name
  let reasonPattern = '';
  
  if (ruleName === 'TRANSLATION_APPROVED') {
    reasonPattern = '%approved%';
  } else if (ruleName === 'TRANSLATION_MERGED') {
    reasonPattern = '%merged%';
  } else if (ruleName === 'TRANSLATION_CREATED') {
    reasonPattern = '%created%';
  } else if (ruleName === 'BASE_REJECTION_PENALTY') {
    reasonPattern = '%rejected%';
  } else if (ruleName === 'BASE_FALSE_REJECTION_PENALTY') {
    reasonPattern = '%false_rejection%';
  }
  
  if (!reasonPattern) {
    // For tier thresholds and other rules, we can't easily preview
    return {
      currentValue,
      newValue,
      delta,
      message: 'Preview not available for this rule type',
      affectedUsers: []
    };
  }
  
  // Get sample of users affected by this rule
  const affectedUsers = db
    .prepare(`
      SELECT 
        u.id,
        u.username,
        u.reputation as current_reputation,
        COUNT(re.id) as affected_event_count,
        SUM(re.delta) as current_total_delta
      FROM users u
      INNER JOIN reputation_events re ON u.id = re.user_id
      WHERE re.reason LIKE ?
      GROUP BY u.id, u.username, u.reputation
      ORDER BY affected_event_count DESC
      LIMIT ?
    `)
    .all(reasonPattern, sampleSize);
  
  // Calculate projected reputation for each user
  const preview = affectedUsers.map(user => {
    const changePerEvent = delta;
    const totalChange = changePerEvent * user.affected_event_count;
    const projectedReputation = user.current_reputation + totalChange;
    
    return {
      userId: user.id,
      username: user.username,
      currentReputation: user.current_reputation,
      projectedReputation,
      affectedEvents: user.affected_event_count,
      reputationChange: totalChange
    };
  });
  
  return {
    currentValue,
    newValue,
    delta,
    affectedUsers: preview,
    totalUsersAffected: db
      .prepare(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM reputation_events
        WHERE reason LIKE ?
      `)
      .get(reasonPattern).count
  };
}
