import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStep } from '../steps';
import { MinHeap } from '../util/heap';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter } from './shared';
import { reconstructPath, type MazeSolver, type SolveResult } from './types';

export interface DijkstraParams extends Record<string, unknown> {
  /**
   * Cost of entering each cell (programmatic only, no UI descriptor). Defaults to 1 for every
   * cell, which makes Dijkstra behave like BFS with a priority queue. Must be non-negative.
   */
  readonly weights?: ArrayLike<number>;
}

interface Entry {
  cell: CellId;
  g: number;
  seq: number;
}

export const dijkstraMeta: AlgorithmMeta = {
  id: 'dijkstra',
  name: "Dijkstra's Algorithm",
  family: 'solver',
  summary:
    'Always expands the cheapest known cell using a binary heap, so the first time the goal ' +
    'is popped its cost is optimal. With unit costs it visits cells in the same rings as BFS; ' +
    'with per-cell weights it routes around expensive terrain.',
  complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'optimal', 'heap', 'weighted'],
  params: [],
  docsSlug: 'learn/dijkstra',
  since: CORE_VERSION,
};

/**
 * Teaches: priority queues, relaxation (`relax` steps fire when a shorter route to an already
 * discovered cell is found), and why a heap replaces BFS's queue once edges have costs.
 * Complete and optimal for non-negative weights. Uses lazy deletion: stale heap entries are
 * skipped when popped instead of being removed.
 *
 * Note for Learn mode: with *per-cell entry* costs the first discovery of a cell always comes
 * from the cheapest predecessor (the heap pops in non-decreasing g), so `relax` never fires;
 * it appears once costs differ per *edge* or in A*, whose f-order differs from g-order.
 */
export const dijkstra: MazeSolver<DijkstraParams> = {
  meta: dijkstraMeta,
  *run(maze: MazeState, params?: Partial<DijkstraParams>) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const weights = params?.weights;
    if (weights !== undefined) {
      if (weights.length !== total) throw new RangeError('weights must have one entry per cell');
      for (let i = 0; i < total; i++) {
        const w = weights[i] as number;
        if (!(w >= 0)) throw new RangeError('weights must be non-negative numbers');
      }
    }
    const costOf = (cell: CellId): number => (weights ? (weights[cell] as number) : 1);

    const c = new StepCounter();
    const dist = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    let seq = 0;
    const heap = new MinHeap<Entry>((a, b) => (a.g !== b.g ? a.g < b.g : a.seq < b.seq));

    dist[start] = 0;
    heap.push({ cell: start, g: 0, seq: seq++ });
    c.discovered++;
    c.frontier(1);

    while (heap.size > 0) {
      const { cell, g } = heap.pop() as Entry;
      if (closed[cell] === 1 || g > (dist[cell] as number)) continue; // stale entry
      closed[cell] = 1;
      c.expanded++;
      yield c.count({ t: 'expand', cell, g } satisfies SolveStep);

      if (cell === goal) {
        const path = reconstructPath(parent, start, goal);
        const stats = c.stats(path.length - 1, true);
        yield { t: 'path', cells: path } satisfies SolveStep;
        yield { t: 'done', stats } satisfies SolveStep;
        return { path, stats } satisfies SolveResult;
      }

      for (const d of DIRS) {
        if (hasWall(walls, cell, d)) continue;
        const nb = neighbor(grid, cell, d);
        if (nb === NO_CELL || closed[nb] === 1) continue;
        const ng = g + costOf(nb);
        const old = dist[nb] as number;
        if (old === Number.POSITIVE_INFINITY) {
          dist[nb] = ng;
          parent[nb] = cell;
          heap.push({ cell: nb, g: ng, seq: seq++ });
          c.discovered++;
          c.frontier(heap.size);
          yield c.count({ t: 'discover', cell: nb, from: cell, g: ng } satisfies SolveStep);
        } else if (ng < old) {
          dist[nb] = ng;
          parent[nb] = cell;
          heap.push({ cell: nb, g: ng, seq: seq++ });
          c.frontier(heap.size);
          yield c.count({ t: 'relax', cell: nb, from: cell, oldG: old, newG: ng } satisfies SolveStep);
        }
      }
    }

    const stats = c.stats(null, null);
    yield { t: 'fail' } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path: null, stats } satisfies SolveResult;
  },
};
