import React, { useState, useEffect, useRef } from 'react';
import { GachaPullResult, UserEcosystem } from '../../types';
import { 
  Compass, 
  Sparkles, 
  Anchor, 
  RotateCcw, 
  Radio, 
  AlertTriangle, 
  FastForward, 
  CheckCircle2, 
  Waves,
  Eye
} from 'lucide-react';
import { oceanAudio } from '../../services/oceanAudio';

interface DiveStationProps {
  ecosystem: UserEcosystem;
  onPull: (count: 1 | 10) => Promise<{ results: GachaPullResult[]; extra_flakes_awarded: number }>;
  onBackToTank: () => void;
}

type DiveState = 'idle' | 'descent' | 'sonar_lock' | 'pod_reveal' | 'summary';

const RARITY_RANK: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5
};

const RARITY_STYLES: Record<string, {
  border: string;
  bg: string;
  text: string;
  badge: string;
  glow: string;
  accent: string;
}> = {
  common: {
    border: 'border-slate-600',
    bg: 'bg-slate-900/95',
    text: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300',
    glow: 'shadow-slate-600/20',
    accent: '#94a3b8'
  },
  uncommon: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-950/95',
    text: 'text-emerald-300',
    badge: 'bg-emerald-950 text-emerald-400 border border-emerald-500/30',
    glow: 'shadow-emerald-500/30',
    accent: '#10b981'
  },
  rare: {
    border: 'border-blue-500',
    bg: 'bg-blue-950/95',
    text: 'text-blue-300',
    badge: 'bg-blue-950 text-blue-400 border border-blue-500/40',
    glow: 'shadow-blue-500/40',
    accent: '#3b82f6'
  },
  epic: {
    border: 'border-purple-500',
    bg: 'bg-purple-950/95',
    text: 'text-purple-300',
    badge: 'bg-purple-950 text-purple-300 border border-purple-500/40',
    glow: 'shadow-purple-500/50',
    accent: '#a855f7'
  },
  legendary: {
    border: 'border-amber-400',
    bg: 'bg-amber-950/95',
    text: 'text-amber-300',
    badge: 'bg-amber-950 text-amber-300 border border-amber-400/50',
    glow: 'shadow-amber-400/70',
    accent: '#f59e0b'
  }
};

