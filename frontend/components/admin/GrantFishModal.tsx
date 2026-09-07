import React, { useState, useEffect } from 'react';
import { 
  X, 
  Fish, 
  Sparkles, 
  Search, 
  Layers, 
  Check, 
  Loader2,
  Box,
  Sliders
} from 'lucide-react';
import { AdminGachaUser, AdminUserFish, GachaSpecies } from '../../types';
import { backendApi } from '../../services/api';
import toast from 'react-hot-toast';

interface GrantFishModalProps {
  isOpen: boolean;
  user: AdminGachaUser | null;
  onClose: () => void;
  onSuccess: (grantedFishes: AdminUserFish[], totalCount: number) => void;
}

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  common: { border: 'border-slate-700', bg: 'bg-slate-800/80', text: 'text-slate-300', badge: 'bg-slate-700 text-slate-200' },
  uncommon: { border: 'border-emerald-600/50', bg: 'bg-emerald-950/40', text: 'text-emerald-300', badge: 'bg-emerald-900/80 text-emerald-300 border border-emerald-500/30' },
  rare: { border: 'border-blue-600/50', bg: 'bg-blue-950/40', text: 'text-blue-300', badge: 'bg-blue-900/80 text-blue-300 border border-blue-500/30' },
  epic: { border: 'border-purple-600/50', bg: 'bg-purple-950/40', text: 'text-purple-300', badge: 'bg-purple-900/80 text-purple-300 border border-purple-500/30' },
  legendary: { border: 'border-amber-500/60', bg: 'bg-amber-950/40', text: 'text-amber-300', badge: 'bg-amber-900/80 text-amber-200 border border-amber-500/40' }
};

