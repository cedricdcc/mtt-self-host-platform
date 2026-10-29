import * as THREE from 'three';

/**
 * Dimensions of the authentic 1:1:1 diorama cube
 */
export const CUBE_SIZE = 40.0;
export const HALF_CUBE = CUBE_SIZE / 2.0; // 20.0

/**
 * Manages 3D atmospheric underwater environment, stratified 3-tier vertical lighting,
 * bathymetric gradient backdrop, animated volumetric sun god-rays, sculpted multi-zone seabed,
 * depth fog, ambient bubbles, the 1:1:1 diorama cube (in standard view), and the boundless
 * procedural world (in desktop mode).
 */
export class SceneEnvironment {
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  public sunLight: THREE.DirectionalLight;
  public sunlitLight: THREE.PointLight;
  public twilightLight: THREE.PointLight;
  public abyssalGlowLight: THREE.PointLight;
  private depthFog: THREE.FogExp2;
  private bubbleParticles: THREE.Points;
  private bubblePositions: Float32Array;
  private bubbleVelocities: Float32Array;
  private bubbleCount: number = 80;

  // 1:1:1 True Cube Vivarium Components (Standard View)
  public vivariumFrame: THREE.LineSegments | null = null;
  public bathymetricBackdrop: THREE.Mesh | null = null;
  public godRaysGroup: THREE.Group | null = null;
  public sandFloor: THREE.Mesh | null = null;
  public abyssalBaserock: THREE.Group | null = null;
  public waterSurface: THREE.Mesh | null = null;
  public dioramaPedestal: THREE.Mesh | null = null;
  public depthTicks: THREE.Group | null = null;
  public glassPanels: THREE.Group | null = null;
  private backdropTexture: THREE.CanvasTexture | null = null;

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
    this.ambientLight = new THREE.AmbientLight(0x38bdf8, 1.35);
    this.scene.add(this.ambientLight);

    // 3. Overhead Radiant Sun Light Source
    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    this.sunLight.position.set(25, 45, 25);
    this.scene.add(this.sunLight);

