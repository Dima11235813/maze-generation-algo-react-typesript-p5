import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStep } from '../steps';
import { MinHeap } from '../util/heap';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { HEURISTIC_PARAM, StepCounter, heuristicFn, parseHeuristic, type HeuristicId } from './shared';
import { reconstructPath, type MazeSolver, type SolveResult } from './types';

export interface AStarParams extends Record<string, unknown> {
  readonly heuristic: HeuristicId;
  /** Multiplier on h. 1 = classic A* (optimal); > 1 = weighted A*, faster but may be suboptimal. */
  readonly weight: number;
  /** Order among equal f: prefer lower h (drives toward the goal) or insertion order. */
  readonly tieBreak: 'low-h' | 'fifo';
}

interface Entry {
  cell: CellId;
  g: number;
  h: number;
  f: number;
  seq: number;
}

export const astarMeta: AlgorithmMeta = {
  id: 'astar',
  name: 'A* Search',
  family: 'solver',
  summary:
    'Dijkstra plus a heuristic: expands the cell with the smallest f = g + h, where h estimates ' +
    'the distance left. With an admissible heuristic and weight 1 it is optimal while expanding ' +
    'far fewer cells than BFS; a weight above 1 trades optimality for speed.',
  complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'optimal', 'heuristic', 'heap'],
  params: [
    HEURISTIC_PARAM,
    {
      key: 'weight',
      label: 'Heuristic weight',
      description: '1 keeps A* optimal. Larger values are greedier and may return longer paths.',
      kind: 'float',
      min: 1,
      max: 5,
      step: 0.25,
      default: 1,
    },
    {
      key: 'tieBreak',
      label: 'Tie-break',
      description: 'How to order cells with equal f.',
      kind: 'enum',
      options: [
        { value: 'low-h', label: 'Lower h first (toward the goal)' },
        { value: 'fifo', label: 'Insertion order' },
      ],
      default: 'low-h',
    },
  ],
  docsSlug: 'learn/astar',
  since: CORE_VERSION,
};

/**
 * Teaches: admissibility and consistency, why f = g + h never over-estimates with Manhattan on
 * a 4-connected grid, tie-breaking, and weighted A*. Every `expand`/`discover` step carries
 * g, h and f so the UI can show the costs. Optimal iff `weight === 1` (all three heuristics are
 * admissible and consistent here). Complete on finite mazes.
 */
export const astar: MazeSolver<AStarParams> = {
  meta: astarMeta,
  *run(maze: MazeState, params?: Partial<AStarParams>) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const heuristic = parseHeuristic(params?.heuristic);
    const weight =
      typeof params?.weight === 'number' && Number.isFinite(params.weight)
        ? Math.min(5, Math.max(1, params.weight))
        : 1;
    const tieBreak = params?.tieBreak === 'fifo' ? 'fifo' : 'low-h';
    const h0 = heuristicFn(grid, goal, heuristic);
    const h = (cell: CellId): number => weight * h0(cell);

    const c = new StepCounter();
    const gBest = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    let seq = 0;
    const heap = new MinHeap<Entry>((a, b) => {
      if (a.f !== b.f) return a.f < b.f;
      if (tieBreak === 'low-h' && a.h !== b.h) return a.h < b.h;
      return a.seq < b.seq;
    });

    gBest[start] = 0;
    const hs = h(start);
    heap.push({ cell: start, g: 0, h: hs, f: hs, seq: seq++ });
    c.discovered++;
    c.frontier(1);

    while (heap.size > 0) {
      const e = heap.pop() as Entry;
      if (closed[e.cell] === 1 || e.g > (gBest[e.cell] as number)) continue; // stale
      closed[e.cell] = 1;
      c.expanded++;
      yield c.count({ t: 'expand', cell: e.cell, g: e.g, h: e.h, f: e.f } satisfies SolveStep);

      if (e.cell === goal) {
        const path = reconstructPath(parent, start, goal);
        const stats = c.stats(path.length - 1, weight === 1);
        yield { t: 'path', cells: path } satisfies SolveStep;
        yield { t: 'done', stats } satisfies SolveStep;
        return { path, stats } satisfies SolveResult;
      }

      for (const d of DIRS) {
        if (hasWall(walls, e.cell, d)) continue;
        const nb = neighbor(grid, e.cell, d);
        if (nb === NO_CELL || closed[nb] === 1) continue;
        const ng = e.g + 1;
        const old = gBest[nb] as number;
        if (ng < old) {
          const wasSeen = old !== Number.POSITIVE_INFINITY;
          gBest[nb] = ng;
          parent[nb] = e.cell;
          const hn = h(nb);
          heap.push({ cell: nb, g: ng, h: hn, f: ng + hn, seq: seq++ });
          c.frontier(heap.size);
          if (wasSeen) {
            yield c.count({ t: 'relax', cell: nb, from: e.cell, oldG: old, newG: ng } satisfies SolveStep);
          } else {
            c.discovered++;
            yield c.count({ t: 'discover', cell: nb, from: e.cell, g: ng, f: ng + hn } satisfies SolveStep);
          }
        }
      }
    }

    const stats = c.stats(null, null);
    yield { t: 'fail' } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path: null, stats } satisfies SolveResult;
  },
};
