/**
 * Colour maths shared by every adapter. The legacy app duplicated inversion in three files;
 * here it is applied exactly once via `resolve()`.
 */
import type { RGB, RenderTheme } from './types';

export const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export function invertRgb(c: RGB): RGB {
  return { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b };
}

/** Applies the theme's `invert` flag. Every colour drawn must go through this. */
export function resolve(theme: RenderTheme, c: RGB): RGB {
  return theme.invert ? invertRgb(c) : c;
}

export function rgbToCss(c: RGB, alpha?: number): string {
  return alpha === undefined
    ? `rgb(${clamp255(c.r)}, ${clamp255(c.g)}, ${clamp255(c.b)})`
    : `rgba(${clamp255(c.r)}, ${clamp255(c.g)}, ${clamp255(c.b)}, ${alpha})`;
}

export function rgbToHex(c: RGB): string {
  const h = (v: number) => clamp255(v).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1] as string, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 0xRRGGBB integer for three.js. */
export function rgbToInt(c: RGB): number {
  return (clamp255(c.r) << 16) | (clamp255(c.g) << 8) | clamp255(c.b);
}

/**
 * Legacy `Cell.show` fill colour, reproduced from tracker data:
 * green channel divided by `visitCount * 0.242` (first visits glow, heavily revisited cells
 * darken), blue channel reduced by the DFS depth at first visit.
 */
export function legacyCellColor(theme: RenderTheme, visitCount: number, depthAtVisit: number): RGB {
  const base = theme.cell;
  const divider = visitCount * 0.242;
  const g = divider > 0 ? base.g / divider : base.g;
  const b = base.b - Math.max(0, depthAtVisit);
  return resolve(theme, { r: clamp255(base.r), g: clamp255(g), b: clamp255(b) });
}

/** Legacy `Cell.highlight`: translucent blue whose intensity fades with visit count. */
export function legacyCurrentColor(theme: RenderTheme, visitCount: number): { color: RGB; alpha: number } {
  const b = 255 / (visitCount + 1) / 2;
  return { color: resolve(theme, { r: theme.current.r, g: theme.current.g, b: clamp255(b + theme.current.b) }), alpha: 0.4 };
}

/** Linear interpolation between colours, t in [0, 1]. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k };
}

/** Legacy defaults from `mazeDefaults.ts` (wall colour stored as it was actually drawn). */
export const legacyTheme: RenderTheme = {
  background: rgb(113, 173, 245),
  cell: rgb(65, 117, 5),
  wall: rgb(0, 0, 0),
  current: rgb(0, 0, 128),
  start: rgb(255, 214, 10),
  goal: rgb(255, 60, 60),
  solveFrontier: rgb(255, 200, 60),
  solveExpanded: rgb(120, 170, 255),
  solveDeadEnd: rgb(140, 140, 140),
  path: rgb(255, 255, 255),
  player: rgb(255, 255, 255),
  invert: false,
};
