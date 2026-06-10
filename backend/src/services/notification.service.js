// Notification service - handles notification creation and management

const { getDatabase } = require("../db/database");

/**
 * Create a notification for a user
 * @param {object} params - Notification parameters
 * @returns {number} The created notification ID
 */
function createNotification(params) {
  const { userId, type, translationId, termId, message, link, createdById } = params;
  const db = getDatabase();
  
  // Don't send notifications to yourself
  if (userId === createdById) {
    return null;
  }
  
  const stmt = db.prepare(`
    INSERT INTO notifications (user_id, type, translation_id, term_id, message, link, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(userId, type, translationId, termId, message, link, createdById);
  return result.lastInsertRowid;
}

/**
 * Get unread notifications for a user
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} limit - Maximum number of notifications to return
 * @returns {array} Array of notifications
 */
function getUnreadNotifications(userIdentifier, limit = 50) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return [];
    }
  }
  
  const stmt = db.prepare(`
    SELECT n.*, 
           u.username as created_by_username,
           u.extra as created_by_extra
    FROM notifications n
    LEFT JOIN users u ON n.created_by_id = u.id
    WHERE n.user_id = ? AND n.read = 0
    ORDER BY n.created_at DESC
    LIMIT ?
  `);
  
  const notifications = stmt.all(userId, limit);
  
  // Parse extra field for display names
  return notifications.map(n => {
    if (n.created_by_extra) {
      try {
        const extra = JSON.parse(n.created_by_extra);
        n.created_by_display_name = extra.display_name || n.created_by_username;
      } catch (e) {
        n.created_by_display_name = n.created_by_username;
      }
    } else {
      n.created_by_display_name = n.created_by_username;
    }
    return n;
  });
}

/**
 * Get all notifications for a user (read and unread)
 * @param {number|string} userIdentifier - User ID or username
 * @param {number} limit - Maximum number of notifications to return
 * @returns {array} Array of notifications
 */
function getAllNotifications(userIdentifier, limit = 50) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return [];
    }
  }
  
  const stmt = db.prepare(`
    SELECT n.*, 
           u.username as created_by_username,
           u.extra as created_by_extra
    FROM notifications n
    LEFT JOIN users u ON n.created_by_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `);
  
  const notifications = stmt.all(userId, limit);
  
  // Parse extra field for display names
  return notifications.map(n => {
    if (n.created_by_extra) {
      try {
        const extra = JSON.parse(n.created_by_extra);
        n.created_by_display_name = extra.display_name || n.created_by_username;
      } catch (e) {
        n.created_by_display_name = n.created_by_username;
      }
    } else {
      n.created_by_display_name = n.created_by_username;
    }
    return n;
  });
}

/**
 * Mark a notification as read
 * @param {number} notificationId - The notification ID
 * @param {number|string} userIdentifier - User ID or username (for security check)
 * @returns {boolean} Success
 */
function markNotificationAsRead(notificationId, userIdentifier) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return false;
    }
  }
  
  const stmt = db.prepare(`
    UPDATE notifications 
    SET read = 1 
    WHERE id = ? AND user_id = ?
  `);
  
  const result = stmt.run(notificationId, userId);
  return result.changes > 0;
}

/**
 * Mark all notifications as read for a user
 * @param {number|string} userIdentifier - User ID or username
 * @returns {number} Number of notifications marked as read
 */
function markAllNotificationsAsRead(userIdentifier) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return 0;
    }
  }
  
  const stmt = db.prepare(`
    UPDATE notifications 
    SET read = 1 
    WHERE user_id = ? AND read = 0
  `);
  
  const result = stmt.run(userId);
  return result.changes;
}

/**
 * Get unread notification count for a user
 * @param {number|string} userIdentifier - User ID or username
 * @returns {number} Count of unread notifications
 */
function getUnreadNotificationCount(userIdentifier) {
  const db = getDatabase();
  const { resolveUsernameToId } = require("../db/database");
  
  // Resolve user identifier to user_id
  let userId = typeof userIdentifier === 'number' ? userIdentifier : parseInt(userIdentifier, 10);
  if (isNaN(userId)) {
    userId = resolveUsernameToId(userIdentifier);
    if (!userId) {
      return 0;
    }
  }
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND read = 0
  `);
  
  const result = stmt.get(userId);
  return result ? result.count : 0;
}

