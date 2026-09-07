import * as THREE from 'three';

/**
 * Dimensions of the authentic 1:1:1 diorama cube
 */
export const CUBE_SIZE = 40.0;
export const HALF_CUBE = CUBE_SIZE / 2.0; // 20.0

/**
 * Manages 3D atmospheric underwater environment, lighting, depth fog, ambient bubbles,
 * and the upgraded 1:1:1 diorama cube with acrylic glass panels, corner brackets,
 * etched depth tick marks, and stepped pedestal base.
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

  // 1:1:1 True Cube Vivarium Components
  public vivariumFrame: THREE.LineSegments | null = null;
  public sandFloor: THREE.Mesh | null = null;
  public waterSurface: THREE.Mesh | null = null;
  public dioramaPedestal: THREE.Mesh | null = null;
  public cornerBrackets: THREE.Group | null = null;
  public depthTicks: THREE.Group | null = null;
  public glassPanels: THREE.Group | null = null;

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

    // 5. 1:1:1 True Cube Vivarium Framing & Diorama Pedestal (40w x 40h x 40d)
    this.initVivariumFrame();

    // 6. Ambient Plankton & Bubble Particles
    const { particles, positions, velocities } = this.initBubbles();
    this.bubbleParticles = particles;
    this.bubblePositions = positions;
    this.bubbleVelocities = velocities;
    this.scene.add(this.bubbleParticles);
  }

  /**
   * Initializes 1:1:1 Symmetrical Vivarium Glass Cube (40, 40, 40)
   * with acrylic glass faces, brushed titanium corner brackets,
   * etched depth scale ticks, and stepped diorama pedestal.
   */
  public initVivariumFrame(): void {
    // 1. Glowing Cyan Wireframe Edges (40 x 40 x 40)
    const boxGeo = new THREE.BoxGeometry(40, 40, 40);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      linewidth: 2
    });
    this.vivariumFrame = new THREE.LineSegments(edgesGeo, edgesMat);
    this.scene.add(this.vivariumFrame);

    // 2. Translucent Acrylic Glass Panels (Front, Back, Left, Right, Top)
    this.glassPanels = new THREE.Group();
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });

    const panelGeo = new THREE.PlaneGeometry(CUBE_SIZE, CUBE_SIZE);
    
    // Front panel
    const front = new THREE.Mesh(panelGeo, glassMat);
    front.position.set(0, 0, HALF_CUBE);
    this.glassPanels.add(front);

    // Back panel
    const back = new THREE.Mesh(panelGeo, glassMat);
    back.position.set(0, 0, -HALF_CUBE);
    this.glassPanels.add(back);

    // Left panel
    const left = new THREE.Mesh(panelGeo, glassMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-HALF_CUBE, 0, 0);
    this.glassPanels.add(left);

    // Right panel
    const right = new THREE.Mesh(panelGeo, glassMat);
    right.rotation.y = Math.PI / 2;
    right.position.set(HALF_CUBE, 0, 0);
    this.glassPanels.add(right);

    this.scene.add(this.glassPanels);

    // 3. Sandy Ocean Floor Bed (40 x 1.5 x 40 at Y = -20)
    const floorGeo = new THREE.BoxGeometry(CUBE_SIZE, 1.5, CUBE_SIZE);
    const floorMat = new THREE.MeshToonMaterial({
      color: 0xfde047
    });
    this.sandFloor = new THREE.Mesh(floorGeo, floorMat);
    this.sandFloor.position.set(0, -HALF_CUBE, 0);
    this.scene.add(this.sandFloor);

    // 4. Stepped Diorama Pedestal Base (44 x 2 x 44 at Y = -21)
    const pedestalGeo = new THREE.BoxGeometry(CUBE_SIZE + 4, 2.0, CUBE_SIZE + 4);
    const pedestalMat = new THREE.MeshToonMaterial({
      color: 0x0f172a // sleek dark slate
    });
    this.dioramaPedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    this.dioramaPedestal.position.set(0, -HALF_CUBE - 1.0, 0);
    this.scene.add(this.dioramaPedestal);

    // 5. Translucent Caustic Water Surface Ceiling at Y = 20
    const waterGeo = new THREE.PlaneGeometry(CUBE_SIZE, CUBE_SIZE);
    const waterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.waterSurface = new THREE.Mesh(waterGeo, waterMat);
    this.waterSurface.rotation.x = Math.PI / 2;
    this.waterSurface.position.set(0, HALF_CUBE, 0);
    this.scene.add(this.waterSurface);

    // 6. Brushed Titanium Corner Brackets at 8 Vertices
    this.cornerBrackets = new THREE.Group();
    const bracketGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const bracketMat = new THREE.MeshToonMaterial({
      color: 0x334155
    });

    const signs = [-1, 1];
    signs.forEach((sx) => {
      signs.forEach((sy) => {
        signs.forEach((sz) => {
          const bracket = new THREE.Mesh(bracketGeo, bracketMat);
          bracket.position.set(sx * HALF_CUBE, sy * HALF_CUBE, sz * HALF_CUBE);
          this.cornerBrackets!.add(bracket);
        });
      });
    });
    this.scene.add(this.cornerBrackets);

    // 7. Etched Depth Scale Ticks along 4 Vertical Pillars
    this.depthTicks = new THREE.Group();
    const tickMat = new THREE.MeshBasicMaterial({ color: 0xa5f3fc });
    const depths = [
      { y: 20, label: '0m' },       // surface
      { y: 7, label: '200m' },      // epipelagic
      { y: -7, label: '1000m' },    // mesopelagic
      { y: -20, label: '3000m' }    // abyss
    ];

    const tickGeo = new THREE.BoxGeometry(0.8, 0.15, 0.8);
    const pillarPositions = [
      { x: -HALF_CUBE, z: -HALF_CUBE },
      { x: HALF_CUBE, z: -HALF_CUBE },
      { x: -HALF_CUBE, z: HALF_CUBE },
      { x: HALF_CUBE, z: HALF_CUBE }
    ];

    pillarPositions.forEach((pillar) => {
      depths.forEach((d) => {
        const tickMesh = new THREE.Mesh(tickGeo, tickMat);
        tickMesh.position.set(pillar.x, d.y, pillar.z);
        this.depthTicks!.add(tickMesh);
      });
    });
    this.scene.add(this.depthTicks);
  }

  private initBubbles(): { particles: THREE.Points; positions: Float32Array; velocities: Float32Array } {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.bubbleCount * 3);
    const velocities = new Float32Array(this.bubbleCount);

    for (let i = 0; i < this.bubbleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (CUBE_SIZE - 4);
      positions[i * 3 + 1] = (Math.random() - 0.5) * (CUBE_SIZE - 4);
      positions[i * 3 + 2] = (Math.random() - 0.5) * (CUBE_SIZE - 4);
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
      if (pos[i * 3 + 1] > HALF_CUBE - 1) {
        pos[i * 3 + 1] = -(HALF_CUBE - 1);
        pos[i * 3] = (Math.random() - 0.5) * (CUBE_SIZE - 4);
        pos[i * 3 + 2] = (Math.random() - 0.5) * (CUBE_SIZE - 4);
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
    if (this.dioramaPedestal) {
      this.dioramaPedestal.geometry.dispose();
      (this.dioramaPedestal.material as THREE.Material).dispose();
      this.scene.remove(this.dioramaPedestal);
    }
    if (this.cornerBrackets) {
      this.scene.remove(this.cornerBrackets);
    }
    if (this.depthTicks) {
      this.scene.remove(this.depthTicks);
    }
    if (this.glassPanels) {
      this.scene.remove(this.glassPanels);
    }
  }
}

export default SceneEnvironment;
