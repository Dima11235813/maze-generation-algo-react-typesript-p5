import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStep } from '../steps';
import { MinHeap } from '../util/heap';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import {
  HEURISTIC_PARAM,
  StepCounter,
  heuristicFn,
  parseHeuristic,
  type HeuristicId,
} from './shared';
import { reconstructPath, type MazeSolver, type SolveResult } from './types';

export interface GreedyBestFirstParams extends Record<string, unknown> {
  readonly heuristic: HeuristicId;
}

interface Entry {
  cell: CellId;
  h: number;
  seq: number;
}

export const greedyBestFirstMeta: AlgorithmMeta = {
  id: 'greedy-best-first',
  name: 'Greedy Best-First Search',
  family: 'solver',
  summary:
    'Always expands the cell that looks closest to the goal (smallest h) and ignores the cost ' +
    'so far. Fast when the heuristic is right, easily fooled by dead ends that point at the ' +
    'goal; complete but not optimal.',
  complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'heuristic', 'heap'],
  params: [HEURISTIC_PARAM],
  docsSlug: 'learn/greedy-best-first',
  since: CORE_VERSION,
};

/**
 * Teaches: the difference between g and h. Greedy uses only h, so it can commit to a long
 * corridor because its end is geometrically near the goal. A closed set keeps it complete on
 * finite graphs. Compare with A*, which adds g back in.
 */
export const greedyBestFirst: MazeSolver<GreedyBestFirstParams> = {
  meta: greedyBestFirstMeta,
  *run(maze: MazeState, params?: Partial<GreedyBestFirstParams>) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const h = heuristicFn(grid, goal, parseHeuristic(params?.heuristic));

    const c = new StepCounter();
    const seen = new Uint8Array(total);
    const parent = new Int32Array(total).fill(-1);
    const depth = new Int32Array(total).fill(-1);
    let seq = 0;
    const heap = new MinHeap<Entry>((a, b) => (a.h !== b.h ? a.h < b.h : a.seq < b.seq));

    seen[start] = 1;
    depth[start] = 0;
    heap.push({ cell: start, h: h(start), seq: seq++ });
    c.discovered++;
    c.frontier(1);

    while (heap.size > 0) {
      const e = heap.pop() as Entry;
      c.expanded++;
      yield c.count({
        t: 'expand',
        cell: e.cell,
        g: depth[e.cell] ?? 0,
        h: e.h,
      } satisfies SolveStep);

      if (e.cell === goal) {
        const path = reconstructPath(parent, start, goal);
        const stats = c.stats(path.length - 1, null);
        yield { t: 'path', cells: path } satisfies SolveStep;
        yield { t: 'done', stats } satisfies SolveStep;
        return { path, stats } satisfies SolveResult;
      }

      for (const d of DIRS) {
        if (hasWall(walls, e.cell, d)) continue;
        const nb = neighbor(grid, e.cell, d);
        if (nb === NO_CELL || seen[nb] === 1) continue;
        seen[nb] = 1;
        parent[nb] = e.cell;
        depth[nb] = (depth[e.cell] ?? 0) + 1;
        const hn = h(nb);
        heap.push({ cell: nb, h: hn, seq: seq++ });
        c.discovered++;
        c.frontier(heap.size);
        yield c.count({
          t: 'discover',
          cell: nb,
          from: e.cell,
          g: depth[nb] ?? 0,
        } satisfies SolveStep);
      }
    }

    const stats = c.stats(null, null);
    yield { t: 'fail' } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path: null, stats } satisfies SolveResult;
  },
};
