import React, { useEffect, useState } from 'react';
import { 
  X, 
  Fish, 
  Trash2, 
  Edit2, 
  Check, 
  Search, 
  Droplets, 
  RotateCcw, 
  AlertTriangle, 
  Sparkles, 
  Loader2,
  Calendar,
  ShieldAlert
} from 'lucide-react';
import { AdminGachaUser, AdminUserFish, AdminUserTankResponse, UserEcosystem } from '../../types';
import { backendApi } from '../../services/api';
import toast from 'react-hot-toast';

interface AdminTankDrawerProps {
  user: AdminGachaUser;
  onClose: () => void;
  onUpdate: (userId: number, updatedEco: UserEcosystem, fishesCount: number) => void;
}

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  common: { border: 'border-slate-700', bg: 'bg-slate-900/90', text: 'text-slate-300', badge: 'bg-slate-800 text-slate-300' },
  uncommon: { border: 'border-emerald-600/40', bg: 'bg-emerald-950/30', text: 'text-emerald-300', badge: 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' },
  rare: { border: 'border-blue-600/50', bg: 'bg-blue-950/30', text: 'text-blue-300', badge: 'bg-blue-950 text-blue-400 border border-blue-500/30' },
  epic: { border: 'border-purple-600/50', bg: 'bg-purple-950/30', text: 'text-purple-300', badge: 'bg-purple-950 text-purple-400 border border-purple-500/30' },
  legendary: { border: 'border-amber-500/60', bg: 'bg-amber-950/30', text: 'text-amber-300', badge: 'bg-amber-950 text-amber-300 border border-amber-500/40' }
};

