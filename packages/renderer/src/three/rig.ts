/**
 * Camera rig: named orbit presets around the maze centre, first-person poses, pointer
 * parallax, fit-to-view distances and eased transitions.
 *
 * Poses are `(position, yaw, pitch)` so easing between any two poses (including 180-degree
 * first-person turns) takes the shortest angular path without passing through the eye.
 */
import * as THREE from 'three';
import { CAMERA_PRESET_ANGLES, MAX_ELEVATION, MIN_ELEVATION, pitchLimits } from '../camera';
import type { CameraPreset, PointerState } from '../types';

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** Radians, 0 = looking north (-z), increasing clockwise seen from above. */
  yaw: number;
  /** Radians, negative looks down. */
  pitch: number;
}

const deg = (d: number): number => (d * Math.PI) / 180;
const PRESETS = CAMERA_PRESET_ANGLES;

const FOLLOW_YAW = deg(15);
const FOLLOW_PITCH = deg(10);
/** Time constant of the exponential easing (ms); ~3 tau to settle. */
const EASE_TAU_MS = 90;
/** Fraction of the normalised viewport the maze may occupy (leaves a ~4 % margin per side). */
const FIT_NDC = 0.92;
const FIT_ITERATIONS = 28;

export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

  private current: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private target: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private initialised = false;
  private extentW = 1;
  private extentH = 1;
  /** Height of the tallest geometry (wall tops) that must stay in view. */
  private extentTop = 0;

  private readonly forward = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  /** Scratch camera used by the projection-based fit. */
  private readonly scratch = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  private readonly corner = new THREE.Vector3();
  private readonly fitCache = new Map<string, number>();

  setAspect(aspect: number): void {
    if (!(aspect > 0)) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Maze extent in world units (plus wall height); also sets sensible near/far planes. */
  setExtent(width: number, height: number, cellSize: number, wallTop = cellSize * 0.5): void {
    this.extentW = Math.max(1e-3, width);
    this.extentH = Math.max(1e-3, height);
    this.extentTop = Math.max(0, wallTop);
    this.camera.near = Math.max(0.01, cellSize * 0.02);
    this.camera.far = Math.max(1000, Math.hypot(width, height) * 20);
    this.camera.updateProjectionMatrix();
    this.fitCache.clear();
  }

  /**
   * Distance from the centre at which the whole maze (floor corners and wall tops) is inside
   * the viewport for a preset. Found by projecting the eight extent corners through a scratch
   * camera and bisecting the distance, so flat, wide mazes fill the view instead of being
   * fitted to a bounding sphere.
   */
  fitDistance(preset: CameraPreset): number {
    const key = `${preset}|${this.camera.aspect.toFixed(4)}|${this.camera.fov}|${this.extentW}|${this.extentH}|${this.extentTop}`;
    const cached = this.fitCache.get(key);
    if (cached !== undefined) return cached;

    const { elevation, azimuth } = PRESETS[preset];
    const radius = Math.max(1e-3, 0.5 * Math.hypot(this.extentW, this.extentH));
    const cam = this.scratch;
    cam.fov = this.camera.fov;
    cam.aspect = this.camera.aspect;
    cam.near = this.camera.near;
    cam.far = this.camera.far;
    cam.updateProjectionMatrix();

    const hw = this.extentW / 2;
    const hh = this.extentH / 2;
    const top = this.extentTop;
    const fits = (d: number): boolean => {
      cam.position.set(
        d * Math.cos(elevation) * Math.sin(azimuth),
        d * Math.sin(elevation),
        d * Math.cos(elevation) * Math.cos(azimuth),
      );
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(true);
      for (const y of [0, top]) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            this.corner.set(sx * hw, y, sz * hh).project(cam);
            if (
              Math.abs(this.corner.x) > FIT_NDC ||
              Math.abs(this.corner.y) > FIT_NDC ||
              this.corner.z > 1 ||
              this.corner.z < -1
            ) {
              return false;
            }
          }
        }
      }
      return true;
    };

    let lo = radius * 0.05;
    let hi = radius * 8;
    let result = hi;
    if (fits(hi)) {
      for (let i = 0; i < FIT_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      result = hi;
    }
    if (this.fitCache.size > 64) this.fitCache.clear();
    this.fitCache.set(key, result);
    return result;
  }

  /** Range of user tilt (radians) that keeps a preset's elevation inside the allowed band. */
  pitchLimits(preset: CameraPreset): { min: number; max: number } {
    return pitchLimits(preset);
  }

  /**
   * Orbit pose for a preset around the origin. `pointer` (screen-normalised, y down) adds the
   * legacy follow-mouse parallax; pass `null` to disable it. `yaw`/`pitch` are the user's own
   * orbit offsets (drag, buttons, keys). The distance stays the preset's fit distance so the
   * view does not "breathe" while rotating; zoom is the user's control for distance.
   */
  orbit(
    preset: CameraPreset,
    zoom: number,
    pointer: PointerState | null,
    yaw = 0,
    pitch = 0,
  ): void {
    const base = PRESETS[preset];
    let elevation = Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, base.elevation + pitch));
    let azimuth = base.azimuth + yaw;
    if (pointer) {
      azimuth -= pointer.x * FOLLOW_YAW;
      elevation = Math.min(
        MAX_ELEVATION,
        Math.max(MIN_ELEVATION, elevation - pointer.y * FOLLOW_PITCH),
      );
    }
    const d = this.fitDistance(preset) / Math.max(1e-3, zoom);
    const x = d * Math.cos(elevation) * Math.sin(azimuth);
    const y = d * Math.sin(elevation);
    const z = d * Math.cos(elevation) * Math.cos(azimuth);
    // Looking at the origin from (x, y, z).
    this.setTarget({ x, y, z, yaw: Math.atan2(-x, z), pitch: -elevation });
  }

  /** First-person pose at a world position with an explicit yaw/pitch. */
  firstPerson(x: number, z: number, eyeHeight: number, yaw: number, pitch: number): void {
    this.setTarget({ x, y: eyeHeight, z, yaw, pitch });
  }

  /** Jump to the target pose without easing. */
  snap(): void {
    this.current = { ...this.target };
    this.apply();
  }

  /**
   * Advances the easing by `dtMs` and writes the pose to the camera. Returns `true` while a
   * transition is still in progress (the caller keeps its animation loop alive).
   */
  update(dtMs: number, immediate: boolean): boolean {
    const c = this.current;
    const t = this.target;
    if (immediate) {
      this.snap();
      return false;
    }
    const k = 1 - Math.exp(-Math.max(0, dtMs) / EASE_TAU_MS);
    const dyaw = wrapAngle(t.yaw - c.yaw);
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    c.z += (t.z - c.z) * k;
    c.yaw = wrapAngle(c.yaw + dyaw * k);
    c.pitch += (t.pitch - c.pitch) * k;

    const eps = Math.max(1e-3, Math.max(this.extentW, this.extentH) * 1e-5);
    const moving =
      Math.abs(t.x - c.x) > eps ||
      Math.abs(t.y - c.y) > eps ||
      Math.abs(t.z - c.z) > eps ||
      Math.abs(dyaw) > 1e-4 ||
      Math.abs(t.pitch - c.pitch) > 1e-4;
    if (!moving) this.current = { ...t };
    this.apply();
    return moving;
  }

  private setTarget(p: Pose): void {
    this.target = p;
    if (!this.initialised) {
      this.initialised = true;
      this.snap();
    }
  }

  private apply(): void {
    const c = this.current;
    const cam = this.camera;
    cam.position.set(c.x, c.y, c.z);
    const cp = Math.cos(c.pitch);
    this.forward.set(Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp);
    this.lookAt.copy(cam.position).add(this.forward);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.lookAt);
  }
}
