import { DIRS, NO_CELL, cellCount, isValidCell, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export interface RecursiveBacktrackerParams extends Record<string, unknown> {
  /** Cell where the depth-first walk begins. Also becomes `MazeState.start`. */
  readonly start: CellId;
}

export const recursiveBacktrackerMeta: AlgorithmMeta = {
  id: 'recursive-backtracker',
  name: 'Recursive Backtracker (DFS)',
  family: 'generator',
  summary:
    'Depth-first search with an explicit stack: carve into a random unvisited neighbour, ' +
    'back up when stuck. Produces long, winding corridors with few dead ends.',
  complexity: { time: 'O(V)', space: 'O(V)' },
  tags: ['dfs', 'randomized', 'perfect', 'long-corridors'],
  params: [
    {
      key: 'start',
      label: 'Start cell',
      description: 'Cell index where the walk begins (0 = top-left).',
      kind: 'int',
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      default: 0,
    },
  ],
  docsSlug: 'learn/recursive-backtracker',
  since: CORE_VERSION,
};

/**
 * The legacy `MazeGenerator.ts` draw loop, expressed as a generator function.
 *
 * Step semantics match the legacy frame loop exactly so trackers can reproduce its colours
 * and cube heights: a `visit` is emitted every time a cell becomes current (including when
 * backtracking onto it), then either a `carve` into a random unvisited neighbour (neighbours
 * scanned in N, E, S, W order like the legacy Top/Right/Bottom/Left) or a `backtrack`.
 */
export const recursiveBacktracker: MazeGenerator<RecursiveBacktrackerParams> = {
  meta: recursiveBacktrackerMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<RecursiveBacktrackerParams>) {
    const total = cellCount(grid);
    const start = params?.start !== undefined && isValidCell(grid, params.start) ? params.start : 0;
    const walls = createWalls(grid);
    const visited = new Uint8Array(total);
    const stack: CellId[] = [];
    const candidates: CellId[] = [];

    let current: CellId = start;
    visited[current] = 1;

    for (;;) {
      yield { t: 'visit', cell: current } satisfies GenStep;

      candidates.length = 0;
      for (const d of DIRS) {
        const nb = neighbor(grid, current, d);
        if (nb !== NO_CELL && visited[nb] === 0) candidates.push(nb);
      }

      if (candidates.length > 0) {
        const next = candidates[rng.int(candidates.length)] as CellId;
        stack.push(current);
        removeWall(walls, grid, current, next);
        yield { t: 'carve', from: current, to: next } satisfies GenStep;
        visited[next] = 1;
        current = next;
      } else if (stack.length > 0) {
        const prev = stack.pop() as CellId;
        yield { t: 'backtrack', from: current, to: prev } satisfies GenStep;
        current = prev;
      } else {
        break;
      }
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, start, total - 1);
  },
};
