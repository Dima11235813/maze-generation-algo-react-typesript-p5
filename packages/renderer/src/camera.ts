/**
 * Camera preset geometry shared by the three.js rig and the app's view controls. Kept free of
 * three.js so the app can clamp user rotation without loading the 3D chunk.
 */
import { clampZoom } from './layout';
import type { CameraPreset, CameraState } from './types';

const deg = (d: number): number => (d * Math.PI) / 180;

/** Elevation above the plane and azimuth around the centre (0 = camera south of the maze). */
export const CAMERA_PRESET_ANGLES: Readonly<
  Record<CameraPreset, { readonly elevation: number; readonly azimuth: number }>
> = {
  top: { elevation: deg(88), azimuth: 0 },
  tilt: { elevation: deg(35), azimuth: 0 },
  isometric: { elevation: deg(45), azimuth: deg(45) },
  low: { elevation: deg(15), azimuth: 0 },
  front: { elevation: deg(5), azimuth: 0 },
};

export const MIN_ELEVATION = deg(3);
export const MAX_ELEVATION = deg(89);

/** Range of user tilt (radians) that keeps a preset's elevation inside the allowed band. */
export function pitchLimits(preset: CameraPreset): { min: number; max: number } {
  const e = CAMERA_PRESET_ANGLES[preset].elevation;
  return { min: MIN_ELEVATION - e, max: MAX_ELEVATION - e };
}

/** Wraps an angle into [-PI, PI). */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

/** The user-adjustable part of the camera: distance and orbit offsets. */
export interface CameraView {
  readonly zoom: number;
  readonly yaw: number;
  readonly pitch: number;
}

export const DEFAULT_VIEW: CameraView = { zoom: 1, yaw: 0, pitch: 0 };

/** Clamps a view for a preset: zoom to its range, yaw wrapped, pitch within the elevation band. */
export function normalizeView(preset: CameraPreset, v: CameraView): CameraView {
  const { min, max } = pitchLimits(preset);
  return {
    zoom: clampZoom(v.zoom),
    yaw: wrapAngle(v.yaw),
    pitch: Math.min(max, Math.max(min, v.pitch)),
  };
}

/** Extracts the user view from a camera reported by a renderer. */
export function viewFromCamera(c: CameraState): CameraView {
  return { zoom: c.zoom, yaw: c.yaw ?? 0, pitch: c.pitch ?? 0 };
}
