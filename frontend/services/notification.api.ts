// Notification API service

import { backendApi } from './api';

export interface Notification {
  id: number;
  user_id: number;
  type: 'discussion_reply' | 'translation_approved' | 'translation_rejected';
  translation_id: number;
  term_id: number;
  message: string;
  link: string | null;
  read: number;
  created_at: string;
  created_by_id: number | null;
  created_by_username: string | null;
  created_by_display_name: string | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
  count?: number;
  unreadCount?: number;
}

export interface NotificationCountResponse {
  count: number;
}

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(limit = 50): Promise<NotificationsResponse> {
  return backendApi.get<NotificationsResponse>(`/notifications/unread?limit=${limit}`);
}

/**
 * Get all notifications
 */
export async function getAllNotifications(limit = 50): Promise<NotificationsResponse> {
  return backendApi.get<NotificationsResponse>(`/notifications?limit=${limit}`);
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<NotificationCountResponse> {
  return backendApi.get<NotificationCountResponse>('/notifications/count');
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number): Promise<{ success: boolean }> {
  return backendApi.put<{ success: boolean }>(`/notifications/${notificationId}/read`, {});
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; count: number }> {
  return backendApi.put<{ success: boolean; count: number }>('/notifications/read-all', {});
}

/**
 * Get details for a single notification
 */
export async function getNotification(notificationId: number): Promise<{ notification: Notification }> {
  return backendApi.get<{ notification: Notification }>(`/notifications/${notificationId}`);
}
