/**
 * Light rig reproducing the legacy p5 set-up (P-21): two white point lights above and below
 * the plane, a blue directional light from the east, a white light that follows the pointer,
 * and - in first-person mode - a single headlamp attached to the camera.
 *
 * Lights use `decay = 0` so intensities are predictable regardless of maze size; values are
 * roughly pi times the legacy 0..1 feel because three.js's Lambert BRDF divides by pi.
 */
import * as THREE from 'three';

export class LightRig {
  private readonly group = new THREE.Group();
  private readonly ambient = new THREE.AmbientLight(0xffffff, 1.2);
  private readonly above = new THREE.PointLight(0xffffff, 2.4, 0, 0);
  private readonly below = new THREE.PointLight(0xffffff, 1.1, 0, 0);
  private readonly blue = new THREE.DirectionalLight(0x0066ff, 1.6);
  private readonly pointer = new THREE.PointLight(0xffffff, 1.8, 0, 0);
  private readonly headlamp = new THREE.PointLight(0xffffff, 3.2, 0, 0);
  private pointerHeight = 100;
  private firstPerson = false;
  private pointerActive = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    this.pointer.visible = false;
    this.headlamp.visible = false;
    this.group.add(this.ambient, this.above, this.below, this.blue, this.blue.target, this.pointer);
    scene.add(this.group);
    // The headlamp travels with the camera; the camera must be in the scene graph for that.
    this.headlamp.position.set(0, 0, 0);
    camera.add(this.headlamp);
    if (camera.parent === null) scene.add(camera);
  }

  /** Place lights relative to the maze size. */
  fit(width: number, height: number, cellSize: number): void {
    const r = Math.max(1, Math.hypot(width, height));
    this.above.position.set(0, r * 0.6, 0);
    this.below.position.set(0, -r * 0.6, 0);
    this.blue.position.set(r, r * 0.3, 0);
    this.blue.target.position.set(0, 0, 0);
    this.blue.target.updateMatrixWorld();
    this.pointerHeight = cellSize * 3;
  }

  setFirstPerson(enabled: boolean): void {
    this.firstPerson = enabled;
    this.above.visible = !enabled;
    this.below.visible = !enabled;
    this.blue.visible = !enabled;
    this.headlamp.visible = enabled;
    this.ambient.intensity = enabled ? 0.7 : 1.2;
    this.pointer.visible = !enabled && this.pointerActive;
  }

  /** World-space point on the floor under the pointer, or `null` to switch the light off. */
  setPointerWorld(point: THREE.Vector3 | null): void {
    this.pointerActive = point !== null;
    if (point) this.pointer.position.set(point.x, this.pointerHeight, point.z);
    this.pointer.visible = this.pointerActive && !this.firstPerson;
  }

  dispose(): void {
    this.camera.remove(this.headlamp);
    this.scene.remove(this.group);
    this.ambient.dispose();
    this.above.dispose();
    this.below.dispose();
    this.blue.dispose();
    this.pointer.dispose();
    this.headlamp.dispose();
  }
}
