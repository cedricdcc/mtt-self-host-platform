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

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Atmospheric Fog (Cyan/Deep Navy)
    this.depthFog = new THREE.FogExp2(0x041830, 0.018);
    this.scene.fog = this.depthFog;

    // 2. Ambient Lighting
    this.ambientLight = new THREE.AmbientLight(0x0f2d4a, 1.8);
    this.scene.add(this.ambientLight);

    // 3. Overhead Sunlight Shafts
    this.sunLight = new THREE.DirectionalLight(0xb2f5ea, 2.5);
    this.sunLight.position.set(10, 45, 15);
    this.scene.add(this.sunLight);

    // 4. Subtle Rim Spotlight
    const rimLight = new THREE.DirectionalLight(0x00d2ff, 1.2);
    rimLight.position.set(-15, -20, -10);
    this.scene.add(rimLight);

    // 5. Ambient Plankton & Bubble Particles
    const { particles, positions, velocities } = this.initBubbles();
    this.bubbleParticles = particles;
    this.bubblePositions = positions;
    this.bubbleVelocities = velocities;
    this.scene.add(this.bubbleParticles);

    // 6. Tank Bounds Markers & Caustic Ground Plate
    this.addGroundAndDecorations();
  }

  private initBubbles(): { particles: THREE.Points; positions: Float32Array; velocities: Float32Array } {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.bubbleCount * 3);
    const velocities = new Float32Array(this.bubbleCount);

    for (let i = 0; i < this.bubbleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      velocities[i] = 1.0 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x88e7ff,
      size: 0.35,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    return {
      particles: new THREE.Points(geometry, material),
      positions,
      velocities
    };
  }

  private addGroundAndDecorations(): void {
    // Deep seabed plate
    const groundGeo = new THREE.PlaneGeometry(100, 60);
    const groundMat = new THREE.MeshToonMaterial({
      color: 0x051329
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -32;
    this.scene.add(ground);
  }

  /**
   * Adjust fog density and color depending on water quality (0% to 100%)
   */
  public updateWaterQuality(quality: number): void {
    if (quality >= 80) {
      // Pristine turquoise deep water
      this.depthFog.color.setHex(0x041830);
      this.depthFog.density = 0.016;
      this.ambientLight.color.setHex(0x0f2d4a);
    } else if (quality >= 40) {
      // Balanced habitat
      this.depthFog.color.setHex(0x061e38);
      this.depthFog.density = 0.022;
      this.ambientLight.color.setHex(0x0d2842);
    } else {
      // Murky / Needs care
      this.depthFog.color.setHex(0x1a2118);
      this.depthFog.density = 0.035;
      this.ambientLight.color.setHex(0x19241a);
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

      // Wrap around top to bottom
      if (pos[i * 3 + 1] > 32) {
        pos[i * 3 + 1] = -32;
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
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
  }
}

export default SceneEnvironment;
