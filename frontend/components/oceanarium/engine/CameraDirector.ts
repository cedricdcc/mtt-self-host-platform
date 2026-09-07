import * as THREE from 'three';
import { SubmarineDirector, ObservedFishData } from './SubmarineDirector';

export type CameraMode = 'STANDARD_VIEW' | 'DESKTOP_MODE' | 'INSPECTING_FISH';

// 2.5D Isometric Vivarium View Constants
export const ISOMETRIC_RADIUS = 55.0;
export const ISOMETRIC_THETA = Math.PI / 4; // 45 degrees
export const ISOMETRIC_PHI = Math.PI / 3.2; // ~56 degrees elevation
export const ISOMETRIC_CENTER = new THREE.Vector3(0, 0, 0);

/**
 * Manages camera states, smooth lerping, depth snaps, and 3rd-person cinematic submarine chase.
 */
export class CameraDirector {
  public camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'STANDARD_VIEW';

  // Standard Orbit View state (Initialized to 2.5D Isometric Vivarium perspective)
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = ISOMETRIC_CENTER.clone();
  private currentLookAt: THREE.Vector3 = ISOMETRIC_CENTER.clone();

  // Mouse orbit dragging state
  public isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private spherical: THREE.Spherical = new THREE.Spherical(ISOMETRIC_RADIUS, ISOMETRIC_PHI, ISOMETRIC_THETA);
  private centerOffset: THREE.Vector3 = ISOMETRIC_CENTER.clone();

  // Smooth View Reset State
  private isResetting: boolean = false;
  private resetProgress: number = 0;
  private resetDuration: number = 1.0;
  private resetStartSpherical: THREE.Spherical = new THREE.Spherical();
  private resetStartCenter: THREE.Vector3 = new THREE.Vector3();

