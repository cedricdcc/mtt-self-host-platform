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
  reactionTimer: number;
}

export interface FoodItem {
  id: number;
  type: 'flake' | 'super_pellet';
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

/**
 * 3D Boids simulation for cartoon fish swimming across depth zones with multi-archetype
 * locomotion, neighbor separation & schooling, biome landmark affinity, and boop reactions.
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

  // Reef and twilight species that exhibit mild same-species cohesion and alignment
  private static readonly SCHOOLING_SPECIES: ReadonlySet<string> = new Set([
    'azure_damselfish',
    'sunburst_tang',
    'clown_anemone',
    'silver_hatchet',
    'glass_lantern'
  ]);

  public isDesktopMode: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public setDesktopMode(enabled: boolean): void {
    this.isDesktopMode = enabled;
  }

  /**
   * Selects a new patrol waypoint with biome landmark affinity:
   * - `clown_anemone` and `golden_seahorse` bias toward the Sunlit Coral Shelf (Y: 7..13, Z: -14..-8) 50% of the time.
   * - `ghost_grenadier`, `bioluminescent_angler`, and `dumbo_specter` bias toward the Abyssal Trench (Y: -17.5..-10).
   */
  public selectWaypointForBoid(boid: BoidFish, focusOrigin?: THREE.Vector3): THREE.Vector3 {
    const zone = this.zoneY[boid.depthZone] || this.zoneY.sunlit;
    const ox = this.isDesktopMode && focusOrigin ? focusOrigin.x : 0;
    const oz = this.isDesktopMode && focusOrigin ? focusOrigin.z : 0;
    const rx = this.isDesktopMode ? 32 : this.boundsX * 1.8;
    const rz = this.isDesktopMode ? 32 : this.boundsZ * 1.8;

    const sId = (boid.speciesId || '').toLowerCase();

    // Sunlit Coral Shelf affinity (50% bias for clown_anemone & golden_seahorse)
    if (!this.isDesktopMode && (sId === 'clown_anemone' || sId === 'golden_seahorse') && Math.random() < 0.5) {
      return new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        7 + Math.random() * (13 - 7),
        -14 + Math.random() * (-8 - -14)
      );
    }

    // Abyssal Trench affinity for deep trench specialists
    if (sId === 'ghost_grenadier' || sId === 'bioluminescent_angler' || sId === 'dumbo_specter') {
      return new THREE.Vector3(
        ox + (Math.random() - 0.5) * rx,
        -17.5 + Math.random() * (-10 - -17.5),
        oz + (Math.random() - 0.5) * rz
      );
    }

