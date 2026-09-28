import {
  hexToRgb,
  legacyTheme,
  type CameraState,
  type RenderOptions,
  type RenderTheme,
} from '@maze/renderer';
import type { Prefs } from '../state/prefs';
import { autoProjectionDepth } from './gridSizing';

export type ThemePrefs = Pick<Prefs, 'cellColor' | 'wallColor' | 'backgroundColor' | 'invert'>;

/** Prefs colours + invert flag -> renderer theme (P-07, P-11). */
export function buildTheme(p: ThemePrefs): RenderTheme {
  return {
    ...legacyTheme,
    cell: hexToRgb(p.cellColor) ?? legacyTheme.cell,
    wall: hexToRgb(p.wallColor) ?? legacyTheme.wall,
    background: hexToRgb(p.backgroundColor) ?? legacyTheme.background,
    invert: p.invert,
  };
}

export type OptionPrefs = Pick<
  Prefs,
  | 'cellSize'
  | 'wallWidth'
  | 'mode'
  | 'showProjection'
  | 'mirror'
  | 'maxProjectionDepth'
  | 'projectionUnit'
  | 'wallHeight'
  | 'showGrid'
  | 'showStartGoal'
>;

export function buildRenderOptions(
  p: OptionPrefs,
  rows: number,
  reducedMotion: boolean,
  cellSizeOverride?: number,
): RenderOptions {
  return {
    cellSize: cellSizeOverride ?? p.cellSize,
    wallWidth: Math.min(p.wallWidth, Math.max(1, Math.floor((cellSizeOverride ?? p.cellSize) / 2))),
    mode: p.mode,
    showProjection: p.showProjection,
    mirror: p.mirror,
    maxProjectionDepth:
      p.maxProjectionDepth === 'auto' ? autoProjectionDepth(rows) : p.maxProjectionDepth,
    projectionUnit: p.projectionUnit,
    wallHeight: p.wallHeight,
    showGrid: p.showGrid,
    showStartGoal: p.showStartGoal,
    reducedMotion,
  };
}

export function buildCamera(
  p: Pick<Prefs, 'cameraPreset' | 'followPointer'>,
  zoom: number,
): CameraState {
  return { preset: p.cameraPreset, followPointer: p.followPointer, zoom };
}
