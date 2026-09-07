import React, { useEffect, useRef, useState } from 'react';
import { UserFish } from '../../types';
import { ThreeGameDirector, OceanariumMode } from './engine/ThreeGameDirector';
import { ObservedFishData } from './engine/SubmarineDirector';
import { Maximize2, Minimize2, Sparkles, Compass, Eye, X, RotateCcw } from 'lucide-react';

interface OceanariumCanvasProps {
  fishes: UserFish[];
  waterQuality: number;
  foodMode: 'none' | 'flake' | 'super_pellet';
  onFeed: (foodType: 'flake' | 'super_pellet') => void;
  onSelectFish?: (fish: UserFish) => void;
  isDesktopMode?: boolean;
  onToggleDesktopMode?: (enable: boolean) => void;
}

export const OceanariumCanvas: React.FC<OceanariumCanvasProps> = ({
  fishes,
  waterQuality,
  foodMode,
  onFeed,
  onSelectFish,
  isDesktopMode: externalDesktopMode,
  onToggleDesktopMode
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const directorRef = useRef<ThreeGameDirector | null>(null);

  const [internalDesktopMode, setInternalDesktopMode] = useState(false);
  const isDesktopMode = externalDesktopMode !== undefined ? externalDesktopMode : internalDesktopMode;

  const [selectedFish, setSelectedFish] = useState<UserFish | null>(null);
  const [observedFish, setObservedFish] = useState<ObservedFishData | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeZone, setActiveZone] = useState<'sunlit' | 'twilight' | 'abyssal'>('sunlit');

  // Initialize ThreeGameDirector
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const director = new ThreeGameDirector(canvas, {
      onFishSelected: (fish) => {
        setSelectedFish(fish);
        if (onSelectFish) onSelectFish(fish);
      },
      onObservationStart: (fishData) => {
        setObservedFish(fishData);
      },
      onObservationEnd: () => {
        setObservedFish(null);
      },
      onFeedSuccess: () => {
        // Celebratory feedback
        if (navigator.vibrate) navigator.vibrate(25);
      }
    });

    directorRef.current = director;
    director.syncFishes(fishes);
    director.updateWaterQuality(waterQuality);

    return () => {
      director.dispose();
      directorRef.current = null;
    };
  }, []);

  // Sync fishes data updates
  useEffect(() => {
    if (directorRef.current) {
      directorRef.current.syncFishes(fishes);
    }
  }, [fishes]);

  // Sync water quality
  useEffect(() => {
    if (directorRef.current) {
      directorRef.current.updateWaterQuality(waterQuality);
    }
  }, [waterQuality]);

  // Sync Desktop Mode state
  useEffect(() => {
    const director = directorRef.current;
    if (!director) return;

    if (isDesktopMode) {
      director.setMode('DESKTOP_MODE');
      setSelectedFish(null);
    } else {
      director.setMode('STANDARD_VIEW');
      setObservedFish(null);
    }
  }, [isDesktopMode]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const director = directorRef.current;
      if (!container || !director) return;

      const rect = container.getBoundingClientRect();
      director.handleResize(rect.width, rect.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDesktopMode]);

  const handleResetView = () => {
    if (directorRef.current) {
      directorRef.current.resetCameraView(1.0);
    }
  };

  // Keyboard navigation: ESC for Desktop Mode, R for Reset View
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDesktopMode) {
        handleSetDesktopMode(false);
      }
      if ((e.key === 'r' || e.key === 'R') && !isDesktopMode) {
        handleResetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktopMode]);

  // Auto-hide controls in Desktop Mode
  const handleMouseMove = () => {
    if (!isDesktopMode) return;
    setShowControls(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleSetDesktopMode = (enable: boolean) => {
    if (onToggleDesktopMode) {
      onToggleDesktopMode(enable);
    } else {
      setInternalDesktopMode(enable);
    }

    // Attempt Native Fullscreen if entering
    if (enable && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Depth snap trigger
  const handleDepthSnap = (zone: 'sunlit' | 'twilight' | 'abyssal') => {
    setActiveZone(zone);
    if (directorRef.current) {
      directorRef.current.snapToDepth(zone);
    }
  };

  // Canvas Interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    const director = directorRef.current;
    const canvas = canvasRef.current;
    if (!director || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const hitFish = director.handlePointerDown(e.clientX, e.clientY, rect);

    // If no fish was hit and food mode is active, drop food in 3D
    if (!hitFish && (foodMode === 'flake' || foodMode === 'super_pellet') && !isDesktopMode) {
      director.feed(foodMode);
      onFeed(foodMode);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    handleMouseMove();
    if (directorRef.current) {
      directorRef.current.handlePointerMove(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    if (directorRef.current) {
      directorRef.current.handlePointerUp();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative select-none overflow-hidden transition-all duration-300 ${
        isDesktopMode
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950'
          : 'w-full h-[650px] md:h-[750px] rounded-3xl shadow-2xl border border-sky-900/40 bg-slate-950'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* STANDARD VIEW: Depth Markers & Quick Jump Pills (Left Edge) */}
      {!isDesktopMode && (
        <div className="absolute left-4 top-6 flex flex-col gap-2 z-10 pointer-events-auto">
          {(['sunlit', 'twilight', 'abyssal'] as const).map((zone) => {
            const labels = {
              sunlit: { name: 'Sunlit Reef', depth: '0m', color: 'bg-cyan-400', text: 'text-cyan-300' },
              twilight: { name: 'Twilight Zone', depth: '500m', color: 'bg-blue-500', text: 'text-blue-300' },
              abyssal: { name: 'Abyssal Trench', depth: '2500m', color: 'bg-purple-500', text: 'text-purple-300' }
            };
            const meta = labels[zone];
            const isActive = activeZone === zone;

            return (
              <button
                key={zone}
                onClick={() => handleDepthSnap(zone)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-all backdrop-blur-md border ${
                  isActive
                    ? 'bg-slate-900/90 border-cyan-400 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${meta.color} ${isActive ? 'animate-ping' : ''}`}></span>
                <span>{meta.name}</span>
                <span className="opacity-60">({meta.depth})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* STANDARD VIEW: Top-Right Glass Controls Dock with Rich Tooltips */}
      {!isDesktopMode && (
        <div className="absolute right-4 top-6 z-10 pointer-events-auto flex items-center gap-2.5">
          {/* Reset View Button */}
          <div className="relative group">
            <button
              onClick={handleResetView}
              className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 shadow-lg shadow-cyan-950/40 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
              aria-label="Reset View"
            >
              <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-90 duration-300" />
            </button>

            {/* Tooltip Card */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-56 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl pointer-events-none z-30 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">Reset View</span>
                <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-[10px] font-mono text-cyan-300">R</kbd>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Smoothly re-aligns camera to the default 2.5D isometric diorama angle.
              </p>
            </div>
          </div>

          {/* Desktop Mode Button */}
          <div className="relative group">
            <button
              onClick={() => handleSetDesktopMode(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/90 to-yellow-600/90 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs md:text-sm shadow-xl shadow-amber-500/20 backdrop-blur-md border border-amber-300/40 transition-all hover:scale-105 active:scale-95"
              aria-label="Desktop Mode"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Desktop Mode</span>
            </button>

            {/* Tooltip Card */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-60 p-3 rounded-2xl bg-slate-950/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl pointer-events-none z-30 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-300">Desktop Mode</span>
                <kbd className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/50 text-[10px] font-mono text-amber-200">ESC</kbd>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Ambient full-window immersion with autonomous nature-doc submarine patrol.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STANDARD VIEW: Bottom-Left Camera Navigation Hint Pill */}
      {!isDesktopMode && (
        <div className="absolute left-4 bottom-6 z-10 pointer-events-none hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-400">
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          <span>Drag to orbit • Scroll to zoom • Press <strong className="text-cyan-300">[R]</strong> to reset</span>
        </div>
      )}

      {/* DESKTOP MODE: Auto-hiding Ambient Top Bar */}
      {isDesktopMode && (
        <div
          className={`absolute top-6 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-500 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-900/90 backdrop-blur-xl border border-sky-600/40 rounded-full shadow-2xl text-xs text-white">
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="font-bold tracking-wider text-amber-300">SUBMERSIBLE PATROL ACTIVE</span>
              <span className="text-slate-400">• Press ESC to exit</span>
            </div>
            <button
              onClick={() => handleSetDesktopMode(false)}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP MODE: Nature Documentary Observation HUD Card */}
      {isDesktopMode && observedFish && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-6 duration-300 pointer-events-none">
          <div className="bg-slate-900/85 backdrop-blur-xl border border-cyan-400/50 rounded-2xl p-4 shadow-[0_0_35px_rgba(6,182,212,0.3)] text-white flex items-center gap-4 max-w-md min-w-[340px]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
              <Eye className="w-6 h-6 animate-pulse text-cyan-200" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                  Observing Specimen
                </span>
                {observedFish.isShiny && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    SHINY
                  </span>
                )}
              </div>
              <h3 className="font-bold text-sm text-white mt-0.5 capitalize">
                {observedFish.speciesId.replace(/_/g, ' ')}
              </h3>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                Zone: <span className="capitalize text-sky-300">{observedFish.depthZone}</span> • Depth ~
                {observedFish.depthZone === 'sunlit' ? '45m' : observedFish.depthZone === 'twilight' ? '650m' : '2200m'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STANDARD VIEW: Selected Fish Tooltip / Inspection Card */}
      {!isDesktopMode && selectedFish && (
        <div className="absolute right-4 bottom-6 z-20 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 text-white rounded-2xl p-4 shadow-2xl max-w-xs pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-cyan-300">
                {selectedFish.nickname || selectedFish.name}
              </span>
              {Boolean(selectedFish.is_shiny) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  SHINY
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedFish(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            {selectedFish.description}
          </p>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Depth: <strong className="text-sky-300 capitalize">{selectedFish.depth_zone}</strong></span>
            <span>Rarity: <strong className="text-amber-300 capitalize">{selectedFish.rarity}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OceanariumCanvas;
