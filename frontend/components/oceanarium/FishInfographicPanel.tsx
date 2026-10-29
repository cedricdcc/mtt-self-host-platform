import React, { useState } from 'react';
import { UserFish } from '../../types';
import { 
  Sparkles, 
  Heart, 
  X, 
  Ruler, 
  Waves, 
  Activity, 
  Compass, 
  Zap, 
  Droplets,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface FishInfographicPanelProps {
  fish: UserFish;
  onClose: () => void;
  onFeedFish?: (type: 'flake' | 'super_pellet') => void;
  onPrevFish?: () => void;
  onNextFish?: () => void;
  onBoopFish?: () => void;
  fishIndex?: number;
  currentIndex?: number;
  totalFishes?: number;
}

const RARITY_THEMES: Record<string, { badge: string; border: string; glow: string; text: string }> = {
  common: {
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    border: 'border-slate-700',
    glow: 'rgba(148, 163, 184, 0.15)',
    text: 'text-slate-300'
  },
  uncommon: {
    badge: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/40',
    glow: 'rgba(16, 185, 129, 0.25)',
    text: 'text-emerald-300'
  },
  rare: {
    badge: 'bg-blue-950 text-blue-300 border-blue-500/40',
    border: 'border-blue-500/40',
    glow: 'rgba(59, 130, 246, 0.3)',
    text: 'text-blue-300'
  },
  epic: {
    badge: 'bg-purple-950 text-purple-300 border-purple-500/40',
    border: 'border-purple-500/40',
    glow: 'rgba(168, 85, 247, 0.35)',
    text: 'text-purple-300'
  },
  legendary: {
    badge: 'bg-amber-950 text-amber-300 border-amber-500/50',
    border: 'border-amber-500/50',
    glow: 'rgba(245, 158, 11, 0.4)',
    text: 'text-amber-300'
  }
};

export const FishInfographicPanel: React.FC<FishInfographicPanelProps> = ({
  fish,
  onClose,
  onFeedFish,
  onPrevFish,
  onNextFish,
  onBoopFish,
  fishIndex,
  currentIndex,
  totalFishes = 1
}) => {
  const [isFavorited, setIsFavorited] = useState(Boolean(fish.is_favorite));
  const [boopPulse, setBoopPulse] = useState(false);

  const activeFishIdx = currentIndex ?? fishIndex ?? 0;

  const handleBoopClick = () => {
    if (onBoopFish) {
      onBoopFish();
    }
    setBoopPulse(true);
    setTimeout(() => setBoopPulse(false), 900);
  };

  // Determine estimated real-world metric length in cm
  const speciesLower = (fish.species_id || '').toLowerCase();
  let baseLengthCm = 22;
  if (speciesLower.includes('whale') || speciesLower.includes('leviathan')) baseLengthCm = 450;
  else if (speciesLower.includes('shark') || speciesLower.includes('manta')) baseLengthCm = 180;
  else if (speciesLower.includes('puffer') || speciesLower.includes('porcupine')) baseLengthCm = 28;
  else if (speciesLower.includes('tang') || speciesLower.includes('surgeon')) baseLengthCm = 24;
  else if (speciesLower.includes('clown') || speciesLower.includes('anemone')) baseLengthCm = 12;
  else if (speciesLower.includes('angler') || speciesLower.includes('abyss')) baseLengthCm = 35;
  else if (speciesLower.includes('squid') || speciesLower.includes('octo')) baseLengthCm = 65;

  const visualScale = fish.visual_traits?.scale || 1.0;
  const specimenLengthCm = Math.round(baseLengthCm * visualScale);

  // Comparison type: hand (<30 cm) or scuba diver (>=30 cm)
  const compareToHand = specimenLengthCm < 30;
  const referenceName = compareToHand ? 'Human Hand (18 cm)' : 'Scuba Diver (180 cm)';
  const referenceSizeCm = compareToHand ? 18 : 180;

  // Scale ratio
  const ratio = (specimenLengthCm / referenceSizeCm).toFixed(1);

  const rarityTheme = RARITY_THEMES[fish.rarity] || RARITY_THEMES.common;
  const isShiny = Boolean(fish.is_shiny);

  // Bathymetric zone metadata
  const zoneMeta = {
    sunlit: { name: 'Sunlit Reef', depth: '0 - 200m', progress: '12%', color: 'from-cyan-400 to-sky-500' },
    twilight: { name: 'Twilight Zone', depth: '200 - 1000m', progress: '52%', color: 'from-sky-500 to-indigo-600' },
    abyssal: { name: 'Abyssal Trench', depth: '1000 - 4000m+', progress: '88%', color: 'from-indigo-600 to-purple-800' }
  }[fish.depth_zone] || { name: 'Sunlit Reef', depth: '0 - 200m', progress: '15%', color: 'from-cyan-400 to-sky-500' };

  return (
    <div 
      className="absolute right-4 top-6 bottom-6 z-30 w-full max-w-sm flex flex-col pointer-events-auto animate-in fade-in slide-in-from-right-8 duration-300"
      style={{ filter: `drop-shadow(0 0 35px ${rarityTheme.glow})` }}
    >
      <div className="flex-1 flex flex-col rounded-3xl bg-slate-950/95 backdrop-blur-2xl border border-sky-500/30 p-5 overflow-y-auto text-white shadow-2xl space-y-4">
        {/* 0. Specimen Cycling Bar (Prev | Specimen X of N | Next) */}
        {totalFishes > 1 && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-xs font-mono">
            <button
              onClick={() => onPrevFish && onPrevFish()}
              className="flex items-center gap-1 text-cyan-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Previous Specimen"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="text-slate-300 font-semibold">
              Specimen <strong className="text-cyan-300">{activeFishIdx + 1}</strong> of {totalFishes}
            </span>
            <button
              onClick={() => onNextFish && onNextFish()}
              className="flex items-center gap-1 text-cyan-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Next Specimen"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1. Header & Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider border ${rarityTheme.badge}`}>
                {fish.rarity}
              </span>
              {isShiny && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30">
                  <Sparkles className="w-3 h-3" />
                  SHINY SPECIMEN
                </span>
              )}
            </div>
            <h2 className="text-lg font-black tracking-tight text-white capitalize">
              {fish.nickname || fish.name || fish.species_id.replace(/_/g, ' ')}
            </h2>
            <p className="text-xs font-mono text-cyan-300/80 capitalize">
              {fish.species_id.replace(/_/g, ' ')}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFavorited(!isFavorited)}
              className={`p-2 rounded-xl transition-all border ${
                isFavorited 
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle Favorite"
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all hover:scale-105"
              title="Close Panel (ESC / R)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Comparative Physical Scale Visualizer (The Infographic Scale) */}
        <div className="rounded-2xl bg-slate-900/80 border border-sky-800/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-cyan-300 font-bold flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
              <Ruler className="w-3.5 h-3.5" />
              Comparative Scale
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              <strong className="text-amber-300">{specimenLengthCm} cm</strong> ({ratio}× {compareToHand ? 'hand' : 'diver'})
            </span>
          </div>

          {/* Scale Ruler & Silhouettes */}
          <div className="relative h-24 rounded-xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800/80 p-2 flex items-end justify-around overflow-hidden">
            {/* Metric Ruler Grid Lines */}
            <div className="absolute inset-x-0 top-1 h-3 flex justify-between px-2 text-[8px] font-mono text-slate-500 border-b border-slate-800">
              <span>0</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>

            {/* Reference Silhouette (Hand or Scuba Diver) */}
            <div className="flex flex-col items-center">
              <div className="h-14 flex items-end">
                {compareToHand ? (
                  /* Hand Silhouette SVG */
                  <svg className="w-8 h-12 text-slate-500 fill-current opacity-60" viewBox="0 0 24 24">
                    <path d="M12 2a2 2 0 0 0-2 2v7h-1V5a2 2 0 0 0-4 0v9a8 8 0 0 0 16 0V9a2 2 0 0 0-4 0v2h-1V4a2 2 0 0 0-2-2z"/>
                  </svg>
                ) : (
                  /* Scuba Diver Silhouette SVG */
                  <svg className="w-9 h-14 text-slate-500 fill-current opacity-60" viewBox="0 0 24 24">
                    <path d="M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 7c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h1v5a1 1 0 0 0 2 0v-5h1v5a1 1 0 0 0 2 0v-5h1c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1H9z"/>
                  </svg>
                )}
              </div>
              <span className="text-[9px] font-mono text-slate-400 mt-1">
                {compareToHand ? 'Hand (18cm)' : 'Diver (1.8m)'}
              </span>
            </div>

            {/* Versus Caliper Marker */}
            <div className="h-12 border-r border-dashed border-cyan-500/40 self-center"></div>

            {/* Specimen Fish Silhouette */}
            <div className="flex flex-col items-center">
              <div className="h-14 flex items-end">
                <svg 
                  className="h-12 text-cyan-400 fill-current drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] transition-transform duration-300" 
                  style={{ width: `${Math.max(28, Math.min(68, specimenLengthCm * 1.5))}px` }}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3C6.5 3 2 6.5 2 12s4.5 9 10 9c3.3 0 6.2-1.3 8.2-3.4L22 19v-4l-3.3-1.1c.2-.6.3-1.3.3-1.9 0-.6-.1-1.3-.3-1.9L22 9V5l-1.8 1.4C18.2 4.3 15.3 3 12 3zm-4 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
                </svg>
              </div>
              <span className="text-[9px] font-mono font-bold text-cyan-300 mt-1">
                Specimen ({specimenLengthCm}cm)
              </span>
            </div>
          </div>
        </div>

        {/* 3. Bathymetric Depth Stratum Column */}
        <div className="rounded-2xl bg-slate-900/80 border border-sky-800/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-cyan-300 font-bold flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
              <Waves className="w-3.5 h-3.5" />
              Bathymetric Depth
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              {zoneMeta.name} ({zoneMeta.depth})
            </span>
          </div>

          <div className="relative h-4 rounded-full bg-gradient-to-r from-cyan-400 via-blue-600 to-purple-900 overflow-hidden shadow-inner">
            <div 
              className="absolute top-0 bottom-0 w-3 rounded-full bg-white shadow-[0_0_10px_#ffffff] border-2 border-slate-900 -translate-x-1/2 animate-pulse"
              style={{ left: zoneMeta.progress }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
            <span className="text-cyan-300">0m (Sunlit)</span>
            <span className="text-blue-300">500m (Twilight)</span>
            <span className="text-purple-300">3000m+ (Abyssal)</span>
          </div>
        </div>

        {/* 4. Bio-Telemetry & Diet Stats */}
        <div className="rounded-2xl bg-slate-900/80 border border-sky-800/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-300 uppercase text-[11px] tracking-wider">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Bio-Telemetry
            </span>
            <span className="text-[10px] text-slate-400">Status: {fish.status || 'Active'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 font-mono">Vitality Index</span>
              <span className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                <Zap className="w-3.5 h-3.5" /> 96%
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 font-mono">Swim Velocity</span>
              <span className="text-sm font-bold text-sky-400 font-mono flex items-center gap-1 mt-0.5">
                <Compass className="w-3.5 h-3.5" /> 2.2 kts
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
            {fish.description || 'A native specimen swimming gracefully within the living diorama habitat.'}
          </p>
        </div>

        {/* 5. Quick Actions */}
        <div className="pt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onFeedFish && onFeedFish('flake')}
            className="flex-1 py-2.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-amber-500/10"
          >
            <span>🍞</span>
            <span>Feed Specimen</span>
          </button>
          <button
            onClick={handleBoopClick}
            className={`flex-1 py-2.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border shadow-lg ${
              boopPulse
                ? 'bg-cyan-400/30 border-cyan-300 text-white shadow-cyan-400/30 scale-105'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10'
            }`}
          >
            <span>⚡</span>
            <span>{boopPulse ? 'Booped!' : 'Boop Specimen'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FishInfographicPanel;
