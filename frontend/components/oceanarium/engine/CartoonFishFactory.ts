import * as THREE from 'three';

export interface VisualTraits {
  primary_color: string;
  secondary_color: string;
  scale?: number;
  glow?: boolean;
  body_type?: string;
  fins_type?: string;
}

export interface SpeciesData {
  id: string;
  name?: string;
  depth_zone?: string;
  rarity?: string;
  body_type?: string;
  scale?: number;
  primary_color: string;
  secondary_color: string;
  glow?: boolean;
  visual_traits?: VisualTraits;
}

/**
 * Creates 3D cartoon fish matching the rounded, expressive styling of the homepage pufferfish.
 */
export class CartoonFishFactory {
  private toonGradientMap: THREE.DataTexture;
  private shinyGradientMap: THREE.DataTexture;
  private sparkleTexture: THREE.CanvasTexture;

  constructor() {
    this.toonGradientMap = this.createToonGradient([20, 140, 255]);
    this.shinyGradientMap = this.createToonGradient([100, 200, 255]);
    this.sparkleTexture = this.createSparkleTexture();
  }

  /**
   * Generates a 3-step gradient map for MeshToonMaterial
   */
  private createToonGradient(steps: number[]): THREE.DataTexture {
    const colors = new Uint8Array(steps);
    const texture = new THREE.DataTexture(colors, steps.length, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Generates a procedural 4-point star sparkle texture for particle trails
   */
  private createSparkleTexture(): THREE.CanvasTexture {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) {
      // In headless node test environments
      return new THREE.CanvasTexture({} as HTMLCanvasElement);
    }
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 230, 150, 0.9)');
      grad.addColorStop(0.7, 'rgba(180, 240, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();

      // 4-point star glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(32, 4);
      ctx.quadraticCurveTo(32, 32, 60, 32);
      ctx.quadraticCurveTo(32, 32, 32, 60);
      ctx.quadraticCurveTo(32, 32, 4, 32);
      ctx.quadraticCurveTo(32, 32, 32, 4);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Create a complete cartoon 3D fish model
   */
  public createFishMesh(species: SpeciesData, isShiny: boolean = false): THREE.Group {
    const group = new THREE.Group();
    group.name = `fish_${species.id}_${isShiny ? 'shiny' : 'standard'}`;

    const traits = species.visual_traits || {
      primary_color: species.primary_color || '#00d2ff',
      secondary_color: species.secondary_color || '#3a7bd5',
      body_type: species.body_type || 'oval',
      scale: species.scale || 1.0,
      glow: species.glow || false
    };

    const bodyType = species.body_type || traits.body_type || 'oval';
    const scaleFactor = (species.scale || traits.scale || 1.0);

    // Color derivation
    const primaryColor = isShiny ? this.getShinyColor(traits.primary_color) : traits.primary_color;
    const secondaryColor = isShiny ? '#ffd700' : traits.secondary_color;

    // Toon Materials
    const bodyMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(primaryColor),
      gradientMap: isShiny ? this.shinyGradientMap : this.toonGradientMap,
      emissive: isShiny ? new THREE.Color('#332200') : (traits.glow ? new THREE.Color(primaryColor).multiplyScalar(0.4) : new THREE.Color(0x000000))
    });

    const accentMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(secondaryColor),
      gradientMap: this.toonGradientMap,
      transparent: true,
      opacity: 0.92
    });

    // 1. Build Body depending on cartoon type
    const bodyMesh = this.buildCartoonBody(bodyType, bodyMat, accentMat);
    group.add(bodyMesh);

    // 2. Add Expressive Cartoon Eyes (matching pufferfish)
    this.addCartoonEyes(group, bodyType);

    // 3. Add Pectoral Fins (left & right)
    const { leftFin, rightFin } = this.addPectoralFins(group, bodyType, accentMat);

    // 4. Add Animated Tail & Pivot
    const tailPivot = this.addTailFin(group, bodyType, accentMat);

    // 5. Add Special Features (Angler lure, spines, manta wings, etc.)
    let lureGlow: THREE.PointLight | null = null;
    if (bodyType === 'angler' || traits.glow) {
      lureGlow = this.addAnglerLure(group, primaryColor);
    }

    // 6. Shiny Sparkle Emitter
    let sparkleEmitter: THREE.Group | null = null;
    if (isShiny) {
      sparkleEmitter = this.createSparkleAura();
      group.add(sparkleEmitter);
    }

    // Apply scale factor
    group.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Attach animation references in userData
    group.userData = {
      speciesId: species.id,
      bodyType,
      isShiny,
      tailPivot,
      leftFin,
      rightFin,
      sparkleEmitter,
      lureGlow,
      swimSpeed: 1.0 + Math.random() * 0.4,
      swimPhase: Math.random() * Math.PI * 2,
      finWobblePhase: Math.random() * Math.PI * 2
    };

    return group;
  }

  /**
   * Derive iridescent / golden pastel hue for shiny variants
   */
  private getShinyColor(baseHex: string): string {
    const col = new THREE.Color(baseHex);
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    // Shift hue +180 deg (complementary) and boost luminance to pastel pearlescent
    col.setHSL((hsl.h + 0.5) % 1.0, 0.85, 0.72);
    return '#' + col.getHexString();
  }

  /**
   * Construct smoothed rounded cartoon geometries for body types
   */
  private buildCartoonBody(bodyType: string, bodyMat: THREE.Material, accentMat: THREE.Material): THREE.Group {
    const bodyGroup = new THREE.Group();

    if (bodyType === 'ray') {
      // Manta ray flat diamond body
      const rayGeo = new THREE.CylinderGeometry(1.6, 1.2, 0.35, 16);
      rayGeo.scale(1.2, 1.0, 1.8);
      const rayMesh = new THREE.Mesh(rayGeo, bodyMat);
      bodyGroup.add(rayMesh);
      return bodyGroup;
    }

    if (bodyType === 'vertical') {
      // Seahorse upright curved body
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), bodyMat);
      head.position.set(0, 0.6, 0.2);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.45, 12), accentMat);
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, 0.55, 0.6);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), bodyMat);
      belly.scale.set(0.8, 1.2, 0.9);
      belly.position.set(0, 0, 0);

      bodyGroup.add(head);
      bodyGroup.add(snout);
      bodyGroup.add(belly);
      return bodyGroup;
    }

    if (bodyType === 'squid' || bodyType === 'octo') {
      // Rounded bell / dome with tentacles
      const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 16), bodyMat);
      mantle.rotation.x = -Math.PI / 2;
      mantle.position.set(0, 0, -0.4);
      bodyGroup.add(mantle);
      return bodyGroup;
    }

    if (bodyType === 'jelly') {
      // Pulsing cartoon dome
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), bodyMat);
      dome.position.set(0, 0.2, 0);
      bodyGroup.add(dome);
      return bodyGroup;
    }

    // Default: Cute bulbous fish body (oval, disc, torpedo, spiky)
    let rx = 0.8;
    let ry = 0.8;
    let rz = 1.3;

    if (bodyType === 'disc') {
      rx = 0.35;
      ry = 1.1;
      rz = 1.0;
    } else if (bodyType === 'torpedo') {
      rx = 0.6;
      ry = 0.6;
      rz = 1.7;
    } else if (bodyType === 'spiky') {
      // Pufferfish style! Bulbous sphere
      rx = 0.95;
      ry = 0.95;
      rz = 1.1;
    }

    const geo = new THREE.SphereGeometry(1, 24, 24);
    geo.scale(rx, ry, rz);
    const mainBody = new THREE.Mesh(geo, bodyMat);
    bodyGroup.add(mainBody);

    // If spiky (like pufferfish), add little rounded studs
    if (bodyType === 'spiky') {
      const studGeo = new THREE.ConeGeometry(0.09, 0.25, 8);
      studGeo.rotateX(Math.PI / 2);
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2;
        const stud = new THREE.Mesh(studGeo, accentMat);
        stud.position.set(Math.cos(theta) * 0.9, Math.sin(theta) * 0.9, (Math.random() - 0.5) * 0.6);
        stud.lookAt(stud.position.clone().multiplyScalar(2));
        bodyGroup.add(stud);
      }
    }

    return bodyGroup;
  }

  /**
   * Big cute cartoon eyes with white sclera, glossy black pupil, and specular shine dot
   */
  private addCartoonEyes(parent: THREE.Group, bodyType: string): void {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = 'cartoon_eyes';

    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111625 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const eyeRadius = bodyType === 'spiky' ? 0.28 : 0.24;
    const scleraGeo = new THREE.SphereGeometry(eyeRadius, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.58, 12, 12);
    const shineGeo = new THREE.SphereGeometry(eyeRadius * 0.22, 8, 8);

    // Left and Right Eye
    const eyeOffsetX = bodyType === 'disc' ? 0.36 : 0.62;
    const eyeOffsetY = 0.28;
    const eyeOffsetZ = 0.65;

    [-1, 1].forEach((side) => {
      const eyeSide = new THREE.Group();
      eyeSide.position.set(side * eyeOffsetX, eyeOffsetY, eyeOffsetZ);

      // Sclera
      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.scale.set(1.0, 1.0, 0.6);

      // Pupil
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * 0.04, 0, eyeRadius * 0.5);

      // Cute highlight dot on top-right
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(side * 0.04 + 0.05, 0.06, eyeRadius * 0.7);

      eyeSide.add(sclera);
      eyeSide.add(pupil);
      eyeSide.add(shine);

      eyeGroup.add(eyeSide);
    });

    parent.add(eyeGroup);
  }

  /**
   * Animated Pectoral Fins on sides
   */
  private addPectoralFins(parent: THREE.Group, bodyType: string, finMat: THREE.Material): { leftFin: THREE.Object3D; rightFin: THREE.Object3D } {
    const finGeo = new THREE.SphereGeometry(0.35, 12, 12);
    finGeo.scale(0.1, 0.5, 0.8);

    // Left fin pivot
    const leftFinPivot = new THREE.Group();
    leftFinPivot.position.set(0.65, -0.1, 0.1);
    const leftMesh = new THREE.Mesh(finGeo, finMat);
    leftMesh.position.set(0.18, 0, -0.2);
    leftMesh.rotation.y = Math.PI * 0.2;
    leftFinPivot.add(leftMesh);
    parent.add(leftFinPivot);

    // Right fin pivot
    const rightFinPivot = new THREE.Group();
    rightFinPivot.position.set(-0.65, -0.1, 0.1);
    const rightMesh = new THREE.Mesh(finGeo, finMat);
    rightMesh.position.set(-0.18, 0, -0.2);
    rightMesh.rotation.y = -Math.PI * 0.2;
    rightFinPivot.add(rightMesh);
    parent.add(rightFinPivot);

    return { leftFin: leftFinPivot, rightFin: rightFinPivot };
  }

  /**
   * Animated Tail Fin on Pivot
   */
  private addTailFin(parent: THREE.Group, bodyType: string, finMat: THREE.Material): THREE.Object3D {
    const tailPivot = new THREE.Group();
    tailPivot.name = 'tail_pivot';

    let tailZ = -1.1;
    if (bodyType === 'torpedo') tailZ = -1.5;
    if (bodyType === 'ray') tailZ = -1.6;

    tailPivot.position.set(0, 0, tailZ);

    // Flared cartoon tail fin
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(0.1, 0.6, 0.4, 0.8);
    tailShape.quadraticCurveTo(0.1, 0.2, 0.6, 0);
    tailShape.quadraticCurveTo(0.1, -0.2, 0.4, -0.8);
    tailShape.quadraticCurveTo(0.1, -0.6, 0, 0);

    const extrudeSettings = { depth: 0.06, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, extrudeSettings);
    tailGeo.center();
    tailGeo.rotateY(Math.PI / 2);

    const tailMesh = new THREE.Mesh(tailGeo, finMat);
    tailMesh.position.set(0, 0, -0.5);
    tailPivot.add(tailMesh);

    parent.add(tailPivot);
    return tailPivot;
  }

  /**
   * Bioluminescent Angler Lure
   */
  private addAnglerLure(parent: THREE.Group, glowColor: string): THREE.PointLight {
    const stalk = new THREE.Group();
    stalk.position.set(0, 0.8, 0.4);

    // Stalk line
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.7, 0.4),
      new THREE.Vector3(0, 0.5, 1.0)
    );
    const stalkGeo = new THREE.TubeGeometry(curve, 16, 0.04, 8, false);
    const stalkMat = new THREE.MeshBasicMaterial({ color: 0x223344 });
    stalk.add(new THREE.Mesh(stalkGeo, stalkMat));

    // Glowing Escas Bulb
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowColor) });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), bulbMat);
    bulb.position.set(0, 0.5, 1.0);
    stalk.add(bulb);

    const light = new THREE.PointLight(glowColor, 2, 4);
    light.position.set(0, 0.5, 1.0);
    stalk.add(light);

    parent.add(stalk);
    return light;
  }

  /**
   * Creates an orbiting sparkle/star particle cloud for shiny fish
   */
  private createSparkleAura(): THREE.Group {
    const auraGroup = new THREE.Group();
    auraGroup.name = 'sparkle_aura';

    const particleCount = 18;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = (i / particleCount) * Math.PI * 2;
      const r = 1.4 + Math.random() * 0.5;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 2] = Math.sin(theta) * r;
      scales[i] = 0.5 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      map: this.sparkleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffe87c
    });

    const points = new THREE.Points(geometry, material);
    auraGroup.add(points);
    return auraGroup;
  }
}

export default CartoonFishFactory;
