import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStats, SolveStep } from '../steps';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { reconstructPath, type MazeSolver, type SolveResult } from './types';

export const dfsMeta: AlgorithmMeta = {
  id: 'dfs',
  name: 'Depth-First Search',
  family: 'solver',
  summary:
    'Follows one corridor as deep as it goes, backing up at dead ends. Complete on finite ' +
    'mazes but not optimal; the path it finds is the first one it stumbles into.',
  complexity: { time: 'O(V + E)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'stack'],
  params: [],
  docsSlug: 'learn/dfs',
  since: CORE_VERSION,
};

export const dfs: MazeSolver = {
  meta: dfsMeta,
  *run(maze: MazeState) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const parent = new Int32Array(total).fill(-1);
    const seen = new Uint8Array(total);
    const stack: CellId[] = [start];
    seen[start] = 1;

    let expanded = 0;
    let discovered = 1;
    let frontierPeak = 1;
    let steps = 0;

    while (stack.length > 0) {
      const cell = stack.pop() as CellId;
      expanded++;
      steps++;
      yield { t: 'expand', cell } satisfies SolveStep;

      if (cell === goal) {
        const path = reconstructPath(parent, start, goal);
        const stats: SolveStats = {
          expanded,
          discovered,
          frontierPeak,
          pathLength: path.length - 1,
          optimal: null,
          steps: steps + 2,
        };
        yield { t: 'path', cells: path } satisfies SolveStep;
        yield { t: 'done', stats } satisfies SolveStep;
        return { path, stats } satisfies SolveResult;
      }

      let pushed = 0;
      for (const d of DIRS) {
        if (hasWall(walls, cell, d)) continue;
        const nb = neighbor(grid, cell, d);
        if (nb === NO_CELL || seen[nb] === 1) continue;
        seen[nb] = 1;
        parent[nb] = cell;
        stack.push(nb);
        pushed++;
        discovered++;
        frontierPeak = Math.max(frontierPeak, stack.length);
        steps++;
        yield { t: 'discover', cell: nb, from: cell } satisfies SolveStep;
      }
      if (pushed === 0) {
        steps++;
        yield { t: 'deadend', cell } satisfies SolveStep;
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
