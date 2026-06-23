// Flow service - handles Translation Flow logic and queue management

const { getDatabase } = require("../db/database");
const {
  awardPoints,
  updateStreak,
  incrementTranslationCount,
  incrementReviewCount,
  updateChallengeProgress,
} = require("./gamification.service");
const {
  applyApprovalReward,
  applyRejectionPenalty,
  applyCreationReward,
} = require("./reputation.service");

// SQL pattern to check for translatable field roles
const TRANSLATABLE_FIELD_PATTERN = `(tf.field_roles LIKE '%"translatable"%' OR tf.field_roles LIKE '%''translatable''%')`;

/**
 * Get pending reviews for a user (reviews they need to do, not their own translations)
 * Returns translations that are in 'review' status and not created by the user
 * Only returns fields with field_role = 'translatable'
 * @param {number|string} userIdentifier - User ID or username
 * @param {string} language - Optional language filter
 * @param {number} sourceId - Optional source filter
 * @returns {array} Array of translations needing review
 */
function getPendingReviews(userIdentifier, language = null, sourceId = null) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return null;
    }
  }
  
  // Build query with optional language and source filter and translatable fields filter
  let query = `SELECT t.id as translation_id, t.term_field_id, t.language, t.value, t.status,
            t.created_by_id, t.created_at,
            tf.field_uri, tf.original_value,
            term.id as term_id, term.uri as term_uri, term.source_id
     FROM translations t
     JOIN term_fields tf ON t.term_field_id = tf.id
     JOIN terms term ON tf.term_id = term.id
     LEFT JOIN user_activity ua_skip ON t.id = ua_skip.translation_id
       AND ua_skip.user_id = ? AND ua_skip.action = 'task_skipped'
     WHERE t.status = 'review' 
       AND t.created_by_id != ?
       AND (t.reviewed_by_id IS NULL)
       AND ua_skip.translation_id IS NULL
       AND ${TRANSLATABLE_FIELD_PATTERN}`;
  
  const params = [userId, userId];
  
  if (language) {
    query += ` AND t.language = ?`;
    params.push(language);
  }
  
  if (sourceId) {
    query += ` AND term.source_id = ?`;
    params.push(parseInt(sourceId, 10));
  }
  
  query += ` ORDER BY datetime(t.created_at) ASC LIMIT 1`;
  
  const reviews = db.prepare(query).get(...params);
  
  if (!reviews) {
    return null;
  }
  
  // Enrich with translatable fields for context
  const allFields = db.prepare(
    `SELECT tf.field_uri, tf.original_value 
     FROM term_fields tf
     WHERE tf.term_id = ?
     AND ${TRANSLATABLE_FIELD_PATTERN}`
  ).all(reviews.term_id);
  
  return {
    ...reviews,
    term_fields: allFields,
  };
}

/**
 * Get rejected translations that the user created (for re-translation)
 * Returns translations that are in 'rejected' status and created by the user
 * Only returns fields with field_role = 'translatable'
 * @param {number|string} userIdentifier - User ID or username
 * @param {string} language - Optional language filter
 * @param {number} sourceId - Optional source filter
 * @returns {object|null} Rejected translation needing re-work
 */
function getRejectedTranslations(userIdentifier, language = null, sourceId = null) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return null;
    }
  }
  
  // Build query to get rejected translations created by this user
  let query = `SELECT t.id as translation_id, t.term_field_id, t.language, t.value, t.status,
            t.created_by_id, t.created_at, t.rejection_reason, t.resubmission_motivation,
            tf.field_uri, tf.original_value,
            term.id as term_id, term.uri as term_uri, term.source_id
     FROM translations t
     JOIN term_fields tf ON t.term_field_id = tf.id
     JOIN terms term ON tf.term_id = term.id
     WHERE t.status = 'rejected' 
       AND t.created_by_id = ?
       AND ${TRANSLATABLE_FIELD_PATTERN}`;
  
  const params = [userId];
  
  if (language) {
    query += ` AND t.language = ?`;
    params.push(language);
  }
  
  if (sourceId) {
    query += ` AND term.source_id = ?`;
    params.push(parseInt(sourceId, 10));
  }
  
  query += ` ORDER BY t.updated_at ASC LIMIT 1`;
  
  const rejected = db.prepare(query).get(...params);
  
  if (!rejected) {
    return null;
  }
  
  // Enrich with translatable fields for context
  const allFields = db.prepare(
    `SELECT tf.field_uri, tf.original_value 
     FROM term_fields tf
     WHERE tf.term_id = ?
     AND ${TRANSLATABLE_FIELD_PATTERN}`
  ).all(rejected.term_id);
  
  return {
    ...rejected,
    term_fields: allFields,
  };
}

