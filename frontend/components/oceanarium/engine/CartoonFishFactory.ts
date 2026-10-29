import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type LocomotionType =
  | 'carangiform'
  | 'hover_flutter'
  | 'puffer'
  | 'rajiform'
  | 'upright_bob'
  | 'jet_pulse'
  | 'ear_flap'
  | 'medusa_pulse'
  | 'chain_wave'
  | 'anguilliform'
  | 'specialist_swim';

export interface VisualTraits {
  primary_color: string;
  secondary_color: string;
  scale?: number;
  glow?: boolean;
  body_type?: string;
  fins_type?: string;
  model_url?: string | null;
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
  model_url?: string | null;
  visual_traits?: VisualTraits;
}

export type FishSpeciesVisuals = SpeciesData;

/**
 * Creates 3D cartoon fish across 8 anatomical rig families and 21 collectible species
 * with procedural 256x256 pattern textures, cel/toon materials, and kinematic pivot rigs.
 */
export class CartoonFishFactory {
  private static patternCache: Map<string, THREE.CanvasTexture> = new Map();
  private toonGradientMap: THREE.DataTexture;
  private shinyGradientMap: THREE.DataTexture;
  private sparkleTexture: THREE.CanvasTexture;
  private gltfLoader: GLTFLoader | null = null;
  public gltfCache: Map<string, THREE.Group> = new Map();
  private gltfLoadingPromises: Map<string, Promise<THREE.Group | null>> = new Map();

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
   * Generates and caches a 256x256 offscreen CanvasTexture with species-specific markings.
   * Safely returns null in headless Node environments without DOM canvas support.
   */
  public createPatternTexture(
    speciesId: string,
    primaryHex: string,
    secondaryHex: string,
    isShiny: boolean = false
  ): THREE.CanvasTexture | null {
    const sId = (speciesId || 'default').toLowerCase();
    const cacheKey = `${sId}_${primaryHex}_${secondaryHex}_${isShiny ? 'shiny' : 'std'}`;
    if (CartoonFishFactory.patternCache.has(cacheKey)) {
      return CartoonFishFactory.patternCache.get(cacheKey)!;
    }

    if (typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const pCol = isShiny ? this.getShinyColor(primaryHex) : primaryHex;
    const sCol = isShiny ? '#ffd700' : secondaryHex;

    // Base fill
    ctx.fillStyle = pCol;
    ctx.fillRect(0, 0, 256, 256);

    if (sId.includes('clown_anemone') || sId.includes('clown')) {
      // Orange base with 3 white vertical saddle bands outlined in black
      ctx.fillStyle = isShiny ? pCol : '#ff6b2b';
      ctx.fillRect(0, 0, 256, 256);

      const bandXs = [58, 128, 198];
      bandXs.forEach((bx) => {
        ctx.fillStyle = '#111625';
        ctx.fillRect(bx - 20, 0, 40, 256);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 13, 0, 26, 256);
      });
    } else if (sId.includes('emerald_parrotfish') || sId.includes('parrot')) {
      // Jade-to-turquoise gradient with diamond scale lattice
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, isShiny ? pCol : '#0d9488');
      grad.addColorStop(0.55, isShiny ? sCol : '#10b981');
      grad.addColorStop(1, '#2dd4bf');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 2;
      const step = 28;
      for (let x = -256; x < 512; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 256, 256);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 256, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
    } else if (sId.includes('azure_damselfish') || sId.includes('damsel')) {
      // Neon blue body with deep cobalt dorsal fade and yellow tail accent
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#1e3a8a');
      grad.addColorStop(0.45, isShiny ? pCol : '#00d2ff');
      grad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Yellow tail / posterior accent
      const tailGrad = ctx.createLinearGradient(180, 0, 256, 0);
      tailGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
      tailGrad.addColorStop(0.4, '#facc15');
      tailGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = tailGrad;
      ctx.fillRect(180, 0, 76, 256);
    } else if (sId.includes('sunburst_tang') || sId.includes('tang')) {
      // Bright lemon-to-gold radial gradient
      const radGrad = ctx.createRadialGradient(128, 128, 16, 128, 128, 160);
      radGrad.addColorStop(0, '#fef08a');
      radGrad.addColorStop(0.55, isShiny ? pCol : '#facc15');
      radGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, 256, 256);
    } else if (sId.includes('solar_lionfish') || sId.includes('lionfish')) {
      // Maroon and cream zebra vertical stripes
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 256; x += 24) {
        ctx.fillStyle = isShiny ? pCol : '#9f1239';
        ctx.fillRect(x, 0, 13, 256);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x + 13, 0, 4, 256);
      }
    } else if (sId.includes('spotted_pufferfish') || sId.includes('puffer')) {
      // Warm amber dorsum with dark espresso spots and cream belly
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, isShiny ? pCol : '#d97706');
      grad.addColorStop(0.55, isShiny ? pCol : '#f59e0b');
      grad.addColorStop(0.62, '#fef3c7');
      grad.addColorStop(1, '#fffbeb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Dark espresso dorsal spots
      ctx.fillStyle = '#291509';
      const spots = [
        [32, 34, 8], [76, 24, 10], [128, 40, 9], [178, 28, 11], [224, 38, 8],
        [48, 76, 11], [96, 68, 8], [148, 82, 10], [202, 72, 9], [24, 112, 7],
        [72, 118, 9], [118, 108, 11], [168, 116, 8], [218, 110, 10]
      ];
      spots.forEach(([sx, sy, sr]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (sId.includes('sapphire_manta') || sId.includes('manta')) {
      // Deep sapphire back with glowing cyan chevron shoulder markings
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.7, isShiny ? pCol : '#1e3a8a');
      grad.addColorStop(1, '#172554');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = isShiny ? '#ffd700' : '#00f2fe';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      // Dual glowing cyan chevrons
      [85, 145].forEach((cy) => {
        ctx.beginPath();
        ctx.moveTo(48, cy + 28);
        ctx.lineTo(128, cy - 18);
        ctx.lineTo(208, cy + 28);
        ctx.stroke();
      });
    } else if (sId.includes('coelacanth_shadow') || sId.includes('coelacanth')) {
      // Dark indigo-slate scales with white mineral speckles
      ctx.fillStyle = isShiny ? pCol : '#1e1b4b';
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.lineWidth = 2;
      for (let y = 16; y < 256; y += 24) {
        for (let x = 16; x < 256; x += 24) {
          ctx.beginPath();
          ctx.arc(x + ((y / 24) % 2) * 12, y, 12, 0, Math.PI);
          ctx.stroke();
        }
      }

      // White mineral speckles
      ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
      const flecks = [
        [40, 50, 5], [95, 35, 7], [160, 62, 6], [210, 44, 5],
        [62, 110, 8], [130, 98, 6], [188, 122, 7], [34, 175, 6],
        [108, 168, 7], [174, 185, 5], [228, 160, 6], [80, 224, 5], [152, 230, 7]
      ];
      flecks.forEach(([fx, fy, fr]) => {
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (sId.includes('cosmic_jelly') || sId.includes('jelly')) {
      // Radial magenta-ultraviolet nebula starburst veins
      const rad = ctx.createRadialGradient(128, 128, 8, 128, 128, 136);
      rad.addColorStop(0, '#fdf4ff');
      rad.addColorStop(0.3, isShiny ? pCol : '#f43f5e');
      rad.addColorStop(0.68, '#a21caf');
      rad.addColorStop(1, '#2e1065');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(128, 128);
        ctx.quadraticCurveTo(
          128 + Math.cos(angle + 0.15) * 68,
          128 + Math.sin(angle + 0.15) * 68,
          128 + Math.cos(angle) * 124,
          128 + Math.sin(angle) * 124
        );
        ctx.stroke();
      }
    } else if (sId.includes('abyssal_leviathan') || sId.includes('leviathan')) {
      // Obsidian armor plates with glowing cyan tectonic seams
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = isShiny ? '#ffd700' : '#66fcf1';
      ctx.lineWidth = 3.5;
      const seams = [
        [[0, 48], [88, 64], [164, 42], [256, 58]],
        [[0, 128], [72, 112], [148, 142], [256, 120]],
        [[0, 204], [96, 188], [182, 214], [256, 196]],
        [[88, 0], [72, 112], [96, 188], [84, 256]],
        [[164, 0], [148, 142], [182, 214], [172, 256]]
      ];
      seams.forEach((pts) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.stroke();
      });
    } else if (
      sId.includes('glass_lantern') ||
      sId.includes('silver_hatchet') ||
      sId.includes('lantern') ||
      sId.includes('hatchet')
    ) {
      // Metallic silver/cyan counter-shaded sheen with glowing cyan ventral photophore dots
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.35, isShiny ? pCol : '#cbd5e1');
      grad.addColorStop(0.75, '#e2e8f0');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = '#00f2fe';
      for (let x = 20; x < 240; x += 24) {
        ctx.beginPath();
        ctx.arc(x, 205, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Smooth dual-tone organic gradient for remaining species
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, pCol);
      grad.addColorStop(1, sCol);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    CartoonFishFactory.patternCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Asynchronously load a GLTF/GLB model from URL with memory caching and pivot centering
   */
  public async loadGLB(url: string): Promise<THREE.Group | null> {
    if (!url) return null;
    if (this.gltfCache.has(url)) {
      return this.gltfCache.get(url)!.clone(true);
    }
    if (this.gltfLoadingPromises.has(url)) {
      const model = await this.gltfLoadingPromises.get(url);
      return model ? model.clone(true) : null;
    }

    if (!this.gltfLoader && typeof window !== 'undefined') {
      this.gltfLoader = new GLTFLoader();
    }
    if (!this.gltfLoader) return null;

    const promise = new Promise<THREE.Group | null>((resolve) => {
      this.gltfLoader!.load(
        url,
        (gltf) => {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root) {
            resolve(null);
            return;
          }

          // Normalize bounding box: scale to target ~2.0 units length
          const bbox = new THREE.Box3().setFromObject(root);
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 2.0;
          const normScale = maxDim > 0 ? targetSize / maxDim : 1.0;
          root.scale.set(normScale, normScale, normScale);

          // Center root around pivot (0,0,0)
          const center = bbox.getCenter(new THREE.Vector3()).multiplyScalar(normScale);
          root.position.sub(center);

          const wrapper = new THREE.Group();
          wrapper.name = `glb_wrapper_${url}`;
          wrapper.add(root);

          if (gltf.animations && gltf.animations.length > 0) {
            wrapper.userData.animations = gltf.animations;
          }

          this.gltfCache.set(url, wrapper);
          resolve(wrapper.clone(true));
        },
        undefined,
        (err) => {
          console.warn(`[CartoonFishFactory] Failed to load GLB from ${url}:`, err);
          resolve(null);
        }
      );
    });

    this.gltfLoadingPromises.set(url, promise);
    const result = await promise;
    return result ? result.clone(true) : null;
  }

  /**
   * Applies metallic iridescent sheen, emissive pulse, and sparkle particles to a GLB model
   */
  public applyShinyToGLB(model: THREE.Group): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              mat.metalness = Math.max(mat.metalness || 0, 0.75);
              mat.roughness = Math.min(mat.roughness || 1, 0.25);
              mat.emissive = new THREE.Color(0x332200);
              mat.emissiveIntensity = 0.35;
              mat.needsUpdate = true;
            } else if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshToonMaterial) {
              mat.color.set(this.getShinyColor('#' + mat.color.getHexString()));
              mat.needsUpdate = true;
            }
          });
        }
      }
    });

    const emitter = this.createSparkleAura();
    model.add(emitter);
    model.userData.sparkleEmitter = emitter;
  }

  /**
   * Create a complete 3D fish mesh for any of the 21 species across 8 anatomical rig families.
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
    const scaleFactor = species.scale || traits.scale || 1.0;

    // If a custom 3D GLB model is configured, spawn via GLB pipeline with procedural rig fallback
    const modelUrl = species.model_url || traits.model_url;
    if (modelUrl) {
      const glbContainer = new THREE.Group();
      glbContainer.name = `glb_container_${species.id}`;
      group.add(glbContainer);

      if (this.gltfCache.has(modelUrl)) {
        group.userData = {
          speciesId: species.id,
          bodyType,
          isShiny,
          modelUrl,
          isGLB: true,
          locomotionType: 'carangiform' as LocomotionType,
          baseScale: scaleFactor,
          swimSpeed: 1.0 + Math.random() * 0.4,
          swimPhase: Math.random() * Math.PI * 2,
          finWobblePhase: Math.random() * Math.PI * 2,
          glbContainer
        };

        const glbModel = this.gltfCache.get(modelUrl)!.clone(true);
        glbModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        if (isShiny) {
          this.applyShinyToGLB(glbModel);
          group.userData.sparkleEmitter = glbModel.userData.sparkleEmitter;
        }
        if (glbModel.userData.animations && glbModel.userData.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(glbModel);
          mixer.clipAction(glbModel.userData.animations[0]).play();
          group.userData.animationMixer = mixer;
        }
        glbContainer.add(glbModel);
      } else {
        const placeholder = new THREE.Group();
        placeholder.name = 'glb_placeholder';
        this.buildProceduralFallbackMesh(
          placeholder,
          { ...species, scale: 1.0, model_url: null },
          isShiny
        );

        group.userData = {
          ...placeholder.userData,
          speciesId: species.id,
          bodyType,
          isShiny,
          modelUrl,
          isGLB: true,
          baseScale: scaleFactor,
          swimSpeed: 1.0 + Math.random() * 0.4,
          swimPhase: Math.random() * Math.PI * 2,
          finWobblePhase: Math.random() * Math.PI * 2,
          glbContainer
        };

        placeholder.scale.set(scaleFactor, scaleFactor, scaleFactor);
        glbContainer.add(placeholder);

        this.loadGLB(modelUrl).then((glbModel) => {
          if (glbModel) {
            if (placeholder.parent) {
              glbContainer.remove(placeholder);
            }
            glbModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
            if (isShiny) {
              this.applyShinyToGLB(glbModel);
              group.userData.sparkleEmitter = glbModel.userData.sparkleEmitter;
            }
            if (glbModel.userData.animations && glbModel.userData.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(glbModel);
              mixer.clipAction(glbModel.userData.animations[0]).play();
              group.userData.animationMixer = mixer;
            }
            glbContainer.add(glbModel);
          }
        });
      }

      return group;
    }

    this.buildProceduralFallbackMesh(group, species, isShiny);
    return group;
  }

  /**
   * Routes species to one of the 8 anatomical rig family builders and populates userData kinematics.
   */
  public buildProceduralFallbackMesh(
    group: THREE.Group,
    species: SpeciesData,
    isShiny: boolean = false
  ): THREE.Group {
    const traits = species.visual_traits || {
      primary_color: species.primary_color || '#00d2ff',
      secondary_color: species.secondary_color || '#3a7bd5',
      body_type: species.body_type || 'oval',
      scale: species.scale || 1.0,
      glow: species.glow || false
    };

    const speciesId = (species.id || 'azure_damselfish').toLowerCase();
    const rawBodyType = (species.body_type || traits.body_type || 'oval').toLowerCase();
    const bodyType = speciesId === 'spotted_pufferfish' ? 'spiky' : rawBodyType;
    const scaleFactor = species.scale || traits.scale || 1.0;
    const hasGlow = Boolean(species.glow ?? traits.glow);

    const primaryColor = isShiny
      ? this.getShinyColor(traits.primary_color || species.primary_color || '#00d2ff')
      : (traits.primary_color || species.primary_color || '#00d2ff');
    const secondaryColor = isShiny
      ? '#ffd700'
      : (traits.secondary_color || species.secondary_color || '#3a7bd5');

    const patternTexture = this.createPatternTexture(
      speciesId,
      traits.primary_color || species.primary_color || '#00d2ff',
      traits.secondary_color || species.secondary_color || '#3a7bd5',
      isShiny
    );

    const bodyMat = new THREE.MeshToonMaterial({
      color: patternTexture ? new THREE.Color('#ffffff') : new THREE.Color(primaryColor),
      map: patternTexture || null,
      gradientMap: isShiny ? this.shinyGradientMap : this.toonGradientMap,
      emissive: isShiny
        ? new THREE.Color('#332200')
        : hasGlow
        ? new THREE.Color(primaryColor).multiplyScalar(0.35)
        : new THREE.Color(0x000000)
    });

    const solidBodyMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(primaryColor),
      gradientMap: isShiny ? this.shinyGradientMap : this.toonGradientMap,
      emissive: isShiny
        ? new THREE.Color('#332200')
        : hasGlow
        ? new THREE.Color(primaryColor).multiplyScalar(0.35)
        : new THREE.Color(0x000000)
    });

    const accentMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(secondaryColor),
      gradientMap: this.toonGradientMap,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide
    });

    // Base userData initialization
    group.userData = {
      speciesId: species.id,
      bodyType,
      isShiny,
      locomotionType: 'carangiform' as LocomotionType,
      swimSpeed: 1.0 + Math.random() * 0.4,
      swimPhase: Math.random() * Math.PI * 2,
      finWobblePhase: Math.random() * Math.PI * 2
    };

    // Route to the 8 anatomical rig family builders
    if (bodyType === 'ray' || speciesId === 'sapphire_manta') {
      this.buildMantaRayRig(group, speciesId, bodyMat, solidBodyMat, accentMat);
    } else if (bodyType === 'vertical' || speciesId === 'golden_seahorse') {
      this.buildSeahorseRig(group, speciesId, solidBodyMat, accentMat);
    } else if (
      bodyType === 'squid' ||
      bodyType === 'octo' ||
      bodyType === 'dumbo' ||
      speciesId === 'prismatic_squid' ||
      speciesId === 'vampire_octo' ||
      speciesId === 'dumbo_specter'
    ) {
      this.buildCephalopodRig(group, speciesId, bodyType, solidBodyMat, accentMat, primaryColor, secondaryColor);
    } else if (
      bodyType === 'jelly' ||
      bodyType === 'chain' ||
      speciesId === 'cosmic_jelly' ||
      speciesId === 'crystal_siphonophore'
    ) {
      this.buildMedusaAndChainRig(group, speciesId, bodyType, bodyMat, solidBodyMat, accentMat, primaryColor, secondaryColor);
    } else if (
      bodyType === 'ribbon' ||
      bodyType === 'eel' ||
      bodyType === 'leviathan' ||
      speciesId === 'ribbon_oarfish' ||
      speciesId === 'gulper_void' ||
      speciesId === 'abyssal_leviathan'
    ) {
      this.buildSerpentineRig(group, speciesId, bodyType, bodyMat, solidBodyMat, accentMat, primaryColor, secondaryColor);
    } else if (
      bodyType === 'hatchet' ||
      bodyType === 'ancient' ||
      bodyType === 'rattail' ||
      bodyType === 'angler' ||
      speciesId === 'silver_hatchet' ||
      speciesId === 'glass_lantern' ||
      speciesId === 'coelacanth_shadow' ||
      speciesId === 'ghost_grenadier' ||
      speciesId === 'bioluminescent_angler'
    ) {
      this.buildDeepSpecialistRig(group, speciesId, bodyType, bodyMat, solidBodyMat, accentMat, primaryColor, secondaryColor);
    } else {
      // Sculpted Reef & Spined builder (oval, disc, torpedo, spiky)
      this.buildSculptedReefAndSpinedRig(group, speciesId, bodyType, bodyMat, solidBodyMat, accentMat, primaryColor, secondaryColor);
    }

    // Shiny Sparkle Emitter
    if (isShiny) {
      const sparkleEmitter = this.createSparkleAura();
      group.add(sparkleEmitter);
      group.userData.sparkleEmitter = sparkleEmitter;
    }

    group.scale.set(scaleFactor, scaleFactor, scaleFactor);
    return group;
  }

  /**
   * Rig Family 1: Manta Ray (`sapphire_manta`)
   * Articulated inner/outer pectoral wings, cephalic horn lobes, ventral gill slits, and whip tail.
   */
  private buildMantaRayRig(
    group: THREE.Group,
    _speciesId: string,
    bodyMat: THREE.Material,
    solidBodyMat: THREE.Material,
    accentMat: THREE.Material
  ): void {
    group.userData.locomotionType = 'rajiform';

    // Central flattened diamond disc body
    const centralBody = this.buildCartoonBody('ray', bodyMat, accentMat);
    group.add(centralBody);

    // Pale ventral counter-shaded belly plate & 5 pairs of ventral gill slits
    const bellyMat = new THREE.MeshToonMaterial({
      color: 0xe0f2fe,
      gradientMap: this.toonGradientMap
    });
    const bellyGeo = new THREE.SphereGeometry(0.75, 16, 12);
    bellyGeo.scale(1.1, 0.16, 1.45);
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
    bellyMesh.position.set(0, -0.1, 0.05);
    group.add(bellyMesh);

    const gillMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const gillGeo = new THREE.BoxGeometry(0.22, 0.02, 0.04);
    for (let i = 0; i < 5; i++) {
      const gz = 0.42 - i * 0.14;
      [-1, 1].forEach((side) => {
        const gill = new THREE.Mesh(gillGeo, gillMat);
        gill.position.set(side * 0.34, -0.22, gz);
        gill.rotation.y = side * 0.2;
        group.add(gill);
      });
    }

    // Forward-curled cephalic horn lobes flanking wide filter mouth
    const lobeGeo = new THREE.ConeGeometry(0.16, 0.65, 10);
    lobeGeo.rotateX(Math.PI / 2);
    [-1, 1].forEach((side) => {
      const lobe = new THREE.Mesh(lobeGeo, solidBodyMat);
      lobe.position.set(side * 0.48, -0.02, 1.18);
      lobe.rotation.y = -side * 0.18;
      group.add(lobe);
    });

    // Articulated 2-stage pectoral wings (inner + outer pivots for rajiform wave)
    const innerShape = new THREE.Shape();
    innerShape.moveTo(0, 0.85);
    innerShape.lineTo(1.05, 0.15);
    innerShape.lineTo(1.05, -0.45);
    innerShape.lineTo(0, -0.95);
    innerShape.closePath();
    const innerWingGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
    innerWingGeo.rotateX(Math.PI / 2);

    const outerShape = new THREE.Shape();
    outerShape.moveTo(0, 0.15);
    outerShape.lineTo(1.15, -0.2);
    outerShape.lineTo(0.4, -0.52);
    outerShape.lineTo(0, -0.45);
    outerShape.closePath();
    const outerWingGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015 });
    outerWingGeo.rotateX(Math.PI / 2);

    // Left Wing Hierarchy
    const leftWingInner = new THREE.Group();
    leftWingInner.name = 'left_wing_inner';
    leftWingInner.position.set(0.55, 0.02, 0.05);
    const leftInnerMesh = new THREE.Mesh(innerWingGeo, bodyMat);
    leftWingInner.add(leftInnerMesh);

    const leftWingOuter = new THREE.Group();
    leftWingOuter.name = 'left_wing_outer';
    leftWingOuter.position.set(1.02, 0, 0);
    const leftOuterMesh = new THREE.Mesh(outerWingGeo, accentMat);
    leftWingOuter.add(leftOuterMesh);
    leftWingInner.add(leftWingOuter);
    group.add(leftWingInner);

    // Right Wing Hierarchy (mirrored on X)
    const rightWingInner = new THREE.Group();
    rightWingInner.name = 'right_wing_inner';
    rightWingInner.position.set(-0.55, 0.02, 0.05);
    const rightInnerMesh = new THREE.Mesh(innerWingGeo, bodyMat);
    rightInnerMesh.scale.x = -1;
    rightWingInner.add(rightInnerMesh);

    const rightWingOuter = new THREE.Group();
    rightWingOuter.name = 'right_wing_outer';
    rightWingOuter.position.set(-1.02, 0, 0);
    const rightOuterMesh = new THREE.Mesh(outerWingGeo, accentMat);
    rightOuterMesh.scale.x = -1;
    rightWingOuter.add(rightOuterMesh);
    rightWingInner.add(rightWingOuter);
    group.add(rightWingInner);

    // Lateral cephalic eyes & wide filter mouth
    this.addCartoonEyes(group, 'ray');
    const jawPivot = this.addNibblingMouth(group, 'ray', accentMat);

    // Long tapering whip tail
    const tailPivot = new THREE.Group();
    tailPivot.name = 'tail_pivot';
    tailPivot.position.set(0, 0, -1.15);
    const whipGeo = new THREE.ConeGeometry(0.08, 1.9, 8);
    whipGeo.rotateX(-Math.PI / 2);
    const whipMesh = new THREE.Mesh(whipGeo, solidBodyMat);
    whipMesh.position.set(0, 0, -0.95);
    tailPivot.add(whipMesh);
    group.add(tailPivot);

    const { dorsalFin, analFin } = this.addFinCrests(group, 'ray', accentMat);

    group.userData.leftWingInner = leftWingInner;
    group.userData.leftWingOuter = leftWingOuter;
    group.userData.rightWingInner = rightWingInner;
    group.userData.rightWingOuter = rightWingOuter;
    group.userData.leftFin = leftWingInner;
    group.userData.rightFin = rightWingInner;
    group.userData.tailPivot = tailPivot;
    group.userData.dorsalFin = dorsalFin;
    group.userData.analFin = analFin;
    group.userData.jawPivot = jawPivot;
  }

  /**
   * Rig Family 2: Seahorse (`golden_seahorse`)
   * Stacked S-curve torso rings, tubular equine snout, 5-spike coronet crown,
   * curled prehensile tail, and fluttering dorsal fan on back.
   */
  private buildSeahorseRig(
    group: THREE.Group,
    _speciesId: string,
    bodyMat: THREE.Material,
    accentMat: THREE.Material
  ): void {
    group.userData.locomotionType = 'upright_bob';

    const spineSegments: THREE.Object3D[] = [];

    // Stacked S-curve armored torso rings
    const ringCoords = [
      { y: 0.68, z: 0.12, r: 0.24 },
      { y: 0.48, z: 0.05, r: 0.28 },
      { y: 0.26, z: 0.14, r: 0.36 },
      { y: 0.02, z: 0.22, r: 0.42 },
      { y: -0.22, z: 0.18, r: 0.38 },
      { y: -0.44, z: 0.08, r: 0.30 },
      { y: -0.64, z: -0.02, r: 0.22 },
      { y: -0.82, z: -0.06, r: 0.16 }
    ];

    ringCoords.forEach((rc, idx) => {
      const seg = new THREE.Group();
      seg.name = `seahorse_seg_${idx}`;
      seg.position.set(0, rc.y, rc.z);

      const coreMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(rc.r * 0.88, rc.r * 0.95, 0.22, 12),
        bodyMat
      );
      seg.add(coreMesh);

      const ridgeMesh = new THREE.Mesh(
        new THREE.TorusGeometry(rc.r * 0.92, 0.035, 6, 14),
        accentMat
      );
      ridgeMesh.rotation.x = Math.PI / 2;
      seg.add(ridgeMesh);

      group.add(seg);
      spineSegments.push(seg);
    });

    // Equine head & tubular snout
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.92, 0.16);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), bodyMat);
    headGroup.add(cranium);

    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.52, 12), bodyMat);
    snout.rotation.x = Math.PI / 2 + 0.15;
    snout.position.set(0, -0.06, 0.42);
    headGroup.add(snout);

    const snoutTip = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 12), accentMat);
    snoutTip.position.set(0, -0.12, 0.66);
    headGroup.add(snoutTip);

    // 5-spike coronet crown
    const spikeGeo = new THREE.ConeGeometry(0.045, 0.22, 6);
    for (let i = 0; i < 5; i++) {
      const angle = ((i - 2) / 4) * 0.9;
      const spike = new THREE.Mesh(spikeGeo, accentMat);
      spike.position.set(Math.sin(angle) * 0.14, 0.38, -0.05 + Math.cos(angle) * 0.06);
      spike.rotation.z = -angle * 0.6;
      spike.rotation.x = -0.25;
      headGroup.add(spike);
    }
    group.add(headGroup);

    // Eyes and cheek blush positioned on equine head
    this.addCartoonEyes(group, 'vertical');
    this.addCheekBlush(group, 'vertical');

    // Curled prehensile tail
    const tailPivot = new THREE.Group();
    tailPivot.name = 'tail_pivot';
    tailPivot.position.set(0, -0.92, -0.06);

    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const curlAngle = t * Math.PI * 1.65;
      const radius = (1 - t * 0.65) * 0.34;
      const beadR = (1 - t * 0.72) * 0.14;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(beadR, 10, 10), i % 2 === 0 ? bodyMat : accentMat);
      knot.position.set(
        0,
        -Math.sin(curlAngle) * radius - t * 0.28,
        (1 - Math.cos(curlAngle)) * radius + 0.08
      );
      tailPivot.add(knot);
    }
    group.add(tailPivot);

    // Fluttering dorsal fan on back
    const dorsalFin = new THREE.Group();
    dorsalFin.name = 'dorsal_fin';
    dorsalFin.position.set(0, 0.08, -0.16);
    const fanShape = new THREE.Shape();
    fanShape.moveTo(0, -0.25);
    fanShape.quadraticCurveTo(-0.42, -0.15, -0.46, 0.25);
    fanShape.quadraticCurveTo(-0.2, 0.35, 0, 0.25);
    fanShape.closePath();
    const fanGeo = new THREE.ExtrudeGeometry(fanShape, { depth: 0.025, bevelEnabled: false });
    fanGeo.rotateY(Math.PI / 2);
    const fanMesh = new THREE.Mesh(fanGeo, accentMat);
    dorsalFin.add(fanMesh);
    group.add(dorsalFin);

    // Pectoral ear-fins behind cheeks
    const { leftFin, rightFin } = this.addPectoralFins(group, 'vertical', accentMat);
    const jawPivot = this.addNibblingMouth(group, 'vertical', accentMat);

    group.userData.spineSegments = spineSegments;
    group.userData.tailPivot = tailPivot;
    group.userData.dorsalFin = dorsalFin;
    group.userData.leftFin = leftFin;
    group.userData.rightFin = rightFin;
    group.userData.jawPivot = jawPivot;
  }

  /**
   * Rig Family 3: Cephalopods (`prismatic_squid`, `vampire_octo`, `dumbo_specter`)
   */
  private buildCephalopodRig(
    group: THREE.Group,
    speciesId: string,
    bodyType: string,
    solidBodyMat: THREE.Material,
    accentMat: THREE.Material,
    primaryColor: string,
    secondaryColor: string
  ): void {
    const tentacles: THREE.Object3D[] = [];
    const bellGroup = new THREE.Group();
    bellGroup.name = 'bell_group';
    group.add(bellGroup);

    if (speciesId.includes('dumbo') || bodyType === 'dumbo') {
      // Dumbo Specter Octopus: rounded bell, large flapping ear fins, cute eyes, 8 short curled skirt tentacles
      group.userData.locomotionType = 'ear_flap';

      const domeGeo = new THREE.SphereGeometry(0.85, 24, 20);
      domeGeo.scale(0.95, 1.08, 0.95);
      const domeMesh = new THREE.Mesh(domeGeo, solidBodyMat);
      domeMesh.position.set(0, 0.2, 0);
      bellGroup.add(domeMesh);

      // Large flapping ear fins
      const earGeo = new THREE.SphereGeometry(0.45, 14, 12);
      earGeo.scale(1.15, 0.45, 0.22);

      const leftEarFin = new THREE.Group();
      leftEarFin.name = 'left_ear_fin';
      leftEarFin.position.set(0.72, 0.42, 0.05);
      const leftEarMesh = new THREE.Mesh(earGeo, accentMat);
      leftEarMesh.position.set(0.32, 0.05, 0);
      leftEarFin.add(leftEarMesh);
      group.add(leftEarFin);

      const rightEarFin = new THREE.Group();
      rightEarFin.name = 'right_ear_fin';
      rightEarFin.position.set(-0.72, 0.42, 0.05);
      const rightEarMesh = new THREE.Mesh(earGeo, accentMat);
      rightEarMesh.position.set(-0.32, 0.05, 0);
      rightEarFin.add(rightEarMesh);
      group.add(rightEarFin);

      // 8 short curled skirt tentacles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const armPivot = new THREE.Group();
        armPivot.position.set(Math.cos(angle) * 0.56, -0.45, Math.sin(angle) * 0.56);

        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(angle) * 0.18, -0.28, Math.sin(angle) * 0.18),
          new THREE.Vector3(Math.cos(angle) * 0.34, -0.18, Math.sin(angle) * 0.34)
        );
        const armGeo = new THREE.TubeGeometry(curve, 10, 0.09, 8, false);
        armPivot.add(new THREE.Mesh(armGeo, accentMat));
        group.add(armPivot);
        tentacles.push(armPivot);
      }

      this.addCartoonEyes(group, 'dumbo');
      this.addCheekBlush(group, 'dumbo');

      group.userData.leftEarFin = leftEarFin;
      group.userData.rightEarFin = rightEarFin;
      group.userData.leftFin = leftEarFin;
      group.userData.rightFin = rightEarFin;
    } else if (speciesId.includes('vampire') || bodyType === 'octo') {
      // Vampire Octopus: velvety crimson dome with dark webbing skirt, side ear-fins, 8 curved arms with glowing cyan photophore tips
      group.userData.locomotionType = 'jet_pulse';

      const domeGeo = new THREE.SphereGeometry(0.82, 22, 18);
      domeGeo.scale(0.92, 1.0, 1.15);
      const domeMesh = new THREE.Mesh(domeGeo, solidBodyMat);
      domeMesh.position.set(0, 0.15, -0.25);
      bellGroup.add(domeMesh);

      // Dark espresso webbing skirt cone connecting arms
      const webMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(secondaryColor || '#190a05'),
        gradientMap: this.toonGradientMap,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      });
      const webSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.95, 16, 1, true), webMat);
      webSkirt.rotation.x = -Math.PI / 2;
      webSkirt.position.set(0, 0, 0.38);
      bellGroup.add(webSkirt);

      // Side ear-fins
      const { leftFin, rightFin } = this.addPectoralFins(group, 'octo', accentMat);
      group.userData.leftEarFin = leftFin;
      group.userData.rightEarFin = rightFin;
      group.userData.leftFin = leftFin;
      group.userData.rightFin = rightFin;

      // 8 curved arms with glowing cyan photophore tips
      const tipMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const armGroup = new THREE.Group();
        armGroup.position.set(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 0.25);

        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(angle) * 0.32, Math.sin(angle) * 0.32, 0.55),
          new THREE.Vector3(Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 1.05)
        );
        const armGeo = new THREE.TubeGeometry(curve, 12, 0.065, 8, false);
        armGroup.add(new THREE.Mesh(armGeo, solidBodyMat));

        const photophoreTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), tipMat);
        photophoreTip.position.set(Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 1.05);
        armGroup.add(photophoreTip);

        group.add(armGroup);
        tentacles.push(armGroup);
      }

      this.addCartoonEyes(group, 'octo');
    } else {
      // Prismatic Glass Squid: translucent diamond-finned mantle, glowing internal core, lateral eyes, 8 waving arms + 2 long feeding tentacles
      group.userData.locomotionType = 'jet_pulse';

      const glassMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(primaryColor),
        gradientMap: this.toonGradientMap,
        transparent: true,
        opacity: 0.58
      });
      const mantleGeo = new THREE.ConeGeometry(0.65, 1.85, 18);
      mantleGeo.rotateX(-Math.PI / 2);
      const mantleMesh = new THREE.Mesh(mantleGeo, glassMat);
      mantleMesh.position.set(0, 0, -0.55);
      bellGroup.add(mantleMesh);

      // Glowing internal bioluminescent core
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(secondaryColor || '#12c2e9') });
      const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.95, 12), coreMat);
      coreMesh.rotation.x = Math.PI / 2;
      coreMesh.position.set(0, 0, -0.35);
      bellGroup.add(coreMesh);

      // Diamond lateral mantle fins
      const { leftFin, rightFin } = this.addPectoralFins(group, 'squid', accentMat);
      leftFin.position.set(0.28, 0, -1.05);
      rightFin.position.set(-0.28, 0, -1.05);
      group.userData.leftFin = leftFin;
      group.userData.rightFin = rightFin;

      // 8 articulated waving arms + 2 long feeding tentacles
      for (let i = 0; i < 10; i++) {
        const isFeedingTentacle = i >= 8;
        const angle = isFeedingTentacle ? (i === 8 ? 0 : Math.PI) : (i / 8) * Math.PI * 2;
        const armGroup = new THREE.Group();
        armGroup.position.set(Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0.35);

        const len = isFeedingTentacle ? 1.45 : 0.85;
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, len * 0.5),
          new THREE.Vector3(Math.cos(angle) * 0.06, Math.sin(angle) * 0.06, len)
        );
        const radius = isFeedingTentacle ? 0.035 : 0.05;
        const armGeo = new THREE.TubeGeometry(curve, 12, radius, 8, false);
        armGroup.add(new THREE.Mesh(armGeo, accentMat));

        if (isFeedingTentacle) {
          const club = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), coreMat);
          club.scale.set(0.7, 0.7, 1.8);
          club.position.set(Math.cos(angle) * 0.06, Math.sin(angle) * 0.06, len);
          armGroup.add(club);
        }

        group.add(armGroup);
        tentacles.push(armGroup);
      }

      this.addCartoonEyes(group, 'squid');
    }

    group.userData.bellGroup = bellGroup;
    group.userData.tentacles = tentacles;
  }

  /**
   * Rig Family 4: Medusa & Colonial Chain (`cosmic_jelly`, `crystal_siphonophore`)
   */
  private buildMedusaAndChainRig(
    group: THREE.Group,
    speciesId: string,
    bodyType: string,
    bodyMat: THREE.Material,
    solidBodyMat: THREE.Material,
    accentMat: THREE.Material,
    primaryColor: string,
    secondaryColor: string
  ): void {
    if (speciesId.includes('siphonophore') || bodyType === 'chain') {
      // Crystal Siphonophore: 8 articulated translucent glowing nectophore bells in spineSegments[] with trailing filament ribbons
      group.userData.locomotionType = 'chain_wave';
      const spineSegments: THREE.Object3D[] = [];
      const tentacles: THREE.Object3D[] = [];

      const bellMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(primaryColor),
        gradientMap: this.toonGradientMap,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
      });
      const stolonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(secondaryColor || '#92fe9d') });

      for (let i = 0; i < 8; i++) {
        const seg = new THREE.Group();
        seg.name = `siphonophore_seg_${i}`;
        const t = i / 7;
        const scale = 1.0 - t * 0.45;
        seg.position.set(0, 0, 1.35 - i * 0.44);

        const nectophore = new THREE.Mesh(
          new THREE.SphereGeometry(0.36 * scale, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
          bellMat
        );
        nectophore.rotation.x = Math.PI / 2;
        seg.add(nectophore);

        // Glowing central stolon stem node
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 10, 10), stolonMat);
        seg.add(node);

        // Trailing bioluminescent filament ribbon hanging from each zooid
        const ribbonPivot = new THREE.Group();
        const ribbonCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, -0.05, 0),
          new THREE.Vector3((i % 2 === 0 ? 1 : -1) * 0.12, -0.45 * scale, -0.1),
          new THREE.Vector3(0, -0.82 * scale, -0.22)
        );
        const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, 10, 0.022 * scale, 6, false);
        ribbonPivot.add(new THREE.Mesh(ribbonGeo, stolonMat));
        seg.add(ribbonPivot);
        tentacles.push(ribbonPivot);

        group.add(seg);
        spineSegments.push(seg);
      }

      group.userData.spineSegments = spineSegments;
      group.userData.tentacles = tentacles;
      return;
    }

    // Cosmic Aurelia Jelly: double-layered translucent hemisphere bellGroup with nebula pattern,
    // 4 spiral oral arms, and 12 long neon trailing tentacles (no fish eyes or fish fins).
    group.userData.locomotionType = 'medusa_pulse';
    const bellGroup = new THREE.Group();
    bellGroup.name = 'bell_group';

    const outerBellMat = new THREE.MeshToonMaterial({
      color: new THREE.Color('#ffffff'),
      map: (bodyMat as THREE.MeshToonMaterial).map || null,
      gradientMap: this.toonGradientMap,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(primaryColor).multiplyScalar(0.35)
    });
    const outerDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      outerBellMat
    );
    outerDome.position.set(0, 0.25, 0);
    bellGroup.add(outerDome);

    const innerBellMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(secondaryColor || '#ff5858'),
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide
    });
    const innerDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      innerBellMat
    );
    innerDome.position.set(0, 0.22, 0);
    bellGroup.add(innerDome);

    group.add(bellGroup);

    const tentacles: THREE.Object3D[] = [];

    // 4 spiral oral arms in the center
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const oralArm = new THREE.Group();
      oralArm.position.set(Math.cos(angle) * 0.22, 0.05, Math.sin(angle) * 0.22);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle + 0.5) * 0.16, -0.45, Math.sin(angle + 0.5) * 0.16),
        new THREE.Vector3(Math.cos(angle - 0.5) * 0.16, -0.95, Math.sin(angle - 0.5) * 0.16),
        new THREE.Vector3(0, -1.45, 0)
      ]);
      const oralGeo = new THREE.TubeGeometry(curve, 16, 0.055, 8, false);
      oralArm.add(new THREE.Mesh(oralGeo, accentMat));
      group.add(oralArm);
      tentacles.push(oralArm);
    }

    // 12 long neon trailing margin tentacles
    const neonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(primaryColor) });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tentaclePivot = new THREE.Group();
      tentaclePivot.position.set(Math.cos(angle) * 0.92, 0.08, Math.sin(angle) * 0.92);

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle) * 0.15, -0.85, Math.sin(angle) * 0.15),
        new THREE.Vector3(Math.cos(angle) * 0.05, -1.75, Math.sin(angle) * 0.05)
      );
      const tGeo = new THREE.TubeGeometry(curve, 14, 0.018, 6, false);
      tentaclePivot.add(new THREE.Mesh(tGeo, i % 2 === 0 ? neonMat : solidBodyMat));
      group.add(tentaclePivot);
      tentacles.push(tentaclePivot);
    }

    group.userData.bellGroup = bellGroup;
    group.userData.tentacles = tentacles;
  }

  /**
   * Rig Family 5: Serpentine & Leviathan (`ribbon_oarfish`, `gulper_void`, `abyssal_leviathan`)
   * Multi-segment articulated chain (`userData.spineSegments`, 8 segments) with anguilliform locomotion.
   */
  private buildSerpentineRig(
    group: THREE.Group,
    speciesId: string,
    bodyType: string,
    bodyMat: THREE.Material,
    solidBodyMat: THREE.Material,
    accentMat: THREE.Material,
    _primaryColor: string,
    secondaryColor: string
  ): void {
    group.userData.locomotionType = 'anguilliform';
    const spineSegments: THREE.Object3D[] = [];
    const segmentCount = 8;

    const isOarfish = speciesId.includes('oarfish') || bodyType === 'ribbon';
    const isGulper = speciesId.includes('gulper') || bodyType === 'eel';

    const crimsonMat = new THREE.MeshToonMaterial({
      color: 0xef4444,
      gradientMap: this.toonGradientMap,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < segmentCount; i++) {
      const t = i / (segmentCount - 1);
      const seg = new THREE.Group();
      seg.name = `serpent_seg_${i}`;
      seg.position.set(0, 0, 1.4 - i * 0.42);

      if (isOarfish) {
        // Laterally flat silver ribbon segments + continuous crimson dorsal crest
        const h = (1 - t * 0.45) * 0.48;
        const w = (1 - t * 0.5) * 0.12;
        const slabGeo = new THREE.SphereGeometry(1, 14, 12);
        slabGeo.scale(w, h, 0.28);
        seg.add(new THREE.Mesh(slabGeo, solidBodyMat));

        // Continuous crimson dorsal crest along all segments
        const crestGeo = new THREE.BoxGeometry(0.03, 0.22 * (1 - t * 0.3), 0.42);
        const crest = new THREE.Mesh(crestGeo, crimsonMat);
        crest.position.set(0, h + 0.08, 0);
        seg.add(crest);

        if (i === 0) {
          // 3 tall red crown rays on head
          for (let r = 0; r < 3; r++) {
            const rayGeo = new THREE.CylinderGeometry(0.012, 0.028, 0.85 - r * 0.12, 8);
            const ray = new THREE.Mesh(rayGeo, crimsonMat);
            ray.position.set(0, h + 0.42, 0.12 - r * 0.08);
            ray.rotation.x = 0.25 - r * 0.18;
            seg.add(ray);
          }
        }
      } else if (isGulper) {
        // Void Gulper Eel: massive hinged pelican jaw on segment 0, tiny eyes, tapering dark eel segments, glowing pink tail tip bulb
        if (i === 0) {
          const upperSkullGeo = new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
          upperSkullGeo.scale(0.85, 0.75, 1.65);
          const upperSkull = new THREE.Mesh(upperSkullGeo, solidBodyMat);
          upperSkull.position.set(0, 0.05, 0.25);
          seg.add(upperSkull);

          // Massive hinged pelican jaw
          const jawPivot = new THREE.Group();
          jawPivot.name = 'jaw_pivot';
          jawPivot.position.set(0, -0.05, -0.15);

          const pouchGeo = new THREE.SphereGeometry(0.48, 16, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
          pouchGeo.scale(0.88, 1.15, 1.85);
          const pouchMesh = new THREE.Mesh(pouchGeo, accentMat);
          pouchMesh.position.set(0, -0.08, 0.45);
          jawPivot.add(pouchMesh);
          seg.add(jawPivot);
          group.userData.jawPivot = jawPivot;
        } else {
          const r = Math.max(0.05, (1 - t) * 0.28);
          const eelSeg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), solidBodyMat);
          eelSeg.scale.set(0.85, 0.95, 1.65);
          seg.add(eelSeg);

          if (i === segmentCount - 1) {
            // Glowing pink tail tip bulb
            const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bulbMat);
            bulb.position.set(0, 0, -0.22);
            seg.add(bulb);
          }
        }
      } else {
        // Abyssal Trench Leviathan: armored obsidian titan segments with glowing cyan fissures, dorsal scutes, 4 flippers, horned skull crest, horizontal tail fluke
        const r = (1 - t * 0.58) * 0.56;
        const armorGeo = new THREE.SphereGeometry(r, 16, 14);
        armorGeo.scale(0.95, 0.88, 1.35);
        seg.add(new THREE.Mesh(armorGeo, bodyMat));

        // Glowing cyan-edged dorsal scutes along spine
        if (i >= 1 && i <= 6) {
          const scuteGeo = new THREE.ConeGeometry(0.08 * (1 - t * 0.4), 0.28 * (1 - t * 0.3), 6);
          const scute = new THREE.Mesh(scuteGeo, accentMat);
          scute.position.set(0, r * 0.92, 0);
          scute.rotation.x = -0.35;
          seg.add(scute);
        }

        if (i === 0) {
          // Horned skull crest
          const hornGeo = new THREE.ConeGeometry(0.09, 0.55, 8);
          [-1, 1].forEach((side) => {
            const horn = new THREE.Mesh(hornGeo, accentMat);
            horn.position.set(side * 0.32, 0.42, -0.1);
            horn.rotation.x = -0.65;
            horn.rotation.z = -side * 0.35;
            seg.add(horn);
          });
          const jawPivot = this.addNibblingMouth(seg, 'torpedo', accentMat);
          group.userData.jawPivot = jawPivot;
        }

        // 4 pectoral / pelvic flippers on segments 1 and 4
        if (i === 1 || i === 4) {
          const flipperScale = i === 1 ? 1.0 : 0.65;
          const flipperGeo = new THREE.SphereGeometry(0.38 * flipperScale, 12, 10);
          flipperGeo.scale(1.3, 0.18, 0.55);

          const leftFlipper = new THREE.Mesh(flipperGeo, accentMat);
          leftFlipper.position.set(r + 0.25 * flipperScale, -0.15, 0);
          leftFlipper.rotation.z = -0.25;
          seg.add(leftFlipper);

          const rightFlipper = new THREE.Mesh(flipperGeo, accentMat);
          rightFlipper.position.set(-(r + 0.25 * flipperScale), -0.15, 0);
          rightFlipper.rotation.z = 0.25;
          seg.add(rightFlipper);

          if (i === 1) {
            group.userData.leftFin = leftFlipper;
            group.userData.rightFin = rightFlipper;
          }
        }

        // Horizontal tail fluke on final segment
        if (i === segmentCount - 1) {
          const flukeGeo = new THREE.SphereGeometry(0.45, 14, 10);
          flukeGeo.scale(1.6, 0.14, 0.65);
          const fluke = new THREE.Mesh(flukeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(secondaryColor || '#66fcf1') }));
          fluke.position.set(0, 0, -0.25);
          seg.add(fluke);
          group.userData.tailPivot = seg;
        }
      }

      group.add(seg);
      spineSegments.push(seg);
    }

    // Add eyes on segment 0 (tiny for gulper eel, fierce for leviathan/oarfish)
    this.addCartoonEyes(spineSegments[0] as THREE.Group, isGulper ? 'eel' : 'torpedo');
    if (!group.userData.tailPivot) {
      group.userData.tailPivot = spineSegments[spineSegments.length - 1];
    }

    group.userData.spineSegments = spineSegments;
  }

  /**
   * Rig Family 6: Deep-Sea Specialists (`silver_hatchet`, `glass_lantern`, `coelacanth_shadow`, `ghost_grenadier`, `bioluminescent_angler`)
   */
  private buildDeepSpecialistRig(
    group: THREE.Group,
    speciesId: string,
    bodyType: string,
    bodyMat: THREE.Material,
    solidBodyMat: THREE.Material,
    accentMat: THREE.Material,
    primaryColor: string,
    secondaryColor: string
  ): void {
    group.userData.locomotionType = 'specialist_swim';

    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });

    if (speciesId.includes('hatchet') || bodyType === 'hatchet') {
      // Silver Hatchetfish: ultra-thin mirror blade body, upturned tubular eyes, 10 glowing cyan ventral photophore beads
      const bladeGeo = new THREE.SphereGeometry(0.95, 22, 20);
      bladeGeo.scale(0.18, 1.05, 1.05);
      const bladeMesh = new THREE.Mesh(bladeGeo, bodyMat);
      group.add(bladeMesh);

      // Upturned tubular eyes gazing toward surface
      const eyeGroup = new THREE.Group();
      eyeGroup.name = 'cartoon_eyes';
      const tubeMat = new THREE.MeshToonMaterial({ color: 0x1e293b, gradientMap: this.toonGradientMap });
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const shineMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });

      [-1, 1].forEach((side) => {
        const stalk = new THREE.Group();
        stalk.position.set(side * 0.16, 0.58, 0.58);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12), tubeMat);
        stalk.add(cyl);
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), scleraMat);
        sclera.position.set(0, 0.12, 0);
        stalk.add(sclera);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), pupilMat);
        pupil.position.set(0, 0.17, 0.02);
        stalk.add(pupil);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), shineMat);
        shine.position.set(side * 0.02, 0.21, 0.04);
        stalk.add(shine);
        eyeGroup.add(stalk);
      });
      group.add(eyeGroup);

      // 10 glowing cyan ventral photophore beads along sharp belly keel
      for (let i = 0; i < 10; i++) {
        const pz = -0.52 + (i / 9) * 1.05;
        const py = -0.82 - Math.sin((i / 9) * Math.PI) * 0.16;
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), cyanGlowMat);
        bead.position.set(0, py, pz);
        group.add(bead);
      }

      const { leftFin, rightFin } = this.addPectoralFins(group, 'disc', accentMat);
      const tailPivot = this.addTailFin(group, 'disc', accentMat);
      const { dorsalFin, analFin } = this.addFinCrests(group, 'disc', accentMat);
      const jawPivot = this.addNibblingMouth(group, 'disc', accentMat);

      group.userData.leftFin = leftFin;
      group.userData.rightFin = rightFin;
      group.userData.tailPivot = tailPivot;
      group.userData.dorsalFin = dorsalFin;
      group.userData.analFin = analFin;
      group.userData.jawPivot = jawPivot;
      return;
    }

    if (speciesId.includes('glass_lantern') || speciesId.includes('lantern')) {
      // Glass Lanternfish: semi-translucent torpedo body with internal spine, large glowing blue eyes, 8 lateral photophore beads
      const glassBodyMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(primaryColor),
        map: (bodyMat as THREE.MeshToonMaterial).map || null,
        gradientMap: this.toonGradientMap,
        transparent: true,
        opacity: 0.58
      });
      const outerGeo = new THREE.SphereGeometry(1, 24, 20);
      outerGeo.scale(0.55, 0.62, 1.55);
      group.add(new THREE.Mesh(outerGeo, glassBodyMat));

      // Visible internal vertebral spine & glowing core
      const spineBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.03, 2.1, 10),
        new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
      );
      spineBar.rotation.x = Math.PI / 2;
      spineBar.position.set(0, 0.08, -0.05);
      group.add(spineBar);

      // 8 lateral photophore beads (4 per flank)
      for (let i = 0; i < 4; i++) {
        const pz = 0.55 - i * 0.38;
        [-1, 1].forEach((side) => {
          const bead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), cyanGlowMat);
          bead.position.set(side * 0.48, -0.18, pz);
          group.add(bead);
        });
      }

      this.addCartoonEyes(group, 'torpedo');
      const { leftFin, rightFin } = this.addPectoralFins(group, 'torpedo', accentMat);
      const tailPivot = this.addTailFin(group, 'torpedo', accentMat);
      const { dorsalFin, analFin } = this.addFinCrests(group, 'torpedo', accentMat);
      const jawPivot = this.addNibblingMouth(group, 'torpedo', accentMat);

      group.userData.leftFin = leftFin;
      group.userData.rightFin = rightFin;
      group.userData.tailPivot = tailPivot;
      group.userData.dorsalFin = dorsalFin;
      group.userData.analFin = analFin;
      group.userData.jawPivot = jawPivot;
      return;
    }

    if (speciesId.includes('coelacanth') || bodyType === 'ancient') {
      // Ancient Dusk Coelacanth: armored slate body with white flecks, 4 fleshy stalked lobeFins, 3-lobed diphycercal tail
      const bodyGeo = new THREE.SphereGeometry(1, 24, 20);
      bodyGeo.scale(0.68, 0.85, 1.55);
      group.add(new THREE.Mesh(bodyGeo, bodyMat));

      // 4 fleshy stalked lobeFins (2 anterior pectoral + 2 posterior pelvic)
      const lobeFins: THREE.Object3D[] = [];
      const lobeCoords = [
        { x: 0.58, y: -0.28, z: 0.35 },
        { x: -0.58, y: -0.28, z: 0.35 },
        { x: 0.46, y: -0.42, z: -0.38 },
        { x: -0.46, y: -0.42, z: -0.38 }
      ];
      lobeCoords.forEach((lc, idx) => {
        const lobePivot = new THREE.Group();
        lobePivot.name = `lobe_fin_${idx}`;
        lobePivot.position.set(lc.x, lc.y, lc.z);

        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.32, 10), solidBodyMat);
        stalk.rotation.z = lc.x > 0 ? -0.65 : 0.65;
        stalk.position.set(lc.x > 0 ? 0.12 : -0.12, -0.08, 0);
        lobePivot.add(stalk);

        const paddle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), accentMat);
        paddle.scale.set(0.25, 0.75, 1.15);
        paddle.position.set(lc.x > 0 ? 0.26 : -0.26, -0.18, -0.08);
        lobePivot.add(paddle);

        group.add(lobePivot);
        lobeFins.push(lobePivot);
      });

      // 3-lobed diphycercal tail (upper, lower, and central supplementary fleshy lobe)
      const tailPivot = this.addTailFin(group, 'torpedo', accentMat);
      const centralLobe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), solidBodyMat);
      centralLobe.scale.set(0.28, 0.48, 1.45);
      centralLobe.position.set(0, 0, -0.78);
      tailPivot.add(centralLobe);

      this.addCartoonEyes(group, 'torpedo');
      const { dorsalFin, analFin } = this.addFinCrests(group, 'torpedo', accentMat);
      const jawPivot = this.addNibblingMouth(group, 'torpedo', accentMat);

      group.userData.lobeFins = lobeFins;
      group.userData.leftFin = lobeFins[0];
      group.userData.rightFin = lobeFins[1];
      group.userData.tailPivot = tailPivot;
      group.userData.dorsalFin = dorsalFin;
      group.userData.analFin = analFin;
      group.userData.jawPivot = jawPivot;
      return;
    }

    if (speciesId.includes('grenadier') || bodyType === 'rattail') {
      // Ghost Grenadier: angular armored head, chin barbel, 5-segment tapering rattail (spineSegments)
      const headGeo = new THREE.ConeGeometry(0.68, 1.25, 6);
      headGeo.rotateX(Math.PI / 2);
      const headMesh = new THREE.Mesh(headGeo, solidBodyMat);
      headMesh.position.set(0, 0.04, 0.68);
      group.add(headMesh);

      // Sensory chin barbel
      const barbel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.005, 0.35, 6), accentMat);
      barbel.position.set(0, -0.38, 0.85);
      barbel.rotation.x = 0.35;
      group.add(barbel);

      // 5-segment tapering rattail
      const spineSegments: THREE.Object3D[] = [];
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const seg = new THREE.Group();
        seg.name = `rattail_seg_${i}`;
        seg.position.set(0, 0, 0.05 - i * 0.45);

        const r = Math.max(0.04, (1 - t * 0.88) * 0.52);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, 0.48, 10), solidBodyMat);
        cone.rotation.x = Math.PI / 2;
        seg.add(cone);

        group.add(seg);
        spineSegments.push(seg);
      }

      this.addCartoonEyes(group, 'torpedo');
      const { leftFin, rightFin } = this.addPectoralFins(group, 'torpedo', accentMat);
      const { dorsalFin, analFin } = this.addFinCrests(group, 'torpedo', accentMat);
      const jawPivot = this.addNibblingMouth(group, 'torpedo', accentMat);

      group.userData.spineSegments = spineSegments;
      group.userData.tailPivot = spineSegments[spineSegments.length - 1];
      group.userData.leftFin = leftFin;
      group.userData.rightFin = rightFin;
      group.userData.dorsalFin = dorsalFin;
      group.userData.analFin = analFin;
      group.userData.jawPivot = jawPivot;
      return;
    }

    // Bioluminescent Angler (`bioluminescent_angler` / `angler`):
    // Dark abyssal orb body, huge underbite jaw (`jawPivot`) with 12 translucent inward fangs, and `addAnglerLure`
    const orbGeo = new THREE.SphereGeometry(0.95, 24, 20);
    orbGeo.scale(0.95, 0.92, 1.08);
    group.add(new THREE.Mesh(orbGeo, solidBodyMat));

    // Cavernous underbite jaw with 12 translucent inward fangs
    const jawPivot = new THREE.Group();
    jawPivot.name = 'jaw_pivot';
    jawPivot.position.set(0, -0.22, 0.48);

    const mandibleGeo = new THREE.TorusGeometry(0.52, 0.11, 10, 18, Math.PI);
    mandibleGeo.rotateX(Math.PI / 2);
    const mandible = new THREE.Mesh(mandibleGeo, solidBodyMat);
    jawPivot.add(mandible);

    const fangMat = new THREE.MeshToonMaterial({
      color: 0xe0f2fe,
      gradientMap: this.toonGradientMap,
      transparent: true,
      opacity: 0.85
    });
    const fangGeo = new THREE.ConeGeometry(0.032, 0.24, 6);
    for (let i = 0; i < 12; i++) {
      const isLower = i < 6;
      const idx = i % 6;
      const angle = ((idx - 2.5) / 2.5) * 1.15;
      const fang = new THREE.Mesh(fangGeo, fangMat);
      if (isLower) {
        fang.position.set(Math.sin(angle) * 0.48, 0.14, Math.cos(angle) * 0.48);
        fang.rotation.x = -0.28;
        jawPivot.add(fang);
      } else {
        fang.position.set(Math.sin(angle) * 0.46, 0.08, 0.45 + Math.cos(angle) * 0.44);
        fang.rotation.x = Math.PI + 0.25;
        group.add(fang);
      }
    }
    group.add(jawPivot);

    this.addCartoonEyes(group, 'spiky');
    const { leftFin, rightFin } = this.addPectoralFins(group, 'spiky', accentMat);
    const tailPivot = this.addTailFin(group, 'oval', accentMat);
    const { dorsalFin, analFin } = this.addFinCrests(group, 'oval', accentMat);
    const lureLight = this.addAnglerLure(group, secondaryColor || '#00f2fe');

    group.userData.jawPivot = jawPivot;
    group.userData.leftFin = leftFin;
    group.userData.rightFin = rightFin;
    group.userData.tailPivot = tailPivot;
    group.userData.dorsalFin = dorsalFin;
    group.userData.analFin = analFin;
    group.userData.lureGlow = lureLight;
  }

  /**
   * Rig Families 7 & 8: Sculpted Reef & Spined Builder
   * (`azure_damselfish`, `sunburst_tang`, `emerald_parrotfish`, `clown_anemone`, `solar_lionfish`, `spotted_pufferfish`)
   */
  private buildSculptedReefAndSpinedRig(
    group: THREE.Group,
    speciesId: string,
    bodyType: string,
    bodyMat: THREE.Material,
    solidBodyMat: THREE.Material,
    accentMat: THREE.Material,
    _primaryColor: string,
    _secondaryColor: string
  ): void {
    const isLionfish = speciesId.includes('lionfish');
    const isPuffer = speciesId.includes('puffer') || (bodyType === 'spiky' && !isLionfish);
    const isParrotfish = speciesId.includes('parrot');
    const isTang = speciesId.includes('tang');

    if (isLionfish) {
      group.userData.locomotionType = 'hover_flutter';
    } else if (isPuffer) {
      group.userData.locomotionType = 'puffer';
    } else {
      group.userData.locomotionType = 'carangiform';
    }

    // Main body mesh
    const bodyMesh = this.buildCartoonBody(isLionfish ? 'oval' : bodyType, bodyMat, accentMat);
    group.add(bodyMesh);

    // Pufferfish: 24 radial spikes stored in userData.puffSpikes + cream belly
    if (isPuffer) {
      const puffSpikes: THREE.Object3D[] = [];
      const spikeGeo = new THREE.ConeGeometry(0.075, 0.28, 8);
      spikeGeo.rotateX(Math.PI / 2);

      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < 24; i++) {
        const y = 1 - (i / 23) * 1.75; // avoid covering eyes directly
        const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i;
        const sx = Math.cos(theta) * radiusAtY * 0.92;
        const sy = y * 0.92;
        const sz = Math.sin(theta) * radiusAtY * 1.05;

        const spike = new THREE.Mesh(spikeGeo, accentMat);
        spike.position.set(sx, sy, sz);
        spike.lookAt(sx * 2, sy * 2, sz * 2);
        group.add(spike);
        puffSpikes.push(spike);
      }
      group.userData.puffSpikes = puffSpikes;
    }

    // Lionfish: 14 splayed feathered dorsal spines & wide ribbed fan pectorals
    let leftFin: THREE.Object3D;
    let rightFin: THREE.Object3D;
    let dorsalFin: THREE.Object3D;
    let analFin: THREE.Object3D;

    if (isLionfish) {
      dorsalFin = new THREE.Group();
      dorsalFin.name = 'dorsal_fin';
      dorsalFin.position.set(0, 0.78, 0);

      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        const spineGroup = new THREE.Group();
        spineGroup.position.set(0, 0, 0.58 - t * 1.35);
        spineGroup.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.18 + (i % 3) * 0.12);
        spineGroup.rotation.x = -0.15 - t * 0.45;

        const needle = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.95, 6), solidBodyMat);
        needle.position.set(0, 0.45, 0);
        spineGroup.add(needle);

        const plume = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.78, 0.14), accentMat);
        plume.position.set(0, 0.4, -0.04);
        spineGroup.add(plume);

        dorsalFin.add(spineGroup);
      }
      group.add(dorsalFin);

      const crests = this.addFinCrests(group, 'oval', accentMat);
      group.remove(crests.dorsalFin);
      analFin = crests.analFin;

      // Wide ribbed fan pectorals
      leftFin = new THREE.Group();
      leftFin.position.set(0.68, -0.08, 0.18);
      rightFin = new THREE.Group();
      rightFin.position.set(-0.68, -0.08, 0.18);

      for (let r = 0; r < 8; r++) {
        const fanAngle = ((r - 3.5) / 3.5) * 0.75;
        const rayGeo = new THREE.ConeGeometry(0.035, 0.95, 6);
        rayGeo.rotateZ(-Math.PI / 2);

        const lRay = new THREE.Mesh(rayGeo, r % 2 === 0 ? solidBodyMat : accentMat);
        lRay.rotation.y = fanAngle;
        lRay.position.set(0.42, Math.sin(fanAngle) * 0.15, -Math.abs(fanAngle) * 0.15);
        leftFin.add(lRay);

        const rRay = new THREE.Mesh(rayGeo.clone().rotateY(Math.PI), r % 2 === 0 ? solidBodyMat : accentMat);
        rRay.rotation.y = -fanAngle;
        rRay.position.set(-0.42, Math.sin(fanAngle) * 0.15, -Math.abs(fanAngle) * 0.15);
        rightFin.add(rRay);
      }
      group.add(leftFin);
      group.add(rightFin);
    } else {
      const pectorals = this.addPectoralFins(group, bodyType, accentMat);
      leftFin = pectorals.leftFin;
      rightFin = pectorals.rightFin;
      const crests = this.addFinCrests(group, bodyType, accentMat);
      dorsalFin = crests.dorsalFin;
      analFin = crests.analFin;
    }

    // Species-specific anatomical details
    if (isParrotfish) {
      // Fused cyan beak on the snout
      const beakMat = new THREE.MeshToonMaterial({ color: 0x2dd4bf, gradientMap: this.toonGradientMap });
      const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 10), beakMat);
      upperBeak.rotation.x = Math.PI / 2 + 0.15;
      upperBeak.position.set(0, 0.05, 1.72);
      group.add(upperBeak);
    }

    if (isTang) {
      // Pointed surgeonfish grazing snout + white caudal scalpel spine
      const snoutCone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.45, 12), bodyMat);
      snoutCone.rotation.x = Math.PI / 2;
      snoutCone.position.set(0, -0.04, 1.08);
      group.add(snoutCone);

      const scalpelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [-1, 1].forEach((side) => {
        const scalpel = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 8), scalpelMat);
        scalpel.rotation.x = Math.PI / 2;
        scalpel.position.set(side * 0.14, 0, -0.88);
        group.add(scalpel);
      });
    }

    this.addCartoonEyes(group, bodyType);
    const tailPivot = this.addTailFin(group, bodyType, accentMat);
    const jawPivot = this.addNibblingMouth(group, bodyType, accentMat);
    this.addCheekBlush(group, bodyType);
    this.addSpeciesMarkings(group, speciesId, bodyType, accentMat);

    group.userData.tailPivot = tailPivot;
    group.userData.leftFin = leftFin;
    group.userData.rightFin = rightFin;
    group.userData.dorsalFin = dorsalFin;
    group.userData.analFin = analFin;
    group.userData.jawPivot = jawPivot;
  }

  /**
   * Derive iridescent / golden pastel hue for shiny variants
   */
  private getShinyColor(baseHex: string): string {
    const col = new THREE.Color(baseHex);
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    col.setHSL((hsl.h + 0.5) % 1.0, 0.85, 0.72);
    return '#' + col.getHexString();
  }

  /**
   * Construct smoothed rounded cartoon geometries for core body types
   */
  private buildCartoonBody(bodyType: string, bodyMat: THREE.Material, accentMat: THREE.Material): THREE.Group {
    const bodyGroup = new THREE.Group();

    if (bodyType === 'ray') {
      const rayGeo = new THREE.CylinderGeometry(1.1, 0.9, 0.32, 18);
      rayGeo.scale(1.0, 1.0, 1.6);
      const rayMesh = new THREE.Mesh(rayGeo, bodyMat);
      bodyGroup.add(rayMesh);
      return bodyGroup;
    }

    if (bodyType === 'vertical') {
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
      const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 16), bodyMat);
      mantle.rotation.x = -Math.PI / 2;
      mantle.position.set(0, 0, -0.4);
      bodyGroup.add(mantle);
      return bodyGroup;
    }

    if (bodyType === 'jelly') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), bodyMat);
      dome.position.set(0, 0.2, 0);
      bodyGroup.add(dome);
      return bodyGroup;
    }

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
      rx = 0.95;
      ry = 0.95;
      rz = 1.1;
    }

    const geo = new THREE.SphereGeometry(1, 24, 24);
    geo.scale(rx, ry, rz);
    const mainBody = new THREE.Mesh(geo, bodyMat);
    bodyGroup.add(mainBody);

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

    const eyeRadius = bodyType === 'eel' ? 0.09 : bodyType === 'spiky' ? 0.28 : 0.22;
    const scleraGeo = new THREE.SphereGeometry(eyeRadius, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.58, 12, 12);
    const shineGeo = new THREE.SphereGeometry(eyeRadius * 0.22, 8, 8);

    let eyeOffsetX = 0.58;
    let eyeOffsetY = 0.26;
    let eyeOffsetZ = 0.65;

    if (bodyType === 'disc') {
      eyeOffsetX = 0.34;
    } else if (bodyType === 'vertical') {
      eyeOffsetX = 0.28;
      eyeOffsetY = 0.95;
      eyeOffsetZ = 0.24;
    } else if (bodyType === 'ray') {
      eyeOffsetX = 0.62;
      eyeOffsetY = 0.08;
      eyeOffsetZ = 0.85;
    } else if (bodyType === 'eel') {
      eyeOffsetX = 0.22;
      eyeOffsetY = 0.16;
      eyeOffsetZ = 0.65;
    } else if (bodyType === 'squid' || bodyType === 'octo' || bodyType === 'dumbo') {
      eyeOffsetX = 0.52;
      eyeOffsetY = 0.12;
      eyeOffsetZ = 0.36;
    }

    [-1, 1].forEach((side) => {
      const eyeSide = new THREE.Group();
      eyeSide.position.set(side * eyeOffsetX, eyeOffsetY, eyeOffsetZ);

      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.scale.set(1.0, 1.0, 0.6);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * 0.04, 0, eyeRadius * 0.5);

      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(side * 0.04 + 0.04, 0.05, eyeRadius * 0.7);

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
  private addPectoralFins(
    parent: THREE.Group,
    bodyType: string,
    finMat: THREE.Material
  ): { leftFin: THREE.Object3D; rightFin: THREE.Object3D } {
    const finGeo = new THREE.SphereGeometry(0.35, 12, 12);
    finGeo.scale(0.1, 0.5, 0.8);

    const xPos = bodyType === 'disc' ? 0.35 : bodyType === 'vertical' ? 0.26 : 0.65;
    const yPos = bodyType === 'vertical' ? 0.82 : -0.1;
    const zPos = bodyType === 'vertical' ? 0.04 : 0.1;

    const leftFinPivot = new THREE.Group();
    leftFinPivot.position.set(xPos, yPos, zPos);
    const leftMesh = new THREE.Mesh(finGeo, finMat);
    leftMesh.position.set(0.18, 0, -0.2);
    leftMesh.rotation.y = Math.PI * 0.2;
    leftFinPivot.add(leftMesh);
    parent.add(leftFinPivot);

    const rightFinPivot = new THREE.Group();
    rightFinPivot.position.set(-xPos, yPos, zPos);
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

    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(0.1, 0.6, 0.4, 0.8);
    tailShape.quadraticCurveTo(0.1, 0.2, 0.6, 0);
    tailShape.quadraticCurveTo(0.1, -0.2, 0.4, -0.8);
    tailShape.quadraticCurveTo(0.1, -0.6, 0, 0);

    const extrudeSettings = {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02
    };
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
   * Animated Dorsal and Anal Fin Crests
   */
  private addFinCrests(
    parent: THREE.Group,
    bodyType: string,
    finMat: THREE.Material
  ): { dorsalFin: THREE.Object3D; analFin: THREE.Object3D } {
    const dorsalPivot = new THREE.Group();
    dorsalPivot.name = 'dorsal_fin';

    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.quadraticCurveTo(0.2, 0.5, 0.6, 0.6);
    dorsalShape.quadraticCurveTo(0.4, 0.2, 0.8, 0);
    dorsalShape.lineTo(0, 0);

    const extrudeSettings = { depth: 0.04, bevelEnabled: false };
    const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, extrudeSettings);
    dorsalGeo.center();
    dorsalGeo.rotateY(Math.PI / 2);

    const dorsalMesh = new THREE.Mesh(dorsalGeo, finMat);
    const dorsalY = bodyType === 'disc' ? 1.25 : bodyType === 'spiky' ? 1.05 : bodyType === 'ray' ? 0.25 : 0.9;
    dorsalPivot.position.set(0, dorsalY, 0.1);
    dorsalPivot.add(dorsalMesh);
    parent.add(dorsalPivot);

    const analPivot = new THREE.Group();
    analPivot.name = 'anal_fin';

    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.quadraticCurveTo(0.1, -0.35, 0.4, -0.45);
    analShape.quadraticCurveTo(0.3, -0.15, 0.5, 0);
    analShape.lineTo(0, 0);

    const analGeo = new THREE.ExtrudeGeometry(analShape, extrudeSettings);
    analGeo.center();
    analGeo.rotateY(Math.PI / 2);

    const analMesh = new THREE.Mesh(analGeo, finMat);
    const analY = bodyType === 'disc' ? -1.2 : -0.75;
    analPivot.position.set(0, analY, -0.4);
    analPivot.add(analMesh);
    parent.add(analPivot);

    return { dorsalFin: dorsalPivot, analFin: analPivot };
  }

  /**
   * Animated Nibbling Mouth / Lower Jaw Pivot
   */
  private addNibblingMouth(parent: THREE.Object3D, bodyType: string, accentMat: THREE.Material): THREE.Group {
    const zMouth = bodyType === 'torpedo' ? 1.6 : bodyType === 'spiky' ? 1.05 : bodyType === 'vertical' ? 0.78 : 1.22;
    const yMouth = bodyType === 'vertical' ? 0.78 : 0.04;

    const upperLipGeo = new THREE.SphereGeometry(0.12, 10, 8);
    upperLipGeo.scale(1.4, 0.55, 0.9);
    const upperLip = new THREE.Mesh(upperLipGeo, accentMat);
    upperLip.position.set(0, yMouth, zMouth);
    parent.add(upperLip);

    const jawPivot = new THREE.Group();
    jawPivot.name = 'jaw_pivot';
    jawPivot.position.set(0, yMouth - 0.1, zMouth - 0.08);

    const lowerLipGeo = new THREE.SphereGeometry(0.11, 10, 8);
    lowerLipGeo.scale(1.3, 0.5, 0.85);
    const lowerLip = new THREE.Mesh(lowerLipGeo, accentMat);
    lowerLip.position.set(0, 0, 0.08);
    jawPivot.add(lowerLip);

    parent.add(jawPivot);
    return jawPivot;
  }

  /**
   * Rosy Cartoon Cheek Blush Decals matching homepage pufferfish
   */
  private addCheekBlush(parent: THREE.Group, bodyType: string): void {
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });

    const blushGeo = new THREE.CircleGeometry(0.14, 12);
    const xOffset = bodyType === 'disc' ? 0.36 : bodyType === 'spiky' ? 0.78 : bodyType === 'vertical' ? 0.28 : 0.62;
    const yOffset = bodyType === 'vertical' ? 0.85 : 0.08;
    const zOffset = bodyType === 'vertical' ? 0.22 : 0.58;

    [-1, 1].forEach((side) => {
      const blush = new THREE.Mesh(blushGeo, blushMat);
      blush.position.set(side * xOffset, yOffset, zOffset);
      blush.rotation.y = side * (Math.PI / 2 + 0.15);
      parent.add(blush);
    });
  }

  /**
   * Species-Specific Markings: Clownfish 3D saddle rings, Tang caudal highlight
   */
  private addSpeciesMarkings(
    parent: THREE.Group,
    speciesId: string,
    _bodyType: string,
    _accentMat: THREE.Material
  ): void {
    const sId = (speciesId || '').toLowerCase();
    const isClown = sId.includes('clown') || sId.includes('anemone') || sId.includes('nemo');
    const isTang = sId.includes('tang') || sId.includes('surgeon') || sId.includes('dory');

    if (isClown) {
      const bandMat = new THREE.MeshToonMaterial({
        color: 0xffffff,
        gradientMap: this.toonGradientMap
      });
      const rimMat = new THREE.MeshBasicMaterial({ color: 0x111625 });

      const bandPositions = [
        { z: 0.45, r: 0.74 },
        { z: -0.05, r: 0.81 },
        { z: -0.65, r: 0.54 }
      ];

      bandPositions.forEach((bp) => {
        const bandGeo = new THREE.TorusGeometry(bp.r, 0.062, 8, 20);
        const bandMesh = new THREE.Mesh(bandGeo, bandMat);
        bandMesh.position.set(0, 0, bp.z);
        parent.add(bandMesh);

        [-0.05, 0.05].forEach((dz) => {
          const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(bp.r, 0.02, 6, 18), rimMat);
          rimMesh.position.set(0, 0, bp.z + dz);
          parent.add(rimMesh);
        });
      });
    } else if (isTang) {
      const yellowMat = new THREE.MeshToonMaterial({ color: 0xfacc15, gradientMap: this.toonGradientMap });
      const yellowFluke = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 8), yellowMat);
      yellowFluke.rotation.x = -Math.PI / 2;
      yellowFluke.position.set(0, 0, -1.0);
      parent.add(yellowFluke);
    }
  }

  /**
   * Bioluminescent Angler Lure attaching `userData.escaLure` and `userData.escaLight`
   */
  private addAnglerLure(parent: THREE.Group, glowColor: string): THREE.PointLight {
    const stalk = new THREE.Group();
    stalk.name = 'esca_lure';
    stalk.position.set(0, 0.78, 0.35);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.72, 0.42),
      new THREE.Vector3(0, 0.45, 1.05)
    );
    const stalkGeo = new THREE.TubeGeometry(curve, 16, 0.038, 8, false);
    const stalkMat = new THREE.MeshBasicMaterial({ color: 0x223344 });
    stalk.add(new THREE.Mesh(stalkGeo, stalkMat));

    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowColor) });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), bulbMat);
    bulb.position.set(0, 0.45, 1.05);
    stalk.add(bulb);

    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(glowColor),
      transparent: true,
      opacity: 0.38
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), haloMat);
    halo.position.set(0, 0.45, 1.05);
    stalk.add(halo);

    const light = new THREE.PointLight(glowColor, 2.2, 5);
    light.position.set(0, 0.45, 1.05);
    stalk.add(light);

    parent.add(stalk);
    parent.userData.escaLure = stalk;
    parent.userData.escaLight = light;
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
