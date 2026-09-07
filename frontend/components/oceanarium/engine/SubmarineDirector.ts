import * as THREE from 'three';
import { BoidFish } from './FishBoidsSystem';

export type SubmarineState = 'CRUISING' | 'APPROACHING_TARGET' | 'HOVERING_OBSERVATION';

export interface ObservedFishData {
  id: number;
  speciesId: string;
  name?: string;
  depthZone: string;
  rarity?: string;
  isShiny: boolean;
  position: THREE.Vector3;
}

/**
 * Autonomous Research Submarine & Nature Documentary Patrol Director.
 */
export class SubmarineDirector {
  private scene: THREE.Scene;
  public mesh: THREE.Group;
  public searchlight: THREE.SpotLight;
  private searchlightTarget: THREE.Object3D;
  private propellers: THREE.Object3D[] = [];
  private bubbleTrail: THREE.Points;
  private bubblePositions: Float32Array;
  private bubbleAlphas: Float32Array;
  private bubbleCount: number = 30;

  // AI & State Machine
  private state: SubmarineState = 'CRUISING';
  private velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 1.5);
  private currentWaypoint: THREE.Vector3 = new THREE.Vector3(0, 5, 0);
  private targetFish: BoidFish | null = null;
  private nextScanTimer: number = 18.0; // Seconds until next observation
  private hoverTimer: number = 0;

  // Callbacks
  public onObservationStart?: (fish: ObservedFishData) => void;
  public onObservationEnd?: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Build 3D Cartoon Submarine Mesh
    this.mesh = this.buildSubmarineMesh();
    this.mesh.position.set(0, 5, -8);
    this.scene.add(this.mesh);

    // 2. Setup Volumetric Searchlight
    this.searchlight = new THREE.SpotLight(0xffffff, 4.5, 30, Math.PI * 0.22, 0.45, 1.2);
    this.searchlight.position.set(0, 0.2, 2.0);
    this.searchlightTarget = new THREE.Object3D();
    this.searchlightTarget.position.set(0, -0.5, 15);
    this.mesh.add(this.searchlight);
    this.mesh.add(this.searchlightTarget);
    this.searchlight.target = this.searchlightTarget;

    // 3. Setup Propeller Bubble Trail
    this.bubbleTrail = this.initBubbleTrail();
    this.scene.add(this.bubbleTrail);
  }

  /**
   * Build classic cute yellow bathyscaphe mesh
   */
  public buildSubmarineMesh(): THREE.Group {
    const subGroup = new THREE.Group();
    subGroup.name = 'research_submarine';

    // Materials
    const yellowHullMat = new THREE.MeshToonMaterial({
      color: 0xffcb05, // Classic bright yellow
      roughness: 0.4
    });

    const redStripeMat = new THREE.MeshToonMaterial({
      color: 0xef4444
    });

    const darkMetalMat = new THREE.MeshToonMaterial({
      color: 0x22303c,
      roughness: 0.6
    });

    const glassDomeMat = new THREE.MeshPhysicalMaterial({
      color: 0x88e7ff,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      transmission: 0.8
    });

    // 1. Main Hull (Rounded Capsule / Bullet Shape)
    const hullGeo = new THREE.CapsuleGeometry(1.2, 2.4, 16, 24);
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, yellowHullMat);
    subGroup.add(hull);

    // 2. Red Marine Racing Stripe
    const stripeGeo = new THREE.CylinderGeometry(1.23, 1.23, 0.35, 24);
    stripeGeo.rotateX(Math.PI / 2);
    const stripe = new THREE.Mesh(stripeGeo, redStripeMat);
    stripe.position.set(0, 0, 0);
    subGroup.add(stripe);

    // 3. Glass Bubble Cockpit Dome (Front)
    const domeGeo = new THREE.SphereGeometry(0.85, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    domeGeo.rotateX(Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, glassDomeMat);
    dome.position.set(0, 0.1, 1.8);
    subGroup.add(dome);

    // Cockpit warm interior glow light
    const cockpitGlow = new THREE.PointLight(0xffea9f, 2.0, 4);
    cockpitGlow.position.set(0, 0.1, 1.4);
    subGroup.add(cockpitGlow);

    // 4. Top Conning Tower / Rescue Hatch
    const towerGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.7, 16);
    const tower = new THREE.Mesh(towerGeo, yellowHullMat);
    tower.position.set(0, 1.4, -0.2);
    subGroup.add(tower);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16), darkMetalMat);
    hatch.position.set(0, 1.8, -0.2);
    subGroup.add(hatch);

    // Periscope
    const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), darkMetalMat);
    periscope.position.set(0.15, 2.1, -0.1);
    subGroup.add(periscope);

    // 5. Dual Side/Rear Thrusters & Propellers
    [-0.9, 0.9].forEach((sideX) => {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 12), darkMetalMat);
      nacelle.rotateX(Math.PI / 2);
      nacelle.position.set(sideX, -0.2, -1.6);
      subGroup.add(nacelle);

      // Spinning propeller
      const propPivot = new THREE.Group();
      propPivot.position.set(sideX, -0.2, -2.1);

      const propBladeGeo = new THREE.BoxGeometry(0.65, 0.08, 0.02);
      const blade1 = new THREE.Mesh(propBladeGeo, darkMetalMat);
      const blade2 = new THREE.Mesh(propBladeGeo, darkMetalMat);
      blade2.rotation.z = Math.PI / 2;
      propPivot.add(blade1);
      propPivot.add(blade2);

      subGroup.add(propPivot);
      this.propellers.push(propPivot);
    });

    // 6. Dual Headlamp housings on front
    [-0.7, 0.7].forEach((sideX) => {
      const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 12), darkMetalMat);
      lampHousing.rotateX(Math.PI / 2);
      lampHousing.position.set(sideX, 0.3, 1.6);
      subGroup.add(lampHousing);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      bulb.position.set(sideX, 0.3, 1.78);
      subGroup.add(bulb);
    });

    return subGroup;
  }

  /**
   * Initializes particle system for propeller bubble trails
   */
  private initBubbleTrail(): THREE.Points {
    const geo = new THREE.BufferGeometry();
    this.bubblePositions = new Float32Array(this.bubbleCount * 3);
    this.bubbleAlphas = new Float32Array(this.bubbleCount);

    for (let i = 0; i < this.bubbleCount; i++) {
      this.bubblePositions[i * 3] = 0;
      this.bubblePositions[i * 3 + 1] = -100;
      this.bubblePositions[i * 3 + 2] = 0;
      this.bubbleAlphas[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.bubblePositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xaaeeff,
      size: 0.28,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geo, mat);
  }

  public getState(): SubmarineState {
    return this.state;
  }

  /**
   * Manually trigger observation of a fish specimen
   */
  public triggerObservation(fish: ObservedFishData): void {
    this.state = 'HOVERING_OBSERVATION';
    this.hoverTimer = 7.0;
    this.searchlight.intensity = 6.0;
    if (this.onObservationStart) {
      this.onObservationStart(fish);
    }
  }

  /**
   * Main director update loop
   */
  public update(delta: number, time: number, activeFishes: BoidFish[] = []): void {
    // 1. Spin Propellers
    const propSpeed = this.state === 'HOVERING_OBSERVATION' ? 2.0 : 12.0;
    this.propellers.forEach((p) => {
      p.rotation.z += delta * propSpeed;
    });

    // 2. Emit Bubble Trail from Propellers
    if (Math.random() < 0.35 && this.state !== 'HOVERING_OBSERVATION') {
      const idx = Math.floor(Math.random() * this.bubbleCount);
      const side = Math.random() < 0.5 ? -0.9 : 0.9;
      const spawnOffset = new THREE.Vector3(side, -0.2, -2.1).applyQuaternion(this.mesh.quaternion);
      const spawnWorld = this.mesh.position.clone().add(spawnOffset);

      this.bubblePositions[idx * 3] = spawnWorld.x;
      this.bubblePositions[idx * 3 + 1] = spawnWorld.y;
      this.bubblePositions[idx * 3 + 2] = spawnWorld.z;
    }

    // Rise existing bubbles
    for (let i = 0; i < this.bubbleCount; i++) {
      if (this.bubblePositions[i * 3 + 1] > -90) {
        this.bubblePositions[i * 3 + 1] += delta * 1.8;
      }
    }
    this.bubbleTrail.geometry.attributes.position.needsUpdate = true;

    // 3. State Machine Logic
    if (this.state === 'CRUISING') {
      this.nextScanTimer -= delta;

      // Select random fish to observe every 25-35s
      if (this.nextScanTimer <= 0 && activeFishes.length > 0) {
        const eligible = activeFishes.filter((f) => f.status !== 'dormant');
        if (eligible.length > 0) {
          this.targetFish = eligible[Math.floor(Math.random() * eligible.length)];
          this.state = 'APPROACHING_TARGET';
        } else {
          this.nextScanTimer = 15.0;
        }
      }

      // Cruising navigation
      const distToWaypoint = this.mesh.position.distanceTo(this.currentWaypoint);
      if (distToWaypoint < 4.0 || Math.random() < 0.003) {
        this.currentWaypoint.set(
          (Math.random() - 0.5) * 36,
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 22
        );
      }

      const steerDir = new THREE.Vector3().subVectors(this.currentWaypoint, this.mesh.position).normalize();
      this.velocity.lerp(steerDir.multiplyScalar(2.2), 0.04);
      this.mesh.position.addScaledVector(this.velocity, delta);

      // Orientation with subtle roll and pitch
      const lookTarget = this.mesh.position.clone().add(this.velocity);
      const dummy = new THREE.Object3D();
      dummy.position.copy(this.mesh.position);
      dummy.lookAt(lookTarget);
      dummy.rotateZ(Math.sin(time * 0.8) * 0.05); // gentle roll
      this.mesh.quaternion.slerp(dummy.quaternion, 0.06);

      this.searchlight.intensity = 3.5;
      this.searchlightTarget.position.set(0, -0.5, 15);
    } else if (this.state === 'APPROACHING_TARGET') {
      if (!this.targetFish) {
        this.state = 'CRUISING';
        this.nextScanTimer = 20.0;
        return;
      }

      const fishPos = this.targetFish.mesh.position;
      const dist = this.mesh.position.distanceTo(fishPos);

      // Desired hover position: 4.5 units back along sightline
      const approachVector = new THREE.Vector3().subVectors(fishPos, this.mesh.position).normalize();
      const hoverSpot = fishPos.clone().sub(approachVector.clone().multiplyScalar(4.5));

      const dirToSpot = new THREE.Vector3().subVectors(hoverSpot, this.mesh.position);
      if (dirToSpot.length() < 1.8) {
        // Arrived at observation hover!
        this.state = 'HOVERING_OBSERVATION';
        this.hoverTimer = 7.5;
        this.searchlight.intensity = 6.0;

        if (this.onObservationStart) {
          this.onObservationStart({
            id: this.targetFish.id,
            speciesId: this.targetFish.speciesId,
            name: this.targetFish.mesh.name,
            depthZone: this.targetFish.depthZone,
            isShiny: Boolean(this.targetFish.mesh.userData?.isShiny),
            position: fishPos.clone()
          });
        }
      } else {
        this.velocity.lerp(dirToSpot.normalize().multiplyScalar(2.0), 0.08);
        this.mesh.position.addScaledVector(this.velocity, delta);

        const dummy = new THREE.Object3D();
        dummy.position.copy(this.mesh.position);
        dummy.lookAt(fishPos);
        this.mesh.quaternion.slerp(dummy.quaternion, 0.08);
      }
    } else if (this.state === 'HOVERING_OBSERVATION') {
      this.hoverTimer -= delta;

      if (this.targetFish) {
        // Gently point searchlight and submarine nose at fish as it swims
        const fishPos = this.targetFish.mesh.position;
        const dummy = new THREE.Object3D();
        dummy.position.copy(this.mesh.position);
        dummy.lookAt(fishPos);
        this.mesh.quaternion.slerp(dummy.quaternion, 0.05);

        // Keep gentle hovering buoyancy
        this.mesh.position.y += Math.sin(time * 1.5) * 0.008;
      }

      if (this.hoverTimer <= 0) {
        // Finished observation
        this.state = 'CRUISING';
        this.nextScanTimer = 28.0 + Math.random() * 15.0;
        this.targetFish = null;
        if (this.onObservationEnd) {
          this.onObservationEnd();
        }
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.scene.remove(this.bubbleTrail);
    this.bubbleTrail.geometry.dispose();
    (this.bubbleTrail.material as THREE.Material).dispose();
  }
}

export default SubmarineDirector;
