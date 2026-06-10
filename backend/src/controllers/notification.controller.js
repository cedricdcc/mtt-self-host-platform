// Notification controller - handles HTTP requests for notifications

const notificationService = require("../services/notification.service");

/**
 * Get unread notifications for the current user
 */
async function getUnreadNotifications(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userId = req.session.user.id || req.session.user.user_id;
    const limit = parseInt(req.query.limit) || 50;
    
    const notifications = notificationService.getUnreadNotifications(userId, limit);
    const count = notificationService.getUnreadNotificationCount(userId);
    
    res.json({ notifications, count });
  } catch (error) {
    console.error("[Notifications] Get unread error:", error);
    res.status(500).json({ error: error.message || "Failed to get notifications" });
  }
}

/**
 * Get all notifications for the current user
 */
async function getAllNotifications(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userId = req.session.user.id || req.session.user.user_id;
    const limit = parseInt(req.query.limit) || 50;
    
    const notifications = notificationService.getAllNotifications(userId, limit);
    const unreadCount = notificationService.getUnreadNotificationCount(userId);
    
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[Notifications] Get all error:", error);
    res.status(500).json({ error: error.message || "Failed to get notifications" });
  }
}

/**
 * Mark a notification as read
 */
async function markAsRead(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userId = req.session.user.id || req.session.user.user_id;
    const { notificationId } = req.params;
    
    if (!notificationId) {
      return res.status(400).json({ error: "Missing notificationId" });
    }
    
    const success = notificationService.markNotificationAsRead(parseInt(notificationId), userId);
    
    if (!success) {
      return res.status(404).json({ error: "Notification not found or not authorized" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Notifications] Mark as read error:", error);
    res.status(500).json({ error: error.message || "Failed to mark notification as read" });
  }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userId = req.session.user.id || req.session.user.user_id;
    
    const count = notificationService.markAllNotificationsAsRead(userId);
    
    res.json({ success: true, count });
  } catch (error) {
    console.error("[Notifications] Mark all as read error:", error);
    res.status(500).json({ error: error.message || "Failed to mark all notifications as read" });
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userId = req.session.user.id || req.session.user.user_id;
    
    const count = notificationService.getUnreadNotificationCount(userId);
    
    res.json({ count });
  } catch (error) {
    console.error("[Notifications] Get unread count error:", error);
    res.status(500).json({ error: error.message || "Failed to get unread count" });
  }
}

/**
 * Get a specific notification by ID
 */
async function getNotification(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const userId = req.session.user.id || req.session.user.user_id;
    const notificationId = parseInt(req.params.notificationId);
    
    if (!notificationId) {
      return res.status(400).json({ error: "Missing notificationId" });
    }
    
    const notification = notificationService.getNotification(notificationId, userId);
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found or not authorized" });
    }
    
    res.json({ notification });
  } catch (error) {
    console.error("[Notifications] Get notification error:", error);
    res.status(500).json({ error: error.message || "Failed to get notification" });
  }
}

module.exports = {
  getUnreadNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getNotification
};
