/**
 * Placement maths for the floating maze tools widget. The position is stored as fractions of the
 * free space (container minus widget), so it stays inside the maze area when the window or the
 * widget changes size, and {1, 1} means docked in the bottom-right corner.
 */
export interface Fraction {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly width: number;
  readonly height: number;
}

export const DOCKED: Fraction = { x: 1, y: 1 };

/** Inset from the container edges, in CSS pixels. */
export const TOOLS_MARGIN = 8;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

/** Free space the widget can move in along each axis (never negative). */
export function freeSpace(container: Box, widget: Box): Box {
  return {
    width: Math.max(0, container.width - widget.width - 2 * TOOLS_MARGIN),
    height: Math.max(0, container.height - widget.height - 2 * TOOLS_MARGIN),
  };
}

/** Top-left of the widget in pixels inside the container. */
export function toPixels(
  pos: Fraction,
  container: Box,
  widget: Box,
): { left: number; top: number } {
  const free = freeSpace(container, widget);
  return {
    left: TOOLS_MARGIN + clamp01(pos.x) * free.width,
    top: TOOLS_MARGIN + clamp01(pos.y) * free.height,
  };
}

/** Fraction for a desired top-left in pixels, clamped to the container. */
export function toFraction(left: number, top: number, container: Box, widget: Box): Fraction {
  const free = freeSpace(container, widget);
  return {
    x: free.width === 0 ? 1 : clamp01((left - TOOLS_MARGIN) / free.width),
    y: free.height === 0 ? 1 : clamp01((top - TOOLS_MARGIN) / free.height),
  };
}

/** Moves by a pixel delta (keyboard nudges, drags), clamped. */
export function moveBy(
  pos: Fraction,
  dx: number,
  dy: number,
  container: Box,
  widget: Box,
): Fraction {
  const { left, top } = toPixels(pos, container, widget);
  return toFraction(left + dx, top + dy, container, widget);
}
