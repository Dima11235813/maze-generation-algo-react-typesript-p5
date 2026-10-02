import { DIRS, NO_CELL, cellCount, neighbor, type CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { SolveStep } from '../steps';
import { hasWall, type MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter } from './shared';
import type { MazeSolver, SolveResult } from './types';

export const bidirectionalBfsMeta: AlgorithmMeta = {
  id: 'bidirectional-bfs',
  name: 'Bidirectional BFS',
  family: 'solver',
  summary:
    'Two breadth-first waves, one from the start and one from the goal, expanded a layer at a ' +
    'time from whichever side is smaller. They meet in the middle after exploring roughly two ' +
    'half-size circles instead of one big one.',
  complexity: { time: 'O(b^(d/2))', space: 'O(V)' },
  tags: ['graph-search', 'complete', 'optimal', 'queue', 'bidirectional'],
  params: [],
  docsSlug: 'learn/bidirectional-bfs',
  since: CORE_VERSION,
};

interface Side {
  readonly dist: Int32Array;
  readonly parent: Int32Array;
  queue: CellId[];
}

/**
 * Teaches: search from both ends and the branching-factor argument (b^(d/2) + b^(d/2) is far
 * less than b^d). Layers are expanded whole so the first intersection yields a shortest path:
 * when the two waves touch we take the meeting cell with the smallest `distA + distB`.
 *
 * The step stream uses plain `expand`/`discover` for both waves; `g` is the distance from
 * that wave's own root, so trackers colour both wavefronts the same way.
 */
export const bidirectionalBfs: MazeSolver = {
  meta: bidirectionalBfsMeta,
  *run(maze: MazeState) {
    const { grid, walls, start, goal } = maze;
    const total = cellCount(grid);
    const c = new StepCounter();

    const makeSide = (root: CellId): Side => {
      const dist = new Int32Array(total).fill(-1);
      dist[root] = 0;
      return { dist, parent: new Int32Array(total).fill(-1), queue: [root] };
    };
    const a = makeSide(start);
    const b = makeSide(goal);

    if (start === goal) {
      c.discovered = 1;
      c.expanded = 1;
      c.frontier(1);
      yield c.count({ t: 'expand', cell: start, g: 0 } satisfies SolveStep);
      const stats = c.stats(0, true);
      yield { t: 'path', cells: [start] } satisfies SolveStep;
      yield { t: 'done', stats } satisfies SolveStep;
      return { path: [start], stats } satisfies SolveResult;
    }
    c.discovered = 2;
    c.frontier(2);

    let bestMeet: CellId = NO_CELL;
    let bestSum = Number.POSITIVE_INFINITY;

    while (bestMeet === NO_CELL && a.queue.length > 0 && b.queue.length > 0) {
      // Expand the whole current layer of the smaller side.
      const [side, other] = a.queue.length <= b.queue.length ? [a, b] : [b, a];
      const layer = side.queue;
      side.queue = [];
      for (const cell of layer) {
        c.expanded++;
        yield c.count({ t: 'expand', cell, g: side.dist[cell] ?? 0 } satisfies SolveStep);
        for (const d of DIRS) {
          if (hasWall(walls, cell, d)) continue;
          const nb = neighbor(grid, cell, d);
          if (nb === NO_CELL || side.dist[nb] !== -1) continue;
          side.dist[nb] = (side.dist[cell] ?? 0) + 1;
          side.parent[nb] = cell;
          side.queue.push(nb);
          c.discovered++;
          c.frontier(side.queue.length + other.queue.length);
          yield c.count({ t: 'discover', cell: nb, from: cell, g: side.dist[nb] ?? 0 } satisfies SolveStep);
          const otherDist = other.dist[nb] ?? -1;
          if (otherDist >= 0) {
            const sum = (side.dist[nb] ?? 0) + otherDist;
            if (sum < bestSum) {
              bestSum = sum;
              bestMeet = nb;
            }
          }
        }
      }
    }

    if (bestMeet === NO_CELL) {
      const stats = c.stats(null, null);
      yield { t: 'fail' } satisfies SolveStep;
      yield { t: 'done', stats } satisfies SolveStep;
      return { path: null, stats } satisfies SolveResult;
    }

    // start -> meet via side A parents, then meet -> goal via side B parents.
    const head: CellId[] = [];
    for (let cur = bestMeet; cur !== -1; cur = a.parent[cur] ?? -1) {
      head.push(cur);
      if (cur === start) break;
    }
    head.reverse();
    const tail: CellId[] = [];
    for (let cur = b.parent[bestMeet] ?? -1; cur !== -1; cur = b.parent[cur] ?? -1) {
      tail.push(cur);
      if (cur === goal) break;
    }
    const path = head.concat(tail);
    const stats = c.stats(path.length - 1, true);
    yield { t: 'path', cells: path } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path, stats } satisfies SolveResult;
  },
};