/**
 * Get discussion translations that involve the user
 * Returns translations that are in 'discussion' status where the user is a participant
 * Only returns fields with field_role = 'translatable'
 * @param {number|string} userIdentifier - User ID or username
 * @param {string} language - Optional language filter
 * @param {number} sourceId - Optional source filter
 * @returns {object|null} Translation in discussion that involves this user
 */
function getDiscussionTranslations(userIdentifier, language = null, sourceId = null) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return null;
    }
  }
  
  // Build query to get translations in discussion where this user is a participant
  let query = `SELECT t.id as translation_id, t.term_field_id, t.language, t.value, t.status,
            t.created_by_id, t.created_at, t.rejection_reason, t.resubmission_motivation,
            tf.field_uri, tf.original_value,
            term.id as term_id, term.uri as term_uri, term.source_id
     FROM translations t
     JOIN term_fields tf ON t.term_field_id = tf.id
     JOIN terms term ON tf.term_id = term.id
     JOIN discussion_participants dp ON t.id = dp.translation_id
     LEFT JOIN user_activity ua_skip ON t.id = ua_skip.translation_id
       AND ua_skip.user_id = ? AND ua_skip.action = 'task_skipped'
     WHERE t.status = 'discussion' 
       AND dp.user_id = ?
       AND ua_skip.translation_id IS NULL
       AND ${TRANSLATABLE_FIELD_PATTERN}`;
  
  const params = [userId, userId];
  
  if (language) {
    query += ` AND t.language = ?`;
    params.push(language);
  }
  
  if (sourceId) {
    query += ` AND term.source_id = ?`;
    params.push(parseInt(sourceId, 10));
  }
  
  query += ` ORDER BY t.updated_at DESC LIMIT 1`;
  
  const discussion = db.prepare(query).get(...params);
  
  if (!discussion) {
    return null;
  }
  
  // Enrich with translatable fields for context
  const allFields = db.prepare(
    `SELECT tf.field_uri, tf.original_value 
     FROM term_fields tf
     WHERE tf.term_id = ?
     AND ${TRANSLATABLE_FIELD_PATTERN}`
  ).all(discussion.term_id);
  
  return {
    ...discussion,
    term_fields: allFields,
  };
}

/**
 * Get a random untranslated term field
 * Prioritizes terms with no translations at all
 * Only returns fields with 'translatable' in field_roles
 * @param {number|string} userIdentifier - User ID or username (optional, for filtering)
 * @param {string} language - Optional language filter
 * @param {number} sourceId - Optional source filter
 * @returns {object|null} Term field needing translation
 */
