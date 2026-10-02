import { DIRS, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { cloneWalls, createMazeState, hasWall, removeWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazePostprocessor } from './types';

export interface BraidParams extends Record<string, unknown> {
  /** Share of dead ends to remove, 0..100. */
  readonly percent: number;
}

export const braidMeta: AlgorithmMeta = {
  id: 'braid',
  name: 'Braid (remove dead ends)',
  family: 'postprocessor',
  summary:
    'Knock a wall out of a share of the dead-end cells so they loop back into the maze. The ' +
    'result has cycles, which means there is more than one route and solvers that promise ' +
    'the shortest path suddenly have something to prove.',
  complexity: { time: 'O(V)', space: 'O(V)' },
  tags: ['cycles', 'imperfect', 'dead-ends'],
  params: [
    {
      key: 'percent',
      label: 'Dead ends to remove (%)',
      description: '100 removes every dead end that can be removed.',
      kind: 'int',
      min: 0,
      max: 100,
      default: 50,
    },
  ],
  docsSlug: 'learn/braid',
  since: CORE_VERSION,
};

/** Number of open passages into in-grid neighbours. */
function degree(grid: Grid, walls: Uint8Array, cell: CellId): number {
  let n = 0;
  for (const d of DIRS) {
    if (!hasWall(walls, cell, d) && neighbor(grid, cell, d) !== NO_CELL) n++;
  }
  return n;
}

/**
 * Braiding never adds walls, so connectivity is preserved and no new dead ends can appear
 * (a cell's degree only goes up). For each chosen dead end we open a wall towards a
 * neighbour, preferring one that is not itself a dead end so two dead ends do not just pair
 * off into a tiny loop.
 */
export const braid: MazePostprocessor<BraidParams> = {
  meta: braidMeta,
  *run(maze: MazeState, rng: Rng, params?: Partial<BraidParams>) {
    const percent = Math.min(100, Math.max(0, params?.percent ?? 50));
    const { grid } = maze;
    const total = cellCount(grid);
    const walls = cloneWalls(maze.walls);

    const deadEnds: CellId[] = [];
    for (let cell = 0; cell < total; cell++) {
      if (degree(grid, walls, cell) === 1) deadEnds.push(cell);
    }
    rng.shuffle(deadEnds);
    const target = Math.round((deadEnds.length * percent) / 100);

    const preferred: CellId[] = [];
    const fallback: CellId[] = [];
    for (let i = 0; i < target; i++) {
      const cell = deadEnds[i] as CellId;
      // An earlier braid may already have opened this cell from the other side.
      if (degree(grid, walls, cell) !== 1) continue;
      preferred.length = 0;
      fallback.length = 0;
      for (const d of DIRS) {
        if (!hasWall(walls, cell, d)) continue;
        const nb = neighbor(grid, cell, d);
        if (nb === NO_CELL) continue;
        (degree(grid, walls, nb) === 1 ? fallback : preferred).push(nb);
      }
      const pool = preferred.length > 0 ? preferred : fallback;
      if (pool.length === 0) continue; // 1 x N grids: an end cell has nowhere else to go
      const to = pool[rng.int(pool.length)] as CellId;
      yield { t: 'visit', cell } satisfies GenStep;
      removeWall(walls, grid, cell, to);
      yield { t: 'carve', from: cell, to } satisfies GenStep;
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, maze.start, maze.goal);
  },
};
