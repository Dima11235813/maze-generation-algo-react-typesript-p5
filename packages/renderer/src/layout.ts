/**
 * Geometry shared by every adapter: cell rectangles/centres in maze-local units, wall
 * segments de-duplicated so a shared wall is drawn once, heading vectors for first-person
 * mode, and fit-to-view maths.
 *
 * Maze-local coordinates: origin at the top-left corner of cell 0, x grows to the east
 * (columns), y grows to the south (rows). One cell is `cs` units. The three adapter maps
 * local y onto world z.
 */
import {
  DIRS,
  Dir,
  NO_CELL,
  cellCount,
  colOf,
  hasWall,
  idOf,
  neighbor,
  rowOf,
  type CellId,
  type Grid,
  type MazeState,
} from '@maze/core';

// ---------------------------------------------------------------------------------------
// Wall segments
// ---------------------------------------------------------------------------------------

/**
 * Reusable, allocation-free list of wall segments `(cell, dir)`. Filled by
 * {@link collectWallSegments}; only the first `count` entries are valid.
 */
export interface SegmentBuffer {
  readonly cells: Int32Array;
  readonly dirs: Uint8Array;
  count: number;
}

/** Upper bound on unique wall segments: internal edges + perimeter = 2wh + w + h. */
export function segmentCapacity(g: Grid): number {
  return cellCount(g) * 2 + g.width + g.height;
}

export function createSegmentBuffer(g: Grid): SegmentBuffer {
  const cap = segmentCapacity(g);
  return { cells: new Int32Array(cap), dirs: new Uint8Array(cap), count: 0 };
}

export type SeenPredicate = (cell: CellId) => boolean;

/**
 * Collects every wall that should be drawn, once. A wall shared by two drawn cells is owned
 * by the lower cell id; a wall between a drawn cell and a hidden (unseen) cell is owned by
 * the drawn one; perimeter walls are owned by their only cell. With no `seen` predicate every
 * cell is drawn (finished or loaded mazes).
 *
 * Returns the number of segments written into `buffer`.
 */
export function collectWallSegments(
  state: MazeState,
  buffer: SegmentBuffer,
  seen?: SeenPredicate,
): number {
  const { grid, walls } = state;
  const total = cellCount(grid);
  let n = 0;
  for (let cell = 0; cell < total; cell++) {
    if (seen && !seen(cell)) continue;
    for (const d of DIRS) {
      if (!hasWall(walls, cell, d)) continue;
      const nb = neighbor(grid, cell, d);
      // Shared wall, both sides drawn: let the lower id own it.
      if (nb !== NO_CELL && cell > nb && (!seen || seen(nb))) continue;
      buffer.cells[n] = cell;
      buffer.dirs[n] = d;
      n++;
    }
  }
  buffer.count = n;
  return n;
}

/** Number of present wall sides counted per cell (a shared wall counts twice). */
export function wallSideCount(state: MazeState): number {
  const total = cellCount(state.grid);
  let n = 0;
  for (let cell = 0; cell < total; cell++) {
    for (const d of DIRS) if (hasWall(state.walls, cell, d)) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------------------
// Cell geometry (maze-local units)
// ---------------------------------------------------------------------------------------

export interface Segment2 {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Endpoints of the wall `dir` of `cell`, written into `out` (no allocation). */
export function segmentEndpoints(
  g: Grid,
  cell: CellId,
  dir: Dir,
  cs: number,
  out: Segment2,
): Segment2 {
  const x = colOf(g, cell) * cs;
  const y = rowOf(g, cell) * cs;
  switch (dir) {
    case Dir.N:
      out.x0 = x;
      out.y0 = y;
      out.x1 = x + cs;
      out.y1 = y;
      break;
    case Dir.E:
      out.x0 = x + cs;
      out.y0 = y;
      out.x1 = x + cs;
      out.y1 = y + cs;
      break;
    case Dir.S:
      out.x0 = x;
      out.y0 = y + cs;
      out.x1 = x + cs;
      out.y1 = y + cs;
      break;
    case Dir.W:
      out.x0 = x;
      out.y0 = y;
      out.x1 = x;
      out.y1 = y + cs;
      break;
  }
  return out;
}

export interface Point2 {
  x: number;
  y: number;
}

/** Top-left corner of a cell. */
export function cellOrigin(g: Grid, cell: CellId, cs: number, out: Point2): Point2 {
  out.x = colOf(g, cell) * cs;
  out.y = rowOf(g, cell) * cs;
  return out;
}

/** Centre of a cell. */
export function cellCenter(g: Grid, cell: CellId, cs: number, out: Point2): Point2 {
  out.x = (colOf(g, cell) + 0.5) * cs;
  out.y = (rowOf(g, cell) + 0.5) * cs;
  return out;
}

/** Cell under a maze-local point, or `null` outside the maze. */
export function cellAt(g: Grid, x: number, y: number, cs: number): CellId | null {
  if (!(cs > 0)) return null;
  const col = Math.floor(x / cs);
  const row = Math.floor(y / cs);
  if (col < 0 || row < 0 || col >= g.width || row >= g.height) return null;
  return idOf(g, row, col);
}

/** Maze extent in local units. */
export function mazeExtent(g: Grid, cs: number): { width: number; height: number } {
  return { width: g.width * cs, height: g.height * cs };
}

// ---------------------------------------------------------------------------------------
// Headings (first-person mode)
// ---------------------------------------------------------------------------------------

/** Unit vector for a heading in maze-local coordinates (north = -y). */
export function headingVector(dir: Dir, out: Point2): Point2 {
  switch (dir) {
    case Dir.N:
      out.x = 0;
      out.y = -1;
      break;
    case Dir.E:
      out.x = 1;
      out.y = 0;
      break;
    case Dir.S:
      out.x = 0;
      out.y = 1;
      break;
    case Dir.W:
      out.x = -1;
      out.y = 0;
      break;
  }
  return out;
}

/** Yaw in radians: N = 0, E = pi/2, S = pi, W = 3pi/2 (clockwise seen from above). */
export function headingYaw(dir: Dir): number {
  return dir * (Math.PI / 2);
}

// ---------------------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------------------

/**
 * Uniform scale so a `mazeW x mazeH` rectangle fits a `viewW x viewH` viewport with `margin`
 * on every side. Returns 1 for degenerate inputs.
 */
export function fitScale(
  viewW: number,
  viewH: number,
  mazeW: number,
  mazeH: number,
  margin = 0,
): number {
  const availW = viewW - margin * 2;
  const availH = viewH - margin * 2;
  if (!(availW > 0) || !(availH > 0) || !(mazeW > 0) || !(mazeH > 0)) return 1;
  return Math.min(availW / mazeW, availH / mazeH);
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 8;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Multiplicative zoom step for a wheel delta (pixels). */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0012);
}