function getRandomUntranslated(userIdentifier, language = null, sourceId = null) {
  const db = getDatabase();
  
  // Build query with optional language and source filter and translatable fields filter
  // Filter out empty or whitespace-only original_value to prevent offering empty content for translation
  let query = `SELECT tf.id as term_field_id, tf.field_uri, tf.original_value,
            term.id as term_id, term.uri as term_uri, term.source_id
     FROM term_fields tf
     JOIN terms term ON tf.term_id = term.id
     WHERE ${TRANSLATABLE_FIELD_PATTERN}
       AND tf.original_value IS NOT NULL 
       AND TRIM(tf.original_value) != ''`;
  
  const params = [];
  
  if (sourceId) {
    query += ` AND term.source_id = ?`;
    params.push(parseInt(sourceId, 10));
  }
  
  if (language) {
    query += ` AND tf.id NOT IN (
         SELECT term_field_id FROM translations WHERE language = ? AND status IN ('draft', 'review', 'approved', 'merged')
       )`;
    params.push(language);
  } else {
    query += ` AND tf.id NOT IN (
         SELECT term_field_id FROM translations WHERE language IN ('nl', 'fr', 'de', 'es', 'it', 'pt') AND status IN ('draft', 'review', 'approved', 'merged')
       )`;
  }
  
  query += ` ORDER BY RANDOM() LIMIT 1`;
  
  const untranslated = db.prepare(query).get(...params);
  
  if (!untranslated) {
    // Try to find fields with partial translations
    let partialQuery = `SELECT tf.id as term_field_id, tf.field_uri, tf.original_value,
              term.id as term_id, term.uri as term_uri, term.source_id,
              (SELECT COUNT(*) FROM translations WHERE term_field_id = tf.id`;
    
    if (language) {
      partialQuery += ` AND language = ? AND status IN ('draft', 'review', 'approved', 'merged')`;
    } else {
      partialQuery += ` AND status IN ('draft', 'review', 'approved', 'merged')`;
    }
    
    partialQuery += `) as translation_count
       FROM term_fields tf
       JOIN terms term ON tf.term_id = term.id
       WHERE ${TRANSLATABLE_FIELD_PATTERN}
         AND tf.original_value IS NOT NULL 
         AND TRIM(tf.original_value) != ''
         AND (SELECT COUNT(*) FROM translations WHERE term_field_id = tf.id`;
    
    const partialParams = [];
    
    if (language) {
      partialQuery += ` AND language = ? AND status IN ('draft', 'review', 'approved', 'merged')`;
      partialParams.push(language); // First parameter for SELECT COUNT subquery
      partialParams.push(language); // Second parameter for WHERE clause subquery
      partialQuery += `) < 1`;
    } else {
      partialQuery += ` AND status IN ('draft', 'review', 'approved', 'merged')`;
      partialQuery += `) < 6`;
    }
    
    partialQuery += ` ORDER BY translation_count ASC, RANDOM() LIMIT 1`;
    
    const partiallyTranslated = db.prepare(partialQuery).get(...partialParams);
    
    if (!partiallyTranslated) {
      return null;
    }
    
    // Get all translatable fields for this term for context
    const allFields = db.prepare(
      `SELECT tf.field_uri, tf.original_value 
       FROM term_fields tf
       WHERE tf.term_id = ?
       AND ${TRANSLATABLE_FIELD_PATTERN}`
    ).all(partiallyTranslated.term_id);
    
    return {
      ...partiallyTranslated,
      term_fields: allFields,
    };
  }
  
  // Get all translatable fields for this term for context
  const allFields = db.prepare(
    `SELECT tf.field_uri, tf.original_value 
     FROM term_fields tf
     WHERE tf.term_id = ?
     AND ${TRANSLATABLE_FIELD_PATTERN}`
  ).all(untranslated.term_id);
  
  return {
    ...untranslated,
    term_fields: allFields,
  };
}

/**
 * Get the next task for the user (review or translate)
 * Priority order:
 * 1. Rejected translations from the user (needs re-work)
 * 2. Pending reviews (other users' translations)
 * 3. Untranslated terms
 * @param {number|string} userIdentifier - User ID or username
 * @param {string} language - Optional language filter (if not provided, cycles through user's translation languages)
 * @param {number} sourceId - Optional source filter
 * @returns {object} Next task object
 */
