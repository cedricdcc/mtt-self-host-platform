import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Compass, BookOpen, Sparkles, Droplets, Fish, Heart, RefreshCw } from 'lucide-react';
import { ecosystemService } from '../services/ecosystemService';
import { EcosystemResponse, CodexResponse } from '../types';
import OceanariumCanvas from '../components/oceanarium/OceanariumCanvas';
import DiveStation from '../components/oceanarium/DiveStation';
import MarineCodex from '../components/oceanarium/MarineCodex';
import toast from 'react-hot-toast';

export const Oceanarium: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  const [ecosystemData, setEcosystemData] = useState<EcosystemResponse | null>(null);
  const [codexData, setCodexData] = useState<CodexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'oceanarium' | 'dive' | 'codex'>('oceanarium');
  const [foodMode, setFoodMode] = useState<'none' | 'flake' | 'super_pellet'>('flake');

  const loadData = async () => {
    try {
      setLoading(true);
      const [eco, codex] = await Promise.all([
        ecosystemService.fetchEcosystem(),
        ecosystemService.fetchCodex()
      ]);
      setEcosystemData(eco);
      setCodexData(codex);
    } catch (err) {
      console.error('Failed to load oceanarium data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin === 1) {
      loadData();
    }
  }, [user]);

  const handleFeed = async (foodType: 'flake' | 'super_pellet') => {
    try {
      const updated = await ecosystemService.feedEcosystem(foodType);
      setEcosystemData(updated);
      toast.success(
        foodType === 'flake'
          ? 'Flake dropped! +10% Water Quality'
          : 'Super Pellet dropped! +25% Water Quality & Fishes Energized!',
        { icon: '🐟' }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not feed');
    }
  };

  const handlePull = async (count: 1 | 10) => {
    const res = await ecosystemService.pullGacha(count);
    // Reload ecosystem & codex
    const [freshEco, freshCodex] = await Promise.all([
      ecosystemService.fetchEcosystem(),
      ecosystemService.fetchCodex()
    ]);
    setEcosystemData(freshEco);
    setCodexData(freshCodex);
    return res;
  };

  // 1. Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] text-cyan-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // 2. Admin Guard Check
  if (!user || user.is_admin !== 1) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Undersea Laboratory</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Access to the living Oceanarium, Coral Habitats, and Gacha Dive Station is currently restricted to platform administrators during preview and balancing.
        </p>
        <span className="text-xs font-mono px-3 py-1 bg-slate-800 text-slate-400 rounded-full border border-slate-700">
          Admin Access Required
        </span>
      </div>
    );
  }

  if (loading || !ecosystemData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-cyan-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="text-sm font-mono tracking-wider">Submersible docking with station...</span>
      </div>
    );
  }

  const { ecosystem, fishes } = ecosystemData;

  const getWaterQualityBadge = (quality: number) => {
    if (quality >= 80) {
      return { label: 'Pristine & Thriving', text: 'text-emerald-400', bg: 'bg-emerald-950/80 border-emerald-500/30' };
    }
    if (quality >= 40) {
      return { label: 'Balanced Habitat', text: 'text-cyan-400', bg: 'bg-cyan-950/80 border-cyan-500/30' };
    }
    if (quality > 0) {
      return { label: 'Murky / Needs Care', text: 'text-amber-400', bg: 'bg-amber-950/80 border-amber-500/30' };
    }
    return { label: 'Critical / Dormant', text: 'text-rose-400', bg: 'bg-rose-950/80 border-rose-500/30' };
  };

  const badge = getWaterQualityBadge(ecosystem.water_quality);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & HUD */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-sky-800/40 rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Title & Water Health */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Fish className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">The Oceanarium</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Admin Beta
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1.5 ${badge.bg} ${badge.text}`}>
                <Droplets className="w-3 h-3" />
                <span>Water Quality: {ecosystem.water_quality}% ({badge.label})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Tabs Switcher */}
        <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800 w-full md:w-auto justify-center">
          <button
            onClick={() => setActiveTab('oceanarium')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'oceanarium'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Fish className="w-4 h-4" />
            <span>Oceanarium</span>
          </button>
          <button
            onClick={() => setActiveTab('dive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'dive'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Dive Station</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {ecosystem.tickets}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('codex')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'codex'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Codex</span>
          </button>
        </div>

        {/* Right: Quick Inventory / Feed Selector */}
        {activeTab === 'oceanarium' && (
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setFoodMode('flake')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                foodMode === 'flake'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🍞</span>
              <span>Flakes: <strong>{ecosystem.food_flakes}</strong></span>
            </button>
            <button
              onClick={() => setFoodMode('super_pellet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                foodMode === 'super_pellet'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🔮</span>
              <span>Pellets: <strong>{ecosystem.super_pellets}</strong></span>
            </button>
          </div>
        )}
      </div>

      {/* Main Viewport Content */}
      <div className="relative">
        {activeTab === 'oceanarium' && (
          <OceanariumCanvas
            fishes={fishes}
            waterQuality={ecosystem.water_quality}
            foodMode={foodMode}
            onFeed={handleFeed}
          />
        )}

        {activeTab === 'dive' && (
          <DiveStation
            ecosystem={ecosystem}
            onPull={handlePull}
            onBackToTank={() => setActiveTab('oceanarium')}
          />
        )}

        {activeTab === 'codex' && codexData && (
          <MarineCodex codexData={codexData} />
        )}
      </div>

      {/* Mobile Ergonomic Thumb Dock (Below Viewport) */}
      <div className="md:hidden flex items-center justify-between gap-2 p-3 bg-slate-900/95 backdrop-blur-xl border border-sky-800/40 rounded-2xl shadow-xl">
        <button
          onClick={() => handleFeed('flake')}
          disabled={ecosystem.food_flakes < 1}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <span>🍞 Flake</span>
          <span className="font-mono">({ecosystem.food_flakes})</span>
        </button>

        <button
          onClick={() => setActiveTab('dive')}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-lg shadow-amber-500/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>DIVE ({ecosystem.tickets})</span>
        </button>

        <button
          onClick={() => handleFeed('super_pellet')}
          disabled={ecosystem.super_pellets < 1}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <span>🔮 Pellet</span>
          <span className="font-mono">({ecosystem.super_pellets})</span>
        </button>
      </div>
    </div>
  );
};

export default Oceanarium;
