import React, { useEffect, useRef, useState } from 'react';
import { UserFish } from '../../types';
import { ThreeGameDirector, OceanariumMode } from './engine/ThreeGameDirector';
import { ObservedFishData } from './engine/SubmarineDirector';
import { Maximize2, Minimize2, Sparkles, Compass, Eye, X, RotateCcw, ChevronUp, ChevronDown, ScanEye } from 'lucide-react';
import FishInfographicPanel from './FishInfographicPanel';

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
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const pointerDownRef = useRef<{ x: number; y: number; isDragging: boolean; isPan: boolean } | null>(null);

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

  const handleFrontView = () => {
    if (directorRef.current) {
      directorRef.current.snapToFrontView();
    }
  };

  // Keyboard navigation: ESC for Desktop Mode, R for Reset View, F for Front Glass View
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDesktopMode) {
        handleSetDesktopMode(false);
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
      ) {
        return;
      }
      if ((e.key === 'r' || e.key === 'R') && !isDesktopMode) {
        handleResetView();
      }
      if ((e.key === 'f' || e.key === 'F') && !isDesktopMode) {
        handleFrontView();
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

  // Roster & Specimen Cycling Helpers
  const handleSelectFishFromRoster = (fish: UserFish) => {
    if (directorRef.current) {
      const selected = directorRef.current.selectFishById(fish.user_fish_id);
      if (selected) {
        setSelectedFish(selected);
        return;
      }
    }
    setSelectedFish(fish);
    if (onSelectFish) onSelectFish(fish);
  };

  const selectedFishIndex = selectedFish
    ? Math.max(0, fishes.findIndex((f) => f.user_fish_id === selectedFish.user_fish_id))
    : 0;

  const handlePrevFish = () => {
    if (fishes.length === 0) return;
    const prevIdx = (selectedFishIndex - 1 + fishes.length) % fishes.length;
    handleSelectFishFromRoster(fishes[prevIdx]);
  };

  const handleNextFish = () => {
    if (fishes.length === 0) return;
    const nextIdx = (selectedFishIndex + 1) % fishes.length;
    handleSelectFishFromRoster(fishes[nextIdx]);
  };

  const handleBoopSelectedFish = () => {
    if (selectedFish && directorRef.current) {
      directorRef.current.boopFish(selectedFish.user_fish_id);
    }
  };

  // Canvas Interactions with < 5px click-vs-drag threshold
  const handlePointerDown = (e: React.PointerEvent) => {
    const director = directorRef.current;
    if (!director) return;

    const isPan = e.button === 2 || e.shiftKey;
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      isDragging: false,
      isPan
    };

    director.cameraDirector.onPointerDown(e.clientX, e.clientY, isPan);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    handleMouseMove();
    if (pointerDownRef.current) {
      const dist = Math.hypot(e.clientX - pointerDownRef.current.x, e.clientY - pointerDownRef.current.y);
      if (dist >= 5) {
        pointerDownRef.current.isDragging = true;
      }
    }
    if (directorRef.current && (!pointerDownRef.current || pointerDownRef.current.isDragging)) {
      directorRef.current.handlePointerMove(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const director = directorRef.current;
    const canvas = canvasRef.current;
    const pState = pointerDownRef.current;
    pointerDownRef.current = null;

    if (!director) return;
    director.handlePointerUp();

    if (pState && !pState.isDragging && canvas) {
      const rect = canvas.getBoundingClientRect();
      const hitFish = director.handlePointerDown(e.clientX, e.clientY, rect, pState.isPan);
      director.handlePointerUp();

      // If no fish was hit and food mode is active, drop food in 3D
      if (!hitFish && (foodMode === 'flake' || foodMode === 'super_pellet') && !isDesktopMode) {
        director.feed(foodMode);
        onFeed(foodMode);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative select-none overflow-hidden transition-all duration-300 ${
        isDesktopMode
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950'
          : 'w-full h-[70vh] min-h-[600px] max-h-[860px] rounded-3xl shadow-2xl border border-sky-900/40 bg-slate-950'
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
        onPointerLeave={() => {
          pointerDownRef.current = null;
          directorRef.current?.handlePointerUp();
        }}
        onPointerCancel={() => {
          pointerDownRef.current = null;
          directorRef.current?.handlePointerUp();
        }}
        onWheel={(e) => directorRef.current?.handleWheel(e.deltaY)}
        onContextMenu={(e) => e.preventDefault()}
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
          {/* Front Glass View Button */}
          <div className="relative group">
            <button
              onClick={handleFrontView}
              className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 shadow-lg shadow-cyan-950/40 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
              aria-label="Front Glass View"
            >
              <ScanEye className="w-4 h-4 transition-transform group-hover:scale-110 duration-300" />
            </button>

            {/* Tooltip Card */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-56 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl pointer-events-none z-30 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">Front Glass View</span>
                <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-[10px] font-mono text-cyan-300">F</kbd>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Snaps camera straight-on to the aquarium glass for side-profile inspection.
              </p>
            </div>
          </div>

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
        <div className="absolute left-4 bottom-6 z-10 pointer-events-none hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-400">
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          <span>
            Isometric View • Drag to orbit • Scroll to zoom • Click specimen to inspect •{' '}
            <strong className="text-cyan-300">[R]</strong> Iso • <strong className="text-cyan-300">[F]</strong> Front
          </span>
        </div>
      )}

      {/* STANDARD VIEW: Collapsible Tank Specimen Roster Bar (Bottom-Center) */}
      {!isDesktopMode && fishes.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center max-w-[92%] sm:max-w-xl">
          {isRosterOpen && (
            <div className="mb-2 w-full max-h-40 overflow-y-auto p-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-cyan-500/40 shadow-2xl flex flex-wrap items-center justify-center gap-1.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
              {fishes.map((fish) => {
                const isSelected = selectedFish?.user_fish_id === fish.user_fish_id;
                const displayName = fish.nickname || fish.name || fish.species_id.replace(/_/g, ' ');
                return (
                  <button
                    key={fish.user_fish_id}
                    onClick={() => handleSelectFishFromRoster(fish)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition-all border ${
                      isSelected
                        ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-md shadow-cyan-500/20 scale-105'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: fish.visual_traits?.primary_color || '#00d2ff' }}
                    />
                    <span className="truncate max-w-[120px] capitalize">{displayName}</span>
                    {Boolean(fish.is_shiny) && <Sparkles className="w-3 h-3 text-amber-300 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setIsRosterOpen((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 text-cyan-300 hover:text-white border border-cyan-500/40 shadow-xl backdrop-blur-md text-xs font-mono font-bold transition-all"
          >
            <span>Specimens in Tank ({fishes.length})</span>
            {isRosterOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
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

      {/* STANDARD VIEW: Selected Fish Scientific Infographic Drawer */}
      {!isDesktopMode && selectedFish && (
        <FishInfographicPanel
          fish={selectedFish}
          fishIndex={selectedFishIndex}
          currentIndex={selectedFishIndex}
          totalFishes={fishes.length}
          onPrevFish={handlePrevFish}
          onNextFish={handleNextFish}
          onBoopFish={handleBoopSelectedFish}
          onClose={() => {
            setSelectedFish(null);
            if (directorRef.current) {
              directorRef.current.detachReticle();
              directorRef.current.resetCameraView(0.8);
            }
          }}
          onFeedFish={(type) => {
            if (directorRef.current) {
              directorRef.current.feed(type);
            }
            onFeed(type);
          }}
        />
      )}
    </div>
  );
};

export default OceanariumCanvas;
