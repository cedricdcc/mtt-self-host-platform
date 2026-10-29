import * as THREE from 'three';

interface KelpSegment {
  mesh: THREE.Mesh;
  initialX: number;
  initialZ: number;
  height: number;
}

interface KelpRibbon {
  segments: KelpSegment[];
  baseX: number;
  baseZ: number;
  speedMultiplier: number;
  phaseOffset: number;
}

interface Anemone {
  group: THREE.Group;
  tentacles: THREE.Mesh[];
  phase: number;
}

interface GorgonianFan {
  group: THREE.Group;
  phase: number;
  baseRotY: number;
}

interface TubeWormPlume {
  mesh: THREE.Mesh;
  phase: number;
  baseRotZ: number;
}

/**
 * Manages procedural animated 3-tier vertical reef-to-abyss ecology:
 * - Sunlit Coral Shelves & Arch (Y: +6.5 to +11.5) with staghorn corals, brain corals, swaying emerald sea-blades, and pulsing sea anemones
 * - Twilight Basalt Canyon Wall (Y: -5 to +4) with bioluminescent violet gorgonian sea-fans and glowing cyan sponge chimneys
 * - Abyssal Hydrothermal Vents (Y: -19.2) with 3 volcanic black-smoker chimneys, glowing mineral fissures, crimson-tipped giant tube worms, and translucent crystal spires
 * - Seabed Kelp Forest & Coral/Anemone Groves
 */
export class FoliageSystem {
  private scene: THREE.Scene;
  private foliageGroup: THREE.Group;
  public sunlitShelfGroup: THREE.Group;
  public twilightCanyonGroup: THREE.Group;
  public abyssalVentsGroup: THREE.Group;

  private kelpRibbons: KelpRibbon[] = [];
  private anemones: Anemone[] = [];
  private corals: THREE.Group[] = [];
  private gorgonianFans: GorgonianFan[] = [];
  private tubeWormPlumes: TubeWormPlume[] = [];
  private fissureGlowMeshes: THREE.Mesh[] = [];

  // Reusable materials
  private kelpMaterialBase: THREE.MeshToonMaterial;
  private kelpMaterialTip: THREE.MeshToonMaterial;
  private coralPinkMat: THREE.MeshToonMaterial;
  private coralVioletMat: THREE.MeshToonMaterial;
  private coralAmberMat: THREE.MeshToonMaterial;
  private anemoneCyanMat: THREE.MeshToonMaterial;
  private anemoneMagentaMat: THREE.MeshToonMaterial;
  private rockMat: THREE.MeshToonMaterial;

  // 3-Tier Biome Specialized Materials
  private limestoneShelfMat: THREE.MeshToonMaterial;
  private twilightBasaltMat: THREE.MeshToonMaterial;
  private twilightIndigoMat: THREE.MeshToonMaterial;
  private gorgonianVioletMat: THREE.MeshToonMaterial;
  private spongeCyanMat: THREE.MeshToonMaterial;
  private abyssalSmokerMat: THREE.MeshToonMaterial;
  private fissureCyanMat: THREE.MeshBasicMaterial;
  private fissureAmberMat: THREE.MeshBasicMaterial;
  private tubeStalkMat: THREE.MeshToonMaterial;
  private tubeCrimsonPlumeMat: THREE.MeshToonMaterial;
  private crystalCyanMat: THREE.MeshToonMaterial;
  private crystalVioletMat: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.foliageGroup = new THREE.Group();
    this.sunlitShelfGroup = new THREE.Group();
    this.twilightCanyonGroup = new THREE.Group();
    this.abyssalVentsGroup = new THREE.Group();

    this.foliageGroup.add(this.sunlitShelfGroup);
    this.foliageGroup.add(this.twilightCanyonGroup);
    this.foliageGroup.add(this.abyssalVentsGroup);
    this.scene.add(this.foliageGroup);

