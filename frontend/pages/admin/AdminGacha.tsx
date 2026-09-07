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
  Loader2,
  Box,
  Users,
  Save,
  ExternalLink
} from 'lucide-react';
import { backendApi } from '../../services/api';
import { AdminGachaUser, AdminGachaResponse, AdminGachaSummary, GachaSpecies } from '../../types';
import AdminTankDrawer from '../../components/admin/AdminTankDrawer';
import GrantFishModal from '../../components/admin/GrantFishModal';
import toast from 'react-hot-toast';

const AdminGacha: React.FC = () => {
  const [users, setUsers] = useState<AdminGachaUser[]>([]);
  const [summary, setSummary] = useState<AdminGachaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Modal & Drawer State
  const [selectedUser, setSelectedUser] = useState<AdminGachaUser | null>(null);
  const [tankUser, setTankUser] = useState<AdminGachaUser | null>(null);
  const [grantUser, setGrantUser] = useState<AdminGachaUser | null>(null);
  const [ticketsInput, setTicketsInput] = useState<number>(5);
  const [flakesInput, setFlakesInput] = useState<number>(0);
  const [pelletsInput, setPelletsInput] = useState<number>(0);
  const [resetWater, setResetWater] = useState<boolean>(false);
  const [submittingModal, setSubmittingModal] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'species'>('users');

  // Species & 3D Models State
  const [speciesList, setSpeciesList] = useState<GachaSpecies[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState<boolean>(false);
  const [speciesSearch, setSpeciesSearch] = useState<string>('');
  const [modelUrlInputs, setModelUrlInputs] = useState<Record<string, string>>({});
  const [savingSpeciesId, setSavingSpeciesId] = useState<string | null>(null);
  const [urlStatuses, setUrlStatuses] = useState<Record<string, 'ok' | 'missing' | 'testing'>>({});

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

  const fetchSpecies = async () => {
    try {
      setLoadingSpecies(true);
      const res = await backendApi.get<{ species: GachaSpecies[] }>('/admin/gacha/species');
      if (res && res.species) {
        setSpeciesList(res.species);
        const inputs: Record<string, string> = {};
        res.species.forEach(s => {
          inputs[s.id] = s.model_url || '';
        });
        setModelUrlInputs(inputs);
      }
    } catch (err: any) {
      console.error('Failed to load species catalog:', err);
      toast.error('Failed to load species catalog');
    } finally {
      setLoadingSpecies(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'species') {
      fetchSpecies();
    }
  }, [activeTab]);

  const handleSaveModelUrl = async (speciesId: string) => {
    try {
      setSavingSpeciesId(speciesId);
      const url = modelUrlInputs[speciesId] ? modelUrlInputs[speciesId].trim() : null;
      const res = await backendApi.patch<{ ok: boolean; species: GachaSpecies }>(
        `/admin/gacha/species/${speciesId}`,
        { model_url: url }
      );
      if (res.ok) {
        setSpeciesList(prev => prev.map(s => s.id === speciesId ? { ...s, model_url: res.species.model_url } : s));
        toast.success(`Updated 3D model URL for ${res.species.name}`);
      }
    } catch (err: any) {
      console.error('Failed to update species model URL:', err);
      toast.error(err.message || 'Failed to update species');
    } finally {
      setSavingSpeciesId(null);
    }
  };

  const handleTestModelUrl = async (speciesId: string) => {
    const url = modelUrlInputs[speciesId] ? modelUrlInputs[speciesId].trim() : '';
    if (!url) {
      toast('No model URL specified.', { icon: 'ℹ️' });
      return;
    }

    setUrlStatuses(prev => ({ ...prev, [speciesId]: 'testing' }));
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        setUrlStatuses(prev => ({ ...prev, [speciesId]: 'ok' }));
        toast.success('GLB asset is accessible (HTTP 200)');
      } else {
        setUrlStatuses(prev => ({ ...prev, [speciesId]: 'missing' }));
        toast.error(`Asset returned HTTP ${res.status}`);
      }
    } catch (e) {
      setUrlStatuses(prev => ({ ...prev, [speciesId]: 'missing' }));
      toast.error('Could not reach asset URL');
    }
  };

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

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Users size={16} /> Users & Aquariums
        </button>
        <button
          onClick={() => setActiveTab('species')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'species'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Box size={16} /> Species & 3D Models
        </button>
      </div>

      {activeTab === 'users' ? (
        <>

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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setGrantUser(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-sm"
                            title="Grant specific marine specimen to user"
                          >
                            <Sparkles size={13} />
                            <span>Grant Fish</span>
                          </button>
                          <button
                            onClick={() => setTankUser(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors shadow-sm"
                            title="Manage user aquarium and caught fishes"
                          >
                            <Fish size={13} />
                            <span>Manage Tank</span>
                          </button>
                          <button
                            onClick={() => handleOpenModal(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
                          >
                            <Sliders size={13} />
                            <span>Resources</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : (
        /* Species & 3D Models Management Tab Content */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Box size={20} className="text-cyan-500" />
                Species Catalog & 3D GLB Model Pipeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure which marine species use procedural cartoon rendering vs custom GLB 3D models (e.g. <code>/models/puffer.glb</code>).
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Filter species by name..."
                value={speciesSearch}
                onChange={(e) => setSpeciesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {loadingSpecies ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={18} /> Loading marine species catalog...
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Species</th>
                      <th className="px-6 py-3.5">Zone & Rarity</th>
                      <th className="px-6 py-3.5">Rendering Mode</th>
                      <th className="px-6 py-3.5">GLB 3D Model Path</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {speciesList
                      .filter(s => !speciesSearch || s.name.toLowerCase().includes(speciesSearch.toLowerCase()) || s.id.toLowerCase().includes(speciesSearch.toLowerCase()))
                      .map(s => {
                        const isGLB = Boolean(s.model_url);
                        const isSaving = savingSpeciesId === s.id;
                        const status = urlStatuses[s.id];

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                                  <Fish size={18} />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white text-xs">{s.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{s.id}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="capitalize text-xs text-slate-600 dark:text-slate-300">{s.depth_zone}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {s.rarity}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              {isGLB ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                                  <Box size={13} /> 3D GLB Model
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  Procedural Cartoon
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 max-w-sm">
                                <input
                                  type="text"
                                  placeholder="e.g. /models/puffer.glb (or empty for procedural)"
                                  value={modelUrlInputs[s.id] ?? ''}
                                  onChange={(e) => setModelUrlInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                                  className="w-full px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                                />
                                {status === 'ok' && (
                                  <span className="text-[10px] font-bold text-emerald-500 shrink-0" title="HTTP 200 OK">✓ Valid</span>
                                )}
                                {status === 'missing' && (
                                  <span className="text-[10px] font-bold text-rose-500 shrink-0" title="File not found">✗ 404</span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTestModelUrl(s.id)}
                                  disabled={!modelUrlInputs[s.id]}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40"
                                  title="Test if GLB asset file is accessible"
                                >
                                  {status === 'testing' ? <Loader2 size={12} className="animate-spin" /> : 'Test'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveModelUrl(s.id)}
                                  disabled={isSaving}
                                  className="px-3 py-1 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  <span>Save</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Admin Tank Drawer */}
      {tankUser && (
        <AdminTankDrawer
          user={tankUser}
          onClose={() => setTankUser(null)}
          onUpdate={(userId, updatedEco, fishesCount) => {
            setUsers(prev => prev.map(u => u.id === userId ? {
              ...u,
              water_quality: updatedEco.water_quality,
              food_flakes: updatedEco.food_flakes,
              super_pellets: updatedEco.super_pellets,
              fishes_count: fishesCount
            } : u));
          }}
        />
      )}

      {/* Grant Specimen Modal */}
      {grantUser && (
        <GrantFishModal
          isOpen={Boolean(grantUser)}
          user={grantUser}
          onClose={() => setGrantUser(null)}
          onSuccess={(grantedFishes, totalCount) => {
            setUsers(prev => prev.map(u => u.id === grantUser.id ? { ...u, fishes_count: totalCount } : u));
          }}
        />
      )}
    </div>
  );
};

export default AdminGacha;
