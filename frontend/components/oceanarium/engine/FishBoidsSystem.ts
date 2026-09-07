import * as THREE from 'three';

export interface BoidFish {
  id: number;
  speciesId: string;
  depthZone: string;
  status: string;
  isFavorite: boolean;
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  targetChangeTimer: number;
  scale: number;
}

export interface FoodItem {
  id: number;
  type: 'flake' | 'super_pellet';
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

/**
 * 3D Boids simulation for cartoon fish swimming across depth zones with food attraction.
 */
export class FishBoidsSystem {
  private scene: THREE.Scene;
  private fishes: Map<number, BoidFish> = new Map();

  // Symmetrical 1:1:1 Cube Bounds
  public readonly boundsX = 18;
  public readonly boundsZ = 18;
  public readonly zoneY: Record<string, { min: number; max: number }> = {
    sunlit: { min: 6, max: 18 },
    twilight: { min: -6, max: 6 },
    abyssal: { min: -18, max: -6 }
  };

  public isDesktopMode: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public setDesktopMode(enabled: boolean): void {
    this.isDesktopMode = enabled;
  }

  /**
   * Add or update a fish in the simulation
   */
  public addFish(data: {
    user_fish_id: number;
    species_id: string;
    depth_zone: string;
    status?: string;
    is_favorite?: boolean;
    mesh: THREE.Group;
  }): void {
    const existing = this.fishes.get(data.user_fish_id);
    if (existing) {
      existing.status = data.status || 'active';
      existing.isFavorite = Boolean(data.is_favorite);
      return;
    }

    const zone = this.zoneY[data.depth_zone] || this.zoneY.sunlit;
    const initialPos = new THREE.Vector3(
      (Math.random() - 0.5) * (this.boundsX * 1.5),
      Math.random() * (zone.max - zone.min) + zone.min,
      (Math.random() - 0.5) * (this.boundsZ * 1.5)
    );

    data.mesh.position.copy(initialPos);
    this.scene.add(data.mesh);

    const boid: BoidFish = {
      id: data.user_fish_id,
      speciesId: data.species_id,
      depthZone: data.depth_zone,
      status: data.status || 'active',
      isFavorite: Boolean(data.is_favorite),
      mesh: data.mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 2.0
      ),
      target: new THREE.Vector3(
        (Math.random() - 0.5) * this.boundsX,
        Math.random() * (zone.max - zone.min) + zone.min,
        (Math.random() - 0.5) * this.boundsZ
      ),
      targetChangeTimer: 3.0 + Math.random() * 4.0,
      scale: data.mesh.scale.x || 1.0
    };

    this.fishes.set(data.user_fish_id, boid);
  }

  /**
   * Remove fish from simulation and scene
   */
  public removeFish(fishId: number): void {
    const boid = this.fishes.get(fishId);
    if (boid) {
      this.scene.remove(boid.mesh);
      this.fishes.delete(fishId);
    }
  }

  /**
   * Get all boids
   */
  public getAllFishes(): BoidFish[] {
    return Array.from(this.fishes.values());
  }