    // 4. Subtle Rim Spotlight (Bright Cyan)
    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.2);
    rimLight.position.set(-20, -15, -15);
    this.scene.add(rimLight);

    // 4b. Stratified 3-Tier Biome Lighting (Sunlit -> Twilight -> Abyssal Trench)
    this.sunlitLight = new THREE.PointLight(0x7dd3fc, 1.8, 38);
    this.sunlitLight.position.set(0, 14, 4);
    this.scene.add(this.sunlitLight);

    this.twilightLight = new THREE.PointLight(0x3b82f6, 1.15, 34);
    this.twilightLight.position.set(0, 0, -2);
    this.scene.add(this.twilightLight);

    this.abyssalGlowLight = new THREE.PointLight(0x22d3ee, 2.2, 30);
    this.abyssalGlowLight.position.set(0, -16, -3);
    this.scene.add(this.abyssalGlowLight);

    // 5. 1:1:1 True Cube Vivarium Framing, Bathymetric Backdrop, God-Rays & Sculpted Seabed
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
   * Initializes 1:1:1 Symmetrical Vivarium Glass Cube (40, 40, 40),
   * Bathymetric Gradient Backdrop, Volumetric God-Rays, and Sculpted Multi-Zone Seabed
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

    // 1b. Bathymetric Vertical Gradient Backdrop Plane (#0284c7 Sunlit -> #1e3a8a Twilight -> #070b14 Abyssal)
    const backdropGeo = new THREE.PlaneGeometry(CUBE_SIZE, CUBE_SIZE, 1, 24);
    const backdropPos = backdropGeo.attributes.position;
    const backdropColors = new Float32Array(backdropPos.count * 3);
    const sunlitColor = new THREE.Color('#0284c7');
    const twilightColor = new THREE.Color('#1e3a8a');
    const abyssalColor = new THREE.Color('#070b14');
    const tempColor = new THREE.Color();

    for (let i = 0; i < backdropPos.count; i++) {
      const vy = backdropPos.getY(i); // [-20, +20]
      const normalizedY = (vy + HALF_CUBE) / CUBE_SIZE; // 0 (bottom) to 1 (top)
      if (normalizedY >= 0.5) {
        const t = (normalizedY - 0.5) * 2.0;
        tempColor.copy(twilightColor).lerp(sunlitColor, t);
      } else {
        const t = normalizedY * 2.0;
        tempColor.copy(abyssalColor).lerp(twilightColor, t);
      }
      backdropColors[i * 3] = tempColor.r;
      backdropColors[i * 3 + 1] = tempColor.g;
      backdropColors[i * 3 + 2] = tempColor.b;
    }
    backdropGeo.setAttribute('color', new THREE.BufferAttribute(backdropColors, 3));

    const backdropCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (backdropCanvas) {
      backdropCanvas.width = 64;
      backdropCanvas.height = 512;
      const ctx = backdropCanvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0.0, '#0284c7'); // Sunlit zone (Y: +6 to +20)
        grad.addColorStop(0.5, '#1e3a8a'); // Twilight zone (Y: -6 to +6)
        grad.addColorStop(1.0, '#070b14'); // Abyssal trench (Y: -20 to -6)
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 512);
      }
      this.backdropTexture = new THREE.CanvasTexture(backdropCanvas);
    }

    const backdropMat = new THREE.MeshBasicMaterial({
      map: this.backdropTexture,
      vertexColors: !this.backdropTexture,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.bathymetricBackdrop = new THREE.Mesh(backdropGeo, backdropMat);
    this.bathymetricBackdrop.position.set(0, 0, -HALF_CUBE - 0.15);
    this.scene.add(this.bathymetricBackdrop);

    // 1c. Volumetric Sun God-Rays Group (5 angled translucent shafts descending Y = +19 down to Y = +5)
    this.godRaysGroup = new THREE.Group();
    const rayConfigs = [
      { x: -11.5, y: 12.0, z: -6.0, rotZ: -0.22, rotX: 0.12, opacity: 0.14, phase: 0.0 },
      { x: -5.0, y: 12.2, z: -2.5, rotZ: -0.18, rotX: 0.08, opacity: 0.17, phase: 1.3 },
      { x: 1.5, y: 12.0, z: -5.0, rotZ: -0.15, rotX: 0.1, opacity: 0.19, phase: 2.5 },
      { x: 7.5, y: 12.1, z: -1.5, rotZ: -0.2, rotX: 0.07, opacity: 0.15, phase: 3.8 },
      { x: 13.0, y: 11.8, z: -6.5, rotZ: -0.24, rotX: 0.11, opacity: 0.13, phase: 5.1 }
    ];

    rayConfigs.forEach((cfg) => {
      const rayGeo = new THREE.CylinderGeometry(0.8, 3.8, 16, 12, 1, true);
      const rayMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const rayMesh = new THREE.Mesh(rayGeo, rayMat);
      rayMesh.position.set(cfg.x, cfg.y, cfg.z);
      rayMesh.rotation.set(cfg.rotX, 0, cfg.rotZ);
      rayMesh.userData = {
        baseOpacity: cfg.opacity,
        baseRotZ: cfg.rotZ,
        baseRotX: cfg.rotX,
        phase: cfg.phase
      };
      this.godRaysGroup!.add(rayMesh);
    });
    this.scene.add(this.godRaysGroup);

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

    // 3. Sculpted Multi-Zone Seabed (Perimeter Sandy Reef Dunes + Central/Rear Abyssal Volcanic Trench)
    const floorGeo = new THREE.BoxGeometry(CUBE_SIZE, 1.5, CUBE_SIZE, 24, 2, 24);
    const floorPos = floorGeo.attributes.position;
    const floorColors = new Float32Array(floorPos.count * 3);
    const sandDuneColor = new THREE.Color(0xfde047);
    const twilightSlopeColor = new THREE.Color(0x334155);
    const abyssTrenchColor = new THREE.Color(0x0f172a);
    const vertColor = new THREE.Color();

    for (let i = 0; i < floorPos.count; i++) {
      const vx = floorPos.getX(i);
      const vy = floorPos.getY(i);
      const vz = floorPos.getZ(i);

      // Distance from the central-rear abyssal trench basin (centered at X = 0, Z = -5)
      const dx = vx / 14.0;
      const dz = (vz + 5.0) / 12.0;
      const trenchRadial = Math.sqrt(dx * dx + dz * dz);
      const trenchFactor = Math.max(0, Math.min(1, 1.0 - trenchRadial));

      // Sculpt top and upper vertices while keeping bottom base grounded on pedestal
      if (vy > -0.6) {
        const perimeterDunes =
          Math.sin(vx * 0.25) * 0.45 +
          Math.cos(vz * 0.22) * 0.4 +
          Math.max(0, (Math.abs(vx) - 8) * 0.08);
        const trenchDepression = -trenchFactor * 1.65;
        const sculptedOffset = perimeterDunes * (1.0 - trenchFactor * 0.7) + trenchDepression;
        floorPos.setY(i, vy + sculptedOffset);
      }

      if (trenchFactor > 0.45) {
        const t = (trenchFactor - 0.45) / 0.55;
        vertColor.copy(twilightSlopeColor).lerp(abyssTrenchColor, t);
      } else {
        const t = trenchFactor / 0.45;
        vertColor.copy(sandDuneColor).lerp(twilightSlopeColor, t);
      }
      floorColors[i * 3] = vertColor.r;
      floorColors[i * 3 + 1] = vertColor.g;
      floorColors[i * 3 + 2] = vertColor.b;
    }
    floorGeo.setAttribute('color', new THREE.BufferAttribute(floorColors, 3));
    floorGeo.computeVertexNormals();

    const floorMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      vertexColors: true
    });
    this.sandFloor = new THREE.Mesh(floorGeo, floorMat);
    this.sandFloor.position.set(0, -HALF_CUBE, 0);
    this.scene.add(this.sandFloor);

    // 3b. Abyssal Trench Baserock Outcrops along the central/rear trench rim
    this.abyssalBaserock = new THREE.Group();
    const basaltMat = new THREE.MeshToonMaterial({ color: 0x0f172a });
    const glowingVeinMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const ridgeSpecs = [
      { x: -9.5, y: -19.4, z: -8.0, sx: 2.8, sy: 1.4, sz: 2.0 },
      { x: 9.5, y: -19.4, z: -7.5, sx: 2.6, sy: 1.5, sz: 2.1 },
      { x: -4.0, y: -19.6, z: -15.5, sx: 3.4, sy: 1.8, sz: 2.2 },
      { x: 5.0, y: -19.6, z: -15.0, sx: 3.2, sy: 1.7, sz: 2.0 }
    ];
    ridgeSpecs.forEach((spec, idx) => {
      const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
      rockGeo.scale(spec.sx, spec.sy, spec.sz);
      const rockMesh = new THREE.Mesh(rockGeo, basaltMat);
      rockMesh.position.set(spec.x, spec.y, spec.z);
      rockMesh.rotation.y = idx * 0.8;
      this.abyssalBaserock!.add(rockMesh);

      const veinGeo = new THREE.BoxGeometry(spec.sx * 0.9, 0.12, 0.18);
      const veinMesh = new THREE.Mesh(veinGeo, glowingVeinMat);
      veinMesh.position.set(spec.x, spec.y + 0.45, spec.z + 0.6);
      veinMesh.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.18;
      this.abyssalBaserock!.add(veinMesh);
    });
    this.scene.add(this.abyssalBaserock);

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

    // Toggle Diorama Cube & 3-Tier Vivarium Backdrop/God-Rays Visibility
    if (this.vivariumFrame) this.vivariumFrame.visible = !enabled;
    if (this.bathymetricBackdrop) this.bathymetricBackdrop.visible = !enabled;
    if (this.godRaysGroup) this.godRaysGroup.visible = !enabled;
    if (this.sandFloor) this.sandFloor.visible = !enabled;
    if (this.abyssalBaserock) this.abyssalBaserock.visible = !enabled;
    if (this.dioramaPedestal) this.dioramaPedestal.visible = !enabled;
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
   * Update particle animations, volumetric god-ray shimmer, abyssal glow pulse,
   * cloud drift, and infinite terrain tracking
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

    // Shimmer volumetric god-rays in Sunlit zone
    if (this.godRaysGroup && this.godRaysGroup.visible) {
      this.godRaysGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          const u = child.userData || {};
          const baseOp = typeof u.baseOpacity === 'number' ? u.baseOpacity : 0.15;
          const phase = typeof u.phase === 'number' ? u.phase : 0;
          const mat = child.material as THREE.MeshBasicMaterial;
          mat.opacity = baseOp + Math.sin(time * 1.6 + phase) * 0.045;
          child.rotation.z = (u.baseRotZ || -0.18) + Math.sin(time * 0.7 + phase) * 0.025;
        }
      });
    }

    // Gentle bioluminescent pulse in Abyssal trench
    if (this.abyssalGlowLight) {
      this.abyssalGlowLight.intensity = 2.2 + Math.sin(time * 2.1) * 0.35;
    }

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
    this.scene.remove(this.bubbleParticles);

    if (this.vivariumFrame) {
      this.vivariumFrame.geometry.dispose();
      (this.vivariumFrame.material as THREE.Material).dispose();
      this.scene.remove(this.vivariumFrame);
    }
    if (this.bathymetricBackdrop) {
      this.bathymetricBackdrop.geometry.dispose();
      (this.bathymetricBackdrop.material as THREE.Material).dispose();
      if (this.backdropTexture) {
        this.backdropTexture.dispose();
      }
      this.scene.remove(this.bathymetricBackdrop);
    }
    if (this.godRaysGroup) {
      this.godRaysGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      this.scene.remove(this.godRaysGroup);
    }
    if (this.sandFloor) {
      this.sandFloor.geometry.dispose();
      (this.sandFloor.material as THREE.Material).dispose();
      this.scene.remove(this.sandFloor);
    }
    if (this.abyssalBaserock) {
      this.abyssalBaserock.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      this.scene.remove(this.abyssalBaserock);
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
    if (this.sunlitLight) {
      this.scene.remove(this.sunlitLight);
    }
    if (this.twilightLight) {
      this.scene.remove(this.twilightLight);
    }
    if (this.abyssalGlowLight) {
      this.scene.remove(this.abyssalGlowLight);
    }
  }
}

export default SceneEnvironment;
