import React, { useEffect, useState } from 'react';
import { Mail, RefreshCw, Play, AlertCircle, CheckCircle2, Clock, Send, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { backendApi } from '../../services/api';
import { CONFIG } from '../../config';
import toast from 'react-hot-toast';

interface MailItem {
  id: number;
  to_email: string;
  subject: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

const AdminMailSettings: React.FC = () => {
  const [queue, setQueue] = useState<MailItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Broadcast states
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const fetchMailQueue = async (page = 1) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/mail/queue?page=${page}&limit=15`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setQueue(data.items);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.pages);
        setCurrentPage(data.pagination.page);
      } else {
        toast.error('Failed to load mail queue.');
      }
    } catch (error) {
      console.error('Error fetching mail queue:', error);
      toast.error('Error connecting to the mail queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMailQueue(currentPage);
  }, [currentPage]);

  const handleRetryMail = async (id: number) => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/mail/queue/${id}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Email re-queued successfully!');
        fetchMailQueue(currentPage);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to retry email.');
      }
    } catch (error) {
      console.error('Error retrying email:', error);
      toast.error('Error re-queuing email.');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      toast.error('Please enter both subject and body for the broadcast.');
      return;
    }

    if (!confirm('Are you sure you want to broadcast this email to ALL active users?')) {
      return;
    }

    setIsBroadcasting(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/mail/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subject: broadcastSubject.trim(),
          body: broadcastBody.trim(),
        }),
      });

      if (response.ok) {
        toast.success('Broadcast announcement queued successfully!');
        setBroadcastSubject('');
        setBroadcastBody('');
        fetchMailQueue(1);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send broadcast.');
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Error sending broadcast.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredQueue = queue.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const getStatusBadge = (status: MailItem['status']) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 size={12} />
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle size={12} />
            Failed
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
            <Clock size={12} />
            Sending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
            <Clock size={12} />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-600 text-white rounded-lg">
            <Mail size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Mailing Service Panel</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Manage system emails, monitor output queue, and send announcements.</p>
          </div>
        </div>
        <button
          onClick={() => fetchMailQueue(currentPage)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-600"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-8 flex gap-3">
        <Info className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">SMTP Settings Reminder</h4>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
            SMTP connection is configured globally through environment variables in your server's <code>.env</code> file. 
            For setup instructions, reference the <code>docs/SMTP_SETUP.md</code> documentation in the repository.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Mail Queue Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-wrap gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Outgoing Mail Queue ({totalItems})</h2>
              
              {/* Status Filters */}
              <div className="flex gap-2">
                {['all', 'pending', 'sending', 'sent', 'failed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      statusFilter === status
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
                  <span className="mt-4 text-slate-500">Loading queue history...</span>
                </div>
              ) : filteredQueue.length === 0 ? (
                <div className="text-center py-20 text-slate-500">No emails found matching filter.</div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-750 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-4">Recipient</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Attempts</th>
                      <th className="p-4">Created At</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredQueue.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30">
                        <td className="p-4 font-mono font-medium text-slate-950 dark:text-slate-100">{item.to_email}</td>
                        <td className="p-4 max-w-xs truncate text-slate-600 dark:text-slate-300" title={item.subject}>{item.subject}</td>
                        <td className="p-4">{getStatusBadge(item.status)}</td>
                        <td className="p-4 text-center text-slate-500">{item.attempts}</td>
                        <td className="p-4 text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          {item.status === 'failed' && (
                            <button
                              onClick={() => handleRetryMail(item.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/20 dark:hover:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded-lg text-xs font-semibold transition-colors"
                              title="Retry sending this email"
                            >
                              <Play size={12} />
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Showing page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1 || isLoading}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-750 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-650 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={currentPage === totalPages || isLoading}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-750 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-650 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Broadcast System Announcement Form */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6 sticky top-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600 dark:text-cyan-400">
                <Send size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Broadcast Announcement</h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Compose and send a system-wide email announcement to all registered users with verified emails.
            </p>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-450 uppercase">Email Subject</label>
                <input
                  type="text"
                  required
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="System Update or Community News"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-450 uppercase">Email Body (Plain Text)</label>
                <textarea
                  required
                  rows={8}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Type your system announcement text here..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white text-sm font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={isBroadcasting || !broadcastSubject.trim() || !broadcastBody.trim()}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                  isBroadcasting || !broadcastSubject.trim() || !broadcastBody.trim()
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm hover:shadow active:scale-95'
                }`}
              >
                {isBroadcasting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Queuing...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Queue Broadcast
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMailSettings;