  /**
   * Main simulation tick
   */
  public update(delta: number, time: number, foodPellets: FoodItem[] = [], focusOrigin?: THREE.Vector3): void {
    const targetQuat = new THREE.Quaternion();

    this.fishes.forEach((boid) => {
      const mesh = boid.mesh;
      const zone = this.zoneY[boid.depthZone] || this.zoneY.sunlit;
      const isDormant = boid.status === 'dormant';

      if (isDormant) {
        // Dormant fish sink and slowly float near bottom of their depth zone
        const restY = zone.min + 0.5;
        mesh.position.y += (restY - mesh.position.y) * 0.02;
        mesh.position.x += Math.sin(time + boid.id) * 0.005;
        boid.velocity.multiplyScalar(0.95);

        // Very slow gentle tail drift
        if (mesh.userData.tailPivot) {
          mesh.userData.tailPivot.rotation.y = Math.sin(time * 0.8 + boid.id) * 0.15;
        }
        return;
      }

      // Check if food pellet is nearby to chase
      let chasingFood: FoodItem | null = null;
      let nearestDist = 18.0;

      for (const pellet of foodPellets) {
        const d = mesh.position.distanceTo(pellet.mesh.position);
        if (d < nearestDist) {
          nearestDist = d;
          chasingFood = pellet;
        }
      }

      if (chasingFood) {
        // Steer toward food
        const dirToFood = new THREE.Vector3().subVectors(chasingFood.mesh.position, mesh.position).normalize();
        boid.velocity.lerp(dirToFood.multiplyScalar(3.8), 0.15);
      } else {
        // Autonomous waypoint patrolling
        boid.targetChangeTimer -= delta;
        const distToTarget = mesh.position.distanceTo(boid.target);

        if (boid.targetChangeTimer <= 0 || distToTarget < 3.0) {
          const ox = this.isDesktopMode && focusOrigin ? focusOrigin.x : 0;
          const oz = this.isDesktopMode && focusOrigin ? focusOrigin.z : 0;
          const rx = this.isDesktopMode ? 32 : this.boundsX * 1.8;
          const rz = this.isDesktopMode ? 32 : this.boundsZ * 1.8;

          boid.target.set(
            ox + (Math.random() - 0.5) * rx,
            Math.random() * (zone.max - zone.min) + zone.min,
            oz + (Math.random() - 0.5) * rz
          );
          boid.targetChangeTimer = 4.0 + Math.random() * 5.0;
        }

        const steerDir = new THREE.Vector3().subVectors(boid.target, mesh.position).normalize();
        const baseSpeed = boid.isFavorite ? 2.6 : 2.0;
        boid.velocity.lerp(steerDir.multiplyScalar(baseSpeed), 0.05);
      }

      // Depth and boundaries repulsion (adapts to infinite world in desktop mode)
      if (this.isDesktopMode && focusOrigin) {
        const dX = mesh.position.x - focusOrigin.x;
        const dZ = mesh.position.z - focusOrigin.z;
        if (dX < -28) boid.velocity.x += 1.8;
        if (dX > 28) boid.velocity.x -= 1.8;
        if (dZ < -28) boid.velocity.z += 1.8;
        if (dZ > 28) boid.velocity.z -= 1.8;
      } else {
        if (mesh.position.x < -this.boundsX) boid.velocity.x += 1.5;
        if (mesh.position.x > this.boundsX) boid.velocity.x -= 1.5;
        if (mesh.position.z < -this.boundsZ) boid.velocity.z += 1.5;
        if (mesh.position.z > this.boundsZ) boid.velocity.z -= 1.5;
      }
      if (mesh.position.y < zone.min) boid.velocity.y += 1.2;
      if (mesh.position.y > zone.max) boid.velocity.y -= 1.2;

      // Integrate position
      mesh.position.addScaledVector(boid.velocity, delta);

      // Smooth look-at orientation in direction of movement
      if (boid.velocity.lengthSq() > 0.01) {
        const lookTarget = mesh.position.clone().add(boid.velocity);
        const dummy = new THREE.Object3D();
        dummy.position.copy(mesh.position);
        dummy.lookAt(lookTarget);
        mesh.quaternion.slerp(dummy.quaternion, 0.12);
      }

      // Procedural swimming animations
      const swimSpeed = mesh.userData.swimSpeed || 1.0;
      const swimPhase = mesh.userData.swimPhase || 0;
      const speedMagnitude = boid.velocity.length();

      // Tail sweep (faster when swimming faster)
      if (mesh.userData.tailPivot) {
        mesh.userData.tailPivot.rotation.y = Math.sin(time * 4.5 * swimSpeed + swimPhase) * 0.42;
      }

      // Dorsal and Anal fin secondary sway
      if (mesh.userData.dorsalFin) {
        mesh.userData.dorsalFin.rotation.y = Math.sin(time * 4.5 * swimSpeed + swimPhase - 0.4) * 0.22;
      }
      if (mesh.userData.analFin) {
        mesh.userData.analFin.rotation.y = Math.sin(time * 4.5 * swimSpeed + swimPhase - 0.5) * 0.20;
      }

      // Animated mouth nibbling
      if (mesh.userData.jawPivot) {
        mesh.userData.jawPivot.rotation.x = Math.max(0, Math.sin(time * 5.0 * swimSpeed + swimPhase) * 0.16);
      }

      // Pectoral fin flutter
      if (mesh.userData.leftFin && mesh.userData.rightFin) {
        const finWobble = Math.sin(time * 6.0 * swimSpeed + swimPhase) * 0.25;
        mesh.userData.leftFin.rotation.z = finWobble;
        mesh.userData.rightFin.rotation.z = -finWobble;
      }

      // Shiny particle aura rotation & pulse
      if (mesh.userData.sparkleEmitter) {
        mesh.userData.sparkleEmitter.rotation.y += delta * 1.5;
        const pulse = 1.0 + Math.sin(time * 3.0) * 0.15;
        mesh.userData.sparkleEmitter.scale.set(pulse, pulse, pulse);
      }
    });
  }

  public dispose(): void {
    this.fishes.forEach((boid) => {
      this.scene.remove(boid.mesh);
    });
    this.fishes.clear();
  }
}

export default FishBoidsSystem;
