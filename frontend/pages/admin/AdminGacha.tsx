import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  Fish, 
  Ticket, 
  Droplets, 
  Sparkles, 
  Shield, 
  ShieldCheck, 
  Check, 
  X, 
  Sliders, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import { backendApi } from '../../services/api';
import { AdminGachaUser, AdminGachaResponse, AdminGachaSummary } from '../../types';
import toast from 'react-hot-toast';

const AdminGacha: React.FC = () => {
  const [users, setUsers] = useState<AdminGachaUser[]>([]);
  const [summary, setSummary] = useState<AdminGachaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<AdminGachaUser | null>(null);
  const [ticketsInput, setTicketsInput] = useState<number>(5);
  const [flakesInput, setFlakesInput] = useState<number>(0);
  const [pelletsInput, setPelletsInput] = useState<number>(0);
  const [resetWater, setResetWater] = useState<boolean>(false);
  const [submittingModal, setSubmittingModal] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = searchTerm ? { q: searchTerm } : {};
      const res = await backendApi.get<AdminGachaResponse>('/admin/gacha/users', params);
      setUsers(res.users || []);
      setSummary(res.summary || null);
    } catch (err: any) {
      console.error('Failed to load gacha users:', err);
      toast.error(err.message || 'Failed to fetch gacha users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleToggleAccess = async (user: AdminGachaUser) => {
    if (user.is_admin === 1 || user.is_superadmin) {
      toast('Admins and Superadmins always have full access.', { icon: 'ℹ️' });
      return;
    }

    try {
      setUpdatingId(user.id);
      const newAccess = user.has_gacha_access === 1 ? false : true;
      const res = await backendApi.patch<{ ok: boolean; has_gacha_access: number }>(
        `/admin/gacha/users/${user.id}/access`,
        { has_access: newAccess }
      );

      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, has_gacha_access: res.has_gacha_access } : u));
      if (summary) {
        setSummary({
          ...summary,
          total_users_with_access: summary.total_users_with_access + (newAccess ? 1 : -1)
        });
      }
      toast.success(newAccess ? `Access granted to ${user.username}` : `Access revoked from ${user.username}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update access');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuickGrantTickets = async (user: AdminGachaUser, amount: number) => {
    try {
      setUpdatingId(user.id);
      const res = await backendApi.post<{ ok: boolean; ecosystem: any }>(
        `/admin/gacha/users/${user.id}/grant-resources`,
        { tickets: amount }
      );

      setUsers(prev => prev.map(u => u.id === user.id ? {
        ...u,
        dive_tickets: res.ecosystem.tickets,
        tickets: res.ecosystem.tickets
      } : u));

      if (summary) {
        setSummary({
          ...summary,
          total_tickets_in_circulation: summary.total_tickets_in_circulation + amount
        });
      }
      toast.success(`+${amount} tickets awarded to ${user.username}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to grant tickets');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenModal = (user: AdminGachaUser) => {
    setSelectedUser(user);
    setTicketsInput(5);
    setFlakesInput(0);
    setPelletsInput(0);
    setResetWater(false);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSubmittingModal(true);
      const res = await backendApi.post<{ ok: boolean; ecosystem: any }>(
        `/admin/gacha/users/${selectedUser.id}/grant-resources`,
        {
          tickets: Number(ticketsInput) || 0,
          food_flakes: Number(flakesInput) || 0,
          super_pellets: Number(pelletsInput) || 0,
          reset_water: resetWater
        }
      );

      setUsers(prev => prev.map(u => u.id === selectedUser.id ? {
        ...u,
        dive_tickets: res.ecosystem.tickets,
        tickets: res.ecosystem.tickets,
        food_flakes: res.ecosystem.food_flakes,
        super_pellets: res.ecosystem.super_pellets,
        water_quality: res.ecosystem.water_quality
      } : u));

      toast.success(`Resources updated for ${selectedUser.username}`);
      setSelectedUser(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to grant resources');
    } finally {
      setSubmittingModal(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to Admin Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 rounded-xl border border-cyan-200 dark:border-cyan-800">
              <Fish size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Oceanarium & Gacha Management
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Control user preview access, distribute dive tickets, and supervise marine ecosystem health.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors shadow-sm"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Authorized Users
            </span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summary?.total_users_with_access ?? '-'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Admins, superadmins, & granted users
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tickets in Circulation
            </span>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <Ticket size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summary?.total_tickets_in_circulation ?? '-'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Available for deep sea bathyscaphe dives
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Fish Discovered
            </span>
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summary?.total_fishes_caught ?? '-'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across all active oceanariums
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text"
          placeholder="Filter by username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all shadow-sm"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 size={32} className="animate-spin text-cyan-500 mb-3" />
            <p className="text-sm">Loading user ecosystem states...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <AlertCircle size={32} className="text-slate-400 mb-2" />
            <p className="text-sm font-medium">No users found</p>
            <p className="text-xs text-slate-400">Try adjusting your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Oceanarium Access</th>
                  <th className="px-6 py-4">Dive Tickets</th>
                  <th className="px-6 py-4">Supplies</th>
                  <th className="px-6 py-4">Ecosystem State</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {users.map((u) => {
                  const isAdminRole = u.is_admin === 1 || u.is_superadmin;
                  const hasAccess = isAdminRole || u.has_gacha_access === 1;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      {/* User Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.username}</span>
                              {u.is_superadmin && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  Superadmin
                                </span>
                              )}
                              {!u.is_superadmin && u.is_admin === 1 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">ID #{u.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Access Toggle */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isAdminRole ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck size={14} /> Always Granted
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleAccess(u)}
                            disabled={updatingId === u.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
                              u.has_gacha_access === 1
                                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {updatingId === u.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : u.has_gacha_access === 1 ? (
                              <Check size={13} />
                            ) : (
                              <X size={13} />
                            )}
                            <span>{u.has_gacha_access === 1 ? 'Granted' : 'Revoked'}</span>
                          </button>
                        )}
                      </td>

                      {/* Dive Tickets */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                            <Ticket size={16} />
                            <span>{u.dive_tickets ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => handleQuickGrantTickets(u, 1)}
                              disabled={updatingId === u.id}
                              className="px-2 py-0.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded border border-amber-200 dark:border-amber-800 transition-colors"
                              title="Add 1 ticket"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => handleQuickGrantTickets(u, 5)}
                              disabled={updatingId === u.id}
                              className="px-2 py-0.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded border border-amber-200 dark:border-amber-800 transition-colors"
                              title="Add 5 tickets"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Food & Pellets */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1" title="Food Flakes">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                            {u.food_flakes ?? 5} flakes
                          </span>
                          <span className="flex items-center gap-1" title="Super Pellets">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                            {u.super_pellets ?? 1} pellets
                          </span>
                        </div>
                      </td>

                      {/* Ecosystem State */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-36">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Droplets size={12} className="text-cyan-500" />
                              Water {u.water_quality ?? 100}%
                            </span>
                            <span className="text-slate-400">{u.fishes_count ?? 0} fish</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                (u.water_quality ?? 100) > 60 
                                  ? 'bg-cyan-500' 
                                  : (u.water_quality ?? 100) > 25 
                                    ? 'bg-amber-500' 
                                    : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.max(5, u.water_quality ?? 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleOpenModal(u)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
                        >
                          <Sliders size={13} />
                          <span>Manage</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manage Resources Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 rounded-xl">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Manage Resources
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedUser.username} (ID #{selectedUser.id})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Add Dive Tickets
                </label>
                <input 
                  type="number" 
                  min="0"
                  max="500"
                  value={ticketsInput}
                  onChange={(e) => setTicketsInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Add Food Flakes
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    value={flakesInput}
                    onChange={(e) => setFlakesInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Add Super Pellets
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="50"
                    value={pelletsInput}
                    onChange={(e) => setPelletsInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input 
                    type="checkbox"
                    checked={resetWater}
                    onChange={(e) => setResetWater(e.target.checked)}
                    className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                  />
                  <span>Restore water quality to 100% (Purify Tank)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-5 py-2 text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-sm transition-all inline-flex items-center gap-2"
                >
                  {submittingModal && <Loader2 size={16} className="animate-spin" />}
                  <span>Grant Resources</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGacha;
