import * as THREE from 'three';
import { SceneEnvironment } from './SceneEnvironment';
import { CartoonFishFactory } from './CartoonFishFactory';
import { FishBoidsSystem, BoidFish } from './FishBoidsSystem';
import { SubmarineDirector, ObservedFishData } from './SubmarineDirector';
import { CameraDirector, CameraMode } from './CameraDirector';
import { FeedingPhysics, FeedEvent } from './FeedingPhysics';
import { FoliageSystem } from './FoliageSystem';
import { BubbleSystem } from './BubbleSystem';
import { UserFish } from '../../../types';

export type OceanariumMode = 'STANDARD_VIEW' | 'DESKTOP_MODE' | 'INSPECTING_FISH';

export interface DirectorCallbacks {
  onFishSelected?: (fish: UserFish) => void;
  onFeedSuccess?: (event: FeedEvent) => void;
  onObservationStart?: (fish: ObservedFishData) => void;
  onObservationEnd?: () => void;
  onModeChanged?: (mode: OceanariumMode) => void;
}

/**
 * Main ThreeGameDirector Orchestrator managing simulation loops, 3D systems, modes, and event dispatch.
 */
export class ThreeGameDirector {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Subsystems
  public environment: SceneEnvironment;
  public foliageSystem: FoliageSystem;
  public bubbleSystem: BubbleSystem;
  public fishFactory: CartoonFishFactory;
  public boidsSystem: FishBoidsSystem;
  public submarineDirector: SubmarineDirector;
  public cameraDirector: CameraDirector;
  public feedingPhysics: FeedingPhysics;

  // State
  private mode: OceanariumMode = 'STANDARD_VIEW';
  private rawFishes: UserFish[] = [];
  private observedFish: ObservedFishData | null = null;
  private animFrameId: number = 0;
  private clock: THREE.Clock = new THREE.Clock();
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  // Callbacks
  public callbacks: DirectorCallbacks = {};

  constructor(canvas: HTMLCanvasElement, callbacks: DirectorCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 300);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 3. Initialize Subsystems
    this.environment = new SceneEnvironment(this.scene);
    this.foliageSystem = new FoliageSystem(this.scene);
    this.bubbleSystem = new BubbleSystem(this.scene);
    this.fishFactory = new CartoonFishFactory();
    this.boidsSystem = new FishBoidsSystem(this.scene);
    this.submarineDirector = new SubmarineDirector(this.scene);
    this.cameraDirector = new CameraDirector(this.camera);
    this.feedingPhysics = new FeedingPhysics(this.scene);

    // 4. Hook up Submarine Observation Callbacks
    this.submarineDirector.onObservationStart = (fish) => {
      this.observedFish = fish;
      if (this.callbacks.onObservationStart) {
        this.callbacks.onObservationStart(fish);
      }
    };

    this.submarineDirector.onObservationEnd = () => {
      this.observedFish = null;
      if (this.callbacks.onObservationEnd) {
        this.callbacks.onObservationEnd();
      }
    };