export const DiveStation: React.FC<DiveStationProps> = ({
  ecosystem,
  onPull,
  onBackToTank
}) => {
  const [diveState, setDiveState] = useState<DiveState>('idle');
  const [diveDepth, setDiveDepth] = useState(0);
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null);
  const [extraFlakes, setExtraFlakes] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Highest rarity in current batch
  const [highestRarity, setHighestRarity] = useState<'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'>('common');

  // Pod Reveal State
  const [currentPodIndex, setCurrentPodIndex] = useState(0);
  const [isPodUnsealing, setIsPodUnsealing] = useState(false);
  const [isPodOpened, setIsPodOpened] = useState(false);
  const [isSuspensePeak, setIsSuspensePeak] = useState(false);

  const droneStopRef = useRef<(() => void) | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (droneStopRef.current) {
        droneStopRef.current();
      }
    };
  }, []);

  const handleStartDive = async (count: 1 | 10) => {
    if (ecosystem.tickets < count) {
      setErrorMessage(`You need ${count} ticket${count > 1 ? 's' : ''} to take this dive.`);
      return;
    }

    setErrorMessage(null);
    setDiveState('descent');
    setDiveDepth(0);
    setPullResults(null);
    setCurrentPodIndex(0);
    setIsPodOpened(false);
    setIsPodUnsealing(false);
    setIsSuspensePeak(false);

    // Start deep ocean trench drone
    if (droneStopRef.current) droneStopRef.current();
    droneStopRef.current = oceanAudio.playTrenchDrone();

    // Trigger initial sonar ping
    oceanAudio.playSonarPing(850, 0.1);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

    // Animate descent depth
    const descentDuration = 2200;
    const startTime = performance.now();
    let sonarIntervalCount = 0;

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / descentDuration);
      const currentDepth = Math.round(progress * 2850);
      setDiveDepth(currentDepth);

      // Periodic sonar pings that deepen as depth increases
      if (Math.floor(progress * 5) > sonarIntervalCount) {
        sonarIntervalCount = Math.floor(progress * 5);
        oceanAudio.playSonarPing(850, progress);
      }

      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 40);

    try {
      // Execute pull in parallel with descent animation
      const [res] = await Promise.all([
        onPull(count),
        new Promise(resolve => setTimeout(resolve, descentDuration))
      ]);

      setPullResults(res.results);
      setExtraFlakes(res.extra_flakes_awarded);

      // Determine highest rarity in batch
      let maxRank = 1;
      let topRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
      res.results.forEach(fish => {
        const rank = RARITY_RANK[fish.rarity] || 1;
        if (rank > maxRank) {
          maxRank = rank;
          topRarity = fish.rarity as any;
        }
      });
      setHighestRarity(topRarity);

      // Transition to Stage 2: Sonar Anomaly Lock
      setDiveState('sonar_lock');
      oceanAudio.playAnomalyAlert(topRarity);

      // Hold anomaly alert for suspense (1.6s for legendary/epic, 1.0s for common/rare)
      const anomalyHoldTime = topRarity === 'legendary' ? 2000 : topRarity === 'epic' ? 1600 : 1100;
      setTimeout(() => {
        setDiveState('pod_reveal');
        setCurrentPodIndex(0);
        setIsPodOpened(false);
      }, anomalyHoldTime);

    } catch (err) {
      clearInterval(interval);
      if (droneStopRef.current) droneStopRef.current();
      setDiveState('idle');
      setErrorMessage(err instanceof Error ? err.message : 'Expedition dive failed');
    }
  };

  const handleUnsealCurrentPod = () => {
    if (!pullResults || isPodUnsealing || isPodOpened) return;

    const currentFish = pullResults[currentPodIndex];
    if (!currentFish) return;

    const isHighRarity = currentFish.rarity === 'epic' || currentFish.rarity === 'legendary';

    setIsPodUnsealing(true);
    oceanAudio.playCanisterHiss();

    if (isHighRarity) {
      // Suspense peak delay for high rarity
      setIsSuspensePeak(true);
      if (navigator.vibrate) {
        navigator.vibrate(currentFish.rarity === 'legendary' ? [100, 50, 100, 50, 200] : [60, 40, 100]);
      }

      setTimeout(() => {
        setIsSuspensePeak(false);
        setIsPodOpened(true);
        setIsPodUnsealing(false);
        oceanAudio.playRevealStinger(currentFish.rarity);
      }, currentFish.rarity === 'legendary' ? 1400 : 1000);

    } else {
      // Fast reveal for common/rare
      setTimeout(() => {
        setIsPodOpened(true);
        setIsPodUnsealing(false);
        oceanAudio.playRevealStinger(currentFish.rarity);
      }, 350);
    }
  };

  const handleNextPod = () => {
    if (!pullResults) return;

    if (currentPodIndex + 1 < pullResults.length) {
      setCurrentPodIndex(prev => prev + 1);
      setIsPodOpened(false);
      setIsPodUnsealing(false);
      setIsSuspensePeak(false);
    } else {
      // All pods opened -> Go to summary manifest
      if (droneStopRef.current) droneStopRef.current();
      setDiveState('summary');
    }
  };

  const handleSkipToSummary = () => {
    if (droneStopRef.current) droneStopRef.current();
    setDiveState('summary');
  };

  const epicPityLeft = Math.max(0, 10 - ecosystem.pity_counter_epic);
  const legendaryPityLeft = Math.max(0, 30 - ecosystem.pity_counter_legendary);

  return (
    <div className="relative w-full min-h-[650px] md:min-h-[750px] rounded-3xl overflow-hidden border border-cyan-800/40 bg-gradient-to-b from-slate-950 via-sky-950 to-slate-950 p-6 md:p-10 flex flex-col justify-between select-none shadow-2xl">
      
      {/* Dynamic Water Caustics & Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Top Bridge Controls & Pity Status */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => {
            if (droneStopRef.current) droneStopRef.current();
            onBackToTank();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-sky-500/30 text-sky-200 text-xs font-semibold tracking-wide transition-all shadow-md"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Return to Oceanarium</span>
        </button>

        <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-sky-600/30 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-cyan-300 font-medium">
            <span className="text-base">🎟️</span>
            <span>Tickets: <strong className="text-white font-mono text-sm">{ecosystem.tickets}</strong></span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="text-[11px] text-slate-300 flex items-center gap-3">
            <span>Epic in: <strong className="text-purple-400 font-mono">{epicPityLeft}</strong></span>
            <span>Legendary in: <strong className="text-amber-400 font-mono">{legendaryPityLeft}</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DESCENT STATE (Submersible Porthole) */}
      {/* ========================================================================= */}
      {diveState === 'descent' && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center my-8 animate-in fade-in duration-300">
          {/* Circular Reinforced Porthole */}
          <div className={`relative w-56 h-56 md:w-72 md:h-72 rounded-full border-8 border-slate-700 shadow-[0_0_80px_rgba(6,182,212,0.3)] flex flex-col items-center justify-center overflow-hidden transition-all duration-700 ${
            diveDepth < 400
              ? 'bg-gradient-to-b from-cyan-600/50 to-blue-900/70'
              : diveDepth < 1200
                ? 'bg-gradient-to-b from-blue-950 to-indigo-950'
                : 'bg-gradient-to-b from-slate-950 to-black'
          }`}>
            {/* Dual Sweeping Searchlight Beams */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(56,189,248,0.15)_30deg,transparent_60deg)] animate-spin-slow opacity-70 pointer-events-none"></div>

            {/* Bubble particles */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-2xl animate-bounce duration-1000 opacity-40">🫧</span>
            </div>

            <Anchor className="w-10 h-10 text-cyan-300 animate-pulse mb-2 z-10" />
            <div className="text-3xl md:text-4xl font-mono font-black text-white tracking-widest z-10 drop-shadow-md">
              {diveDepth}m
            </div>
            <div className="text-xs font-mono uppercase text-cyan-400 font-bold tracking-wider mt-1 z-10">
              {diveDepth < 200 ? '☀️ Sunlit Zone' : diveDepth < 1000 ? '🔮 Twilight Zone' : '🌌 Abyssal Trench'}
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1 z-10">
              {(1 + diveDepth / 10).toFixed(0)} ATM Pressure
            </div>
          </div>

          <p className="text-cyan-200 text-sm mt-6 font-mono tracking-wider animate-pulse flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Hydrophones active... Bathyscaphe descending into the trench...</span>
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SONAR ANOMALY LOCK STATE (Anticipation / Suspense Spike) */}
      {/* ========================================================================= */}
      {diveState === 'sonar_lock' && (
        <div className={`relative z-20 flex-1 flex flex-col items-center justify-center text-center my-8 animate-in zoom-in-95 duration-300 ${
          highestRarity === 'legendary' ? 'animate-bounce' : ''
        }`}>
          {/* Radar Radar Scope */}
          <div className={`relative w-60 h-60 md:w-72 md:h-72 rounded-full border-4 flex flex-col items-center justify-center overflow-hidden transition-all shadow-2xl ${
            highestRarity === 'legendary'
              ? 'border-amber-400 bg-amber-950/40 shadow-amber-500/60 animate-pulse'
              : highestRarity === 'epic'
                ? 'border-purple-400 bg-purple-950/40 shadow-purple-500/50'
                : highestRarity === 'rare'
                  ? 'border-blue-400 bg-blue-950/40 shadow-blue-500/40'
                  : 'border-cyan-400 bg-cyan-950/40 shadow-cyan-500/30'
          }`}>
            {/* Spinning Radar Line */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(56,189,248,0.3)_45deg,transparent_90deg)] animate-spin"></div>
            
            <Radio className={`w-14 h-14 mb-3 animate-ping ${
              highestRarity === 'legendary'
                ? 'text-amber-300'
                : highestRarity === 'epic'
                  ? 'text-purple-300'
                  : highestRarity === 'rare'
                    ? 'text-blue-300'
                    : 'text-cyan-300'
            }`} />

            <div className="text-sm font-mono uppercase font-black tracking-widest text-white px-3 py-1 rounded-full bg-slate-950/80 border border-white/20">
              {highestRarity === 'legendary' && '⚠️ COLOSSAL ABYSSAL SIGNATURE ⚠️'}
              {highestRarity === 'epic' && '🔮 EXOTIC BIOSIGNATURE LOCKED'}
              {highestRarity === 'rare' && '🔷 RARE SPECIMEN DETECTED'}
              {(highestRarity === 'common' || highestRarity === 'uncommon') && '📡 BIOMASS DETECTED'}
            </div>
          </div>

          <p className="text-white text-base mt-6 font-bold tracking-wide">
            {highestRarity === 'legendary' && 'Seismic water displacement! A primordial titan approaches...'}
            {highestRarity === 'epic' && 'Unusual bioluminescent frequencies radiating from the rift!'}
            {highestRarity === 'rare' && 'Target locked on high-speed aquatic movement.'}
            {(highestRarity === 'common' || highestRarity === 'uncommon') && 'Specimens enclosed in collection pods.'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. POD REVEAL STATE (Bio-Containment Pods) */}
      {/* ========================================================================= */}
      {diveState === 'pod_reveal' && pullResults && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center my-6 animate-in fade-in duration-200">
          
          {/* Top Bar: Progress & Skip Button */}
          <div className="w-full max-w-lg flex items-center justify-between mb-6 px-2">
            <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 rounded-full">
              Specimen {currentPodIndex + 1} of {pullResults.length}
            </span>
            <button
              onClick={handleSkipToSummary}
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Reveal All / Skip</span>
            </button>
          </div>

          {/* Current Pod or Revealed Card */}
          {(() => {
            const currentFish = pullResults[currentPodIndex];
            if (!currentFish) return null;
            const style = RARITY_STYLES[currentFish.rarity] || RARITY_STYLES.common;
            const isHighRarity = currentFish.rarity === 'epic' || currentFish.rarity === 'legendary';

            return (
              <div className="flex flex-col items-center">
                {!isPodOpened ? (
                  /* Sealed Pressurized Canister */
                  <div
                    onClick={handleUnsealCurrentPod}
                    className={`relative w-64 h-80 md:w-72 md:h-96 rounded-3xl border-4 cursor-pointer select-none transition-all duration-300 flex flex-col items-center justify-between p-6 shadow-2xl ${
                      isSuspensePeak
                        ? 'border-amber-400 bg-amber-950/70 scale-105 animate-bounce shadow-[0_0_60px_rgba(245,158,11,0.6)]'
                        : isPodUnsealing
                          ? 'border-cyan-400 bg-cyan-950/50 scale-95 shadow-cyan-500/40'
                          : 'border-slate-600 bg-gradient-to-b from-slate-800 to-slate-950 hover:border-cyan-400 hover:scale-[1.02] shadow-slate-900/60'
                    }`}
                  >
                    {/* Top Valve & Pressure Cap */}
                    <div className="w-full flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-[10px] font-mono text-cyan-400 tracking-wider">CONTAINMENT POD</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${isPodUnsealing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
                    </div>

                    {/* Viewport with Silhouette */}
                    <div className="relative w-36 h-36 rounded-full border-4 border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shadow-inner">
                      {isSuspensePeak ? (
                        <div className="flex flex-col items-center justify-center">
                          <Eye className={`w-12 h-12 animate-pulse ${currentFish.rarity === 'legendary' ? 'text-amber-400' : 'text-purple-400'}`} />
                          <span className="text-[10px] font-mono text-amber-300 mt-1 uppercase font-bold">BIO-LOCK STRAIN</span>
                        </div>
                      ) : (
                        <div className="text-3xl opacity-60 filter blur-[1px] animate-pulse">
                          🐟
                        </div>
                      )}

                      {/* Bubbles stream during unsealing */}
                      {isPodUnsealing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-xl animate-bounce">🫧</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Prompt Button */}
                    <div className="w-full text-center">
                      <button
                        className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md ${
                          isPodUnsealing
                            ? 'bg-amber-500 text-slate-950 animate-pulse'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                        }`}
                      >
                        {isPodUnsealing ? 'Venting Pressure...' : 'Click to Unseal'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Revealed Specimen Card */
                  <div className={`relative w-72 md:w-80 p-6 rounded-3xl border-2 ${style.border} ${style.bg} ${style.glow} shadow-2xl flex flex-col items-center text-center animate-in zoom-in-90 duration-300`}>
                    {currentFish.is_new_discovery && (
                      <span className="absolute -top-3 -right-3 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg animate-bounce">
                        NEW DISCOVERY!
                      </span>
                    )}

                    {/* Gradient Fish Thumbnail */}
                    <div
                      className="w-24 h-24 rounded-2xl flex items-center justify-center mb-4 border border-white/20 shadow-xl"
                      style={{
                        background: `linear-gradient(135deg, ${currentFish.visual_traits?.primary_color || '#00d2ff'}, ${currentFish.visual_traits?.secondary_color || '#3a7bd5'})`
                      }}
                    >
                      <span className="text-4xl select-none">🐟</span>
                    </div>

                    <h3 className="text-lg font-black text-white tracking-tight">{currentFish.name}</h3>
                    
                    <span className={`text-xs font-mono font-black uppercase mt-1 px-3 py-0.5 rounded-full ${style.badge}`}>
                      {currentFish.rarity}
                    </span>

                    <p className="text-xs text-slate-300 mt-3 leading-relaxed max-w-xs">
                      {currentFish.description}
                    </p>

                    <div className="w-full pt-3 mt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{currentFish.depth_zone} Zone</span>
                      <span className="font-mono text-cyan-300">Cataloged</span>
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={handleNextPod}
                      className="w-full mt-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all"
                    >
                      {currentPodIndex + 1 < pullResults.length ? 'Next Specimen ➔' : 'View Expedition Manifest ➔'}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUMMARY EXPEDITION MANIFEST STATE */}
      {/* ========================================================================= */}
      {diveState === 'summary' && pullResults && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center my-6 animate-in fade-in duration-200">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span>Expedition Research Manifest</span>
          </h2>
          
          {extraFlakes > 0 && (
            <p className="text-xs text-amber-300 mb-4 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
              +{extraFlakes} Food Flakes converted from duplicate marine essence
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 max-h-[420px] overflow-y-auto p-2 w-full max-w-4xl">
            {pullResults.map((fish, i) => {
              const style = RARITY_STYLES[fish.rarity] || RARITY_STYLES.common;
              return (
                <div
                  key={i}
                  className={`relative p-3 rounded-2xl border-2 ${style.border} ${style.bg} shadow-lg ${style.glow} flex flex-col items-center text-center transform hover:scale-105 transition-all duration-200`}
                >
                  {fish.is_new_discovery && (
                    <span className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md">
                      NEW!
                    </span>
                  )}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-2 border border-white/20"
                    style={{
                      background: `linear-gradient(135deg, ${fish.visual_traits?.primary_color || '#00d2ff'}, ${fish.visual_traits?.secondary_color || '#3a7bd5'})`
                    }}
                  >
                    <span className="text-2xl select-none">🐟</span>
                  </div>
                  <h4 className="font-bold text-xs text-white line-clamp-1">{fish.name}</h4>
                  <span className={`text-[9px] font-mono uppercase mt-1 font-bold ${style.badge}`}>
                    {fish.rarity}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleStartDive(pullResults.length === 10 ? 10 : 1)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all"
            >
              Dive Again ({pullResults.length === 10 ? '10 🎟️' : '1 🎟️'})
            </button>
            <button
              onClick={() => {
                setPullResults(null);
                setDiveState('idle');
              }}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all"
            >
              Close Manifest
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. IDLE STATE (Bridge Control View) */}
      {/* ========================================================================= */}
      {diveState === 'idle' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-6 animate-in fade-in duration-150">
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
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-white shadow-lg transition-all"
            >
              Single Dive (1 🎟️)
            </button>
            <button
              onClick={() => handleStartDive(10)}
              disabled={ecosystem.tickets < 10}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
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
