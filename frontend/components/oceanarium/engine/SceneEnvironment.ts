import * as THREE from 'three';

/**
 * Manages 3D atmospheric underwater environment, lighting, depth fog, and ambient bubbles.
 */
export class SceneEnvironment {
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private depthFog: THREE.FogExp2;
  private bubbleParticles: THREE.Points;
  private bubblePositions: Float32Array;
  private bubbleVelocities: Float32Array;
  private bubbleCount: number = 80;

  // 2.5D Vivarium Glass Cube components
  public vivariumFrame: THREE.LineSegments | null = null;
  public sandFloor: THREE.Mesh | null = null;
  public waterSurface: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Atmospheric Fog (Tropical Azure Cyan)
    this.depthFog = new THREE.FogExp2(0x0284c7, 0.012);
    this.scene.fog = this.depthFog;

    // 2. Ambient Lighting (Luminous Tropical Azure)
    this.ambientLight = new THREE.AmbientLight(0x38bdf8, 1.4);
    this.scene.add(this.ambientLight);

    // 3. Overhead Sunlight Shafts (Radiant Azure White)
    this.sunLight = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    this.sunLight.position.set(15, 35, 20);
    this.scene.add(this.sunLight);

    // 4. Subtle Rim Spotlight (Bright Cyan)
    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.2);
    rimLight.position.set(-20, -15, -15);
    this.scene.add(rimLight);

    // 5. 2.5D Glass Vivarium Framing & Sandy Floor Bed (48w x 40h x 32d)
    this.initVivariumFrame();

    // 6. Ambient Plankton & Bubble Particles
    const { particles, positions, velocities } = this.initBubbles();
    this.bubbleParticles = particles;
    this.bubblePositions = positions;
    this.bubbleVelocities = velocities;
    this.scene.add(this.bubbleParticles);
  }

  /**
   * Initializes 2.5D Isometric Vivarium Glass Box (48w x 40h x 32d)
   */
  public initVivariumFrame(): void {
    // 1. Glowing Cyan Wireframe Edges
    const boxGeo = new THREE.BoxGeometry(48, 40, 32);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      linewidth: 2
    });
    this.vivariumFrame = new THREE.LineSegments(edgesGeo, edgesMat);
    this.scene.add(this.vivariumFrame);

    // 2. Sandy Ocean Floor Bed (Warm Golden Sand Toon)
    const floorGeo = new THREE.BoxGeometry(48, 1.5, 32);
    const floorMat = new THREE.MeshToonMaterial({
      color: 0xfde047
    });
    this.sandFloor = new THREE.Mesh(floorGeo, floorMat);
    this.sandFloor.position.set(0, -20, 0);
    this.scene.add(this.sandFloor);

    // 3. Translucent Caustic Water Surface Ceiling
    const waterGeo = new THREE.PlaneGeometry(48, 32);
    const waterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.waterSurface = new THREE.Mesh(waterGeo, waterMat);
    this.waterSurface.rotation.x = Math.PI / 2;
    this.waterSurface.position.set(0, 20, 0);
    this.scene.add(this.waterSurface);
  }

  private initBubbles(): { particles: THREE.Points; positions: Float32Array; velocities: Float32Array } {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.bubbleCount * 3);
    const velocities = new Float32Array(this.bubbleCount);

    for (let i = 0; i < this.bubbleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 36;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 28;
      velocities[i] = 1.0 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.35,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    return {
      particles: new THREE.Points(geometry, material),
      positions,
      velocities
    };
  }

  /**
   * Adjust fog density and color depending on water quality (0% to 100%)
   */
  public updateWaterQuality(quality: number): void {
    if (quality >= 80) {
      // Pristine turquoise deep azure
      this.depthFog.color.setHex(0x0284c7);
      this.depthFog.density = 0.012;
      this.ambientLight.color.setHex(0x38bdf8);
    } else if (quality >= 40) {
      // Balanced reef habitat
      this.depthFog.color.setHex(0x0369a1);
      this.depthFog.density = 0.018;
      this.ambientLight.color.setHex(0x0284c7);
    } else {
      // Murky lagoon / Needs care
      this.depthFog.color.setHex(0x164e63);
      this.depthFog.density = 0.028;
      this.ambientLight.color.setHex(0x0f766e);
    }
  }

  /**
   * Update particle animations
   */
  public update(delta: number, time: number): void {
    const pos = this.bubblePositions;
    const vels = this.bubbleVelocities;

    for (let i = 0; i < this.bubbleCount; i++) {
      pos[i * 3 + 1] += vels[i] * delta;
      pos[i * 3] += Math.sin(time * 0.8 + i) * 0.02;

      // Wrap around within vivarium bounds
      if (pos[i * 3 + 1] > 19) {
        pos[i * 3 + 1] = -19;
        pos[i * 3] = (Math.random() - 0.5) * 44;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
      }
    }

    this.bubbleParticles.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.bubbleParticles.geometry.dispose();
    (this.bubbleParticles.material as THREE.Material).dispose();

    if (this.vivariumFrame) {
      this.vivariumFrame.geometry.dispose();
      (this.vivariumFrame.material as THREE.Material).dispose();
      this.scene.remove(this.vivariumFrame);
    }
    if (this.sandFloor) {
      this.sandFloor.geometry.dispose();
      (this.sandFloor.material as THREE.Material).dispose();
      this.scene.remove(this.sandFloor);
    }
    if (this.waterSurface) {
      this.waterSurface.geometry.dispose();
      (this.waterSurface.material as THREE.Material).dispose();
      this.scene.remove(this.waterSurface);
    }
  }
}

export default SceneEnvironment;
