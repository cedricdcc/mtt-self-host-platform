import * as THREE from 'three';
import { FoodItem, BoidFish } from './FishBoidsSystem';

export interface FeedEvent {
  fishId: number;
  foodType: 'flake' | 'super_pellet';
}

/**
 * Manages 3D food pellets, downward sinking physics, and mouth collision consumption.
 */
export class FeedingPhysics {
  private scene: THREE.Scene;
  private pellets: FoodItem[] = [];
  private nextId: number = 1;
  private flakeGeo: THREE.BufferGeometry;
  private pelletGeo: THREE.BufferGeometry;
  private flakeMat: THREE.Material;
  private pelletMat: THREE.Material;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Shared geometries and materials
    this.flakeGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.06, 6);
    this.pelletGeo = new THREE.SphereGeometry(0.4, 12, 12);

    this.flakeMat = new THREE.MeshToonMaterial({
      color: 0xffbb33,
      emissive: 0x442200
    });

    this.pelletMat = new THREE.MeshToonMaterial({
      color: 0xc084fc,
      emissive: 0x6b21a8
    });
  }

  /**
   * Drop food at world position
   */
  public dropFood(position: THREE.Vector3, type: 'flake' | 'super_pellet'): FoodItem {
    const isFlake = type === 'flake';
    const mesh = new THREE.Mesh(
      isFlake ? this.flakeGeo : this.pelletGeo,
      isFlake ? this.flakeMat : this.pelletMat
    );

    mesh.position.copy(position);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    this.scene.add(mesh);

    const item: FoodItem = {
      id: this.nextId++,
      type,
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        -(1.2 + Math.random() * 0.8),
        (Math.random() - 0.5) * 0.4
      )
    };

    this.pellets.push(item);
    return item;
  }

  /**
   * Get active pellets
   */
  public getPellets(): FoodItem[] {
    return this.pellets;
  }

  /**
   * Update downward sinking with wobble physics
   */
  public update(delta: number): void {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Wobble rotation
      p.mesh.rotation.x += delta * 1.5;
      p.mesh.rotation.y += delta * 2.0;

      // Despawn if hit bottom floor
      if (p.mesh.position.y < -30) {
        this.scene.remove(p.mesh);
        this.pellets.splice(i, 1);
      }
    }
  }

  /**
   * Check collision between sinking pellets and fish mouths
   */
  public checkFishFeeding(fishes: BoidFish[]): FeedEvent[] {
    const events: FeedEvent[] = [];

    for (let pIdx = this.pellets.length - 1; pIdx >= 0; pIdx--) {
      const pellet = this.pellets[pIdx];

      for (const fish of fishes) {
        if (fish.status === 'dormant') continue;

        // Fish mouth is located near front (+Z in fish coordinate space)
        const mouthPos = fish.mesh.position.clone();
        const dist = mouthPos.distanceTo(pellet.mesh.position);
        const eatRadius = 1.8 * fish.scale;

        if (dist < eatRadius) {
          // Food consumed!
          events.push({
            fishId: fish.id,
            foodType: pellet.type
          });

          // Small pulse animation on fish
          fish.mesh.scale.multiplyScalar(1.15);
          setTimeout(() => {
            fish.mesh.scale.set(fish.scale, fish.scale, fish.scale);
          }, 200);

          this.scene.remove(pellet.mesh);
          this.pellets.splice(pIdx, 1);
          break;
        }
      }
    }

    return events;
  }

  public dispose(): void {
    this.pellets.forEach((p) => {
      this.scene.remove(p.mesh);
    });
    this.pellets = [];
    this.flakeGeo.dispose();
    this.pelletGeo.dispose();
  }
}

export default FeedingPhysics;
