import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStats, SolveStep } from '../steps';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { reconstructPath, type MazeSolver, type SolveResult } from './types';

export const bfsMeta: AlgorithmMeta = {
  id: 'bfs',
  name: 'Breadth-First Search',
  family: 'solver',
  summary:
    'Explores cells in rings of increasing distance using a queue. Complete and optimal on ' +
    'unweighted mazes; the frontier is the wavefront you see spreading out.',
  complexity: { time: 'O(V + E)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'optimal', 'queue'],
  params: [],
  docsSlug: 'learn/bfs',
  since: CORE_VERSION,
};

export const bfs: MazeSolver = {
  meta: bfsMeta,
  *run(maze: MazeState) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const parent = new Int32Array(total).fill(-1);
    const dist = new Int32Array(total).fill(-1);
    const queue: CellId[] = [start];
    let head = 0;
    dist[start] = 0;

    let expanded = 0;
    let discovered = 1;
    let frontierPeak = 1;
    let steps = 0;

    while (head < queue.length) {
      const cell = queue[head++] as CellId;
      expanded++;
      steps++;
      yield { t: 'expand', cell, g: dist[cell] ?? 0 } satisfies SolveStep;

      if (cell === goal) {
        const path = reconstructPath(parent, start, goal);
        const stats: SolveStats = {
          expanded,
          discovered,
          frontierPeak,
          pathLength: path.length - 1,
          optimal: true,
          steps: steps + 2,
        };
        yield { t: 'path', cells: path } satisfies SolveStep;
        yield { t: 'done', stats } satisfies SolveStep;
        return { path, stats } satisfies SolveResult;
      }

      for (const d of DIRS) {
        if (hasWall(walls, cell, d)) continue;
        const nb = neighbor(grid, cell, d);
        if (nb === NO_CELL || dist[nb] !== -1) continue;
        dist[nb] = (dist[cell] ?? 0) + 1;
        parent[nb] = cell;
        queue.push(nb);
        discovered++;
        frontierPeak = Math.max(frontierPeak, queue.length - head);
        steps++;
        yield { t: 'discover', cell: nb, from: cell, g: dist[nb] ?? 0 } satisfies SolveStep;
      }
    }

    const stats: SolveStats = {
      expanded,
      discovered,
      frontierPeak,
      pathLength: null,
      optimal: null,
      steps: steps + 2,
    };
    yield { t: 'fail' } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path: null, stats } satisfies SolveResult;
  },
};
