import React, { useState, useEffect, useRef } from 'react';
import { Bell, Users, Check, X as XIcon, Loader2, X } from 'lucide-react';
import { 
  getUnreadNotifications, 
  getUnreadNotificationCount, 
  markNotificationAsRead,
  markAllNotificationsAsRead,
  Notification 
} from '../services/notification.api';
import { backendApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Invitation {
  id: number;
  community_id: number;
  community_name: string;
  community_description: string;
  community_access_type: string;
  community_member_count: number;
  invited_by_username: string;
  created_at: string;
}

interface NotificationBellProps {
  isMobile?: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ isMobile = false }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [invitationCount, setInvitationCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingInvitationIds, setProcessingInvitationIds] = useState<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load unread count and invitations on mount and poll every 30 seconds
  useEffect(() => {
    loadUnreadCount();
    loadInvitationCount();
    const interval = setInterval(() => {
      loadUnreadCount();
      loadInvitationCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Lock body scroll when mobile bottom sheet is open
  useEffect(() => {
    if (isMobile && isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobile, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const loadUnreadCount = async () => {
    try {
      const response = await getUnreadNotificationCount();
      setUnreadCount(response.count);
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  const loadInvitationCount = async () => {
    try {
      const invitations = await backendApi.get<Invitation[]>('/invitations');
      setInvitationCount(invitations.length);
    } catch (error) {
      console.error('Failed to load invitation count:', error);
      setInvitationCount(0);
    }
  };

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await getUnreadNotifications(20);
      setNotifications(response.notifications);
      setUnreadCount(response.count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const data = await backendApi.get<Invitation[]>('/invitations');
      setInvitations(data);
      setInvitationCount(data.length);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleBellClick = () => {
    if (!isOpen) {
      loadNotifications();
      loadInvitations();
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    try {
      await markNotificationAsRead(notification.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    // Navigate to the translation
    setIsOpen(false);
    if (notification.translation_id) {
      navigate(`/flow?translation_id=${notification.translation_id}`);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      setProcessingInvitationIds(prev => new Set(prev).add(invitationId));
      await backendApi.post(`/invitations/${invitationId}/accept`, {});
      toast.success('Invitation accepted!');
      
      // Remove the accepted invitation from the list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      setInvitationCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      toast.error(error.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setProcessingInvitationIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  const handleDeclineInvitation = async (invitationId: number) => {
    try {
      setProcessingInvitationIds(prev => new Set(prev).add(invitationId));
      await backendApi.post(`/invitations/${invitationId}/decline`, {});
      toast.success('Invitation declined');
      
      // Remove the declined invitation from the list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      setInvitationCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Failed to decline invitation:', error);
      toast.error(error.response?.data?.error || 'Failed to decline invitation');
    } finally {
      setProcessingInvitationIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications([]);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const totalCount = unreadCount + invitationCount;
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          Loading...
        </div>
      );
    }

    return (
      <>
        {/* Invitations Section */}
        {invitations.length > 0 && (
          <div className="border-b border-slate-200 dark:border-slate-700">
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Invitations ({invitations.length})
              </h4>
            </div>
            {invitations.map(invitation => {
              const isProcessing = processingInvitationIds.has(invitation.id);
              return (
                <div
                  key={`invitation-${invitation.id}`}
                  className="p-4 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 mt-1">
                      <Users className="text-marine-600 dark:text-marine-400" size={16} />
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {invitation.community_name}
                      </p>
                      {invitation.community_description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {invitation.community_description}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        from @{invitation.invited_by_username} • {invitation.community_member_count} members
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptInvitation(invitation.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-marine-600 hover:bg-marine-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <Check size={12} />
                          Accept
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(invitation.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <XIcon size={12} />
                          Decline
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <div>
            {invitations.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Notifications ({notifications.length})
                </h4>
              </div>
            )}
            {notifications.map(notification => (
              <button
                key={`notification-${notification.id}`}
                onClick={() => handleNotificationClick(notification)}
                className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0 text-left transition-colors"
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm text-slate-900 dark:text-white break-words">
                      {notification.message}
                    </p>
                    {notification.created_by_display_name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        from {notification.created_by_display_name}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {invitations.length === 0 && notifications.length === 0 && (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <Bell className="mx-auto mb-2 text-slate-400" size={32} />
            <p>No new notifications or invitations</p>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {isMobile ? (
        <button
          onClick={handleBellClick}
          className="relative flex flex-col items-center justify-center gap-1 transition-colors text-slate-500 dark:text-slate-400 hover:text-marine-600 dark:hover:text-marine-400"
          aria-label="Alerts - Notifications and Invitations"
        >
          <div className="relative">
            <Bell size={24} strokeWidth={2} />
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">Alerts</span>
        </button>
      ) : (
        <button
          onClick={handleBellClick}
          className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Alerts - Notifications and Invitations"
        >
          <Bell size={20} />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>
      )}

      {/* Mobile Bottom Sheet Presentation */}
      {isOpen && isMobile && (
        <>
          {/* Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Surface */}
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications and Invitations"
          >
            {/* Top Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">Notifications & Invitations</h3>
                {totalCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
                    {totalCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                  aria-label="Close notifications"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Notification List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {renderContent()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex-shrink-0">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="w-full py-2.5 px-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors"
              >
                View all notifications
              </button>
            </div>
          </div>
        </>
      )}

      {/* Desktop Dropdown Presentation */}
      {isOpen && !isMobile && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Notifications & Invitations</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {renderContent()}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
