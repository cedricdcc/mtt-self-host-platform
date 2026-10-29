import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GachaSpecies } from '../../types';
import { CartoonFishFactory, SpeciesData } from './engine/CartoonFishFactory';
import { FishBoidsSystem } from './engine/FishBoidsSystem';

export interface Species3DPreviewProps {
  species: GachaSpecies;
  isShiny?: boolean;
  interactive?: boolean;
  className?: string;
}

// Shared factory & offscreen snapshot cache so grid cards don't allocate multiple WebGL contexts
const snapshotCache: Map<string, string> = new Map();
let sharedFactory: CartoonFishFactory | null = null;
let sharedOffscreenRenderer: THREE.WebGLRenderer | null = null;

function getSharedFactory(): CartoonFishFactory {
  if (!sharedFactory) {
    sharedFactory = new CartoonFishFactory();
  }
  return sharedFactory;
}

function toSpeciesData(species: GachaSpecies): SpeciesData {
  return {
    id: species.id,
    name: species.name,
    depth_zone: species.depth_zone,
    rarity: species.rarity,
    primary_color: species.visual_traits?.primary_color || '#00d2ff',
    secondary_color: species.visual_traits?.secondary_color || '#3a7bd5',
    body_type: species.visual_traits?.body_type || 'oval',
    scale: 1.0,
    glow: Boolean(species.visual_traits?.glow),
    model_url: species.model_url || species.visual_traits?.model_url || null,
    visual_traits: {
      primary_color: species.visual_traits?.primary_color || '#00d2ff',
      secondary_color: species.visual_traits?.secondary_color || '#3a7bd5',
      body_type: species.visual_traits?.body_type || 'oval',
      scale: 1.0,
      glow: Boolean(species.visual_traits?.glow),
      model_url: species.model_url || species.visual_traits?.model_url || null
    }
  };
}

function setupStudioLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 1.15);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x1e1b4b, 0.95);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.85);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  rimLight.position.set(-5, 3, -4);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xfbbf24, 0.75, 16);
  fillLight.position.set(0, -4, 4);
  scene.add(fillLight);
}

function normalizeFishInTurntable(mesh: THREE.Group, turntable: THREE.Group): void {
  // Advance one pose frame before measuring bounds
  FishBoidsSystem.animateFishMesh(mesh, 0.85, 0.016, 1.0, 0);

  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetFit = 2.35;
  const fitScale = Math.min(1.35, Math.max(0.45, targetFit / maxDim));

  mesh.scale.set(fitScale, fitScale, fitScale);
  mesh.userData.baseScale = fitScale;
  mesh.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);
  turntable.add(mesh);
}

