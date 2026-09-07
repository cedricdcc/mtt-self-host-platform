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

/**
 * Manages procedural animated seabed ecology: swaying kelp ribbons, colorful corals, and pulsing sea anemones.
 */
export class FoliageSystem {
  private scene: THREE.Scene;
  private foliageGroup: THREE.Group;
  private kelpRibbons: KelpRibbon[] = [];
  private anemones: Anemone[] = [];
  private corals: THREE.Group[] = [];

  // Reusable materials
  private kelpMaterialBase: THREE.MeshToonMaterial;
  private kelpMaterialTip: THREE.MeshToonMaterial;
  private coralPinkMat: THREE.MeshToonMaterial;
  private coralVioletMat: THREE.MeshToonMaterial;
  private coralAmberMat: THREE.MeshToonMaterial;
  private anemoneCyanMat: THREE.MeshToonMaterial;
  private anemoneMagentaMat: THREE.MeshToonMaterial;
  private rockMat: THREE.MeshToonMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.foliageGroup = new THREE.Group();
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

    // Construct seabed foliage elements
    this.createKelpForest();
    this.createCoralsAndAnemones();
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
   * Updates procedural swaying and breathing animations per frame
   */
  public update(delta: number, time: number): void {
    // 1. Kelp Ribbon Harmonic Sway
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

    this.scene.remove(this.foliageGroup);
  }
}

export default FoliageSystem;
