import { Dir, cellCount, idOf, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export interface SidewinderParams extends Record<string, unknown> {
  /** Probability of closing the current run at each cell (higher = shorter runs, more verticals). */
  readonly verticalBias: number;
}

export const sidewinderMeta: AlgorithmMeta = {
  id: 'sidewinder',
  name: 'Sidewinder',
  family: 'generator',
  summary:
    'Carve eastward runs along each row; when a run ends, open exactly one passage north from ' +
    'a random cell of the run. The top row becomes one long corridor, so the maze is always ' +
    'easy to solve by heading up - a textbook example of structural bias.',
  complexity: { time: 'O(V)', space: 'O(width)' },
  tags: ['row-by-row', 'randomized', 'perfect', 'biased', 'simple'],
  params: [
    {
      key: 'verticalBias',
      label: 'Vertical bias',
      description: 'Chance of ending a run at each cell; 0 gives full-width runs, 1 gives columns.',
      kind: 'float',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
  docsSlug: 'learn/sidewinder',
  since: CORE_VERSION,
};

/**
 * Sidewinder is Eller's algorithm with the bookkeeping removed: because every run links up
 * exactly once and only to the row above, there is no need to track sets at all. The price is
 * a fully open top row and a strong "snake" texture.
 */
export const sidewinder: MazeGenerator<SidewinderParams> = {
  meta: sidewinderMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<SidewinderParams>) {
    const verticalBias = params?.verticalBias ?? 0.5;
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const { width, height } = grid;
    const run: CellId[] = [];

    for (let row = 0; row < height; row++) {
      run.length = 0;
      for (let col = 0; col < width; col++) {
        const cell = idOf(grid, row, col);
        run.push(cell);
        yield { t: 'visit', cell } satisfies GenStep;

        const atEastEdge = col === width - 1;
        // The top row has nowhere to go north, so it is one continuous run.
        const closeRun = row > 0 && (atEastEdge || rng.next() < verticalBias);

        if (closeRun) {
          const member = run[rng.int(run.length)] as CellId;
          const above = neighbor(grid, member, Dir.N);
          removeWall(walls, grid, member, above);
          yield { t: 'carve', from: member, to: above } satisfies GenStep;
          run.length = 0;
        } else if (!atEastEdge) {
          const east = neighbor(grid, cell, Dir.E);
          removeWall(walls, grid, cell, east);
          yield { t: 'carve', from: cell, to: east } satisfies GenStep;
        }
      }
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
