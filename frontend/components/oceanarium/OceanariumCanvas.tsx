import React, { useEffect, useRef, useState } from 'react';
import { UserFish } from '../../types';
import {
  drawDepthBackground,
  drawFish,
  drawPellet,
  FoodPellet,
  Particle,
  RenderFishState
} from './canvasRenderer';

interface OceanariumCanvasProps {
  fishes: UserFish[];
  waterQuality: number;
  foodMode: 'none' | 'flake' | 'super_pellet';
  onFeed: (foodType: 'flake' | 'super_pellet') => void;
  onSelectFish?: (fish: UserFish) => void;
}

export const OceanariumCanvas: React.FC<OceanariumCanvasProps> = ({
  fishes,
  waterQuality,
  foodMode,
  onFeed,
  onSelectFish
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fishesStateRef = useRef<RenderFishState[]>([]);
  const pelletsRef = useRef<FoodPellet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const nextPelletId = useRef<number>(1);

  const [selectedFishTooltip, setSelectedFishTooltip] = useState<{
    fish: RenderFishState;
    x: number;
    y: number;
  } | null>(null);

  // Initialize or update fishes state
  useEffect(() => {
    const existingMap = new Map<number, RenderFishState>();
    fishesStateRef.current.forEach(f => existingMap.set(f.id, f));

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width / (window.devicePixelRatio || 1) : 800;
    const height = canvas ? canvas.height / (window.devicePixelRatio || 1) : 600;

    const updated: RenderFishState[] = fishes.map(fish => {
      const existing = existingMap.get(fish.user_fish_id);

      // Depth zone Y bounds
      let minY = 0.08 * height;
      let maxY = 0.35 * height;
      if (fish.depth_zone === 'twilight') {
        minY = 0.35 * height;
        maxY = 0.70 * height;
      } else if (fish.depth_zone === 'abyssal') {
        minY = 0.70 * height;
        maxY = 0.92 * height;
      }

      if (existing) {
        return {
          ...existing,
          status: fish.status,
          nickname: fish.nickname,
          is_favorite: fish.is_favorite
        };
      }

      const initialX = Math.random() * (width - 100) + 50;
      const initialY = Math.random() * (maxY - minY) + minY;

      return {
        id: fish.user_fish_id,
        species_id: fish.species_id,
        name: fish.name,
        nickname: fish.nickname,
        depth_zone: fish.depth_zone,
        rarity: fish.rarity,
        x: initialX,
        y: initialY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 0.8,
        targetX: Math.random() * (width - 100) + 50,
        targetY: Math.random() * (maxY - minY) + minY,
        scale: fish.visual_traits?.scale || 1.0,
        primary_color: fish.visual_traits?.primary_color || '#00d2ff',
        secondary_color: fish.visual_traits?.secondary_color || '#3a7bd5',
        glow: Boolean(fish.visual_traits?.glow),
        body_type: fish.visual_traits?.body_type || 'oval',
        tail_angle: 0,
        tail_speed: 1.0 + Math.random() * 0.5,
        status: fish.status,
        is_favorite: fish.is_favorite
      };
    });

    fishesStateRef.current = updated;
  }, [fishes]);

  // Main simulation & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();

    const render = (now: number) => {
      const time = now - startTime;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Draw Depth Background & Turbidity
      drawDepthBackground(ctx, width, height, time, waterQuality);

      // 2. Ambient Plankton & Bubble Particles
      if (particlesRef.current.length < 35 && Math.random() < 0.25) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: height + 10,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(0.5 + Math.random() * 0.9),
          radius: 1 + Math.random() * 2,
          alpha: 0.2 + Math.random() * 0.4,
          type: Math.random() < 0.7 ? 'bubble' : 'plankton'
        });
      }

      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = p.type === 'bubble' ? `rgba(255, 255, 255, ${p.alpha})` : `rgba(102, 252, 241, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        if (p.y < -10 || p.alpha <= 0) {
          particlesRef.current.splice(idx, 1);
        }
      });

      // 3. Update & Draw Food Pellets
      const activePellets = pelletsRef.current;
      for (let i = activePellets.length - 1; i >= 0; i--) {
        const pellet = activePellets[i];
        pellet.y += pellet.vy;
        pellet.wobble += 0.08;

        drawPellet(ctx, pellet);

        // Check floor collision
        if (pellet.y > height - 15) {
          activePellets.splice(i, 1);
        }
      }

      // 4. Update & Draw Fishes
      const fishesState = fishesStateRef.current;
      fishesState.forEach(fish => {
        let minY = 0.08 * height;
        let maxY = 0.35 * height;
        if (fish.depth_zone === 'twilight') {
          minY = 0.35 * height;
          maxY = 0.70 * height;
        } else if (fish.depth_zone === 'abyssal') {
          minY = 0.70 * height;
          maxY = 0.92 * height;
        }

        if (fish.status === 'dormant') {
          // Dormant fish sink and rest slowly
          const floorY = maxY;
          fish.y += (floorY - fish.y) * 0.02;
          fish.vx *= 0.95;
          fish.vy *= 0.95;
        } else {
          // Check for nearby food pellets to chase
          let nearestPellet: FoodPellet | null = null;
          let nearestDist = 250; // Detection radius

          for (let pIdx = activePellets.length - 1; pIdx >= 0; pIdx--) {
            const pellet = activePellets[pIdx];
            const dist = Math.hypot(pellet.x - fish.x, pellet.y - fish.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestPellet = pellet;
            }

            // Consumption collision
            if (dist < 28 * fish.scale) {
              activePellets.splice(pIdx, 1);
              if (navigator.vibrate) navigator.vibrate(20);
            }
          }

          if (nearestPellet) {
            // Chase food
            const angleToPellet = Math.atan2(nearestPellet.y - fish.y, nearestPellet.x - fish.x);
            fish.vx += Math.cos(angleToPellet) * 0.15;
            fish.vy += Math.sin(angleToPellet) * 0.15;
          } else {
            // Natural autonomous waypoint steering
            const distToTarget = Math.hypot(fish.targetX - fish.x, fish.targetY - fish.y);
            if (distToTarget < 30 || Math.random() < 0.005) {
              fish.targetX = Math.random() * (width - 120) + 60;
              fish.targetY = Math.random() * (maxY - minY) + minY;
            }

            const steerAngle = Math.atan2(fish.targetY - fish.y, fish.targetX - fish.x);
            const speed = (waterQuality < 40 ? 0.03 : 0.06) * (fish.is_favorite ? 1.2 : 1.0);
            fish.vx += Math.cos(steerAngle) * speed;
            fish.vy += Math.sin(steerAngle) * speed;
          }

          // Damping & speed limits
          const maxSpeed = nearestPellet ? 2.5 : (waterQuality < 40 ? 0.9 : 1.6);
          const currentSpeed = Math.hypot(fish.vx, fish.vy);
          if (currentSpeed > maxSpeed) {
            fish.vx = (fish.vx / currentSpeed) * maxSpeed;
            fish.vy = (fish.vy / currentSpeed) * maxSpeed;
          }

          fish.x += fish.vx;
          fish.y += fish.vy;

          // Stay within depth zone and canvas bounds
          if (fish.x < 30) { fish.x = 30; fish.vx *= -1; }
          if (fish.x > width - 30) { fish.x = width - 30; fish.vx *= -1; }
          if (fish.y < minY) { fish.y = minY; fish.vy *= -1; }
          if (fish.y > maxY) { fish.y = maxY; fish.vy *= -1; }
        }

        drawFish(ctx, fish, time);
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [waterQuality]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Click / Tap on Canvas
  const handleInteraction = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Check if clicked a fish
    const clickedFish = fishesStateRef.current.find(f => Math.hypot(f.x - x, f.y - y) < 32 * f.scale);
    if (clickedFish) {
      setSelectedFishTooltip({ fish: clickedFish, x, y });
      const rawFish = fishes.find(f => f.user_fish_id === clickedFish.id);
      if (rawFish && onSelectFish) {
        onSelectFish(rawFish);
      }
      return;
    } else {
      setSelectedFishTooltip(null);
    }

    // Drop food if foodMode is active
    if (foodMode === 'flake' || foodMode === 'super_pellet') {
      pelletsRef.current.push({
        id: nextPelletId.current++,
        x: Math.max(30, Math.min(canvas.width / (window.devicePixelRatio || 1) - 30, x)),
        y: Math.min(y, 40),
        vy: 1.2 + Math.random() * 0.6,
        type: foodMode,
        wobble: 0
      });

      if (navigator.vibrate) navigator.vibrate(15);
      onFeed(foodMode);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[650px] md:h-[750px] rounded-2xl overflow-hidden shadow-2xl border border-sky-900/40 bg-slate-950 select-none"
      style={{ touchAction: 'none' }}
      onClick={(e) => handleInteraction(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Depth Markers Overlay (Left edge) */}
      <div className="absolute left-3 top-0 bottom-0 pointer-events-none flex flex-col justify-between py-4 text-[10px] font-mono tracking-widest text-sky-200/50 uppercase">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Sunlit Reef (0m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span>Twilight Zone (500m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
          <span>Abyssal Trench (2500m)</span>
        </div>
      </div>

      {/* Selected Fish Tooltip */}
      {selectedFishTooltip && (
        <div
          className="absolute z-20 bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 text-white rounded-xl p-3 shadow-xl pointer-events-auto transform -translate-x-1/2 -translate-y-full mb-4 max-w-xs animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${Math.max(120, Math.min(containerRef.current ? containerRef.current.clientWidth - 120 : 300, selectedFishTooltip.x))}px`,
            top: `${selectedFishTooltip.y - 10}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-sm text-cyan-300">
              {selectedFishTooltip.fish.nickname || selectedFishTooltip.fish.name}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-600/40 text-sky-300">
              {selectedFishTooltip.fish.rarity}
            </span>
          </div>
          <div className="text-xs text-slate-300 mb-2">
            Zone: <span className="capitalize text-sky-400">{selectedFishTooltip.fish.depth_zone}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Status: {selectedFishTooltip.fish.status === 'active' ? '🟢 Swimming' : '💤 Dormant'}</span>
            {selectedFishTooltip.fish.is_favorite ? <span className="text-amber-400">★ Favorite</span> : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default OceanariumCanvas;