    // Initialize stylized toon materials
    this.kelpMaterialBase = new THREE.MeshToonMaterial({ color: 0x059669 }); // emerald green
    this.kelpMaterialTip = new THREE.MeshToonMaterial({ color: 0x84cc16 });  // bright lime
    this.coralPinkMat = new THREE.MeshToonMaterial({ color: 0xfb7185 });     // coral peach/pink
    this.coralVioletMat = new THREE.MeshToonMaterial({ color: 0xa855f7 });   // vibrant violet
    this.coralAmberMat = new THREE.MeshToonMaterial({ color: 0xf59e0b });    // warm amber
    this.anemoneCyanMat = new THREE.MeshToonMaterial({ color: 0x06b6d4 });   // luminous cyan
    this.anemoneMagentaMat = new THREE.MeshToonMaterial({ color: 0xec4899 });// bright magenta
    this.rockMat = new THREE.MeshToonMaterial({ color: 0x475569 });          // slate rock

    // 3-Tier Biome Materials
    this.limestoneShelfMat = new THREE.MeshToonMaterial({ color: 0xd6d3d1 }); // warm reef limestone
    this.twilightBasaltMat = new THREE.MeshToonMaterial({ color: 0x1e293b }); // dark slate canyon rock
    this.twilightIndigoMat = new THREE.MeshToonMaterial({ color: 0x312e81 }); // deep indigo ledge
    this.gorgonianVioletMat = new THREE.MeshToonMaterial({
      color: 0xc084fc,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.55
    });
    this.spongeCyanMat = new THREE.MeshToonMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.65
    });
    this.abyssalSmokerMat = new THREE.MeshToonMaterial({ color: 0x0f172a }); // volcanic black-smoker basalt
    this.fissureCyanMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.9
    });
    this.fissureAmberMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9
    });
    this.tubeStalkMat = new THREE.MeshToonMaterial({ color: 0xe2e8f0 }); // ivory chitin tube
    this.tubeCrimsonPlumeMat = new THREE.MeshToonMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 0.45
    });
    this.crystalCyanMat = new THREE.MeshToonMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.82
    });
    this.crystalVioletMat = new THREE.MeshToonMaterial({
      color: 0xa855f7,
      emissive: 0x581c87,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.82
    });

    // Construct seabed & 3-tier vertical biome ecology
    this.createKelpForest();
    this.createCoralsAndAnemones();
    this.createSunlitCoralShelf();
    this.createTwilightCanyonWall();
    this.createAbyssalHydrothermalVents();
  }

  public setDesktopMode(enabled: boolean): void {
    this.sunlitShelfGroup.visible = !enabled;
    this.twilightCanyonGroup.visible = !enabled;
  }

  /**
   * Builds raised limestone reef ledges & a coral arch in the Sunlit zone (Y: +6.5 to +11.5)
   * along the rear-left and rear-right walls, populated with staghorn corals, brain corals,
   * swaying emerald sea-blades, and pulsing sea anemones.
   */
  public createSunlitCoralShelf(): void {
    const shelfSpecs = [
      { x: -11.5, y: 7.8, z: -13.5, sx: 6.2, sy: 1.4, sz: 4.5, tint: 'pink' },
      { x: 11.5, y: 8.4, z: -13.5, sx: 6.0, sy: 1.5, sz: 4.5, tint: 'violet' }
    ];

    shelfSpecs.forEach((spec, sIdx) => {
      const shelfLedge = new THREE.Group();
      shelfLedge.position.set(spec.x, spec.y, spec.z);

      // 1. Stepped limestone reef terrace slab
      const mainSlabGeo = new THREE.CylinderGeometry(spec.sx * 0.52, spec.sx * 0.38, spec.sy, 8);
      mainSlabGeo.scale(1.2, 1.0, 0.85);
      const mainSlab = new THREE.Mesh(mainSlabGeo, this.limestoneShelfMat);
      shelfLedge.add(mainSlab);

      const upperStepGeo = new THREE.CylinderGeometry(spec.sx * 0.36, spec.sx * 0.3, spec.sy * 0.8, 7);
      const upperStep = new THREE.Mesh(upperStepGeo, this.limestoneShelfMat);
      upperStep.position.set(sIdx === 0 ? -0.9 : 0.9, spec.sy * 0.65, -0.5);
      shelfLedge.add(upperStep);

      // 2. Colorful staghorn coral branches on the shelf
      const branchMat = spec.tint === 'pink' ? this.coralPinkMat : this.coralVioletMat;
      for (let b = 0; b < 5; b++) {
        const angle = (b / 5) * Math.PI * 2;
        const h = 1.6 + (b % 3) * 0.45;
        const brGeo = new THREE.CylinderGeometry(0.14, 0.22, h, 6);
        const brMesh = new THREE.Mesh(brGeo, branchMat);
        brMesh.position.set(Math.cos(angle) * 1.4, spec.sy * 0.5 + h * 0.45, Math.sin(angle) * 0.9);
        brMesh.rotation.z = Math.cos(angle) * 0.28;
        brMesh.rotation.x = Math.sin(angle) * 0.28;

        const tipGeo = new THREE.SphereGeometry(0.2, 6, 6);
        const tipMesh = new THREE.Mesh(tipGeo, branchMat);
        tipMesh.position.y = h * 0.5;
        brMesh.add(tipMesh);
        shelfLedge.add(brMesh);
      }

      // 3. Brain coral dome on shelf
      const brainGeo = new THREE.DodecahedronGeometry(0.95, 1);
      const brainMesh = new THREE.Mesh(brainGeo, this.coralAmberMat);
      brainMesh.position.set(sIdx === 0 ? 1.2 : -1.2, spec.sy * 0.5 + 0.55, 0.4);
      brainMesh.scale.set(1.15, 0.85, 1.0);
      shelfLedge.add(brainMesh);

      // 4. Pulsing sea anemone on the shelf terrace
      const anemoneGroup = new THREE.Group();
      anemoneGroup.position.set(0, spec.sy * 0.5 + 0.3, 0.6);
      const tentacleMat = sIdx === 0 ? this.anemoneCyanMat : this.anemoneMagentaMat;
      const tentacles: THREE.Mesh[] = [];
      for (let t = 0; t < 8; t++) {
        const tAngle = (t / 8) * Math.PI * 2;
        const tGeo = new THREE.CylinderGeometry(0.07, 0.14, 1.2, 5);
        const tentacle = new THREE.Mesh(tGeo, tentacleMat);
        tentacle.position.set(Math.cos(tAngle) * 0.38, 0.55, Math.sin(tAngle) * 0.38);
        tentacle.rotation.z = Math.cos(tAngle) * 0.38;
        tentacle.rotation.x = Math.sin(tAngle) * 0.38;
        anemoneGroup.add(tentacle);
        tentacles.push(tentacle);
      }
      shelfLedge.add(anemoneGroup);
      this.anemones.push({
        group: anemoneGroup,
        tentacles,
        phase: 2.0 + sIdx * 1.4
      });

      // 5. Swaying emerald sea-blades rooted on the shelf edge
      for (let k = 0; k < 2; k++) {
        const bladeGroup = new THREE.Group();
        const bx = (k === 0 ? -1.8 : 1.8);
        bladeGroup.position.set(bx, spec.sy * 0.5, -0.3);
        const segs: KelpSegment[] = [];
        const segCount = 4;
        const segH = 1.25;
        for (let s = 0; s < segCount; s++) {
          const w = 0.65 * (1.0 - (s / segCount) * 0.45);
          const g = new THREE.PlaneGeometry(w, segH);
          const m = s >= 2 ? this.kelpMaterialTip : this.kelpMaterialBase;
          const mesh = new THREE.Mesh(g, m);
          mesh.position.set(0, s * segH * 0.9 + segH * 0.5, 0);
          bladeGroup.add(mesh);
          segs.push({
            mesh,
            initialX: 0,
            initialZ: 0,
            height: s * segH * 0.9 + segH * 0.5
          });
        }
        shelfLedge.add(bladeGroup);
        this.kelpRibbons.push({
          segments: segs,
          baseX: spec.x + bx,
          baseZ: spec.z,
          speedMultiplier: 2.0 + k * 0.3,
          phaseOffset: sIdx * 1.1 + k * 0.7
        });
      }

      this.sunlitShelfGroup.add(shelfLedge);
      this.corals.push(shelfLedge);
    });

    // 6. Central Sunlit Coral Arch spanning between the rear ledges (Y: +9.0 to +11.5, Z = -12.5)
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 9.2, -12.5);

    const archSpanGeo = new THREE.TorusGeometry(4.2, 0.75, 7, 16, Math.PI);
    const archSpan = new THREE.Mesh(archSpanGeo, this.limestoneShelfMat);
    archSpan.scale.set(1.25, 0.6, 0.9);
    archGroup.add(archSpan);

    // Crown staghorn & amber coral clusters atop the arch (reaching Y ~ +11.5)
    const crownPositions = [-2.4, 0, 2.4];
    crownPositions.forEach((cx, cIdx) => {
      const crownMat = cIdx === 1 ? this.coralAmberMat : cIdx === 0 ? this.coralPinkMat : this.coralVioletMat;
      const crownGeo = new THREE.DodecahedronGeometry(0.7, 1);
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.position.set(cx, 2.1 - Math.abs(cx) * 0.22, 0);
      archGroup.add(crownMesh);
    });

    this.sunlitShelfGroup.add(archGroup);
  }

  /**
   * Builds stepped slate/indigo basalt canyon outcrops in the Twilight zone (Y: -5 to +4)
   * along the rear and side walls with bioluminescent violet gorgonian sea-fans and glowing cyan sponge chimneys.
   */
  public createTwilightCanyonWall(): void {
    const outcropSpecs = [
      { x: -16.2, y: 2.2, z: -10.5, rotY: 0.45, scale: 1.1 },
      { x: -9.5, y: -1.4, z: -15.5, rotY: 0.15, scale: 1.25 },
      { x: 0.0, y: 1.8, z: -16.2, rotY: 0.0, scale: 1.3 },
      { x: 9.8, y: -2.6, z: -15.2, rotY: -0.18, scale: 1.2 },
      { x: 16.2, y: 0.6, z: -10.0, rotY: -0.45, scale: 1.1 }
    ];

    outcropSpecs.forEach((spec, idx) => {
      const canyonOutcrop = new THREE.Group();
      canyonOutcrop.position.set(spec.x, spec.y, spec.z);
      canyonOutcrop.rotation.y = spec.rotY;
      canyonOutcrop.scale.setScalar(spec.scale);

      // 1. Stepped slate/indigo basalt ledges
      const lowerStepGeo = new THREE.CylinderGeometry(2.4, 1.5, 1.3, 6);
      lowerStepGeo.scale(1.3, 1.0, 0.8);
      const lowerStep = new THREE.Mesh(lowerStepGeo, this.twilightBasaltMat);
      canyonOutcrop.add(lowerStep);

      const upperStepGeo = new THREE.CylinderGeometry(1.7, 2.1, 0.9, 6);
      const upperStep = new THREE.Mesh(upperStepGeo, this.twilightIndigoMat);
      upperStep.position.set(idx % 2 === 0 ? -0.5 : 0.5, 0.85, -0.2);
      canyonOutcrop.add(upperStep);

      // 2. Bioluminescent violet gorgonian sea-fan
      const fanGroup = new THREE.Group();
      fanGroup.position.set(-0.7, 1.2, 0.35);
      const fanBranches = 5;
      for (let f = 0; f < fanBranches; f++) {
        const spread = ((f / (fanBranches - 1)) - 0.5) * 1.1;
        const stalkGeo = new THREE.CylinderGeometry(0.05, 0.1, 2.0, 5);
        const stalk = new THREE.Mesh(stalkGeo, this.gorgonianVioletMat);
        stalk.position.set(Math.sin(spread) * 0.7, Math.cos(spread) * 0.9, 0);
        stalk.rotation.z = -spread;

        // Lateral fan fronds
        const frondGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.8, 4);
        const frond = new THREE.Mesh(frondGeo, this.gorgonianVioletMat);
        frond.position.set(0.2, 0.2, 0);
        frond.rotation.z = -0.55;
        stalk.add(frond);

        fanGroup.add(stalk);
      }
      canyonOutcrop.add(fanGroup);
      this.gorgonianFans.push({
        group: fanGroup,
        phase: idx * 0.9,
        baseRotY: 0.2
      });

      // 3. Glowing cyan sponge chimneys (2 to 3 tubular chimneys per outcrop)
      const chimneyCount = 2 + (idx % 2);
      for (let c = 0; c < chimneyCount; c++) {
        const chHeight = 1.4 + c * 0.45;
        const chRadius = 0.24 + (c % 2) * 0.06;
        const chGeo = new THREE.CylinderGeometry(chRadius * 1.15, chRadius * 0.9, chHeight, 8, 1, true);
        const chMesh = new THREE.Mesh(chGeo, this.spongeCyanMat);
        chMesh.position.set(0.55 + c * 0.42, 0.8 + chHeight * 0.45, (c - 0.5) * 0.3);
        chMesh.rotation.z = (c - 0.5) * -0.14;

        // Glowing cyan rim ring at top of sponge chimney
        const rimGeo = new THREE.TorusGeometry(chRadius * 1.12, 0.05, 6, 12);
        const rimMesh = new THREE.Mesh(rimGeo, this.fissureCyanMat);
        rimMesh.rotation.x = Math.PI / 2;
        rimMesh.position.y = chHeight * 0.5;
        chMesh.add(rimMesh);

        canyonOutcrop.add(chMesh);
      }

      this.twilightCanyonGroup.add(canyonOutcrop);
    });
  }

  /**
   * Builds 3 volcanic black-smoker vent chimneys on the Abyssal trench floor (Y = -19.2)
   * with glowing cyan/amber mineral fissures, clusters of crimson-tipped giant tube worms,
   * and translucent crystal spires.
   */
  public createAbyssalHydrothermalVents(): void {
    const ventConfigs = [
      { x: -6.8, y: -19.2, z: -11.0, height: 4.8, fissureType: 'cyan' },
      { x: 0.4, y: -19.2, z: -13.2, height: 5.6, fissureType: 'amber' },
      { x: 7.2, y: -19.2, z: -10.5, height: 4.5, fissureType: 'cyan' }
    ];

    ventConfigs.forEach((cfg, vIdx) => {
      const ventGroup = new THREE.Group();
      ventGroup.position.set(cfg.x, cfg.y, cfg.z);

      // 1. Volcanic black-smoker chimney spire & stepped basal mound
      const moundGeo = new THREE.ConeGeometry(2.4, 1.8, 7);
      const moundMesh = new THREE.Mesh(moundGeo, this.abyssalSmokerMat);
      moundMesh.position.y = 0.8;
      ventGroup.add(moundMesh);

      const chimneyGeo = new THREE.CylinderGeometry(0.65, 1.45, cfg.height, 7);
      const chimneyMesh = new THREE.Mesh(chimneyGeo, this.abyssalSmokerMat);
      chimneyMesh.position.y = cfg.height * 0.5;
      ventGroup.add(chimneyMesh);

      // Glowing crater rim at chimney summit
      const fissureMat = cfg.fissureType === 'amber' ? this.fissureAmberMat : this.fissureCyanMat;
      const craterRimGeo = new THREE.TorusGeometry(0.62, 0.14, 6, 12);
      const craterRim = new THREE.Mesh(craterRimGeo, fissureMat);
      craterRim.rotation.x = Math.PI / 2;
      craterRim.position.y = cfg.height;
      ventGroup.add(craterRim);
      this.fissureGlowMeshes.push(craterRim);

      // 2. Glowing cyan/amber mineral fissures along the chimney flanks
      for (let f = 0; f < 3; f++) {
        const fMat = (f + vIdx) % 2 === 0 ? this.fissureCyanMat : this.fissureAmberMat;
        const fissureBandGeo = new THREE.BoxGeometry(0.16, cfg.height * 0.55, 0.22);
        const fissureBand = new THREE.Mesh(fissureBandGeo, fMat);
        const fAngle = (f / 3) * Math.PI * 2 + 0.4;
        fissureBand.position.set(
          Math.cos(fAngle) * 0.95,
          cfg.height * 0.42,
          Math.sin(fAngle) * 0.95
        );
        fissureBand.rotation.z = (f - 1) * 0.15;
        ventGroup.add(fissureBand);
        this.fissureGlowMeshes.push(fissureBand);
      }

      // 3. Clusters of crimson-tipped giant tube worms (Riftia pachyptila)
      const wormCount = 6;
      for (let w = 0; w < wormCount; w++) {
        const wAngle = (w / wormCount) * Math.PI * 2 + vIdx * 0.5;
        const wRadius = 1.45 + (w % 2) * 0.35;
        const stalkHeight = 1.5 + (w % 3) * 0.4;

        const wormGroup = new THREE.Group();
        wormGroup.position.set(Math.cos(wAngle) * wRadius, 0.3, Math.sin(wAngle) * wRadius);

        const stalkGeo = new THREE.CylinderGeometry(0.09, 0.12, stalkHeight, 6);
        const stalkMesh = new THREE.Mesh(stalkGeo, this.tubeStalkMat);
        stalkMesh.position.y = stalkHeight * 0.5;
        const baseLean = (w % 2 === 0 ? 1 : -1) * 0.16;
        stalkMesh.rotation.z = baseLean;
        wormGroup.add(stalkMesh);

        // Crimson branchial plume tip
        const plumeGeo = new THREE.ConeGeometry(0.17, 0.5, 6);
        const plumeMesh = new THREE.Mesh(plumeGeo, this.tubeCrimsonPlumeMat);
        plumeMesh.position.y = stalkHeight * 0.5 + 0.2;
        stalkMesh.add(plumeMesh);

        this.tubeWormPlumes.push({
          mesh: stalkMesh,
          phase: vIdx * 1.3 + w * 0.6,
          baseRotZ: baseLean
        });

        ventGroup.add(wormGroup);
      }

      // 4. Translucent bioluminescent crystal spires around the vent base
      const crystalCount = 4;
      for (let c = 0; c < crystalCount; c++) {
        const cAngle = (c / crystalCount) * Math.PI * 2 + 0.35;
        const cHeight = 1.6 + (c % 2) * 0.7;
        const cMat = c % 2 === 0 ? this.crystalCyanMat : this.crystalVioletMat;
        const crystalGeo = new THREE.ConeGeometry(0.32, cHeight, 5);
        const crystalMesh = new THREE.Mesh(crystalGeo, cMat);
        crystalMesh.position.set(
          Math.cos(cAngle) * 2.1,
          cHeight * 0.45,
          Math.sin(cAngle) * 2.1
        );
        crystalMesh.rotation.z = Math.cos(cAngle) * 0.25;
        crystalMesh.rotation.x = Math.sin(cAngle) * 0.25;
        ventGroup.add(crystalMesh);
      }

      this.abyssalVentsGroup.add(ventGroup);
    });
  }

  /**
   * Generates procedural swaying kelp ribbons along the perimeter of the seabed
   */
  public createKelpForest(): void {
    // Placement coordinates along rear perimeter and sides (within [-18, 18])
    const kelpCoords = [
      { x: -17, z: -14 }, { x: -13, z: -15 }, { x: -8, z: -14 },
      { x: -3, z: -15 },  { x: 2, z: -14 },   { x: 7, z: -15 },
      { x: 12, z: -14 },  { x: 16, z: -15 },  { x: 17, z: -11 },
      // Left edge
      { x: -17, z: -7 },  { x: -17, z: 2 },   { x: -16, z: 8 },
      // Right edge
      { x: 17, z: -5 },   { x: 17, z: 3 },    { x: 16, z: 9 }
    ];

    const segmentHeight = 2.4;
    const segmentWidth = 1.1;

    kelpCoords.forEach((coord, kIdx) => {
      const segmentCount = 6 + (kIdx % 3);
      const segments: KelpSegment[] = [];
      const ribbonGroup = new THREE.Group();
      ribbonGroup.position.set(coord.x, -19.2, coord.z);

      let currentY = 0;

      for (let s = 0; s < segmentCount; s++) {
        const progress = s / segmentCount;
        const width = segmentWidth * (1.0 - progress * 0.45);
        const geo = new THREE.PlaneGeometry(width, segmentHeight);
        const mat = progress > 0.5 ? this.kelpMaterialTip : this.kelpMaterialBase;

        const segMesh = new THREE.Mesh(geo, mat);
        segMesh.position.set(0, currentY + segmentHeight / 2, 0);
        segMesh.rotation.y = (kIdx * 0.4) + (s * 0.1);
        ribbonGroup.add(segMesh);

        segments.push({
          mesh: segMesh,
          initialX: 0,
          initialZ: 0,
          height: currentY + segmentHeight / 2
        });

        currentY += segmentHeight * 0.92;
      }

      this.foliageGroup.add(ribbonGroup);
      this.kelpRibbons.push({
        segments,
        baseX: coord.x,
        baseZ: coord.z,
        speedMultiplier: 1.6 + (kIdx % 4) * 0.25,
        phaseOffset: kIdx * 0.55
      });
    });
  }

  /**
   * Generates colorful staghorn branch corals, brain corals, and breathing sea anemones
   */
  public createCoralsAndAnemones(): void {
    // Clustered outcropping positions on the sandy seabed
    const reefBases = [
      { x: -14, z: -6, type: 'mixed_pink' },
      { x: 12, z: -5, type: 'mixed_violet' },
      { x: -8, z: 8, type: 'anemone_grove' },
      { x: 10, z: 7, type: 'brain_coral_cluster' },
      { x: -17, z: 4, type: 'staghorn_patch' },
      { x: 16, z: -1, type: 'anemone_magenta' }
    ];

    reefBases.forEach((base, idx) => {
      const outcropping = new THREE.Group();
      outcropping.position.set(base.x, -19.2, base.z);

      // 1. Base Rock
      const rockGeo = new THREE.SphereGeometry(1.6, 7, 5);
      rockGeo.scale(1.2, 0.45, 1.1);
      const rock = new THREE.Mesh(rockGeo, this.rockMat);
      rock.position.y = 0.3;
      outcropping.add(rock);

      // 2. Add Coral / Anemone variants
      if (base.type.includes('staghorn') || base.type.includes('pink') || base.type.includes('violet')) {
        const branchMat = base.type.includes('violet') ? this.coralVioletMat : this.coralPinkMat;
        const branchCount = 5 + (idx % 3);

        for (let b = 0; b < branchCount; b++) {
          const angle = (b / branchCount) * Math.PI * 2;
          const branchHeight = 2.2 + (b % 3) * 0.6;
          const branchGeo = new THREE.CylinderGeometry(0.18, 0.28, branchHeight, 6);
          const branch = new THREE.Mesh(branchGeo, branchMat);

          branch.position.set(Math.cos(angle) * 0.7, branchHeight * 0.5 + 0.3, Math.sin(angle) * 0.7);
          branch.rotation.z = Math.cos(angle) * 0.35;
          branch.rotation.x = Math.sin(angle) * 0.35;

          // Tip sphere
          const tipGeo = new THREE.SphereGeometry(0.24, 6, 6);
          const tip = new THREE.Mesh(tipGeo, branchMat);
          tip.position.y = branchHeight * 0.5;
          branch.add(tip);

          outcropping.add(branch);
        }
      }

      if (base.type.includes('brain') || idx % 2 === 0) {
        // Brain Coral geodesic dome
        const brainGeo = new THREE.DodecahedronGeometry(1.2, 1);
        const brainMesh = new THREE.Mesh(brainGeo, this.coralAmberMat);
        brainMesh.position.set(0.6, 0.8, -0.4);
        brainMesh.scale.set(1.1, 0.9, 1.0);
        outcropping.add(brainMesh);
      }

      if (base.type.includes('anemone') || idx % 2 !== 0) {
        // Pulsing Anemone
        const anemoneGroup = new THREE.Group();
        anemoneGroup.position.set(-0.5, 0.5, 0.4);

        const tentacleMat = idx % 2 === 0 ? this.anemoneCyanMat : this.anemoneMagentaMat;
        const tentacleCount = 8;
        const tentacles: THREE.Mesh[] = [];

        for (let t = 0; t < tentacleCount; t++) {
          const tAngle = (t / tentacleCount) * Math.PI * 2;
          const tGeo = new THREE.CylinderGeometry(0.08, 0.16, 1.4, 5);
          const tentacle = new THREE.Mesh(tGeo, tentacleMat);

          tentacle.position.set(Math.cos(tAngle) * 0.45, 0.7, Math.sin(tAngle) * 0.45);
          tentacle.rotation.z = Math.cos(tAngle) * 0.4;
          tentacle.rotation.x = Math.sin(tAngle) * 0.4;

          anemoneGroup.add(tentacle);
          tentacles.push(tentacle);
        }

        outcropping.add(anemoneGroup);
        this.anemones.push({
          group: anemoneGroup,
          tentacles,
          phase: idx * 1.2
        });
      }

      this.foliageGroup.add(outcropping);
      this.corals.push(outcropping);
    });
  }

  /**
   * Updates procedural swaying and breathing animations per frame across all 3 tiers
   */
  public update(delta: number, time: number): void {
    // 1. Kelp & Sunlit Sea-Blade Ribbon Harmonic Sway
    this.kelpRibbons.forEach((ribbon) => {
      ribbon.segments.forEach((seg, sIdx) => {
        const swayAmount = (sIdx + 1) * 0.08;
        const wave = Math.sin(time * ribbon.speedMultiplier + ribbon.phaseOffset + sIdx * 0.45);
        seg.mesh.position.x = seg.initialX + wave * swayAmount;
        seg.mesh.rotation.z = wave * 0.07 * (sIdx + 1);
      });
    });

    // 2. Anemone Rhythmic Breathing Expansion/Contraction
    this.anemones.forEach((anemone) => {
      const breath = 1.0 + Math.sin(time * 3.0 + anemone.phase) * 0.18;
      anemone.tentacles.forEach((tentacle, tIdx) => {
        tentacle.scale.set(1.0, breath, 1.0);
        tentacle.rotation.y = Math.sin(time * 2.0 + tIdx) * 0.1;
      });
    });

    // 3. Subtle Coral Sway in water currents
    this.corals.forEach((coral, cIdx) => {
      coral.rotation.y = Math.sin(time * 0.8 + cIdx) * 0.03;
    });

    // 4. Twilight Bioluminescent Gorgonian Sea-Fan Sway
    this.gorgonianFans.forEach((fan) => {
      fan.group.rotation.y = fan.baseRotY + Math.sin(time * 1.4 + fan.phase) * 0.12;
      fan.group.rotation.z = Math.cos(time * 1.1 + fan.phase) * 0.06;
    });

    // 5. Abyssal Giant Tube Worm Plume Sway & Hydrothermal Fissure Pulse
    this.tubeWormPlumes.forEach((worm) => {
      worm.mesh.rotation.z = worm.baseRotZ + Math.sin(time * 2.2 + worm.phase) * 0.09;
    });

    const fissurePulse = 0.78 + Math.sin(time * 3.2) * 0.18;
    this.fissureCyanMat.opacity = fissurePulse;
    this.fissureAmberMat.opacity = 0.78 + Math.cos(time * 2.7) * 0.18;
  }

  /**
   * Cleanup and dispose all geometries and materials
   */
  public dispose(): void {
    this.foliageGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });

    this.kelpMaterialBase.dispose();
    this.kelpMaterialTip.dispose();
    this.coralPinkMat.dispose();
    this.coralVioletMat.dispose();
    this.coralAmberMat.dispose();
    this.anemoneCyanMat.dispose();
    this.anemoneMagentaMat.dispose();
    this.rockMat.dispose();

    this.limestoneShelfMat.dispose();
    this.twilightBasaltMat.dispose();
    this.twilightIndigoMat.dispose();
    this.gorgonianVioletMat.dispose();
    this.spongeCyanMat.dispose();
    this.abyssalSmokerMat.dispose();
    this.fissureCyanMat.dispose();
    this.fissureAmberMat.dispose();
    this.tubeStalkMat.dispose();
    this.tubeCrimsonPlumeMat.dispose();
    this.crystalCyanMat.dispose();
    this.crystalVioletMat.dispose();

    this.scene.remove(this.foliageGroup);
  }
}

export default FoliageSystem;
