import { DIRS, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export const aldousBroderMeta: AlgorithmMeta = {
  id: 'aldous-broder',
  name: 'Aldous-Broder',
  family: 'generator',
  summary:
    'Wander at random; whenever you step into a cell you have never seen, carve the passage ' +
    'you came through. Every perfect maze is equally likely (a uniform spanning tree) - at the ' +
    'cost of a painfully slow end game while the walk hunts for the last few cells.',
  complexity: { time: 'expected O(V log V), unbounded worst case', space: 'O(V)' },
  tags: ['random-walk', 'uniform', 'randomized', 'perfect', 'unbiased'],
  params: [],
  docsSlug: 'learn/aldous-broder',
  since: CORE_VERSION,
};

/**
 * Aldous-Broder: a simple random walk on the grid graph. The first entry into each cell adds
 * the edge it arrived by; later visits add nothing. Because the walk is uniform over
 * neighbours the resulting spanning tree is uniform over all spanning trees - the only bias
 * is none at all, which is the lesson. Expect it to feel sluggish at 1x on big grids.
 */
export const aldousBroder: MazeGenerator = {
  meta: aldousBroderMeta,
  *run(grid: Grid, rng: Rng) {
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const visited = new Uint8Array(total);
    const options: CellId[] = [];

    let current: CellId = 0;
    visited[current] = 1;
    let remaining = total - 1;
    yield { t: 'visit', cell: current } satisfies GenStep;

    while (remaining > 0) {
      // Uniform choice among in-grid neighbours = simple random walk on the grid graph.
      options.length = 0;
      for (const d of DIRS) {
        const nb = neighbor(grid, current, d);
        if (nb !== NO_CELL) options.push(nb);
      }
      const next = options[rng.int(options.length)] as CellId;
      yield { t: 'walk', cell: next } satisfies GenStep;
      if (visited[next] === 0) {
        visited[next] = 1;
        remaining--;
        removeWall(walls, grid, current, next);
        yield { t: 'carve', from: current, to: next } satisfies GenStep;
      }
      current = next;
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
