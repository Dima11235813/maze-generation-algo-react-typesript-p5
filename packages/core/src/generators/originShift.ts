import { DIRS, Dir, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { addWall, createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export interface OriginShiftParams extends Record<string, unknown> {
  /** Number of root moves. 0 = automatic (10 x cells). */
  readonly iterations: number;
}

export const originShiftMeta: AlgorithmMeta = {
  id: 'origin-shift',
  name: 'Origin Shift',
  family: 'generator',
  summary:
    'Treat the maze as a tree with every cell pointing towards a root ("origin"). Move the ' +
    'root to a random neighbour: the old root now points at the new one, and the new root ' +
    'drops its old pointer. Each move changes at most two walls and keeps a perfect maze, so ' +
    'the maze can keep evolving forever.',
  complexity: { time: 'O(1) per move, ~O(V log V) moves to mix', space: 'O(V)' },
  tags: ['tree-rotation', 'randomized', 'perfect', 'live', 'incremental'],
  params: [
    {
      key: 'iterations',
      label: 'Root moves',
      description: '0 picks 10 moves per cell automatically.',
      kind: 'int',
      min: 0,
      max: 1_000_000,
      default: 0,
    },
  ],
  docsSlug: 'learn/origin-shift',
  since: CORE_VERSION,
};

/** Hard cap so a huge grid with `iterations = 0` cannot run away. */
const MAX_AUTO_ITERATIONS = 1_000_000;

/**
 * Origin Shift (popularised in 2024). The tree is stored as parent pointers; the root has
 * none. One move: pick a random neighbour `n` of the root, point the root at `n` (adding
 * that edge), make `n` the root and drop its old parent pointer (removing that edge). If
 * `n` was already the root's child the two edges are the same one and nothing changes.
 * The starting tree is a deterministic "comb" (rows linked east, column 0 linked north)
 * so all randomness comes from the moves, and the maze drifts away from its grid-like start.
 */
export const originShift: MazeGenerator<OriginShiftParams> = {
  meta: originShiftMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<OriginShiftParams>) {
    const total = cellCount(grid);
    const requested = Math.floor(params?.iterations ?? 0);
    const iterations =
      requested > 0 ? requested : Math.min(MAX_AUTO_ITERATIONS, total * 10);
    const walls = createWalls(grid);
    /** parent[c] = next cell towards the root; -1 for the root itself. */
    const parent = new Int32Array(total).fill(-1);
    const options: CellId[] = [];

    // Deterministic start: a comb rooted at cell 0.
    let root: CellId = 0;
    for (let cell = 1; cell < total; cell++) {
      const west = neighbor(grid, cell, Dir.W);
      const p = west !== NO_CELL ? west : neighbor(grid, cell, Dir.N);
      parent[cell] = p;
      removeWall(walls, grid, cell, p);
      yield { t: 'carve', from: p, to: cell } satisfies GenStep;
    }

    for (let i = 0; i < iterations; i++) {
      options.length = 0;
      for (const d of DIRS) {
        const nb = neighbor(grid, root, d);
        if (nb !== NO_CELL) options.push(nb);
      }
      if (options.length === 0) break; // 1x1 grid: nothing to rotate
      const next = options[rng.int(options.length)] as CellId;
      yield { t: 'rotate', oldRoot: root, newRoot: next } satisfies GenStep;

      const oldParentOfNext = parent[next] as CellId;
      parent[root] = next;
      parent[next] = -1;
      if (oldParentOfNext !== root) {
        // The edge root-next is new, and next's old parent edge leaves the tree.
        removeWall(walls, grid, root, next);
        yield { t: 'carve', from: root, to: next } satisfies GenStep;
        addWall(walls, grid, next, oldParentOfNext);
        yield { t: 'seal', a: next, b: oldParentOfNext } satisfies GenStep;
      }
      // else: next was the root's child; the pointer flipped along an existing edge.
      root = next;
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
