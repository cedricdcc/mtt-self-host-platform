import * as THREE from 'three';
import { SubmarineDirector, ObservedFishData } from './SubmarineDirector';

export type CameraMode = 'STANDARD_VIEW' | 'DESKTOP_MODE' | 'INSPECTING_FISH';

/**
 * Manages camera states, smooth lerping, depth snaps, and 3rd-person cinematic submarine chase.
 */
export class CameraDirector {
  public camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'STANDARD_VIEW';

  // Standard Orbit View state
  private targetPosition: THREE.Vector3 = new THREE.Vector3(0, 12, 34);
  private targetLookAt: THREE.Vector3 = new THREE.Vector3(0, 10, 0);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 10, 0);

  // Mouse orbit dragging state
  public isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private spherical: THREE.Spherical = new THREE.Spherical(36, Math.PI / 2.2, 0);
  private centerOffset: THREE.Vector3 = new THREE.Vector3(0, 8, 0);

  // Focus target for inspection
  private inspectingTarget: THREE.Object3D | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.set(0, 12, 34);
    this.camera.lookAt(this.targetLookAt);
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'STANDARD_VIEW') {
      this.inspectingTarget = null;
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
   * Handle mouse drag start
   */
  public onPointerDown(clientX: number, clientY: number): void {
    if (this.mode !== 'STANDARD_VIEW') return;
    this.isDragging = true;
    this.previousMousePosition = { x: clientX, y: clientY };
  }

  /**
   * Handle mouse drag movement
   */
  public onPointerMove(clientX: number, clientY: number): void {
    if (!this.isDragging || this.mode !== 'STANDARD_VIEW') return;

    const deltaX = clientX - this.previousMousePosition.x;
    const deltaY = clientY - this.previousMousePosition.y;

    this.spherical.theta -= deltaX * 0.005;
    this.spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, this.spherical.phi - deltaY * 0.005));

    this.previousMousePosition = { x: clientX, y: clientY };
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
