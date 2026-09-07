import * as THREE from 'three';

/**
 * Dimensions of the authentic 1:1:1 diorama cube
 */
export const CUBE_SIZE = 40.0;
export const HALF_CUBE = CUBE_SIZE / 2.0; // 20.0

/**
 * Manages 3D atmospheric underwater environment, lighting, depth fog, ambient bubbles,
 * the 1:1:1 diorama cube (in standard view), and the boundless procedural world
 * (in desktop mode) featuring an infinite seabed, sky canopy, drifting clouds, and radiant sun.
 */
export class SceneEnvironment {
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  public sunLight: THREE.DirectionalLight;
  private depthFog: THREE.FogExp2;
  private bubbleParticles: THREE.Points;
  private bubblePositions: Float32Array;
  private bubbleVelocities: Float32Array;
  private bubbleCount: number = 80;

  // 1:1:1 True Cube Vivarium Components (Standard View)
  public vivariumFrame: THREE.LineSegments | null = null;
  public sandFloor: THREE.Mesh | null = null;
  public waterSurface: THREE.Mesh | null = null;
  public dioramaPedestal: THREE.Mesh | null = null;
  public cornerBrackets: THREE.Group | null = null;
  public depthTicks: THREE.Group | null = null;
  public glassPanels: THREE.Group | null = null;

  // Desktop Mode Infinite Procedural World Components
  public isDesktopMode: boolean = false;
  public infiniteTerrain: THREE.Mesh | null = null;
  public skyDome: THREE.Mesh | null = null;
  public cloudsMesh: THREE.Mesh | null = null;
  public sunCorona: THREE.Mesh | null = null;
  private cloudMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Atmospheric Fog (Tropical Azure Cyan)
    this.depthFog = new THREE.FogExp2(0x0284c7, 0.012);
    this.scene.fog = this.depthFog;

    // 2. Ambient Lighting (Luminous Tropical Azure)
    this.ambientLight = new THREE.AmbientLight(0x38bdf8, 1.4);
    this.scene.add(this.ambientLight);

    // 3. Overhead Radiant Sun Light Source
    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    this.sunLight.position.set(25, 45, 25);
    this.scene.add(this.sunLight);