export const GrantFishModal: React.FC<GrantFishModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess
}) => {
  const [speciesList, setSpeciesList] = useState<GachaSpecies[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  
  // Form State
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('spotted_pufferfish');
  const [isShiny, setIsShiny] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string>('');
  const [count, setCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSpecies = async () => {
      try {
        setLoadingSpecies(true);
        const res = await backendApi.get<{ species: GachaSpecies[] }>('/admin/gacha/species');
        if (res && res.species) {
          setSpeciesList(res.species);
          if (!selectedSpeciesId && res.species.length > 0) {
            setSelectedSpeciesId(res.species[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load species for grant modal:', err);
        toast.error('Failed to load species list');
      } finally {
        setLoadingSpecies(false);
      }
    };

    fetchSpecies();
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const filteredSpecies = speciesList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'all' || s.depth_zone === selectedZone;
    return matchesSearch && matchesZone;
  });

  const selectedSpecies = speciesList.find(s => s.id === selectedSpeciesId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpeciesId) {
      toast.error('Please select a species');
      return;
    }

    try {
      setSubmitting(true);
      const res = await backendApi.post<{
        ok: boolean;
        grantedCount: number;
        fishes: AdminUserFish[];
        totalFishes: number;
      }>(`/admin/gacha/users/${user.id}/grant-fish`, {
        species_id: selectedSpeciesId,
        is_shiny: isShiny,
        nickname: nickname.trim() || null,
        count: count
      });

      if (res.ok) {
        toast.success(
          `Granted ${count}x ${isShiny ? '✨ Shiny ' : ''}${selectedSpecies?.name || 'fish'} to ${user.username}!`,
          { icon: isShiny ? '🌟' : '🐟' }
        );
        onSuccess(res.fishes, res.totalFishes);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to grant fish:', err);
      toast.error(err.message || 'Failed to grant fish');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Fish size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Grant Specimen to <span className="text-cyan-400">{user.username}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Directly add any marine species with custom Shiny parameters into their vivarium.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Shiny Specimen Toggle Card */}
          <div 
            onClick={() => setIsShiny(!isShiny)}
            className={`cursor-pointer relative overflow-hidden rounded-xl p-4 border transition-all duration-300 flex items-center justify-between ${
              isShiny 
                ? 'bg-gradient-to-r from-amber-950/60 via-purple-950/50 to-cyan-950/60 border-amber-500/60 shadow-lg shadow-amber-500/10' 
                : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isShiny 
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                <Sparkles size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${isShiny ? 'text-amber-300' : 'text-slate-200'}`}>
                    {isShiny ? '✨ Shiny Variant Active' : 'Standard Variant'}
                  </span>
                  {isShiny && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Rare Sparkle Sheen
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isShiny 
                    ? 'Specimen will render with iridescent metallic shaders and orbiting star particle trails.' 
                    : 'Standard coloration matching the scientific baseline.'}
                </p>
              </div>
            </div>

            <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
              isShiny ? 'bg-amber-500' : 'bg-slate-700'
            }`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                isShiny ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </div>
          </div>

          {/* Species Selector Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" />
                Select Species ({filteredSpecies.length})
              </label>

              {/* Zone Filter Chips */}
              <div className="flex items-center gap-1">
                {['all', 'sunlit', 'twilight', 'abyssal'].map(zone => (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => setSelectedZone(zone)}
                    className={`text-[11px] px-2 py-0.5 rounded-md capitalize transition-colors ${
                      selectedZone === zone 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {zone}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input 
                type="text"
                placeholder="Search marine species by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>

            {/* Species Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {loadingSpecies ? (
                <div className="col-span-2 flex items-center justify-center py-8 text-slate-500 text-xs">
                  <Loader2 className="animate-spin mr-2" size={16} /> Loading marine species catalog...
                </div>
              ) : filteredSpecies.length === 0 ? (
                <div className="col-span-2 text-center py-6 text-slate-500 text-xs">
                  No species match your query.
                </div>
              ) : (
                filteredSpecies.map(s => {
                  const isSelected = selectedSpeciesId === s.id;
                  const rarityStyle = RARITY_COLORS[s.rarity] || RARITY_COLORS.common;
                  const isGLB = Boolean(s.model_url);

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSpeciesId(s.id)}
                      className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start gap-2.5 relative ${
                        isSelected 
                          ? 'bg-slate-800 border-cyan-500 shadow-md ring-1 ring-cyan-500/30' 
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${rarityStyle.bg} ${rarityStyle.text} border ${rarityStyle.border}`}>
                        <Fish size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">{s.name}</span>
                          {isSelected && <Check size={14} className="text-cyan-400 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${rarityStyle.badge}`}>
                            {s.rarity}
                          </span>
                          <span className="text-[9px] text-slate-400 capitalize">
                            • {s.depth_zone}
                          </span>
                          {isGLB && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 flex items-center gap-0.5 shrink-0" title={s.model_url || ''}>
                              <Box size={9} /> GLB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Additional Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Optional Nickname
              </label>
              <input 
                type="text"
                placeholder={`e.g. Captain ${selectedSpecies?.name || 'Bubbles'}`}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Quantity
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setCount(Math.max(1, count - 1))}
                  className="w-9 h-8 bg-slate-800 border border-slate-700 rounded-l-xl text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                >
                  -
                </button>
                <input 
                  type="number"
                  min={1}
                  max={5}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)))}
                  className="w-full h-8 text-center bg-slate-900 border-y border-slate-700 text-xs text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setCount(Math.min(5, count + 1))}
                  className="w-9 h-8 bg-slate-800 border border-slate-700 rounded-r-xl text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/95">
          <div className="text-xs text-slate-400">
            Target: <span className="text-slate-200 font-medium">{user.username}</span>
            {selectedSpecies && (
              <span className="ml-2 text-cyan-400">• {count}x {isShiny ? '✨ ' : ''}{selectedSpecies.name}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedSpeciesId}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md ${
                isShiny
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 hover:brightness-110 shadow-amber-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
              } disabled:opacity-50`}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Granting...
                </>
              ) : (
                <>
                  <Fish size={14} /> Grant {isShiny ? 'Shiny ' : ''}Specimen
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrantFishModal;
