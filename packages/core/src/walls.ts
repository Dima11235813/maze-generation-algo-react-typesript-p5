/**
 * Walls as nibbles and the immutable `MazeState`.
 *
 * Each cell owns one byte in a `Uint8Array`; the low four bits are walls (bit index = Dir),
 * the high four bits are reserved for a future format version.
 */
import {
  DIRS,
  Dir,
  NO_CELL,
  cellCount,
  dirBetween,
  isValidCell,
  neighbor,
  opposite,
  type CellId,
  type Grid,
} from './grid';

export const WALL = { N: 1 << Dir.N, E: 1 << Dir.E, S: 1 << Dir.S, W: 1 << Dir.W } as const;
export const ALL_WALLS = 0b1111;
export const WALL_MASK = 0b1111;

export interface MazeState {
  readonly grid: Grid;
  /** Treated as immutable once published. One nibble per cell, N/E/S/W = bits 0..3. */
  readonly walls: Uint8Array;
  readonly start: CellId;
  readonly goal: CellId;
}

export const hasWall = (walls: Uint8Array, id: CellId, d: Dir): boolean =>
  ((walls[id] ?? ALL_WALLS) & (1 << d)) !== 0;

/** A fresh wall array with every wall present. */
export function createWalls(g: Grid): Uint8Array {
  return new Uint8Array(cellCount(g)).fill(ALL_WALLS);
}

export function cloneWalls(walls: Uint8Array): Uint8Array {
  return new Uint8Array(walls);
}

function requireAdjacent(g: Grid, a: CellId, b: CellId): Dir {
  const d = dirBetween(g, a, b);
  if (d === undefined) {
    throw new Error(`Cells ${a} and ${b} are not adjacent`);
  }
  return d;
}

/** Removes the wall between `a` and `b` on BOTH sides (keeps the symmetry invariant). */
export function removeWall(walls: Uint8Array, g: Grid, a: CellId, b: CellId): void {
  const d = requireAdjacent(g, a, b);
  walls[a] = (walls[a] ?? ALL_WALLS) & ~(1 << d);
  walls[b] = (walls[b] ?? ALL_WALLS) & ~(1 << opposite(d));
}

/** Adds the wall between `a` and `b` on BOTH sides. */
export function addWall(walls: Uint8Array, g: Grid, a: CellId, b: CellId): void {
  const d = requireAdjacent(g, a, b);
  walls[a] = (walls[a] ?? ALL_WALLS) | (1 << d);
  walls[b] = (walls[b] ?? ALL_WALLS) | (1 << opposite(d));
}

export function createMazeState(
  grid: Grid,
  walls: Uint8Array,
  start: CellId,
  goal: CellId,
): MazeState {
  if (walls.length !== cellCount(grid)) {
    throw new RangeError(`walls has ${walls.length} entries, grid has ${cellCount(grid)} cells`);
  }
  if (!isValidCell(grid, start) || !isValidCell(grid, goal)) {
    throw new RangeError(`start/goal (${start}/${goal}) out of range for grid`);
  }
  return Object.freeze({ grid, walls, start, goal });
}

/** Directions in which `id` has an open passage to an in-grid neighbour. */
export function openDirs(state: MazeState, id: CellId): Dir[] {
  const out: Dir[] = [];
  for (const d of DIRS) {
    if (!hasWall(state.walls, id, d) && neighbor(state.grid, id, d) !== NO_CELL) out.push(d);
  }
  return out;
}

/** Neighbouring cells reachable through open passages. */
export function openNeighbors(state: MazeState, id: CellId): CellId[] {
  const out: CellId[] = [];
  for (const d of DIRS) {
    if (hasWall(state.walls, id, d)) continue;
    const nb = neighbor(state.grid, id, d);
    if (nb !== NO_CELL) out.push(nb);
  }
  return out;
}

/** Number of passages (graph edges). Each passage counted once via its E/S side. */
export function passageCount(state: MazeState): number {
  const { grid, walls } = state;
  let n = 0;
  const total = cellCount(grid);
  for (let id = 0; id < total; id++) {
    if (!hasWall(walls, id, Dir.E) && neighbor(grid, id, Dir.E) !== NO_CELL) n++;
    if (!hasWall(walls, id, Dir.S) && neighbor(grid, id, Dir.S) !== NO_CELL) n++;
  }
  return n;
}

/** `hasWall(a, d) === hasWall(neighbor(a, d), opposite(d))` for every in-grid pair. */
export function wallsAreSymmetric(state: MazeState): boolean {
  const { grid, walls } = state;
  const total = cellCount(grid);
  for (let id = 0; id < total; id++) {
    for (const d of DIRS) {
      const nb = neighbor(grid, id, d);
      if (nb === NO_CELL) continue;
      if (hasWall(walls, id, d) !== hasWall(walls, nb, opposite(d))) return false;
    }
  }
  return true;
}

/** Every cell reachable from `start` through open passages. */
export function isConnected(state: MazeState): boolean {
  const total = cellCount(state.grid);
  const seen = new Uint8Array(total);
  const queue: CellId[] = [state.start];
  seen[state.start] = 1;
  let head = 0;
  let count = 1;
  while (head < queue.length) {
    const cell = queue[head++]!;
    for (const nb of openNeighbors(state, cell)) {
      if (seen[nb] === 0) {
        seen[nb] = 1;
        count++;
        queue.push(nb);
      }
    }
  }
  return count === total;
}

/** A perfect maze is a spanning tree: symmetric, connected, `passages === cells - 1`. */
export function isPerfectMaze(state: MazeState): boolean {
  return (
    wallsAreSymmetric(state) &&
    isConnected(state) &&
    passageCount(state) === cellCount(state.grid) - 1
  );
}