    return new THREE.Vector3(
      ox + (Math.random() - 0.5) * rx,
      Math.random() * (zone.max - zone.min) + zone.min,
      oz + (Math.random() - 0.5) * rz
    );
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
    if (data.mesh.rotation.order !== 'YXZ') {
      data.mesh.rotation.reorder('YXZ');
    }
    const baseScale = data.mesh.scale.x || 1.0;
    data.mesh.userData.baseScale = baseScale;
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
      target: new THREE.Vector3(),
      targetChangeTimer: 3.0 + Math.random() * 4.0,
      scale: baseScale,
      reactionTimer: 0
    };

    boid.target.copy(this.selectWaypointForBoid(boid));
    this.fishes.set(data.user_fish_id, boid);
  }

  /**
   * Trigger a 2.5s interactive boop reaction and velocity impulse for a specific fish.
   */
  public triggerReaction(fishId: number): boolean {
    const boid = this.fishes.get(fishId);
    if (!boid || boid.status === 'dormant') {
      return false;
    }

    boid.reactionTimer = 2.5;
    boid.mesh.userData.reactionTimer = 2.5;

    const loco = boid.mesh.userData.locomotionType || 'carangiform';
    const sId = (boid.speciesId || '').toLowerCase();

    if (loco === 'puffer' || sId.includes('puffer')) {
      // Hover puff: decelerate horizontal drift and add buoyant vertical lift
      boid.velocity.multiplyScalar(0.35);
      boid.velocity.y += 1.25;
    } else if (
      loco === 'medusa_pulse' ||
      loco === 'chain_wave' ||
      loco === 'jet_pulse' ||
      loco === 'ear_flap' ||
      sId.includes('jelly') ||
      sId.includes('squid') ||
      sId.includes('octo') ||
      sId.includes('dumbo')
    ) {
      // Vertical jet hop for medusa/cephalopods
      const dir =
        boid.velocity.lengthSq() > 0.01
          ? boid.velocity.clone().normalize()
          : new THREE.Vector3(0, 0, 1);
      boid.velocity.addScaledVector(dir, 2.4);
      boid.velocity.y += 3.2;
    } else if (loco === 'upright_bob' || sId.includes('seahorse')) {
      // Gentle upright hop for seahorse
      boid.velocity.y += 2.0;
    } else {
      // Energetic forward dash for reef, manta, serpentine, and specialist swimmers
      const dir =
        boid.velocity.lengthSq() > 0.01
          ? boid.velocity.clone().normalize()
          : new THREE.Vector3((Math.random() - 0.5) * 2, 0.15, (Math.random() - 0.5) * 2).normalize();
      boid.velocity.addScaledVector(dir, 4.2);
      boid.velocity.y += 0.75;
    }

    return true;
  }

  /**
   * Static multi-archetype procedural animation helper reusable by both Boids simulation and <Species3DPreview />.
   */
  public static animateFishMesh(
    mesh: THREE.Group,
    time: number,
    delta: number,
    speedRatio: number = 1.0,
    reactionTimer: number = 0
  ): void {
    if (mesh.rotation.order !== 'YXZ') {
      mesh.rotation.reorder('YXZ');
    }
    const u = mesh.userData || {};
    const locomotionType: string = u.locomotionType || 'carangiform';
    const speciesId: string = String(u.speciesId || '').toLowerCase();
    const swimSpeed: number = (u.swimSpeed || 1.0) * Math.max(0.45, Math.min(2.4, speedRatio));
    const swimPhase: number = u.swimPhase || 0;
    const isReacting = reactionTimer > 0;
    const effectiveSpeed = swimSpeed * (isReacting ? 1.85 : 1.0);

    if (typeof u.baseScale !== 'number' || u.baseScale <= 0) {
      u.baseScale = mesh.scale.x || 1.0;
    }
    const baseScale: number = u.baseScale;

    if (locomotionType === 'hover_flutter') {
      // Regal pectoral fan wave + splayed dorsal spine shimmer (solar_lionfish)
      const fanFreq = 2.4 * effectiveSpeed;
      if (u.leftFin && u.rightFin) {
        const fanWave = Math.sin(time * fanFreq + swimPhase) * (isReacting ? 0.48 : 0.32);
        u.leftFin.rotation.y = fanWave;
        u.rightFin.rotation.y = -fanWave;
        u.leftFin.rotation.z = Math.cos(time * fanFreq + swimPhase) * 0.18;
        u.rightFin.rotation.z = -Math.cos(time * fanFreq + swimPhase) * 0.18;
      }
      if (u.dorsalFin) {
        u.dorsalFin.rotation.z = Math.sin(time * 3.2 * effectiveSpeed + swimPhase) * 0.12;
        u.dorsalFin.children.forEach((spine: THREE.Object3D, idx: number) => {
          spine.rotation.z =
            (idx % 2 === 0 ? 1 : -1) * (0.18 + (idx % 3) * 0.12) +
            Math.sin(time * 4.2 * effectiveSpeed + swimPhase - idx * 0.35) * (isReacting ? 0.16 : 0.08);
        });
      }
      if (u.analFin) {
        u.analFin.rotation.y = Math.sin(time * 2.8 * effectiveSpeed + swimPhase - 0.5) * 0.18;
      }
      if (u.tailPivot) {
        u.tailPivot.rotation.y = Math.sin(time * 2.6 * effectiveSpeed + swimPhase) * 0.24;
      }
      if (u.jawPivot) {
        u.jawPivot.rotation.x = Math.max(0, Math.sin(time * 3.5 * effectiveSpeed + swimPhase) * 0.14);
      }
    } else if (locomotionType === 'puffer') {
      // Rapid fin waddle + defensive 1.45x body puff & 1.8x puffSpikes expansion on reactionTimer > 0
      const waddleFreq = 8.5 * effectiveSpeed;
      if (u.leftFin && u.rightFin) {
        const waddle = Math.sin(time * waddleFreq + swimPhase) * 0.38;
        u.leftFin.rotation.z = waddle;
        u.rightFin.rotation.z = -waddle;
        u.leftFin.rotation.y = Math.cos(time * waddleFreq + swimPhase) * 0.22;
        u.rightFin.rotation.y = -Math.cos(time * waddleFreq + swimPhase) * 0.22;
      }
      if (u.tailPivot) {
        u.tailPivot.rotation.y = Math.sin(time * waddleFreq + swimPhase) * 0.35;
      }
      if (u.dorsalFin) {
        u.dorsalFin.rotation.y = Math.sin(time * waddleFreq + swimPhase - 0.3) * 0.25;
      }
      if (u.analFin) {
        u.analFin.rotation.y = Math.sin(time * waddleFreq + swimPhase - 0.4) * 0.25;
      }
      if (u.jawPivot) {
        u.jawPivot.rotation.x = isReacting
          ? 0.28 + Math.sin(time * 10.0) * 0.08
          : Math.max(0, Math.sin(time * 6.0 * effectiveSpeed + swimPhase) * 0.15);
      }

      const targetBodyScale = isReacting ? baseScale * 1.45 : baseScale;
      const lerpAlpha = Math.min(1.0, Math.max(0.18, delta * 8.0));
      const nextScale = THREE.MathUtils.lerp(mesh.scale.x || baseScale, targetBodyScale, lerpAlpha);
      mesh.scale.set(nextScale, nextScale, nextScale);

      if (Array.isArray(u.puffSpikes)) {
        const targetSpikeScale = isReacting ? 1.8 : 1.0;
        u.puffSpikes.forEach((spike: THREE.Object3D) => {
          const s = THREE.MathUtils.lerp(spike.scale.x || 1.0, targetSpikeScale, lerpAlpha);
          spike.scale.set(s, s, s);
        });
      }
    } else if (locomotionType === 'rajiform') {
      // Sinusoidal phase-delayed wing flapping on inner/outer pectoral wings + whip tail trail (sapphire_manta)
      const wingFreq = 3.0 * effectiveSpeed;
      const innerWave = Math.sin(time * wingFreq + swimPhase) * (isReacting ? 0.46 : 0.34);
      const outerWave = Math.sin(time * wingFreq + swimPhase - 0.65) * (isReacting ? 0.52 : 0.38);

      if (u.leftWingInner) {
        u.leftWingInner.rotation.z = innerWave;
      }
      if (u.leftWingOuter) {
        u.leftWingOuter.rotation.z = outerWave;
      }
      if (u.rightWingInner) {
        u.rightWingInner.rotation.z = -innerWave;
      }
      if (u.rightWingOuter) {
        u.rightWingOuter.rotation.z = -outerWave;
      }
      if (u.tailPivot) {
        u.tailPivot.rotation.y = Math.sin(time * wingFreq + swimPhase - 0.9) * 0.18;
        u.tailPivot.rotation.x = Math.cos(time * wingFreq + swimPhase - 0.9) * 0.14;
      }
      if (u.jawPivot) {
        u.jawPivot.rotation.x = Math.max(0, Math.sin(time * 2.5 * effectiveSpeed + swimPhase) * 0.12);
      }
      if (isReacting) {
        const spinPhase = Math.max(0, Math.min(1, (2.5 - reactionTimer) / 1.4));
        mesh.rotation.z = (1 - Math.cos(spinPhase * Math.PI)) * Math.PI;
      }
    } else if (locomotionType === 'upright_bob') {
      // Rapid dorsal fan flutter + prehensile tailCurlGroup/tailPivot coiling + gentle bob (golden_seahorse)
      const flutterFreq = 14.0 * effectiveSpeed;
      if (u.dorsalFin) {
        u.dorsalFin.rotation.y = Math.sin(time * flutterFreq + swimPhase) * 0.42;
      }
      if (u.leftFin && u.rightFin) {
        const earFlutter = Math.sin(time * 10.0 * effectiveSpeed + swimPhase) * 0.28;
        u.leftFin.rotation.y = earFlutter;
        u.rightFin.rotation.y = -earFlutter;
      }
      const tailCurl = u.tailCurlGroup || u.tailPivot;
      if (tailCurl) {
        tailCurl.rotation.x = Math.sin(time * 2.2 * effectiveSpeed + swimPhase) * (isReacting ? 0.45 : 0.22);
        tailCurl.rotation.z = Math.cos(time * 1.8 * effectiveSpeed + swimPhase) * 0.12;
      }
      if (Array.isArray(u.spineSegments)) {
        u.spineSegments.forEach((seg: THREE.Object3D, idx: number) => {
          seg.rotation.x = Math.sin(time * 2.4 * effectiveSpeed + swimPhase - idx * 0.2) * 0.04;
        });
      }
      if (u.jawPivot) {
        u.jawPivot.rotation.x = Math.max(0, Math.sin(time * 4.0 * effectiveSpeed + swimPhase) * 0.1);
      }
    } else if (locomotionType === 'jet_pulse' || locomotionType === 'ear_flap') {
      // Rhythmic mantle breathing contraction + phase-delayed tentacle waves + flapping ear fins (cephalopods)
      const pulseFreq = (locomotionType === 'ear_flap' ? 3.2 : 3.8) * effectiveSpeed;
      const pulse = Math.sin(time * pulseFreq + swimPhase);

      if (u.bellGroup) {
        const breathRadial = 1.0 + pulse * (isReacting ? 0.18 : 0.11);
        const breathAxial = 1.0 - pulse * (isReacting ? 0.16 : 0.09);
        u.bellGroup.scale.set(breathRadial, breathRadial, breathAxial);
      }

      const leftEar = u.leftEarFin || u.leftFin;
      const rightEar = u.rightEarFin || u.rightFin;
      if (leftEar && rightEar) {
        const flapAmp = locomotionType === 'ear_flap' ? (isReacting ? 0.62 : 0.45) : 0.28;
        const flap = Math.sin(time * 4.2 * effectiveSpeed + swimPhase) * flapAmp;
        leftEar.rotation.z = flap;
        rightEar.rotation.z = -flap;
        leftEar.rotation.y = Math.cos(time * 4.2 * effectiveSpeed + swimPhase) * 0.16;
        rightEar.rotation.y = -Math.cos(time * 4.2 * effectiveSpeed + swimPhase) * 0.16;
      }

      if (Array.isArray(u.tentacles)) {
        u.tentacles.forEach((tentacle: THREE.Object3D, idx: number) => {
          tentacle.rotation.x =
            Math.sin(time * 4.4 * effectiveSpeed + swimPhase - idx * 0.45) * (isReacting ? 0.34 : 0.22);
          tentacle.rotation.z =
            Math.cos(time * 3.6 * effectiveSpeed + swimPhase - idx * 0.45) * 0.14;
        });
      }
    } else if (locomotionType === 'medusa_pulse' || locomotionType === 'chain_wave') {
      // Bell squash-and-stretch + trailing harmonic waves on tentacles[] or spineSegments[]
      const pulse = Math.sin(time * 3.0 * effectiveSpeed + swimPhase);
      if (u.bellGroup) {
        u.bellGroup.scale.set(1 + pulse * 0.18, 1 - pulse * 0.22, 1 + pulse * 0.18);
      }
      if (Array.isArray(u.spineSegments)) {
        u.spineSegments.forEach((seg: THREE.Object3D, idx: number) => {
          const segWave = Math.sin(time * 3.8 * effectiveSpeed + swimPhase - idx * 0.55);
          seg.rotation.y = segWave * (isReacting ? 0.32 : 0.22);
          seg.rotation.x = Math.cos(time * 3.2 * effectiveSpeed + swimPhase - idx * 0.45) * 0.12;
        });
      }
      if (Array.isArray(u.tentacles)) {
        u.tentacles.forEach((tentacle: THREE.Object3D, idx: number) => {
          tentacle.rotation.x =
            Math.sin(time * 3.4 * effectiveSpeed + swimPhase - idx * 0.38) * (isReacting ? 0.32 : 0.2);
          tentacle.rotation.z =
            Math.cos(time * 2.8 * effectiveSpeed + swimPhase - idx * 0.38) * 0.16;
        });
      }
    } else if (locomotionType === 'anguilliform') {
      // Phase-delayed S-wave rotation across spineSegments[] + wide gulper jaw opening
      if (Array.isArray(u.spineSegments)) {
        u.spineSegments.forEach((seg: THREE.Object3D, idx: number) => {
          seg.rotation.y = Math.sin(time * 5.0 * swimSpeed - idx * 0.65) * (isReacting ? 0.36 : 0.28);
          seg.position.x = Math.sin(time * 5.0 * effectiveSpeed + swimPhase - idx * 0.65) * (idx * 0.035);
        });
      }
      if (u.tailPivot && (!Array.isArray(u.spineSegments) || !u.spineSegments.includes(u.tailPivot))) {
        u.tailPivot.rotation.y = Math.sin(time * 5.0 * effectiveSpeed + swimPhase) * 0.32;
      }
      if (u.leftFin && u.rightFin) {
        const flipperSweep = Math.sin(time * 3.8 * effectiveSpeed + swimPhase) * 0.26;
        u.leftFin.rotation.z = -0.25 + flipperSweep;
        u.rightFin.rotation.z = 0.25 - flipperSweep;
      }
      if (u.jawPivot) {
        const isGulper = speciesId.includes('gulper') || u.bodyType === 'eel';
        if (isGulper && (isReacting || u.isChasingFood)) {
          u.jawPivot.rotation.x = 0.72 + Math.sin(time * 8.0 + swimPhase) * 0.14;
        } else {
          u.jawPivot.rotation.x = Math.max(0, Math.sin(time * 4.2 * effectiveSpeed + swimPhase) * 0.18);
        }
      }
    } else {
      // carangiform / specialist_swim
      if (u.tailPivot) {
        u.tailPivot.rotation.y =
          Math.sin(time * 4.5 * effectiveSpeed + swimPhase) * (isReacting ? 0.56 : 0.42);
      }
      if (u.dorsalFin) {
        u.dorsalFin.rotation.y = Math.sin(time * 4.5 * effectiveSpeed + swimPhase - 0.4) * 0.22;
      }
      if (u.analFin) {
        u.analFin.rotation.y = Math.sin(time * 4.5 * effectiveSpeed + swimPhase - 0.5) * 0.2;
      }
      if (u.jawPivot) {
        const isAngler = speciesId.includes('angler');
        u.jawPivot.rotation.x = Math.max(
          0,
          Math.sin(time * (isAngler ? 3.2 : 5.0) * effectiveSpeed + swimPhase) *
            (isReacting ? 0.38 : isAngler ? 0.24 : 0.16)
        );
      }
      if (u.leftFin && u.rightFin) {
        const finWobble = Math.sin(time * 6.0 * effectiveSpeed + swimPhase) * 0.25;
        u.leftFin.rotation.z = finWobble;
        u.rightFin.rotation.z = -finWobble;
      }
      // Tetrapod diagonal paddling on lobeFins (coelacanth_shadow)
      if (Array.isArray(u.lobeFins) && u.lobeFins.length > 0) {
        u.lobeFins.forEach((lobe: THREE.Object3D, idx: number) => {
          const diagPhase = idx === 0 || idx === 3 ? 0 : Math.PI;
          lobe.rotation.x = Math.sin(time * 3.6 * effectiveSpeed + swimPhase + diagPhase) * 0.38;
          lobe.rotation.z = Math.cos(time * 3.6 * effectiveSpeed + swimPhase + diagPhase) * 0.18;
        });
      }
      // Rattail spine wave on ghost_grenadier
      if (Array.isArray(u.spineSegments) && u.spineSegments.length > 0) {
        u.spineSegments.forEach((seg: THREE.Object3D, idx: number) => {
          seg.rotation.y =
            Math.sin(time * 5.2 * effectiveSpeed + swimPhase - idx * 0.55) * (0.12 + idx * 0.04);
        });
      }
      // Bobbing escaLure and pulsing escaLight on bioluminescent_angler
      if (u.escaLure) {
        u.escaLure.rotation.x =
          Math.sin(time * 3.4 * effectiveSpeed + swimPhase) * (isReacting ? 0.35 : 0.18);
        u.escaLure.rotation.z =
          Math.cos(time * 2.7 * effectiveSpeed + swimPhase) * (isReacting ? 0.28 : 0.14);
      }
      if (u.escaLight) {
        u.escaLight.intensity =
          (isReacting ? 3.4 : 2.2) + Math.sin(time * (isReacting ? 12.0 : 4.5) + swimPhase) * 0.65;
      }
      // Playful barrel-spin on reactionTimer > 0
      if (isReacting) {
        const spinPhase = Math.max(0, Math.min(1, (2.5 - reactionTimer) / 1.25));
        mesh.rotation.z = (1 - Math.cos(spinPhase * Math.PI)) * Math.PI;
      }
    }

    // Shiny particle aura rotation & pulse
    if (u.sparkleEmitter) {
      u.sparkleEmitter.rotation.y += delta * 1.5;
      const pulse = 1.0 + Math.sin(time * 3.0) * 0.15;
      u.sparkleEmitter.scale.set(pulse, pulse, pulse);
    }

    // GLB skeletal animation mixer update
    if (u.animationMixer) {
      u.animationMixer.update(delta * effectiveSpeed);
    }

    // GLB hydrodynamic body oscillation
    if (u.glbContainer) {
      u.glbContainer.rotation.y = Math.sin(time * 4.0 * effectiveSpeed + swimPhase) * 0.12;
    }
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
  public update(
    delta: number,
    time: number,
    foodPellets: FoodItem[] = [],
    focusOrigin?: THREE.Vector3
  ): void {
    this.fishes.forEach((boid) => {
      const mesh = boid.mesh;
      const zone = this.zoneY[boid.depthZone] || this.zoneY.sunlit;
      const isDormant = boid.status === 'dormant';

      if (boid.reactionTimer > 0) {
        boid.reactionTimer = Math.max(0, boid.reactionTimer - delta);
        mesh.userData.reactionTimer = boid.reactionTimer;
      }

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

      mesh.userData.isChasingFood = Boolean(chasingFood);

      if (chasingFood) {
        // Steer toward food
        const dirToFood = new THREE.Vector3()
          .subVectors(chasingFood.mesh.position, mesh.position)
          .normalize();
        boid.velocity.lerp(dirToFood.multiplyScalar(3.8), 0.15);
      } else {
        // Autonomous waypoint patrolling with habitat landmark affinity
        boid.targetChangeTimer -= delta;
        const distToTarget = mesh.position.distanceTo(boid.target);

        if (boid.targetChangeTimer <= 0 || distToTarget < 3.0) {
          boid.target.copy(this.selectWaypointForBoid(boid, focusOrigin));
          boid.targetChangeTimer = 4.0 + Math.random() * 5.0;
        }

        const steerDir = new THREE.Vector3().subVectors(boid.target, mesh.position).normalize();
        const baseSpeed = boid.isFavorite ? 2.6 : 2.0;
        const steerAlpha = boid.reactionTimer > 0 ? 0.018 : 0.05;
        boid.velocity.lerp(steerDir.multiplyScalar(baseSpeed), steerAlpha);
      }

      // Short-range neighbor separation (dist < 2.4) & mild same-species schooling
      const separation = new THREE.Vector3();
      const alignment = new THREE.Vector3();
      const cohesionCenter = new THREE.Vector3();
      let schoolNeighborCount = 0;
      const isSchooler = FishBoidsSystem.SCHOOLING_SPECIES.has(boid.speciesId);

      this.fishes.forEach((other) => {
        if (other.id === boid.id || other.status === 'dormant') return;
        const offset = new THREE.Vector3().subVectors(mesh.position, other.mesh.position);
        const dist = offset.length();

        if (dist > 0.0001 && dist < 2.4) {
          const pushStrength = (2.4 - dist) / 2.4;
          separation.addScaledVector(offset.normalize(), pushStrength * 2.2);
        }

        if (isSchooler && other.speciesId === boid.speciesId && dist > 0.0001 && dist < 9.5) {
          alignment.add(other.velocity);
          cohesionCenter.add(other.mesh.position);
          schoolNeighborCount++;
        }
      });

      if (separation.lengthSq() > 0) {
        boid.velocity.addScaledVector(separation, Math.min(0.25, delta * 3.5));
      }

      if (isSchooler && schoolNeighborCount > 0 && !chasingFood) {
        alignment.divideScalar(schoolNeighborCount);
        cohesionCenter.divideScalar(schoolNeighborCount);
        const toCohesion = new THREE.Vector3().subVectors(cohesionCenter, mesh.position);
        if (toCohesion.lengthSq() > 0.01) {
          toCohesion.normalize().multiplyScalar(1.4);
          boid.velocity.lerp(toCohesion, 0.025);
        }
        if (alignment.lengthSq() > 0.01) {
          boid.velocity.lerp(alignment, 0.03);
        }
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

      if (mesh.rotation.order !== 'YXZ') {
        mesh.rotation.reorder('YXZ');
      }

      const locomotionType = mesh.userData.locomotionType || 'carangiform';
      const isUprightSpecies =
        locomotionType === 'upright_bob' ||
        locomotionType === 'medusa_pulse' ||
        boid.speciesId === 'golden_seahorse' ||
        boid.speciesId === 'cosmic_jelly';

      if (isUprightSpecies) {
        // Keep upright_bob (golden_seahorse) and medusa_pulse (cosmic_jelly) upright:
        // pitch and roll damped toward 0, rotating smoothly in horizontal yaw.
        const horizSpeedSq = boid.velocity.x * boid.velocity.x + boid.velocity.z * boid.velocity.z;
        if (horizSpeedSq > 0.002) {
          const targetYaw = Math.atan2(boid.velocity.x, boid.velocity.z);
          const yawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetYaw, 0, 'YXZ'));
          mesh.quaternion.slerp(yawQuat, 0.1);
        }
        mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, 0.25);
        mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, 0.25);

        const swimPhase = mesh.userData.swimPhase || 0;
        mesh.position.y += Math.sin(time * 2.5 + swimPhase) * delta * 0.28;
      } else if (boid.velocity.lengthSq() > 0.01) {
        // Smooth look-at orientation in direction of movement
        const lookTarget = mesh.position.clone().add(boid.velocity);
        const dummy = new THREE.Object3D();
        dummy.position.copy(mesh.position);
        dummy.lookAt(lookTarget);
        mesh.quaternion.slerp(dummy.quaternion, 0.12);
      }

      const speedRatio = Math.max(0.5, boid.velocity.length() / 2.0);
      FishBoidsSystem.animateFishMesh(mesh, time, delta, speedRatio, boid.reactionTimer);
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
