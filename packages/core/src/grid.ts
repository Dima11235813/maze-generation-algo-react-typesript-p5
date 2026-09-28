/**
 * Grid model and cell addressing.
 *
 * A maze is a grid graph: cells are vertices, passages (missing walls) are edges.
 * Only the orthogonal topology is implemented; `topology` is reserved for hex/polar/weave.
 *
 * Wall/direction order is N, E, S, W - the same order as the legacy `walls[0..3]`
 * (Top, Right, Bottom, Left) so characterisation tests can compare byte-for-byte.
 */

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly topology: 'orthogonal';
}

/** Row-major cell index: `row * width + col`. */
export type CellId = number;

/** Sentinel returned by {@link neighbor} when the neighbour would fall off the grid. */
export const NO_CELL = -1;

export const Dir = { N: 0, E: 1, S: 2, W: 3 } as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

export const DIRS: readonly Dir[] = [Dir.N, Dir.E, Dir.S, Dir.W];

export const DIR_NAMES: Readonly<Record<Dir, string>> = {
  [Dir.N]: 'north',
  [Dir.E]: 'east',
  [Dir.S]: 'south',
  [Dir.W]: 'west',
};

const DR = [-1, 0, 1, 0] as const;
const DC = [0, 1, 0, -1] as const;

export const MAX_GRID_SIDE = 4096;

export function createGrid(width: number, height: number): Grid {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new RangeError(`Grid dimensions must be integers, got ${width}x${height}`);
  }
  if (width < 1 || height < 1 || width > MAX_GRID_SIDE || height > MAX_GRID_SIDE) {
    throw new RangeError(`Grid dimensions must be in 1..${MAX_GRID_SIDE}, got ${width}x${height}`);
  }
  return Object.freeze({ width, height, topology: 'orthogonal' as const });
}

export const cellCount = (g: Grid): number => g.width * g.height;

export const idOf = (g: Grid, row: number, col: number): CellId => row * g.width + col;
export const rowOf = (g: Grid, id: CellId): number => Math.floor(id / g.width);
export const colOf = (g: Grid, id: CellId): number => id % g.width;

export const inBounds = (g: Grid, row: number, col: number): boolean =>
  row >= 0 && col >= 0 && row < g.height && col < g.width;

export const isValidCell = (g: Grid, id: CellId): boolean =>
  Number.isInteger(id) && id >= 0 && id < cellCount(g);

/** Neighbour in direction `d`, or {@link NO_CELL} at the grid edge. */
export function neighbor(g: Grid, id: CellId, d: Dir): CellId {
  const r = rowOf(g, id) + DR[d];
  const c = colOf(g, id) + DC[d];
  return inBounds(g, r, c) ? idOf(g, r, c) : NO_CELL;
}

export const opposite = (d: Dir): Dir => ((d + 2) & 3) as Dir;

/** Direction from `a` to `b` when they are orthogonally adjacent, else `undefined`. */
export function dirBetween(g: Grid, a: CellId, b: CellId): Dir | undefined {
  const dr = rowOf(g, b) - rowOf(g, a);
  const dc = colOf(g, b) - colOf(g, a);
  if (dr === -1 && dc === 0) return Dir.N;
  if (dr === 0 && dc === 1) return Dir.E;
  if (dr === 1 && dc === 0) return Dir.S;
  if (dr === 0 && dc === -1) return Dir.W;
  return undefined;
}

/** Manhattan distance between two cells. */
export function manhattan(g: Grid, a: CellId, b: CellId): number {
  return Math.abs(rowOf(g, a) - rowOf(g, b)) + Math.abs(colOf(g, a) - colOf(g, b));
}
