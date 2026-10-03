import {
  DEFAULT_VIEW,
  normalizeView,
  viewFromCamera,
  type CameraPreset,
  type CameraState,
  type CameraView,
} from '@maze/renderer';
import { useCallback, useMemo, useState } from 'react';

const deg = (d: number): number => (d * Math.PI) / 180;

/** Step sizes for the on-screen buttons and keyboard shortcuts. */
export const ROTATE_STEP = deg(15);
export const TILT_STEP = deg(8);
export const ZOOM_STEP = 1.25;

export interface CameraViewControls {
  readonly view: CameraView;
  /** Adopt a camera reported by the renderer (drag, wheel, pinch). */
  readonly fromCamera: (c: CameraState) => void;
  /** Positive turns the camera clockwise seen from above (the maze appears to turn the other way). */
  readonly rotate: (radians: number) => void;
  /** Positive looks more from above. */
  readonly tilt: (radians: number) => void;
  readonly zoomBy: (factor: number) => void;
  /** Back to the preset's framing: zoom 1, no orbit. */
  readonly reset: () => void;
  /** Clears the orbit offsets but keeps the zoom (used when the preset changes). */
  readonly resetOrbit: () => void;
}

/**
 * The user-adjustable camera (zoom + orbit) for one canvas. Values are always normalised for the
 * current preset, so tilt never leaves the allowed elevation band.
 */
export function useCameraView(preset: CameraPreset): CameraViewControls {
  const [raw, setRaw] = useState<CameraView>(DEFAULT_VIEW);
  const view = useMemo(() => normalizeView(preset, raw), [preset, raw]);

  const update = useCallback(
    (fn: (v: CameraView) => CameraView) => {
      setRaw((v) => normalizeView(preset, fn(normalizeView(preset, v))));
    },
    [preset],
  );

  const fromCamera = useCallback(
    (c: CameraState) => {
      update(() => viewFromCamera(c));
    },
    [update],
  );
  const rotate = useCallback(
    (r: number) => {
      update((v) => ({ ...v, yaw: v.yaw + r }));
    },
    [update],
  );
  const tilt = useCallback(
    (r: number) => {
      update((v) => ({ ...v, pitch: v.pitch + r }));
    },
    [update],
  );
  const zoomBy = useCallback(
    (f: number) => {
      update((v) => ({ ...v, zoom: v.zoom * f }));
    },
    [update],
  );
  const reset = useCallback(() => {
    setRaw(DEFAULT_VIEW);
  }, []);
  const resetOrbit = useCallback(() => {
    setRaw((v) => ({ ...v, yaw: 0, pitch: 0 }));
  }, []);

  return { view, fromCamera, rotate, tilt, zoomBy, reset, resetOrbit };
}
