/** Theme, 2D render options and camera for a lesson demo canvas, from the learner's prefs. */
import { useMemo } from 'react';
import { useReducedMotion } from '../../app/documentPrefs';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { usePrefs } from '../../state/prefs';

export function useDemoCanvas(rows: number, cellSize: number) {
  const prefs = usePrefs();
  const reducedMotion = useReducedMotion();
  const theme = useMemo(
    () =>
      buildTheme({
        cellColor: prefs.cellColor,
        wallColor: prefs.wallColor,
        backgroundColor: prefs.backgroundColor,
        invert: prefs.invert,
      }),
    [prefs.cellColor, prefs.wallColor, prefs.backgroundColor, prefs.invert],
  );
  const options = useMemo(
    () => ({
      ...buildRenderOptions(prefs, rows, reducedMotion, cellSize),
      mode: '2d' as const,
    }),
    [prefs, rows, reducedMotion, cellSize],
  );
  const camera = useMemo(
    () => buildCamera({ cameraPreset: prefs.cameraPreset, followPointer: false }, 1),
    [prefs.cameraPreset],
  );
  return { theme, options, camera };
}
