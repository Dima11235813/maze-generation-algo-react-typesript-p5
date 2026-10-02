/**
 * Light rig reproducing the legacy p5 set-up (P-21): two white point lights above and below
 * the plane, a blue-tinted directional light from the east, a white light that follows the
 * pointer, and - in first-person mode - a single headlamp attached to the camera.
 *
 * three r186 uses physically based light units. The rig mixes two strategies so the look is
 * independent of maze size:
 * - Scene-wide lights (above/below/directional) use `decay = 0`, i.e. no distance falloff, so
 *   a 10x10 and a 200x200 maze read the same. Their intensities are chosen for Lambert
 *   materials (three divides by pi): the sum of ambient + hemisphere + key on a top face lands
 *   around 1.0, i.e. the theme colour is reproduced, not blown out.
 * - Local lights (pointer pool, first-person headlamp) use `decay = 2` (inverse square) with
 *   intensity scaled by cellSize^2 so their pool is always a few cells wide; this gives the
 *   depth cue in corridors that the legacy single light had.
 * A hemisphere light (sky/ground) fills the far side of walls so vertical faces are shaded,
 * not black. Note: a wall colour of pure black (the legacy default) reflects nothing under any
 * light; shading becomes visible as soon as the wall colour is lifted slightly.
 */
import * as THREE from 'three';

/** All tunables in one place (see the module comment for the reasoning). */
export const LIGHT_PRESET = {
  /** Flat fill so nothing is ever fully black. */
  ambient: { color: 0xffffff, intensity: 0.35, firstPerson: 0.25 },
  /** Sky (cool) / ground (warm dark) fill; shades vertical faces by their facing. */
  hemisphere: { sky: 0xcfe3ff, ground: 0x1a1608, intensity: 0.55, firstPerson: 0.2 },
  /** Key light above the plane (legacy pointLight(255,255,255, 0,0,+600)). */
  above: { color: 0xffffff, intensity: 1.35, heightFactor: 0.6 },
  /** Fill from below, only visible on the mirrored projection cubes (legacy 0,0,-600). */
  below: { color: 0xffffff, intensity: 0.45, heightFactor: 0.6 },
  /** Legacy directionalLight(0,102,255, -1,0,0): a blue rim from the east. */
  blue: { color: 0x3d8bff, intensity: 0.7, heightFactor: 0.3 },
  /** Pointer-following pool; intensity in candela = k * cellSize^2. */
  pointer: { color: 0xffffff, k: 5.0, heightCells: 3, rangeCells: 9 },
  /** First-person headlamp; intensity = k * cellSize^2, reach in cells. */
  headlamp: { color: 0xfff4e0, k: 2.2, rangeCells: 7 },
} as const;

export class LightRig {
  private readonly group = new THREE.Group();
  private readonly ambient = new THREE.AmbientLight(
    LIGHT_PRESET.ambient.color,
    LIGHT_PRESET.ambient.intensity,
  );
  private readonly hemisphere = new THREE.HemisphereLight(
    LIGHT_PRESET.hemisphere.sky,
    LIGHT_PRESET.hemisphere.ground,
    LIGHT_PRESET.hemisphere.intensity,
  );
  private readonly above = new THREE.PointLight(
    LIGHT_PRESET.above.color,
    LIGHT_PRESET.above.intensity,
    0,
    0,
  );
  private readonly below = new THREE.PointLight(
    LIGHT_PRESET.below.color,
    LIGHT_PRESET.below.intensity,
    0,
    0,
  );
  private readonly blue = new THREE.DirectionalLight(
    LIGHT_PRESET.blue.color,
    LIGHT_PRESET.blue.intensity,
  );
  private readonly pointer = new THREE.PointLight(LIGHT_PRESET.pointer.color, 1, 0, 2);
  private readonly headlamp = new THREE.PointLight(LIGHT_PRESET.headlamp.color, 1, 0, 2);
  private pointerHeight = 100;
  private firstPerson = false;
  private pointerActive = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    this.pointer.visible = false;
    this.headlamp.visible = false;
    this.hemisphere.position.set(0, 1, 0);
    this.group.add(
      this.ambient,
      this.hemisphere,
      this.above,
      this.below,
      this.blue,
      this.blue.target,
      this.pointer,
    );
    scene.add(this.group);
    // The headlamp travels with the camera; the camera must be in the scene graph for that.
    this.headlamp.position.set(0, 0, 0);
    camera.add(this.headlamp);
    if (camera.parent === null) scene.add(camera);
  }

  /** Place and scale lights relative to the maze size. */
  fit(width: number, height: number, cellSize: number): void {
    const r = Math.max(1, Math.hypot(width, height));
    const cs = Math.max(1, cellSize);
    this.above.position.set(0, r * LIGHT_PRESET.above.heightFactor, 0);
    this.below.position.set(0, -r * LIGHT_PRESET.below.heightFactor, 0);
    this.blue.position.set(r, r * LIGHT_PRESET.blue.heightFactor, 0);
    this.blue.target.position.set(0, 0, 0);
    this.blue.target.updateMatrixWorld();

    // Local lights: inverse-square falloff sized in cells.
    this.pointerHeight = cs * LIGHT_PRESET.pointer.heightCells;
    this.pointer.intensity = LIGHT_PRESET.pointer.k * cs * cs;
    this.pointer.distance = cs * LIGHT_PRESET.pointer.rangeCells;
    this.headlamp.intensity = LIGHT_PRESET.headlamp.k * cs * cs;
    this.headlamp.distance = cs * LIGHT_PRESET.headlamp.rangeCells;
  }

  setFirstPerson(enabled: boolean): void {
    this.firstPerson = enabled;
    this.above.visible = !enabled;
    this.below.visible = !enabled;
    this.blue.visible = !enabled;
    this.headlamp.visible = enabled;
    this.ambient.intensity = enabled
      ? LIGHT_PRESET.ambient.firstPerson
      : LIGHT_PRESET.ambient.intensity;
    this.hemisphere.intensity = enabled
      ? LIGHT_PRESET.hemisphere.firstPerson
      : LIGHT_PRESET.hemisphere.intensity;
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
    this.hemisphere.dispose();
    this.above.dispose();
    this.below.dispose();
    this.blue.dispose();
    this.pointer.dispose();
    this.headlamp.dispose();
  }
}