    // 4. Subtle Rim Spotlight (Bright Cyan)
    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.2);
    rimLight.position.set(-20, -15, -15);
    this.scene.add(rimLight);

    // 5. 1:1:1 True Cube Vivarium Framing & Diorama Pedestal (40w x 40h x 40d)
    this.initVivariumFrame();

    // 6. Desktop Mode Infinite Procedural World (Terrain, Sky, Clouds & Sun)
    this.initDesktopInfiniteWorld();

    // 7. Ambient Plankton & Bubble Particles
    const { particles, positions, velocities } = this.initBubbles();
    this.bubbleParticles = particles;
    this.bubblePositions = positions;
    this.bubbleVelocities = velocities;
    this.scene.add(this.bubbleParticles);
  }

  /**
   * Initializes 1:1:1 Symmetrical Vivarium Glass Cube (40, 40, 40)
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

    // 2. Translucent Acrylic Glass Panels
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

  /**
   * Initializes procedural infinite terrain, sky dome, moving clouds, and sun corona
   */
  public initDesktopInfiniteWorld(): void {
    // 1. Procedural Infinite Seabed (180 x 180 grid with procedural dunes)
    const terrainGeo = new THREE.PlaneGeometry(180, 180, 48, 48);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      // Procedural dune undulation
      const vz = Math.sin(vx * 0.07) * 1.6 + Math.cos(vy * 0.06) * 1.3 + Math.sin((vx + vy) * 0.04) * 0.8;
      posAttr.setZ(i, vz);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshToonMaterial({
      color: 0xfde047
    });
    this.infiniteTerrain = new THREE.Mesh(terrainGeo, terrainMat);
    this.infiniteTerrain.rotation.x = -Math.PI / 2;
    this.infiniteTerrain.position.set(0, -20.2, 0);
    this.infiniteTerrain.visible = false;
    this.scene.add(this.infiniteTerrain);

    // 2. Atmospheric Sky Canopy Dome (Y >= 24)
    const skyGeo = new THREE.SphereGeometry(190, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.BackSide
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.position.set(0, 24, 0);
    this.skyDome.visible = false;
    this.scene.add(this.skyDome);

    // 3. Drifting Clouds Layer (Y = 32)
    const cloudGeo = new THREE.PlaneGeometry(240, 240);
    // Procedural soft cloud texture pattern
    const cloudCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let cloudTexture: THREE.CanvasTexture | null = null;
    if (cloudCanvas) {
      cloudCanvas.width = 256;
      cloudCanvas.height = 256;
      const ctx = cloudCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0)';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 16; i++) {
          const cx = Math.random() * 256;
          const cy = Math.random() * 256;
          const rad = 30 + Math.random() * 45;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
          grad.addColorStop(0.6, 'rgba(240, 249, 255, 0.25)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      cloudTexture = new THREE.CanvasTexture(cloudCanvas);
      cloudTexture.wrapS = THREE.RepeatWrapping;
      cloudTexture.wrapT = THREE.RepeatWrapping;
      cloudTexture.repeat.set(3, 3);
    }

    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.cloudsMesh = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    this.cloudsMesh.rotation.x = Math.PI / 2;
    this.cloudsMesh.position.set(0, 32, 0);
    this.cloudsMesh.visible = false;
    this.scene.add(this.cloudsMesh);

    // 4. Radiant Sun Corona Disc
    const coronaGeo = new THREE.CircleGeometry(12, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.sunCorona.position.set(35, 60, 35);
    this.sunCorona.lookAt(0, 0, 0);
    this.sunCorona.visible = false;
    this.scene.add(this.sunCorona);
  }

  /**
   * Switch between Standard 1:1:1 Cube Vivarium and Desktop Mode Infinite Procedural World
   */
  public setDesktopMode(enabled: boolean): void {
    this.isDesktopMode = enabled;

    // Toggle Diorama Cube Visibility
    if (this.vivariumFrame) this.vivariumFrame.visible = !enabled;
    if (this.sandFloor) this.sandFloor.visible = !enabled;
    if (this.dioramaPedestal) this.dioramaPedestal.visible = !enabled;
    if (this.cornerBrackets) this.cornerBrackets.visible = !enabled;
    if (this.depthTicks) this.depthTicks.visible = !enabled;
    if (this.glassPanels) this.glassPanels.visible = !enabled;

    // Toggle Infinite Procedural World Visibility
    if (this.infiniteTerrain) this.infiniteTerrain.visible = enabled;
    if (this.skyDome) this.skyDome.visible = enabled;
    if (this.cloudsMesh) this.cloudsMesh.visible = enabled;
    if (this.sunCorona) this.sunCorona.visible = enabled;

    // Atmospheric adjustment
    if (enabled) {
      this.depthFog.density = 0.007; // Expansive oceanic vista
      this.sunLight.intensity = 3.0;
    } else {
      this.depthFog.density = 0.012; // Focused vivarium cube
      this.sunLight.intensity = 2.2;
    }
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
    if (this.isDesktopMode) return; // Keep expansive in desktop mode

    if (quality >= 80) {
      this.depthFog.color.setHex(0x0284c7);
      this.depthFog.density = 0.012;
      this.ambientLight.color.setHex(0x38bdf8);
    } else if (quality >= 40) {
      this.depthFog.color.setHex(0x0369a1);
      this.depthFog.density = 0.018;
      this.ambientLight.color.setHex(0x0284c7);
    } else {
      this.depthFog.color.setHex(0x164e63);
      this.depthFog.density = 0.028;
      this.ambientLight.color.setHex(0x0f766e);
    }
  }

  /**
   * Update particle animations, cloud drift, and infinite terrain tracking
   */
  public update(delta: number, time: number, focusPosition?: THREE.Vector3): void {
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

    // In Desktop Mode: Drift clouds and center infinite terrain
    if (this.isDesktopMode) {
      if (this.cloudMaterial && this.cloudMaterial.map) {
        this.cloudMaterial.map.offset.x = (time * 0.015) % 1;
        this.cloudMaterial.map.offset.y = (time * 0.008) % 1;
      }
      if (this.infiniteTerrain && focusPosition) {
        this.infiniteTerrain.position.x = focusPosition.x;
        this.infiniteTerrain.position.z = focusPosition.z;
      }
      if (this.skyDome && focusPosition) {
        this.skyDome.position.x = focusPosition.x;
        this.skyDome.position.z = focusPosition.z;
      }
      if (this.cloudsMesh && focusPosition) {
        this.cloudsMesh.position.x = focusPosition.x;
        this.cloudsMesh.position.z = focusPosition.z;
      }
    }
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
    if (this.infiniteTerrain) {
      this.infiniteTerrain.geometry.dispose();
      (this.infiniteTerrain.material as THREE.Material).dispose();
      this.scene.remove(this.infiniteTerrain);
    }
    if (this.skyDome) {
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.Material).dispose();
      this.scene.remove(this.skyDome);
    }
    if (this.cloudsMesh) {
      this.cloudsMesh.geometry.dispose();
      if (this.cloudMaterial) this.cloudMaterial.dispose();
      this.scene.remove(this.cloudsMesh);
    }
    if (this.sunCorona) {
      this.sunCorona.geometry.dispose();
      (this.sunCorona.material as THREE.Material).dispose();
      this.scene.remove(this.sunCorona);
    }
  }
}

export default SceneEnvironment;