export const AdminTankDrawer: React.FC<AdminTankDrawerProps> = ({ user, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [ecosystem, setEcosystem] = useState<UserEcosystem | null>(null);
  const [fishes, setFishes] = useState<AdminUserFish[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');

  // Editing nickname state
  const [editingFishId, setEditingFishId] = useState<number | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [submittingFishId, setSubmittingFishId] = useState<number | null>(null);

  // Deleting fish state
  const [deletingFishId, setDeletingFishId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Reset Tank Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetFishes, setResetFishes] = useState(true);
  const [resetWater, setResetWater] = useState(true);
  const [resetPity, setResetPity] = useState(false);
  const [resetFood, setResetFood] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);

  const fetchTankData = async () => {
    try {
      setLoading(true);
      const res = await backendApi.get<AdminUserTankResponse>(`/admin/gacha/users/${user.id}/tank`);
      setEcosystem(res.ecosystem);
      setFishes(res.fishes || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load user aquarium');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTankData();
  }, [user.id]);

  const handleStartEdit = (fish: AdminUserFish) => {
    setEditingFishId(fish.id);
    setNicknameInput(fish.nickname || '');
  };

  const handleSaveNickname = async (fishId: number) => {
    try {
      setSubmittingFishId(fishId);
      const res = await backendApi.patch<{ ok: boolean; fish: AdminUserFish }>(
        `/admin/gacha/users/${user.id}/fishes/${fishId}`,
        { nickname: nicknameInput.trim() || null }
      );
      setFishes(prev => prev.map(f => f.id === fishId ? { ...f, nickname: res.fish.nickname } : f));
      setEditingFishId(null);
      toast.success('Nickname updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update nickname');
    } finally {
      setSubmittingFishId(null);
    }
  };

  const handleDeleteFish = async (fishId: number) => {
    try {
      setDeletingFishId(fishId);
      const res = await backendApi.delete<{ ok: boolean; deletedFishId: number; remainingCount: number }>(
        `/admin/gacha/users/${user.id}/fishes/${fishId}`
      );
      const nextFishes = fishes.filter(f => f.id !== fishId);
      setFishes(nextFishes);
      setConfirmDeleteId(null);
      if (ecosystem) {
        onUpdate(user.id, ecosystem, res.remainingCount);
      }
      toast.success('Specimen released');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete fish');
    } finally {
      setDeletingFishId(null);
    }
  };

  const handleExecuteReset = async () => {
    try {
      setSubmittingReset(true);
      const res = await backendApi.post<{ ok: boolean; ecosystem: UserEcosystem; fishes_count: number }>(
        `/admin/gacha/users/${user.id}/reset-tank`,
        {
          delete_fishes: resetFishes,
          reset_water: resetWater,
          reset_pity: resetPity,
          reset_food: resetFood
        }
      );

      setEcosystem(res.ecosystem);
      if (resetFishes) {
        setFishes([]);
      }
      onUpdate(user.id, res.ecosystem, res.fishes_count);
      setShowResetModal(false);
      toast.success('Aquarium reset completed successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset aquarium');
    } finally {
      setSubmittingReset(false);
    }
  };

  const filteredFishes = fishes.filter(f => {
    const matchesSearch = !searchTerm || 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (f.nickname && f.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRarity = rarityFilter === 'all' || f.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Fish className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {user.username}'s Aquarium
                </h3>
                {user.is_superadmin && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                    Superadmin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Inspect and manage marine specimens, adjust nicknames, or reset habitat parameters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetModal(true)}
              className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Reset user tank"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Tank...</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tank Health / Ecosystem Stats Bar */}
        {ecosystem && (
          <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400">Water Quality:</span>
              <strong className="text-white font-mono">{ecosystem.water_quality}%</strong>
            </div>
            <div className="flex items-center gap-2">
              <Fish className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Specimens:</span>
              <strong className="text-white font-mono">{fishes.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">🎟️</span>
              <span className="text-slate-400">Tickets:</span>
              <strong className="text-white font-mono">{ecosystem.tickets}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">✨</span>
              <span className="text-slate-400">Pity:</span>
              <span className="text-slate-300 font-mono text-[11px]">
                E:{ecosystem.pity_counter_epic}/10 L:{ecosystem.pity_counter_legendary}/30
              </span>
            </div>
          </div>
        )}

        {/* Search & Rarity Filter Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by species or nickname..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Rarity filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'].map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize whitespace-nowrap transition-all ${
                  rarityFilter === r
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Fish List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-cyan-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-mono">Retrieving marine specimens...</span>
            </div>
          ) : filteredFishes.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <Fish className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No specimens found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || rarityFilter !== 'all'
                  ? 'No marine life matches the current search and filter criteria.'
                  : 'This aquarium currently has no living specimens.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredFishes.map((fish) => {
                const rarityStyle = RARITY_COLORS[fish.rarity] || RARITY_COLORS.common;
                let visualTraits: any = {};
                try {
                  visualTraits = typeof fish.visual_traits === 'string' ? JSON.parse(fish.visual_traits) : fish.visual_traits;
                } catch {}

                const isEditing = editingFishId === fish.id;
                const isConfirmingDelete = confirmDeleteId === fish.id;

                return (
                  <div
                    key={fish.id}
                    className={`relative p-3.5 rounded-2xl border ${rarityStyle.border} ${rarityStyle.bg} flex flex-col justify-between gap-3 shadow-lg transition-all hover:border-sky-500/50`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail with gradient */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner border border-white/20"
                        style={{
                          background: `linear-gradient(135deg, ${visualTraits?.primary_color || '#00d2ff'}, ${visualTraits?.secondary_color || '#3a7bd5'})`
                        }}
                      >
                        <span className="text-xl select-none">🐟</span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-xs text-white truncate">{fish.name}</h4>
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${rarityStyle.badge}`}>
                            {fish.rarity}
                          </span>
                        </div>

                        {/* Nickname Editor */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <input
                              type="text"
                              value={nicknameInput}
                              onChange={(e) => setNicknameInput(e.target.value)}
                              placeholder="Set nickname..."
                              className="w-full px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs text-white focus:outline-none focus:border-cyan-400"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveNickname(fish.id)}
                              disabled={submittingFishId === fish.id}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingFishId(null)}
                              className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-cyan-300 font-medium truncate">
                              {fish.nickname ? `"${fish.nickname}"` : <span className="text-slate-500 italic">No nickname</span>}
                            </span>
                            <button
                              onClick={() => handleStartEdit(fish)}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                              title="Edit Nickname"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                          <span className="capitalize">{fish.depth_zone} zone</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(fish.caught_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">ID #{fish.id}</span>
                      
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <span className="text-[10px] text-rose-400 font-semibold">Release?</span>
                          <button
                            onClick={() => handleDeleteFish(fish.id)}
                            disabled={deletingFishId === fish.id}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(fish.id)}
                          className="px-2 py-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 text-xs flex items-center gap-1 transition-all"
                          title="Delete / Release Specimen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Release</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Configurable Reset Tank Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/10">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reset Aquarium</h3>
                <p className="text-xs text-slate-400">Configure parameters to reset for {user.username}.</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetFishes}
                  onChange={(e) => setResetFishes(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-700 bg-slate-800"
                />
                <span className="text-xs text-slate-200">
                  Delete all caught fishes <strong className="text-rose-400">({fishes.length} specimens)</strong>
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetWater}
                  onChange={(e) => setResetWater(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-700 bg-slate-800"
                />
                <span className="text-xs text-slate-200">
                  Restore water quality to <strong className="text-cyan-400">100%</strong>
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetPity}
                  onChange={(e) => setResetPity(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-800"
                />
                <span className="text-xs text-slate-200">
                  Reset pity counters to zero (Epic: {ecosystem?.pity_counter_epic || 0}, Leg: {ecosystem?.pity_counter_legendary || 0})
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetFood}
                  onChange={(e) => setResetFood(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-700 bg-slate-800"
                />
                <span className="text-xs text-slate-200">
                  Reset food to defaults (5 Flakes, 1 Super Pellet)
                </span>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={submittingReset}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={submittingReset || (!resetFishes && !resetWater && !resetPity && !resetFood)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center gap-2"
              >
                {submittingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Confirm Tank Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTankDrawer;
