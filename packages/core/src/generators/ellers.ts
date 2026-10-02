import { Dir, cellCount, idOf, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import { DisjointSet } from './disjointSet';
import type { MazeGenerator } from './types';

export interface EllersParams extends Record<string, unknown> {
  /** Probability of joining two horizontally adjacent cells that are in different sets. */
  readonly joinProb: number;
  /** Probability that a cell (beyond the mandatory one per set) also drops a passage south. */
  readonly dropProb: number;
}

export const ellersMeta: AlgorithmMeta = {
  id: 'ellers',
  name: "Eller's",
  family: 'generator',
  summary:
    'Build the maze one row at a time. Cells in a row that are connected share a set; join ' +
    'neighbouring cells of different sets at random, then let every set drop at least one ' +
    'passage into the next row. Only one row is ever in memory, so it can run forever.',
  complexity: { time: 'O(V)', space: 'O(width)' },
  tags: ['row-by-row', 'union-find', 'randomized', 'perfect', 'streaming'],
  params: [
    {
      key: 'joinProb',
      label: 'Horizontal join probability',
      description: 'Higher values make longer east-west runs.',
      kind: 'float',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      key: 'dropProb',
      label: 'Extra vertical passage probability',
      description: 'Higher values make the maze more vertical and less branchy.',
      kind: 'float',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
  docsSlug: 'learn/ellers',
  since: CORE_VERSION,
};

/**
 * Eller's algorithm. Within a row, a set is "all cells already connected to each other" (via
 * passages in this row or above). Two rules keep the result a perfect maze: never join two
 * cells of the same set (it would make a loop), and every set must send at least one passage
 * down (otherwise it would be cut off). The last row joins everything that is left. The
 * shared disjoint set over the whole grid is a convenience; a real streaming implementation
 * only needs the current row's labels.
 */
export const ellers: MazeGenerator<EllersParams> = {
  meta: ellersMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<EllersParams>) {
    const joinProb = params?.joinProb ?? 0.5;
    const dropProb = params?.dropProb ?? 0.5;
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const sets = new DisjointSet(total);
    const { width, height } = grid;

    for (let row = 0; row < height; row++) {
      const lastRow = row === height - 1;

      // 1. Join horizontally adjacent cells that are in different sets (always on the last row).
      for (let col = 0; col < width - 1; col++) {
        const a = idOf(grid, row, col);
        const b = a + 1;
        yield { t: 'visit', cell: a } satisfies GenStep;
        if (sets.connected(a, b)) continue;
        if (lastRow || rng.next() < joinProb) {
          sets.union(a, b);
          yield { t: 'union', a, b } satisfies GenStep;
          removeWall(walls, grid, a, b);
          yield { t: 'carve', from: a, to: b } satisfies GenStep;
        }
      }
      if (lastRow) break;

      // 2. Every set in this row drops at least one passage south; extra ones with `dropProb`.
      const members = new Map<number, CellId[]>();
      for (let col = 0; col < width; col++) {
        const cell = idOf(grid, row, col);
        const root = sets.find(cell);
        const list = members.get(root);
        if (list) list.push(cell);
        else members.set(root, [cell]);
      }
      for (const cells of members.values()) {
        let dropped = false;
        for (const cell of cells) {
          if (rng.next() < dropProb) {
            yield* dropSouth(grid, walls, sets, cell);
            dropped = true;
          }
        }
        if (!dropped) {
          yield* dropSouth(grid, walls, sets, cells[rng.int(cells.length)] as CellId);
        }
      }
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};

function* dropSouth(
  grid: Grid,
  walls: Uint8Array,
  sets: DisjointSet,
  cell: CellId,
): Generator<GenStep, void> {
  const below = neighbor(grid, cell, Dir.S);
  sets.union(cell, below);
  removeWall(walls, grid, cell, below);
  yield { t: 'carve', from: cell, to: below } satisfies GenStep;
}
