import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStep } from '../steps';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter } from './shared';
import type { MazeSolver, SolveResult } from './types';

export const floodFillMeta: AlgorithmMeta = {
  id: 'flood-fill',
  name: 'Flood Fill (distance map)',
  family: 'solver',
  summary:
    'Flood the maze from the goal, labelling every cell with its distance. Then start at the ' +
    'entrance and always step to a neighbour one closer. The whole distance field is a reusable ' +
    'result: it answers "how far" for every cell at once.',
  complexity: { time: 'O(V + E)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'optimal', 'queue', 'dynamic-programming'],
  params: [],
  docsSlug: 'learn/flood-fill',
  since: CORE_VERSION,
};

/**
 * Teaches: dynamic programming on graphs. BFS from the goal is the same wavefront as BFS from
 * the start, but the labels it leaves behind (`g` on each `discover`) let any agent anywhere
 * walk downhill to the goal without searching again (`move` steps). Complete and optimal.
 */
export const floodFill: MazeSolver = {
  meta: floodFillMeta,
  *run(maze: MazeState) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const c = new StepCounter();

    // Phase 1: distance map from the goal.
    const dist = new Int32Array(total).fill(-1);
    const queue: CellId[] = [goal];
    dist[goal] = 0;
    c.discovered++;
    c.frontier(1);
    let head = 0;
    while (head < queue.length) {
      const cell = queue[head++] as CellId;
      c.expanded++;
      yield c.count({ t: 'expand', cell, g: dist[cell] ?? 0 } satisfies SolveStep);
      for (const d of DIRS) {
        if (hasWall(walls, cell, d)) continue;
        const nb = neighbor(grid, cell, d);
        if (nb === NO_CELL || dist[nb] !== -1) continue;
        dist[nb] = (dist[cell] ?? 0) + 1;
        queue.push(nb);
        c.discovered++;
        c.frontier(queue.length - head);
        yield c.count({ t: 'discover', cell: nb, from: cell, g: dist[nb] ?? 0 } satisfies SolveStep);
      }
    }

    if ((dist[start] ?? -1) < 0) {
      const stats = c.stats(null, null);
      yield { t: 'fail' } satisfies SolveStep;
      yield { t: 'done', stats } satisfies SolveStep;
      return { path: null, stats } satisfies SolveResult;
    }

    // Phase 2: descend from the start, one distance unit per move.
    const path: CellId[] = [start];
    let cur = start;
    while (cur !== goal) {
      const want = (dist[cur] ?? 0) - 1;
      let moved = false;
      for (const d of DIRS) {
        if (hasWall(walls, cur, d)) continue;
        const nb = neighbor(grid, cur, d);
        if (nb !== NO_CELL && dist[nb] === want) {
          yield c.count({ t: 'move', from: cur, to: nb, heading: d } satisfies SolveStep);
          cur = nb;
          path.push(nb);
          moved = true;
          break;
        }
      }
      if (!moved) throw new Error('flood-fill: distance field is inconsistent');
    }

    const stats = c.stats(path.length - 1, true);
    yield { t: 'path', cells: path } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path, stats } satisfies SolveResult;
  },
};
