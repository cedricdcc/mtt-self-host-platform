import React, { useState } from 'react';
import { GachaPullResult, UserEcosystem } from '../../types';
import { Compass, Sparkles, Anchor, RotateCcw } from 'lucide-react';

interface DiveStationProps {
  ecosystem: UserEcosystem;
  onPull: (count: 1 | 10) => Promise<{ results: GachaPullResult[]; extra_flakes_awarded: number }>;
  onBackToTank: () => void;
}

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  common: {
    border: 'border-slate-500',
    bg: 'bg-slate-900/90',
    text: 'text-slate-300',
    glow: 'shadow-slate-500/20'
  },
  uncommon: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-950/90',
    text: 'text-emerald-300',
    glow: 'shadow-emerald-500/30'
  },
  rare: {
    border: 'border-blue-500',
    bg: 'bg-blue-950/90',
    text: 'text-blue-300',
    glow: 'shadow-blue-500/40'
  },
  epic: {
    border: 'border-purple-500',
    bg: 'bg-purple-950/90',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/50'
  },
  legendary: {
    border: 'border-amber-400',
    bg: 'bg-amber-950/90',
    text: 'text-amber-300',
    glow: 'shadow-amber-400/60'
  }
};

export const DiveStation: React.FC<DiveStationProps> = ({
  ecosystem,
  onPull,
  onBackToTank
}) => {
  const [isDiving, setIsDiving] = useState(false);
  const [diveDepth, setDiveDepth] = useState(0);
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null);
  const [extraFlakes, setExtraFlakes] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const triggerSonarSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio context disabled or not allowed by browser policy
    }
  };

  const handleStartDive = async (count: 1 | 10) => {
    if (ecosystem.tickets < count) {
      setErrorMessage(`You need ${count} ticket${count > 1 ? 's' : ''} to take this dive.`);
      return;
    }

    setErrorMessage(null);
    setIsDiving(true);
    setDiveDepth(0);
    setPullResults(null);

    triggerSonarSound();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

    // Animate depth meter down to 2800m
    const duration = 1800;
    const start = performance.now();

    const depthInterval = setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);
      setDiveDepth(Math.round(progress * 2800));

      if (progress >= 1) {
        clearInterval(depthInterval);
      }
    }, 40);

    try {
      const [res] = await Promise.all([
        onPull(count),
        new Promise(resolve => setTimeout(resolve, duration))
      ]);

      setPullResults(res.results);
      setExtraFlakes(res.extra_flakes_awarded);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Dive failed');
    } finally {
      clearInterval(depthInterval);
      setIsDiving(false);
    }
  };

  const epicPityLeft = Math.max(0, 10 - ecosystem.pity_counter_epic);
  const legendaryPityLeft = Math.max(0, 30 - ecosystem.pity_counter_legendary);

  return (
    <div className="relative w-full min-h-[650px] md:min-h-[750px] rounded-2xl overflow-hidden border border-cyan-800/40 bg-gradient-to-b from-slate-900 via-sky-950 to-slate-950 p-6 md:p-10 flex flex-col justify-between select-none">
      {/* Background Submersible Water & Grid Effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Top Controls & Pity Status */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBackToTank}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-sky-500/30 text-sky-200 text-sm font-medium transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Return to Oceanarium</span>
        </button>

        <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-sky-600/30">
          <div className="flex items-center gap-2 text-sm text-cyan-300 font-medium">
            <span className="text-xl">🎟️</span>
            <span>Tickets: <strong className="text-white text-base">{ecosystem.tickets}</strong></span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="text-xs text-slate-300 flex items-center gap-3">
            <span>Epic in: <strong className="text-purple-400">{epicPityLeft}</strong></span>
            <span>Legendary in: <strong className="text-amber-400">{legendaryPityLeft}</strong></span>
          </div>
        </div>
      </div>

      {/* Diving Descent Animation Viewport */}
      {isDiving ? (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center my-8">
          <div className="relative w-48 h-48 md:w-60 md:h-60 rounded-full border-4 border-cyan-400/60 shadow-[0_0_50px_rgba(6,182,212,0.4)] flex flex-col items-center justify-center overflow-hidden bg-sky-950/80 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
            <Anchor className="w-12 h-12 text-cyan-300 animate-bounce mb-2" />
            <div className="text-2xl md:text-3xl font-mono font-bold text-white tracking-widest">
              {diveDepth}m
            </div>
            <div className="text-xs font-mono uppercase text-cyan-400 tracking-wider mt-1">
              {diveDepth < 200 ? '☀️ Sunlit Zone' : diveDepth < 1000 ? '🔮 Twilight Zone' : '🌌 Abyssal Trench'}
            </div>
          </div>
          <p className="text-slate-300 text-sm mt-6 animate-pulse tracking-wide font-medium">
            Submersible descending into uncharted waters...
          </p>
        </div>
      ) : pullResults ? (
        /* Pull Results Modal / Gallery */
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center my-6">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span>Expedition Discoveries!</span>
          </h2>
          {extraFlakes > 0 && (
            <p className="text-xs text-amber-300 mb-4 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
              +{extraFlakes} Food Flakes converted from duplicate marine essence
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 max-h-[420px] overflow-y-auto p-2 w-full max-w-4xl">
            {pullResults.map((fish, i) => {
              const rarityStyle = RARITY_COLORS[fish.rarity] || RARITY_COLORS.common;
              return (
                <div
                  key={i}
                  className={`relative p-3 rounded-xl border-2 ${rarityStyle.border} ${rarityStyle.bg} shadow-lg ${rarityStyle.glow} flex flex-col items-center text-center transform hover:scale-105 transition-all duration-200`}
                >
                  {fish.is_new_discovery && (
                    <span className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce">
                      NEW!
                    </span>
                  )}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-2 border border-white/20"
                    style={{
                      background: `linear-gradient(135deg, ${fish.visual_traits?.primary_color || '#00d2ff'}, ${fish.visual_traits?.secondary_color || '#3a7bd5'})`
                    }}
                  >
                    <span className="text-2xl select-none">🐟</span>
                  </div>
                  <h4 className="font-bold text-xs text-white line-clamp-1">{fish.name}</h4>
                  <span className={`text-[10px] font-mono uppercase mt-1 font-bold ${rarityStyle.text}`}>
                    {fish.rarity}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">{fish.depth_zone}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleStartDive(pullResults.length === 10 ? 10 : 1)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all"
            >
              Dive Again ({pullResults.length === 10 ? '10 🎟️' : '1 🎟️'})
            </button>
            <button
              onClick={() => setPullResults(null)}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        /* Idle Dive Station Hub View */
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-6">
          <div className="w-24 h-24 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center shadow-inner mb-6">
            <Compass className="w-12 h-12 text-cyan-400 animate-spin-slow" />
          </div>

          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            The Deep Bathyscaphe
          </h2>
          <p className="text-slate-300 max-w-md text-sm mb-6 leading-relaxed">
            Plunge into the lightless trenches. Spend your earned expedition tickets to discover rare, glowing specimens and add them to your living reef.
          </p>

          {errorMessage && (
            <div className="mb-4 text-xs font-medium text-rose-300 bg-rose-950/80 border border-rose-500/40 px-4 py-2 rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Action Dive Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            <button
              onClick={() => handleStartDive(1)}
              disabled={ecosystem.tickets < 1}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-white shadow-lg transition-all"
            >
              Single Dive (1 🎟️)
            </button>
            <button
              onClick={() => handleStartDive(10)}
              disabled={ecosystem.tickets < 10}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Expedition Dive (10 🎟️)</span>
            </button>
          </div>
          <span className="text-[11px] text-amber-300/80 font-mono mt-2">
            ★ 10-Pull guarantees at least one Rare or higher creature
          </span>
        </div>
      )}
    </div>
  );
};

export default DiveStation;
