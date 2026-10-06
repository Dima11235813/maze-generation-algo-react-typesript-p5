import type { ViewMode } from '@maze/renderer';
import { ROTATE_STEP, TILT_STEP, ZOOM_STEP, type CameraViewControls } from '../../maze/view';

/**
 * Shared keyboard handling for the view shortcuts. Returns true when the key was consumed.
 * `[`/`]` rotate, `{`/`}` tilt, `+`/`=`/`-` zoom, `0` reset.
 */
export function handleViewKey(key: string, mode: ViewMode, controls: CameraViewControls): boolean {
  const is3d = mode === '3d';
  switch (key) {
    case '[':
      if (!is3d) return false;
      controls.rotate(ROTATE_STEP);
      return true;
    case ']':
      if (!is3d) return false;
      controls.rotate(-ROTATE_STEP);
      return true;
    case '}':
      if (!is3d) return false;
      controls.tilt(TILT_STEP);
      return true;
    case '{':
      if (!is3d) return false;
      controls.tilt(-TILT_STEP);
      return true;
    case '+':
    case '=':
      controls.zoomBy(ZOOM_STEP);
      return true;
    case '-':
    case '_':
      controls.zoomBy(1 / ZOOM_STEP);
      return true;
    case '0':
      controls.reset();
      return true;
    default:
      return false;
  }
}