  // Focus target for inspection
  private inspectingTarget: THREE.Object3D | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    const initialPos = new THREE.Vector3().setFromSpherical(this.spherical).add(this.centerOffset);
    this.camera.position.copy(initialPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public resetToIsometric(duration = 1.0): void {
    this.mode = 'STANDARD_VIEW';
    this.inspectingTarget = null;
    this.isDragging = false;
    this.isResetting = true;
    this.resetProgress = 0;
    this.resetDuration = Math.max(0.1, duration);

    // Derive spherical coordinates from active 3D camera position relative to current lookAt
    const relPos = new THREE.Vector3().subVectors(this.camera.position, this.currentLookAt);
    if (relPos.length() > 0.001) {
      this.spherical.setFromVector3(relPos);
    }
    this.centerOffset.copy(this.currentLookAt);

    this.resetStartSpherical.copy(this.spherical);
    this.resetStartCenter.copy(this.centerOffset);
  }

  public setMode(mode: CameraMode): void {
    const prevMode = this.mode;
    this.mode = mode;
    if (mode === 'STANDARD_VIEW') {
      this.inspectingTarget = null;
      if (prevMode === 'DESKTOP_MODE') {
        // Automatically smoothly reset camera back to the 1:1:1 diorama cube view
        this.resetToIsometric(1.0);
      }
    }
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  /**
   * Snap camera view to depth zone (sunlit, twilight, abyssal)
   */
  public snapToDepth(zone: 'sunlit' | 'twilight' | 'abyssal'): void {
    if (zone === 'sunlit') {
      this.centerOffset.set(0, 16, 0);
      this.spherical.radius = 32;
      this.spherical.phi = Math.PI / 2.2;
    } else if (zone === 'twilight') {
      this.centerOffset.set(0, 0, 0);
      this.spherical.radius = 32;
      this.spherical.phi = Math.PI / 2.0;
    } else {
      this.centerOffset.set(0, -18, 0);
      this.spherical.radius = 32;
      this.spherical.phi = Math.PI / 1.8;
    }
  }

  /**
   * Focus camera closely on a specific fish
   */
  public inspectFish(fishMesh: THREE.Object3D): void {
    this.mode = 'INSPECTING_FISH';
    this.inspectingTarget = fishMesh;
  }

  /**
   * Handle mouse drag start (locked in standard view)
   */
  public onPointerDown(clientX: number, clientY: number): void {
    // Orbit drag disabled in normal mode to keep the diorama cube locked in its pristine 2.5D isometric view
    this.isDragging = false;
  }

  /**
   * Handle mouse drag movement
   */
  public onPointerMove(clientX: number, clientY: number): void {
    if (!this.isDragging) return;
  }

  /**
   * Handle mouse drag end
   */
  public onPointerUp(): void {
    this.isDragging = false;
  }

  /**
   * Main camera update tick
   */
  public update(delta: number, submarineDirector: SubmarineDirector, observedFish: ObservedFishData | null): void {
    if (this.mode === 'DESKTOP_MODE') {
      this.updateDesktopCamera(delta, submarineDirector, observedFish);
    } else if (this.mode === 'INSPECTING_FISH' && this.inspectingTarget) {
      this.updateInspectingCamera(delta);
    } else {
      this.updateStandardCamera(delta);
    }
  }

  /**
   * Standard View camera update
   */
  public updateStandardCamera(delta: number): void {
    if (this.isResetting) {
      this.resetProgress += delta / this.resetDuration;
      const t = Math.min(1.0, this.resetProgress);
      // Cubic ease out: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - t, 3);

      this.spherical.radius = THREE.MathUtils.lerp(this.resetStartSpherical.radius, ISOMETRIC_RADIUS, easeOut);
      this.spherical.phi = THREE.MathUtils.lerp(this.resetStartSpherical.phi, ISOMETRIC_PHI, easeOut);
      this.spherical.theta = THREE.MathUtils.lerp(this.resetStartSpherical.theta, ISOMETRIC_THETA, easeOut);
      this.centerOffset.lerpVectors(this.resetStartCenter, ISOMETRIC_CENTER, easeOut);

      if (t >= 1.0) {
        this.isResetting = false;
      }
    }

    // Convert spherical coordinates to cartesian target
    const targetPos = new THREE.Vector3().setFromSpherical(this.spherical).add(this.centerOffset);
    this.camera.position.lerp(targetPos, 0.08);

    this.currentLookAt.lerp(this.centerOffset, 0.08);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * 3rd-person Cinematic Submarine Chase & Nature Doc Camera
   */
  public updateDesktopCamera(delta: number, sub: SubmarineDirector, observedFish: ObservedFishData | null): void {
    const subMesh = sub.mesh;
    const subState = sub.getState();

    let desiredPos: THREE.Vector3;
    let desiredLookAt: THREE.Vector3;

    if (subState === 'HOVERING_OBSERVATION' && observedFish) {
      // Cinematic 45-degree angle framing both submarine and fish!
      const sideOffset = new THREE.Vector3(4.5, 2.0, -5.5).applyQuaternion(subMesh.quaternion);
      desiredPos = subMesh.position.clone().add(sideOffset);

      // Look at midpoint between sub and fish
      desiredLookAt = new THREE.Vector3().addVectors(subMesh.position, observedFish.position).multiplyScalar(0.5);
    } else {
      // Standard 3rd person chase camera slightly above and behind stern
      const rearOffset = new THREE.Vector3(0, 2.8, -8.5).applyQuaternion(subMesh.quaternion);
      desiredPos = subMesh.position.clone().add(rearOffset);

      // Look forward ahead of submarine
      const forwardOffset = new THREE.Vector3(0, 0.5, 10.0).applyQuaternion(subMesh.quaternion);
      desiredLookAt = subMesh.position.clone().add(forwardOffset);
    }

    this.camera.position.lerp(desiredPos, 0.06);
    this.currentLookAt.lerp(desiredLookAt, 0.08);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * Smoothly frame a selected fish
   */
  private updateInspectingCamera(delta: number): void {
    if (!this.inspectingTarget) return;

    const fishPos = this.inspectingTarget.position;
    const desiredPos = fishPos.clone().add(new THREE.Vector3(0, 1.2, 5.5));

    this.camera.position.lerp(desiredPos, 0.08);
    this.currentLookAt.lerp(fishPos, 0.1);
    this.camera.lookAt(this.currentLookAt);
  }
}

export default CameraDirector;