function getNextTask(userIdentifier, language = null, sourceId = null) {
  const db = getDatabase();
  const { getUserTranslationLanguages } = require('../utils/languagePreferences');
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    const { resolveUsernameToId } = require("../db/database");
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return {
        type: 'none',
        message: 'User not found',
      };
    }
  }
  
  // If language is not specified, get user's translation languages and try each one
  let languagesToCheck = language ? [language] : getUserTranslationLanguages(db, userId);
  
  // If no translation languages configured, default to common languages
  if (languagesToCheck.length === 0) {
    languagesToCheck = ['nl', 'fr', 'de', 'es'];
  }
  
  console.log('[Flow] Checking languages for tasks:', languagesToCheck);
  if (sourceId) {
    console.log('[Flow] Filtering by source:', sourceId);
  }
  
  // Try each language in priority order
  for (const lang of languagesToCheck) {
    // Priority 1: Discussion translations where user is a participant
    const discussion = getDiscussionTranslations(userIdentifier, lang, sourceId);
    if (discussion) {
      return {
        type: 'discussion',
        task: discussion,
        language: lang,
      };
    }
    
    // Priority 2: Rejected translations by this user (needs re-work)
    const rejected = getRejectedTranslations(userIdentifier, lang, sourceId);
    if (rejected) {
      return {
        type: 'rework',
        task: rejected,
        language: lang,
      };
    }
    
    // Priority 3: Pending reviews for this language (and source if specified)
    const review = getPendingReviews(userIdentifier, lang, sourceId);
    if (review) {
      return {
        type: 'review',
        task: review,
        language: lang,
      };
    }
    
    // Priority 4: Untranslated terms for this language (and source if specified)
    const untranslated = getRandomUntranslated(userIdentifier, lang, sourceId);
    if (untranslated) {
      return {
        type: 'translate',
        task: untranslated,
        language: lang,
      };
    }
  }
  
  // No tasks available in any language
  return {
    type: 'none',
    message: 'No tasks available at the moment. Great job!',
  };
}

/**
 * Submit a review (approve or reject)
 * @param {object} params - Review parameters
 * @returns {object} Result of review
 */