    // 5. Start Game Loop
    this.startLoop();
  }

  public resetCameraView(duration = 1.0): void {
    this.cameraDirector.resetToIsometric(duration);
  }

  public getMode(): OceanariumMode {
    return this.mode;
  }

  public setMode(mode: OceanariumMode): void {
    this.mode = mode;
    this.cameraDirector.setMode(mode);
    if (this.callbacks.onModeChanged) {
      this.callbacks.onModeChanged(mode);
    }
  }

  /**
   * Sync user fish instances with 3D boids
   */
  public syncFishes(userFishes: UserFish[]): void {
    this.rawFishes = userFishes;

    userFishes.forEach((fish) => {
      // Check if mesh already exists in boids
      const existing = this.boidsSystem.getAllFishes().find((b) => b.id === fish.user_fish_id);
      if (existing) {
        existing.status = fish.status;
        existing.isFavorite = Boolean(fish.is_favorite);
        return;
      }

      // Create new cute cartoon 3D fish mesh matching homepage pufferfish
      const isShiny = Boolean(fish.is_shiny);
      const mesh = this.fishFactory.createFishMesh(
        {
          id: fish.species_id,
          name: fish.name,
          depth_zone: fish.depth_zone,
          rarity: fish.rarity,
          primary_color: fish.visual_traits?.primary_color || '#00d2ff',
          secondary_color: fish.visual_traits?.secondary_color || '#3a7bd5',
          body_type: fish.visual_traits?.body_type || 'oval',
          scale: fish.visual_traits?.scale || 1.0,
          glow: Boolean(fish.visual_traits?.glow)
        },
        isShiny
      );

      // Store reference to raw data on userData
      mesh.userData.rawFish = fish;

      this.boidsSystem.addFish({
        user_fish_id: fish.user_fish_id,
        species_id: fish.species_id,
        depth_zone: fish.depth_zone,
        status: fish.status,
        is_favorite: Boolean(fish.is_favorite),
        mesh
      });
    });
  }

  /**
   * Update water turbidity based on quality gauge (0% to 100%)
   */
  public updateWaterQuality(quality: number): void {
    this.environment.updateWaterQuality(quality);
  }

  /**
   * Snap camera view to depth stratum
   */
  public snapToDepth(zone: 'sunlit' | 'twilight' | 'abyssal'): void {
    this.cameraDirector.snapToDepth(zone);
  }

  /**
   * Drop food flakes or super pellets in 3D
   */
  public feed(type: 'flake' | 'super_pellet'): void {
    // Drop food near the surface or camera viewing area
    const spawnX = (Math.random() - 0.5) * 16;
    const spawnZ = (Math.random() - 0.5) * 10;
    const spawnY = this.mode === 'STANDARD_VIEW' ? 24 : 12;

    this.feedingPhysics.dropFood(new THREE.Vector3(spawnX, spawnY, spawnZ), type);
  }

  /**
   * Handle pointer down for fish selection and camera orbit
   */
  public handlePointerDown(clientX: number, clientY: number, rect: DOMRect): boolean {
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.mouseVec.set(x, y);
    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    // Check intersection with active fishes
    const fishMeshes = this.boidsSystem.getAllFishes().map((b) => b.mesh);
    const intersects = this.raycaster.intersectObjects(fishMeshes, true);

    if (intersects.length > 0) {
      // Find top-level fish group
      let hitObj: THREE.Object3D | null = intersects[0].object;
      while (hitObj && !hitObj.userData.rawFish && hitObj.parent) {
        hitObj = hitObj.parent;
      }

      if (hitObj && hitObj.userData.rawFish) {
        const rawFish = hitObj.userData.rawFish as UserFish;
        this.cameraDirector.inspectFish(hitObj);
        if (this.callbacks.onFishSelected) {
          this.callbacks.onFishSelected(rawFish);
        }
        return true; // Clicked a fish
      }
    }

    // Otherwise initiate camera drag in standard view
    this.cameraDirector.onPointerDown(clientX, clientY);
    return false;
  }

  public handlePointerMove(clientX: number, clientY: number): void {
    this.cameraDirector.onPointerMove(clientX, clientY);
  }

  public handlePointerUp(): void {
    this.cameraDirector.onPointerUp();
  }

  public handleResize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Main 60fps Game Loop
   */
  private startLoop(): void {
    const tick = () => {
      const delta = Math.min(this.clock.getDelta(), 0.1);
      const time = this.clock.getElapsedTime();

      // 1. Update Environment
      this.environment.update(delta, time);

      // 2. Update Seabed Foliage and Dynamic Bubbles
      this.foliageSystem.update(delta, time);
      this.bubbleSystem.update(delta, time);

      // 3. Update Food Pellets
      this.feedingPhysics.update(delta);

      // 4. Update Boids Swimming & Food Chasing
      this.boidsSystem.update(delta, time, this.feedingPhysics.getPellets());

      // 5. Check Mouth Collisions and emit celebratory mouth bubble puffs
      const feedEvents = this.feedingPhysics.checkFishFeeding(this.boidsSystem.getAllFishes());
      if (feedEvents.length > 0) {
        feedEvents.forEach((ev) => {
          if (this.callbacks.onFeedSuccess) this.callbacks.onFeedSuccess(ev);
          const targetBoid = this.boidsSystem.getAllFishes().find((b) => b.id === ev.fishId);
          if (targetBoid && targetBoid.mesh) {
            this.bubbleSystem.emitFishMouthPuff(targetBoid.mesh.position, 4);
          }
        });
      }

      // 6. Update Submarine Navigation & Nature Doc Patrol
      this.submarineDirector.update(delta, time, this.boidsSystem.getAllFishes());

      // 7. Update Camera Director
      this.cameraDirector.update(delta, this.submarineDirector, this.observedFish);

      // 8. Render Scene
      this.renderer.render(this.scene, this.camera);

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Clean up all WebGL resources and animation frames
   */
  public dispose(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    this.environment.dispose();
    this.foliageSystem.dispose();
    this.bubbleSystem.dispose();
    this.boidsSystem.dispose();
    this.submarineDirector.dispose();
    this.feedingPhysics.dispose();
    this.renderer.dispose();
  }
}

export default ThreeGameDirector;