function renderSnapshotDataUrl(species: GachaSpecies, isShiny: boolean): string | null {
  const cacheKey = `${species.id}_${Boolean(isShiny)}`;
  if (snapshotCache.has(cacheKey)) {
    return snapshotCache.get(cacheKey)!;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  try {
    if (!sharedOffscreenRenderer) {
      sharedOffscreenRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      sharedOffscreenRenderer.setSize(256, 256, false);
      sharedOffscreenRenderer.setPixelRatio(1);
      sharedOffscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      sharedOffscreenRenderer.toneMappingExposure = 1.15;
    }

    const scene = new THREE.Scene();
    setupStudioLighting(scene);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    camera.position.set(0, 0.25, 3.8);
    camera.lookAt(0, 0, 0);

    const factory = getSharedFactory();
    const fishMesh = factory.createFishMesh(toSpeciesData(species), Boolean(isShiny));

    const turntable = new THREE.Group();
    turntable.rotation.y = Math.PI * 0.36;
    turntable.rotation.x = 0.06;
    normalizeFishInTurntable(fishMesh, turntable);
    scene.add(turntable);

    sharedOffscreenRenderer.setClearColor(0x000000, 0);
    sharedOffscreenRenderer.clear();
    sharedOffscreenRenderer.render(scene, camera);

    const dataUrl = sharedOffscreenRenderer.domElement.toDataURL('image/png');
    if (dataUrl && dataUrl.startsWith('data:image')) {
      snapshotCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  } catch (err) {
    console.warn('[Species3DPreview] Snapshot render fallback:', err);
  }

  return null;
}

export const Species3DPreview: React.FC<Species3DPreviewProps> = ({
  species,
  isShiny = false,
  interactive = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    reactionTimer: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    yaw: Math.PI * 0.36,
    pitch: 0.08,
    reactionTimer: 0
  });

  // Non-interactive 256x256 snapshot mode
  useEffect(() => {
    if (interactive) return;
    const url = renderSnapshotDataUrl(species, Boolean(isShiny));
    setSnapshotUrl(url);
  }, [species, isShiny, interactive]);

  // Interactive 60 FPS turntable WebGL mode
  useEffect(() => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animId = 0;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      console.warn('[Species3DPreview] Interactive WebGL fallback:', err);
      return;
    }

    const width = canvas.clientWidth || 160;
    const height = canvas.clientHeight || 160;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    setupStudioLighting(scene);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 0.25, 3.85);
    camera.lookAt(0, 0, 0);

    const factory = getSharedFactory();
    const fishMesh = factory.createFishMesh(toSpeciesData(species), Boolean(isShiny));
    const turntable = new THREE.Group();
    normalizeFishInTurntable(fishMesh, turntable);
    scene.add(turntable);

    dragStateRef.current.yaw = Math.PI * 0.36;
    dragStateRef.current.pitch = 0.08;
    dragStateRef.current.reactionTimer = 0;

    const clock = new THREE.Clock();

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const state = dragStateRef.current;

      if (!state.isDragging) {
        state.yaw += delta * 0.45;
      }

      if (state.reactionTimer > 0) {
        state.reactionTimer = Math.max(0, state.reactionTimer - delta);
      }

      turntable.rotation.y = state.yaw;
      turntable.rotation.x = state.pitch;

      FishBoidsSystem.animateFishMesh(fishMesh, elapsed, delta, 1.0, state.reactionTimer);

      renderer!.render(scene, camera);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      renderer?.dispose();
    };
  }, [species, isShiny, interactive]);

  if (!interactive) {
    if (snapshotUrl) {
      return (
        <img
          src={snapshotUrl}
          alt={species.name}
          className={`w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] ${className}`}
        />
      );
    }
    return (
      <div className={`w-full h-full flex items-center justify-center text-2xl select-none ${className}`}>
        🐟
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block cursor-grab active:cursor-grabbing touch-none ${className}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragStateRef.current.isDragging = true;
        dragStateRef.current.startX = e.clientX;
        dragStateRef.current.startY = e.clientY;
        dragStateRef.current.lastX = e.clientX;
        dragStateRef.current.lastY = e.clientY;
      }}
      onPointerMove={(e) => {
        if (!dragStateRef.current.isDragging) return;
        e.stopPropagation();
        const dx = e.clientX - dragStateRef.current.lastX;
        const dy = e.clientY - dragStateRef.current.lastY;
        dragStateRef.current.lastX = e.clientX;
        dragStateRef.current.lastY = e.clientY;
        dragStateRef.current.yaw += dx * 0.014;
        dragStateRef.current.pitch = Math.max(
          -0.65,
          Math.min(0.65, dragStateRef.current.pitch + dy * 0.01)
        );
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const dist = Math.hypot(
          e.clientX - dragStateRef.current.startX,
          e.clientY - dragStateRef.current.startY
        );
        dragStateRef.current.isDragging = false;
        if (dist < 5) {
          dragStateRef.current.reactionTimer = 2.5;
        }
      }}
      onPointerLeave={() => {
        dragStateRef.current.isDragging = false;
      }}
    />
  );
};

export default Species3DPreview;