function submitReview(params) {
  const { userId, translationId, action, sessionId, rejectionReason, discussionMessage, discussionTranslation } = params;
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve userId to integer ID
  let resolvedUserId = typeof userId === 'number' ? userId : parseInt(userId, 10);
  if (isNaN(resolvedUserId)) {
    resolvedUserId = resolveUsernameToId(userId);
    if (!resolvedUserId) {
      throw new Error('User not found');
    }
  }
  
  // Validate action
  if (!['approve', 'reject', 'discuss'].includes(action)) {
    throw new Error('Invalid action. Must be "approve", "reject", or "discuss"');
  }
  
  // Validate rejection reason if action is reject
  if (action === 'reject' && (!rejectionReason || !rejectionReason.trim())) {
    throw new Error('Rejection reason is required when rejecting a translation');
  }
  
  // Validate discussion fields if action is discuss
  // A proposed translation is required; an explanation message is optional
  if (action === 'discuss' && (!discussionTranslation || !discussionTranslation.trim())) {
    throw new Error('A proposed translation is required when opening a discussion');
  }
  
  // Get the translation
  const translation = db.prepare(
    "SELECT t.*, tf.term_id FROM translations t JOIN term_fields tf ON t.term_field_id = tf.id WHERE t.id = ?"
  ).get(translationId);
  
  if (!translation) {
    throw new Error('Translation not found');
  }
  
  // Allow review actions on translations in 'review' or 'discussion' status
  if (!['review', 'discussion'].includes(translation.status)) {
    throw new Error('Translation is not in review or discussion status');
  }
  
  // Handle discussion action - change status to 'discussion' and track participants
  if (action === 'discuss') {
    // Add the user as a discussion participant
    const { addDiscussionParticipant, notifyDiscussionParticipants } = require("./notification.service");
    addDiscussionParticipant(translationId, resolvedUserId);
    
    // Also add the translation creator as a participant if not already
    if (translation.created_by_id && translation.created_by_id !== resolvedUserId) {
      addDiscussionParticipant(translationId, translation.created_by_id);
    }

    // Update the translation value with the proposed translation and track the modifier
    const proposedTranslation = discussionTranslation.trim();
    const trimmedMessage = discussionMessage ? discussionMessage.trim() : null;
    db.prepare(
      "UPDATE translations SET value = ?, modified_by_id = ?, status = 'discussion', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(proposedTranslation, resolvedUserId, translationId);
    
    // Log discussion activity with both the proposed translation and optional explanation
    const activityExtra = {
      sessionId,
      language: translation.language,
      translation_value: proposedTranslation,
      discussion_message: trimmedMessage
    };
    
    db.prepare(
      "INSERT INTO user_activity (user_id, action, term_id, term_field_id, translation_id, extra) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      resolvedUserId,
      'translation_discussion',
      translation.term_id,
      translation.term_field_id,
      translationId,
      JSON.stringify(activityExtra)
    );
    
    // Notify all other participants about this discussion
    const notificationMessage = trimmedMessage || `Proposed translation: "${proposedTranslation}"`;
    notifyDiscussionParticipants(translationId, translation.term_id, resolvedUserId, notificationMessage);
    
    return {
      success: true,
      action: 'discuss',
      points: 0,
      streakInfo: { streak: 0, longestStreak: 0, isNewStreak: false }
    };
  }
  
  // Store old status for logging
  const oldStatus = translation.status;
  
  // Update translation status
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  
  if (action === 'reject') {
    db.prepare(
      "UPDATE translations SET status = ?, reviewed_by_id = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(newStatus, resolvedUserId, rejectionReason.trim(), translationId);
  } else {
    db.prepare(
      "UPDATE translations SET status = ?, reviewed_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(newStatus, resolvedUserId, translationId);
  }
  
  // Apply reputation changes based on action using existing reputation system
  if (action === 'approve') {
    // Award approval reward to the most recent modifier (or original creator)
    const translatorUserId = translation.modified_by_id || translation.created_by_id;
    if (translatorUserId) {
      applyApprovalReward(translatorUserId, translationId);
    }

    // Also award approval reward to all other discussion participants who contributed
    try {
      const participants = db.prepare(
        "SELECT DISTINCT user_id FROM discussion_participants WHERE translation_id = ?"
      ).all(translationId);
      for (const participant of participants) {
        if (participant.user_id !== translatorUserId) {
          applyApprovalReward(participant.user_id, translationId);
        }
      }
    } catch (participantErr) {
      console.log(`Could not award points to discussion participants for translation ${translationId}:`, participantErr.message);
    }
  } else if (action === 'reject') {
    // Apply rejection penalty to translator
    const translatorUserId = translation.modified_by_id || translation.created_by_id;
    if (translatorUserId) {
      applyRejectionPenalty(translatorUserId, translationId);
    }
  }
  
  // Award 1 reputation point to reviewer
  const points = 1;
  awardPoints(resolvedUserId, points, `review_${action}`);
  
  // Update streak
  const streakInfo = updateStreak(resolvedUserId);
  
  // Increment review count
  incrementReviewCount(resolvedUserId);
  
  // Update challenge progress
  updateChallengeProgress(resolvedUserId, 'review_10', 1);
  
  // Update daily goal progress (5 translations or reviews)
  const { updateDailyGoalProgress } = require("./gamification.service");
  updateDailyGoalProgress(resolvedUserId, 1);
  
  // Log activity with rejection reason and status change
  try {
    const activityExtra = { 
      sessionId,
      old_status: oldStatus,
      new_status: newStatus,
      language: translation.language,
      translation_value: translation.value
    };
    if (action === 'reject' && rejectionReason) {
      activityExtra.rejection_reason = rejectionReason.trim();
    }
    
    // Log status change action (consistent with term detail page)
    db.prepare(
      "INSERT INTO user_activity (user_id, action, term_id, term_field_id, translation_id, extra) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      resolvedUserId, 
      'translation_status_changed', 
      translation.term_id,
      translation.term_field_id,
      translationId, 
      JSON.stringify(activityExtra)
    );
    
    // Also log the specific approved/rejected action for backward compatibility
    db.prepare(
      "INSERT INTO user_activity (user_id, action, term_id, term_field_id, translation_id, extra) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      resolvedUserId, 
      `translation_${action}d`, 
      translation.term_id,
      translation.term_field_id,
      translationId, 
      JSON.stringify(activityExtra)
    );
  } catch (err) {
    console.log("Could not log activity:", err.message);
  }
  
  return {
    success: true,
    action,
    points,
    streakInfo,
  };
}

/**
 * Get available languages for translation
 * @returns {array} Array of language codes
 */
function getAvailableLanguages() {
  return [
    { code: 'nl', name: 'Dutch' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
  ];
}

/**
 * Get translation history for a specific translation
 * Returns activity log related to this translation
 * @param {number} translationId - Translation ID
 * @returns {array} Array of activity entries
 */
function getTranslationHistory(translationId) {
  const db = getDatabase();
  
  // Get the translation to find related entries
  const translation = db.prepare(
    "SELECT * FROM translations WHERE id = ?"
  ).get(translationId);
  
  if (!translation) {
    return [];
  }
  
  // Get all activity related to this translation
  const history = db.prepare(
    `SELECT ua.*, u.username, u.extra as user_extra
     FROM user_activity ua
     LEFT JOIN users u ON ua.user_id = u.id
     WHERE ua.translation_id = ?
     ORDER BY ua.created_at ASC`
  ).all(translationId);
  
  // Parse user extra to get display name
  return history.map(entry => {
    let displayName = entry.username;
    if (entry.user_extra) {
      try {
        const extraData = JSON.parse(entry.user_extra);
        if (extraData.name) {
          displayName = extraData.name;
        }
      } catch (e) {
        // If parsing fails, use username
      }
    }
    return {
      ...entry,
      display_name: displayName,
      current_translation_value: translation.value
    };
  });
}

/**
 * Log a skip action for analytics
 * @param {object} params - Skip action parameters
 * @param {number|string} params.userId - User ID or username
 * @param {string} params.taskType - Type of task skipped
 * @param {number} params.termId - Term ID (optional)
 * @param {number} params.translationId - Translation ID (optional)
 * @param {string} params.fieldUri - Field URI (optional)
 * @param {string} params.language - Language (optional)
 */
function logSkipAction({ userId, taskType, termId, translationId, fieldUri, language }) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let resolvedUserId = typeof userId === 'number' ? userId : parseInt(userId, 10);
  if (isNaN(resolvedUserId)) {
    resolvedUserId = resolveUsernameToId(userId);
    if (!resolvedUserId) {
      console.warn("[Flow] Could not resolve user ID for skip action logging");
      return;
    }
  }
  
  try {
    // Log as activity for analytics
    const extra = {
      task_type: taskType,
      language: language || null,
      field_uri: fieldUri || null,
    };
    
    db.prepare(
      "INSERT INTO user_activity (user_id, action, term_id, term_field_id, translation_id, extra) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      resolvedUserId,
      'task_skipped',
      termId || null,
      null, // term_field_id
      translationId || null,
      JSON.stringify(extra)
    );
  } catch (err) {
    console.warn("[Flow] Could not log skip action:", err.message);
  }
}

module.exports = {
  getPendingReviews,
  getRejectedTranslations,
  getRandomUntranslated,
  getNextTask,
  submitReview,
  getAvailableLanguages,
  getTranslationHistory,
  getTranslationTask,
  logSkipAction
};

/**
 * Get a specific translation task by translation ID
 * Used for navigation from notifications
 * @param {number} translationId - The translation ID
 * @param {number|string} userIdentifier - User ID or username
 * @returns {object} Translation task object or null
 */
function getTranslationTask(translationId, userIdentifier) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return null;
    }
  }
  
  // Get the translation and related information
  const translation = db.prepare(`
    SELECT t.id as translation_id, t.term_field_id, t.language, t.value, t.status,
           t.created_by_id, t.created_at, t.rejection_reason, t.resubmission_motivation,
           tf.field_uri, tf.original_value,
           term.id as term_id, term.uri as term_uri, term.source_id,
           creator.username as created_by
    FROM translations t
    JOIN term_fields tf ON t.term_field_id = tf.id
    JOIN terms term ON tf.term_id = term.id
    LEFT JOIN users creator ON t.created_by_id = creator.id
    WHERE t.id = ?
  `).get(translationId);
  
  if (!translation) {
    return null;
  }
  
  // Get all translatable fields for context
  const allFields = db.prepare(
    `SELECT tf.field_uri, tf.original_value 
     FROM term_fields tf
     WHERE tf.term_id = ?
     AND ${TRANSLATABLE_FIELD_PATTERN}`
  ).all(translation.term_id);
  
  // Determine task type based on status and user
  let taskType;
  if (translation.status === 'rejected' && translation.created_by_id === userId) {
    taskType = 'rework';
  } else if (translation.status === 'review' || translation.status === 'discussion') {
    taskType = 'review';
  } else {
    // For other statuses, just show as review (read-only)
    taskType = 'review';
  }
  
  return {
    type: taskType,
    taskType,
    task: {
      ...translation,
      term_fields: allFields
    }
  };
}
