import { cellCount, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStep } from '../steps';
import { openNeighbors, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter } from './shared';
import { reconstructPath, type MazeSolver, type SolveResult } from './types';

export const deadEndFillingMeta: AlgorithmMeta = {
  id: 'dead-end-filling',
  name: 'Dead-End Filling',
  family: 'solver',
  summary:
    'Fill in every dead end, then the corridor that just became a dead end, and so on. What ' +
    'remains is the solution (plus any loops in a braided maze). Needs the whole map; ' +
    'elimination instead of search.',
  complexity: { time: 'O(V)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'optimal', 'queue', 'elimination'],
  params: [],
  docsSlug: 'learn/dead-end-filling',
  since: CORE_VERSION,
};

/**
 * Teaches: reasoning from global information. A cell with one open side cannot lie on any
 * simple start-goal path (unless it is the start or the goal), so filling it never removes a
 * route; repeating until nothing changes leaves every simple path intact. On a perfect maze
 * exactly the solution survives. A final BFS over the surviving cells picks the shortest route
 * through any loops a braided maze leaves behind, so the solver is complete and optimal.
 */
export const deadEndFilling: MazeSolver = {
  meta: deadEndFillingMeta,
  *run(maze: MazeState) {
    const { grid, start, goal } = maze;
    const total = cellCount(grid);
    const c = new StepCounter();

    // Phase 1: peel dead ends. `degree` counts open passages to unfilled neighbours.
    const degree = new Int32Array(total);
    const filled = new Uint8Array(total);
    const queue: CellId[] = [];
    for (let id = 0; id < total; id++) {
      degree[id] = openNeighbors(maze, id).length;
      if (degree[id] === 1 && id !== start && id !== goal) queue.push(id);
    }
    c.frontier(queue.length);
    let head = 0;
    while (head < queue.length) {
      const cell = queue[head++] as CellId;
      if (filled[cell] === 1) continue;
      filled[cell] = 1;
      c.discovered++;
      yield c.count({ t: 'deadend', cell } satisfies SolveStep);
      for (const nb of openNeighbors(maze, cell)) {
        if (filled[nb] === 1) continue;
        degree[nb] = (degree[nb] ?? 0) - 1;
        if (degree[nb] === 1 && nb !== start && nb !== goal) {
          queue.push(nb);
          c.frontier(queue.length - head);
        }
      }
    }

    // Phase 2: BFS through the surviving cells (the solution corridor, or corridor + loops).
    const parent = new Int32Array(total).fill(-1);
    const seen = new Uint8Array(total);
    const bfs: CellId[] = [start];
    seen[start] = 1;
    let found = start === goal;
    for (let i = 0; i < bfs.length && !found; i++) {
      const cell = bfs[i] as CellId;
      for (const nb of openNeighbors(maze, cell)) {
        if (filled[nb] === 1 || seen[nb] === 1) continue;
        seen[nb] = 1;
        parent[nb] = cell;
        bfs.push(nb);
        if (nb === goal) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      const stats = c.stats(null, null);
      yield { t: 'fail' } satisfies SolveStep;
      yield { t: 'done', stats } satisfies SolveStep;
      return { path: null, stats } satisfies SolveResult;
    }

    const path = reconstructPath(parent, start, goal);
    for (let i = 0; i < path.length; i++) {
      c.expanded++;
      yield c.count({ t: 'expand', cell: path[i] as CellId, g: i } satisfies SolveStep);
    }
    const stats = c.stats(path.length - 1, true);
    yield { t: 'path', cells: path } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path, stats } satisfies SolveResult;
  },
};
