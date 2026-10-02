import { Dir, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export type BinaryTreeBias = 'ne' | 'nw' | 'se' | 'sw';

export interface BinaryTreeParams extends Record<string, unknown> {
  /** The two directions each cell may link towards; the maze flows diagonally that way. */
  readonly bias: BinaryTreeBias;
}

const BIAS_DIRS: Readonly<Record<BinaryTreeBias, readonly [Dir, Dir]>> = {
  ne: [Dir.N, Dir.E],
  nw: [Dir.N, Dir.W],
  se: [Dir.S, Dir.E],
  sw: [Dir.S, Dir.W],
};

export const binaryTreeMeta: AlgorithmMeta = {
  id: 'binary-tree',
  name: 'Binary Tree',
  family: 'generator',
  summary:
    'For every cell flip a coin: link north or east (or whichever two directions the bias ' +
    'names). The result is a binary tree rooted in one corner with two completely open ' +
    'border corridors and a strong diagonal grain - the simplest algorithm and the most biased.',
  complexity: { time: 'O(V)', space: 'O(1)' },
  tags: ['independent-cells', 'randomized', 'perfect', 'biased', 'simple', 'parallel'],
  params: [
    {
      key: 'bias',
      label: 'Diagonal bias',
      description: 'The corner every passage leans towards.',
      kind: 'enum',
      options: [
        { value: 'ne', label: 'North-east' },
        { value: 'nw', label: 'North-west' },
        { value: 'se', label: 'South-east' },
        { value: 'sw', label: 'South-west' },
      ],
      default: 'ne',
    },
  ],
  docsSlug: 'learn/binary-tree',
  since: CORE_VERSION,
};

/**
 * Binary Tree. Every cell independently picks one of two directions, so the cells could be
 * processed in parallel and no state is shared. Cells on the two "far" borders have only one
 * option, which is why those borders become open corridors; the corner cell has none and is
 * the root. Every path to the root is monotone in the bias directions.
 */
export const binaryTree: MazeGenerator<BinaryTreeParams> = {
  meta: binaryTreeMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<BinaryTreeParams>) {
    const bias: BinaryTreeBias = params?.bias ?? 'ne';
    const [d1, d2] = BIAS_DIRS[bias];
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const options: CellId[] = [];

    for (let cell = 0; cell < total; cell++) {
      yield { t: 'visit', cell } satisfies GenStep;
      options.length = 0;
      const n1 = neighbor(grid, cell, d1);
      const n2 = neighbor(grid, cell, d2);
      if (n1 !== NO_CELL) options.push(n1);
      if (n2 !== NO_CELL) options.push(n2);
      if (options.length === 0) continue; // the root corner
      // Only consume randomness when there is a real choice (keeps edge cells deterministic).
      const to = options.length === 1 ? (options[0] as CellId) : (options[rng.int(2)] as CellId);
      removeWall(walls, grid, cell, to);
      yield { t: 'carve', from: cell, to } satisfies GenStep;
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
