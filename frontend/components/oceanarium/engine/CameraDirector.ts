import * as THREE from 'three';
import { SubmarineDirector, ObservedFishData } from './SubmarineDirector';

export type CameraMode = 'STANDARD_VIEW' | 'DESKTOP_MODE' | 'INSPECTING_FISH';

// 2.5D Isometric Vivarium View Constants
export const ISOMETRIC_RADIUS = 55.0;
export const ISOMETRIC_THETA = Math.PI / 4; // 45 degrees
export const ISOMETRIC_PHI = Math.PI / 3.2; // ~56 degrees elevation
export const ISOMETRIC_CENTER = new THREE.Vector3(0, 0, 0);

/**
 * Manages camera states, smooth lerping, depth snaps, 360° orbit/zoom/pan, and 3rd-person cinematic submarine chase.
 */
export class CameraDirector {
  public camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'STANDARD_VIEW';

  // Standard Orbit View state (Initialized to 2.5D Isometric Vivarium perspective)
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = ISOMETRIC_CENTER.clone();
  private currentLookAt: THREE.Vector3 = ISOMETRIC_CENTER.clone();

  // Mouse orbit & pan dragging state
  public isDragging: boolean = false;
  public isPanning: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private spherical: THREE.Spherical = new THREE.Spherical(ISOMETRIC_RADIUS, ISOMETRIC_PHI, ISOMETRIC_THETA);
  private centerOffset: THREE.Vector3 = ISOMETRIC_CENTER.clone();

  // Smooth View Reset / Preset Transition State
  private isResetting: boolean = false;
  private resetProgress: number = 0;
  private resetDuration: number = 1.0;
  private resetStartSpherical: THREE.Spherical = new THREE.Spherical();
  private resetStartCenter: THREE.Vector3 = new THREE.Vector3();
  private resetTargetSpherical: THREE.Spherical = new THREE.Spherical(ISOMETRIC_RADIUS, ISOMETRIC_PHI, ISOMETRIC_THETA);
  private resetTargetCenter: THREE.Vector3 = ISOMETRIC_CENTER.clone();

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
    this.isPanning = false;
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
    this.resetTargetSpherical.set(ISOMETRIC_RADIUS, ISOMETRIC_PHI, ISOMETRIC_THETA);
    this.resetTargetCenter.copy(ISOMETRIC_CENTER);
  }

  /**
   * Smoothly transition camera to the direct Front View preset
   */
  public snapToFrontView(duration = 0.9): void {
    this.mode = 'STANDARD_VIEW';
    this.inspectingTarget = null;
    this.isDragging = false;
    this.isPanning = false;
    this.isResetting = true;
    this.resetProgress = 0;
    this.resetDuration = Math.max(0.1, duration);

    const relPos = new THREE.Vector3().subVectors(this.camera.position, this.currentLookAt);
    if (relPos.length() > 0.001) {
      this.spherical.setFromVector3(relPos);
    }
    this.centerOffset.copy(this.currentLookAt);

    this.resetStartSpherical.copy(this.spherical);
    this.resetStartCenter.copy(this.centerOffset);
    this.resetTargetSpherical.set(48, Math.PI / 2, 0);
    this.resetTargetCenter.set(0, 0, 0);
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
    this.mode = 'STANDARD_VIEW';
    this.inspectingTarget = null;
    this.isResetting = false;

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
   * Focus camera closely on a specific fish while allowing 360° macro orbit and zoom
   */
  public inspectFish(fishMesh: THREE.Object3D): void {
    if (this.mode !== 'INSPECTING_FISH') {
      this.spherical.set(12.0, Math.PI / 2.2, Math.PI / 6);
    }
    this.mode = 'INSPECTING_FISH';
    this.inspectingTarget = fishMesh;
    this.isResetting = false;
  }

  /**
   * Handle mouse drag start (orbit or pan)
   */
  public onPointerDown(clientX: number, clientY: number, isPan: boolean = false): void {
    this.isDragging = true;
    this.isPanning = isPan;
    this.isResetting = false;
    this.previousMousePosition = { x: clientX, y: clientY };
  }

  /**
   * Handle mouse drag movement (360° orbit or pan)
   */
  public onPointerMove(clientX: number, clientY: number): void {
    if (!this.isDragging) return;

    const dx = clientX - this.previousMousePosition.x;
    const dy = clientY - this.previousMousePosition.y;
    this.previousMousePosition = { x: clientX, y: clientY };

    if (this.isPanning && this.mode !== 'INSPECTING_FISH') {
      this.centerOffset.x = THREE.MathUtils.clamp(this.centerOffset.x - dx * 0.06, -16, 16);
      this.centerOffset.y = THREE.MathUtils.clamp(this.centerOffset.y + dy * 0.06, -18, 18);
    } else {
      this.spherical.theta -= dx * 0.007;
      this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi - dy * 0.007, 0.2, Math.PI - 0.2);
    }
  }

  /**
   * Handle mouse drag end
   */
  public onPointerUp(): void {
    this.isDragging = false;
    this.isPanning = false;
  }

  /**
   * Handle mouse wheel zoom in standard or fish-inspection mode
   */
  public onWheel(deltaY: number): void {
    this.isResetting = false;
    this.spherical.radius = THREE.MathUtils.clamp(
      this.spherical.radius + deltaY * 0.025,
      this.mode === 'INSPECTING_FISH' ? 5.5 : 12.0,
      this.mode === 'INSPECTING_FISH' ? 24.0 : 82.0
    );
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

      this.spherical.radius = THREE.MathUtils.lerp(
        this.resetStartSpherical.radius,
        this.resetTargetSpherical.radius,
        easeOut
      );
      this.spherical.phi = THREE.MathUtils.lerp(
        this.resetStartSpherical.phi,
        this.resetTargetSpherical.phi,
        easeOut
      );
      this.spherical.theta = THREE.MathUtils.lerp(
        this.resetStartSpherical.theta,
        this.resetTargetSpherical.theta,
        easeOut
      );
      this.centerOffset.lerpVectors(this.resetStartCenter, this.resetTargetCenter, easeOut);

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
   * Smoothly frame and orbit around a selected swimming fish
   */
  private updateInspectingCamera(delta: number): void {
    if (!this.inspectingTarget) return;

    const fishPos = this.inspectingTarget.position;
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    const desiredPos = fishPos.clone().add(offset);

    this.camera.position.lerp(desiredPos, 0.08);
    this.currentLookAt.lerp(fishPos, 0.1);
    this.camera.lookAt(this.currentLookAt);
  }
}

export default CameraDirector;