/**
 * Add or update a discussion participant
 * @param {number} translationId - The translation ID
 * @param {number} userId - The user ID
 */
function addDiscussionParticipant(translationId, userId) {
  const db = getDatabase();
  
  // Try to update existing participant
  const updateStmt = db.prepare(`
    UPDATE discussion_participants
    SET last_message_at = CURRENT_TIMESTAMP
    WHERE translation_id = ? AND user_id = ?
  `);
  
  const result = updateStmt.run(translationId, userId);
  
  // If no rows updated, insert new participant
  if (result.changes === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO discussion_participants (translation_id, user_id)
      VALUES (?, ?)
    `);
    insertStmt.run(translationId, userId);
  }
}

/**
 * Get all participants in a discussion except the specified user
 * @param {number} translationId - The translation ID
 * @param {number} excludeUserId - User ID to exclude (usually the person posting)
 * @returns {array} Array of user IDs
 */
function getDiscussionParticipants(translationId, excludeUserId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT user_id
    FROM discussion_participants
    WHERE translation_id = ? AND user_id != ?
  `);
  
  const participants = stmt.all(translationId, excludeUserId);
  return participants.map(p => p.user_id);
}

/**
 * Notify all participants of a discussion about a new message
 * @param {number} translationId - The translation ID
 * @param {number} termId - The term ID
 * @param {number} userId - The user ID who posted
 * @param {string} message - The discussion message
 */
function notifyDiscussionParticipants(translationId, termId, userId, message) {
  const participants = getDiscussionParticipants(translationId, userId);
  
  if (participants.length === 0) {
    return;
  }
  
  const db = getDatabase();
  const user = db.prepare('SELECT username, extra FROM users WHERE id = ?').get(userId);
  
  let displayName = user?.username || 'Someone';
  if (user?.extra) {
    try {
      const extra = JSON.parse(user.extra);
      displayName = extra.display_name || user.username;
    } catch (e) {}
  }
  
  const notificationMessage = `${displayName} replied to a discussion you're in`;
  const link = `/flow?translation_id=${translationId}`;
  
  participants.forEach(participantId => {
    createNotification({
      userId: participantId,
      type: 'discussion_reply',
      translationId,
      termId,
      message: notificationMessage,
      link,
      createdById: userId
    });
  });
}

/**
 * Get a specific notification by ID
 * @param {number} notificationId - The notification ID
 * @param {number|string} userIdentifier - User ID or username
 * @returns {object|null} The notification object or null
 */
function getNotification(notificationId, userIdentifier) {
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
  
  const stmt = db.prepare(`
    SELECT n.*, 
           u.username as created_by_username,
           u.extra as created_by_extra
    FROM notifications n
    LEFT JOIN users u ON n.created_by_id = u.id
    WHERE n.id = ? AND n.user_id = ?
  `);
  
  const notification = stmt.get(notificationId, userId);
  if (!notification) return null;
  
  // Parse extra field for display names
  if (notification.created_by_extra) {
    try {
      const extra = JSON.parse(notification.created_by_extra);
      notification.created_by_display_name = extra.display_name || notification.created_by_username;
    } catch (e) {
      notification.created_by_display_name = notification.created_by_username;
    }
  } else {
    notification.created_by_display_name = notification.created_by_username;
  }
  
  return notification;
}

module.exports = {
  createNotification,
  getUnreadNotifications,
  getAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  addDiscussionParticipant,
  getDiscussionParticipants,
  notifyDiscussionParticipants,
  getNotification
};
