import * as THREE from 'three';

interface AeratorBubble {
  baseX: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  scale: number;
}

interface MouthPuffBubble {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  scale: number;
}

/**
 * Manages dual corner aerator bubbling columns, fish mouth feeding puffs, and luminous plankton.
 */
export class BubbleSystem {
  private scene: THREE.Scene;
  private bubbleGroup: THREE.Group;

  // Corner Aerators State
  public aerators: { baseX: number; baseZ: number }[] = [
    { baseX: -18, baseZ: -10 },
    { baseX: 18, baseZ: -10 }
  ];
  private aeratorBubbles: AeratorBubble[] = [];
  private aeratorPoints: THREE.Points;
  private aeratorPositions: Float32Array;

  // Mouth Puff Particles Pool
  private maxPuffs: number = 40;
  private mouthPuffs: MouthPuffBubble[] = [];
  private puffPoints: THREE.Points;
  private puffPositions: Float32Array;

  // Materials & Geometries
  private aeratorStoneMat: THREE.MeshToonMaterial;
  private aeratorPointsMat: THREE.PointsMaterial;
  private puffPointsMat: THREE.PointsMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.bubbleGroup = new THREE.Group();
    this.scene.add(this.bubbleGroup);

    // Initialize materials
    this.aeratorStoneMat = new THREE.MeshToonMaterial({ color: 0x334155 });
    this.aeratorPointsMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.65,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.puffPointsMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.55,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    // 1. Initialize Corner Aerator Bubbler Stones
    this.initAerators();

    // 2. Initialize Mouth Puff Pool
    this.initMouthPuffs();
  }

  private initAerators(): void {
    const bubblesPerAerator = 45;
    const totalAeratorBubbles = this.aerators.length * bubblesPerAerator;
    this.aeratorPositions = new Float32Array(totalAeratorBubbles * 3);

    this.aerators.forEach((aerator) => {
      // Physical bubbler stone mesh on sandy floor
      const stoneGeo = new THREE.CylinderGeometry(0.9, 1.2, 0.5, 8);
      const stoneMesh = new THREE.Mesh(stoneGeo, this.aeratorStoneMat);
      stoneMesh.position.set(aerator.baseX, -19.6, aerator.baseZ);
      this.bubbleGroup.add(stoneMesh);

      // Diffuser perforated top cap
      const capGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 8);
      const capMat = new THREE.MeshToonMaterial({ color: 0x0284c7 });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(aerator.baseX, -19.3, aerator.baseZ);
      this.bubbleGroup.add(capMesh);

      for (let i = 0; i < bubblesPerAerator; i++) {
        const initialY = -19.0 + (i / bubblesPerAerator) * 38.5;
        this.aeratorBubbles.push({
          baseX: aerator.baseX,
          baseZ: aerator.baseZ,
          x: aerator.baseX + (Math.random() - 0.5) * 0.8,
          y: initialY,
          z: aerator.baseZ + (Math.random() - 0.5) * 0.8,
          speed: 4.5 + Math.random() * 3.5,
          wobbleSpeed: 2.5 + Math.random() * 2.0,
          wobbleAmp: 0.25 + Math.random() * 0.35,
          scale: 0.4 + Math.random() * 0.5
        });
      }
    });

    const aeratorGeo = new THREE.BufferGeometry();
    aeratorGeo.setAttribute('position', new THREE.BufferAttribute(this.aeratorPositions, 3));
    this.aeratorPoints = new THREE.Points(aeratorGeo, this.aeratorPointsMat);
    this.bubbleGroup.add(this.aeratorPoints);
  }

  private initMouthPuffs(): void {
    this.puffPositions = new Float32Array(this.maxPuffs * 3);

    for (let i = 0; i < this.maxPuffs; i++) {
      this.mouthPuffs.push({
        active: false,
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        age: 0,
        maxAge: 2.2,
        scale: 0.4
      });
      this.puffPositions[i * 3 + 1] = -999;
    }

    const puffGeo = new THREE.BufferGeometry();
    puffGeo.setAttribute('position', new THREE.BufferAttribute(this.puffPositions, 3));
    this.puffPoints = new THREE.Points(puffGeo, this.puffPointsMat);
    this.bubbleGroup.add(this.puffPoints);
  }

  /**
   * Emits a celebratory or feeding bubble puff from a fish's mouth position
   */
  public emitFishMouthPuff(position: THREE.Vector3, count = 3): void {
    let emitted = 0;

    for (let i = 0; i < this.maxPuffs && emitted < count; i++) {
      const puff = this.mouthPuffs[i];
      if (!puff.active) {
        puff.active = true;
        puff.age = 0;
        puff.maxAge = 1.8 + Math.random() * 0.8;
        puff.position.copy(position).add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.3
          )
        );
        puff.velocity.set(
          (Math.random() - 0.5) * 0.6,
          2.5 + Math.random() * 1.8,
          (Math.random() - 0.5) * 0.6
        );
        puff.scale = 0.3 + Math.random() * 0.4;
        emitted++;
      }
    }
  }

  /**
   * Updates bubble streams and mouth puff physics each animation frame
   */
  public update(delta: number, time: number): void {
    // 1. Update Aerator Bubble Columns
    for (let i = 0; i < this.aeratorBubbles.length; i++) {
      const b = this.aeratorBubbles[i];
      b.y += b.speed * delta;

      // Lateral sine wobble
      const wobble = Math.sin(time * b.wobbleSpeed + i * 0.5) * b.wobbleAmp;
      b.x = b.baseX + wobble;
      b.z = b.baseZ + Math.cos(time * b.wobbleSpeed * 0.8 + i) * (b.wobbleAmp * 0.7);

      // Surface reach trigger (at vivarium water ceiling y = 19.5)
      if (b.y >= 19.5) {
        b.y = -19.0;
        b.x = b.baseX + (Math.random() - 0.5) * 0.6;
        b.z = b.baseZ + (Math.random() - 0.5) * 0.6;
      }

      this.aeratorPositions[i * 3] = b.x;
      this.aeratorPositions[i * 3 + 1] = b.y;
      this.aeratorPositions[i * 3 + 2] = b.z;
    }
    this.aeratorPoints.geometry.attributes.position.needsUpdate = true;

    // 2. Update Mouth Puff Particles
    for (let i = 0; i < this.mouthPuffs.length; i++) {
      const p = this.mouthPuffs[i];
      if (p.active) {
        p.age += delta;
        if (p.age >= p.maxAge || p.position.y >= 19.5) {
          p.active = false;
          p.position.set(0, -999, 0);
        } else {
          p.position.addScaledVector(p.velocity, delta);
          p.position.x += Math.sin(time * 3.0 + i) * 0.02;
        }

        this.puffPositions[i * 3] = p.position.x;
        this.puffPositions[i * 3 + 1] = p.position.y;
        this.puffPositions[i * 3 + 2] = p.position.z;
      }
    }
    this.puffPoints.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Cleans up all geometries and materials
   */
  public dispose(): void {
    this.bubbleGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
      }
    });

    this.aeratorStoneMat.dispose();
    this.aeratorPointsMat.dispose();
    this.puffPointsMat.dispose();

    this.scene.remove(this.bubbleGroup);
  }
}

export default BubbleSystem;
