import { DIRS, cellCount, opposite, type CellId, type Dir } from '../grid';
import type { AlgorithmMeta } from '../meta';
import { canMove } from '../navigation';
import type { SolveStep } from '../steps';
import type { MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter, agentMove, loopErase, maxMovesParam, resolveMaxMoves, startWalk } from './shared';
import type { MazeSolver, SolveResult } from './types';

export interface TremauxParams extends Record<string, unknown> {
  readonly maxMoves: number;
}

export const tremauxMeta: AlgorithmMeta = {
  id: 'tremaux',
  name: "Tremaux's Algorithm",
  family: 'solver',
  summary:
    'Chalk marks at every passage entrance: never take a passage marked twice, turn back when ' +
    'you reach a junction you have seen before. Local memory alone makes the walk complete; ' +
    'the passages marked exactly once are a route to the goal.',
  complexity: { time: 'O(E) moves', space: 'O(E)' },
  tags: ['agent-perspective', 'complete', 'marks'],
  params: [maxMovesParam(8)],
  docsSlug: 'learn/tremaux',
  since: CORE_VERSION,
};

/**
 * Teaches: that completeness only needs memory you can leave in the environment (marks at
 * passage ends), and that this 1882 algorithm is depth-first search performed on foot. Each
 * passage end (cell, direction) holds a mark count 0..2:
 *
 * - leaving or entering through a passage adds a mark to that end (`mark` steps);
 * - arriving at a cell seen before through a passage that now carries a single mark means
 *   you closed a loop: turn back (the passage ends up marked twice);
 * - otherwise take an unmarked passage if any, else the once-marked passage you first came
 *   in by; never a passage marked twice;
 * - a cell whose only passage is the one you arrived by is a dead end (`deadend`).
 *
 * The returned path is the walk with detours erased (the once-marked passages on a perfect
 * maze). Complete on every finite maze; not optimal on braided mazes.
 */
export const tremaux: MazeSolver<TremauxParams> = {
  meta: tremauxMeta,
  *run(maze: MazeState, params?: Partial<TremauxParams>) {
    const { grid, start, goal } = maze;
    const total = cellCount(grid);
    const maxMoves = resolveMaxMoves(params?.maxMoves, total, 8);

    const c = new StepCounter();
    const marks = new Uint8Array(total * 4); // (cell * 4 + dir) -> 0 | 1 | 2
    const visited = new Uint8Array(total);
    const walk = startWalk(maze, { cell: start, heading: 0 });
    visited[start] = 1;
    c.expanded++;
    c.discovered++;
    c.frontier(1);
    yield c.count({ t: 'expand', cell: start } satisfies SolveStep);

    /** Direction, from the current cell, of the passage we arrived through. */
    let arrivedBy: Dir | null = null;
    /** Whether the current cell had already been visited before this arrival. */
    let revisit = false;
    let reason: 'goal' | 'exhausted' | 'budget' = 'goal';

    const markEnd = function* (cell: CellId, dir: Dir): Generator<SolveStep, void> {
      const i = cell * 4 + dir;
      const count = Math.min(2, (marks[i] ?? 0) + 1) as 1 | 2;
      marks[i] = count;
      yield c.count({ t: 'mark', cell, dir, count } satisfies SolveStep);
    };

    while (walk.pose.cell !== goal) {
      if (walk.moves >= maxMoves) {
        reason = 'budget';
        break;
      }
      const cell = walk.pose.cell;
      const open = DIRS.filter((d) => canMove(maze, cell, d));
      const others = open.filter((d) => d !== arrivedBy);
      const markOf = (d: Dir): number => marks[cell * 4 + d] ?? 0;

      let next: Dir | undefined;
      if (others.length === 0) {
        if (arrivedBy === null) {
          reason = 'exhausted'; // isolated start cell
          break;
        }
        yield c.count({ t: 'deadend', cell } satisfies SolveStep);
        next = arrivedBy;
      } else if (arrivedBy !== null && revisit && markOf(arrivedBy) === 1) {
        next = arrivedBy; // closed a loop: go back the way we came
      } else {
        next = others.find((d) => markOf(d) === 0) ?? open.find((d) => markOf(d) === 1);
      }
      if (next === undefined) {
        reason = 'exhausted'; // every passage marked twice: the goal is unreachable
        break;
      }

      yield* markEnd(cell, next);
      yield* agentMove(c, maze, walk, next);
      const arrived = walk.pose.cell;
      arrivedBy = opposite(next);
      yield* markEnd(arrived, arrivedBy);
      revisit = visited[arrived] === 1;
      visited[arrived] = 1;
    }

    if (reason !== 'goal') {
      const stats = c.stats(null, null);
      yield { t: 'fail' } satisfies SolveStep;
      yield { t: 'done', stats } satisfies SolveStep;
      return { path: null, stats } satisfies SolveResult;
    }

    const path = loopErase(walk.route);
    const stats = c.stats(path.length - 1, null);
    yield { t: 'path', cells: path } satisfies SolveStep;
    yield { t: 'done', stats } satisfies SolveStep;
    return { path, stats } satisfies SolveResult;
  },
};
