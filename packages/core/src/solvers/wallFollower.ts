import { cellCount, opposite, type Dir } from '../grid';
import type { AlgorithmMeta } from '../meta';
import { canMove, turnLeft, turnRight } from '../navigation';
import type { SolveStep } from '../steps';
import type { MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter, agentMove, loopErase, maxMovesParam, resolveMaxMoves, startWalk } from './shared';
import type { MazeSolver, SolveResult } from './types';

export type Hand = 'left' | 'right';

export interface WallFollowerParams extends Record<string, unknown> {
  readonly hand: Hand;
  readonly maxMoves: number;
}

export const HAND_PARAM = {
  key: 'hand',
  label: 'Hand on the wall',
  description: 'Which hand stays on the wall while walking.',
  kind: 'enum',
  options: [
    { value: 'right', label: 'Right hand' },
    { value: 'left', label: 'Left hand' },
  ],
  default: 'right',
} as const;

export const wallFollowerMeta: AlgorithmMeta = {
  id: 'wall-follower',
  name: 'Wall Follower',
  family: 'solver',
  summary:
    'Keep one hand on the wall and walk. Needs no map and no memory beyond the heading. Finds ' +
    'the goal in any simply connected maze (every perfect maze), but circles forever around an ' +
    'island in a braided one.',
  complexity: { time: 'O(V) moves', space: 'O(1)' },
  tags: ['agent-perspective', 'simply-connected', 'heading'],
  params: [HAND_PARAM, maxMovesParam(8)],
  docsSlug: 'learn/wall-follower',
  since: CORE_VERSION,
};

/**
 * Candidate directions in priority order for a hand-on-wall walker facing `heading`:
 * the wall-side turn first, then straight on, then away from the wall, then back.
 */
export function handOrder(heading: Dir, hand: Hand): readonly Dir[] {
  const pose = { cell: 0, heading };
  const wallSide = hand === 'right' ? turnRight(pose).heading : turnLeft(pose).heading;
  const openSide = hand === 'right' ? turnLeft(pose).heading : turnRight(pose).heading;
  return [wallSide, heading, openSide, opposite(heading)];
}

/**
 * Teaches: topology. In a perfect maze every wall is connected to the outer boundary, so
 * following any wall traces the boundary of a single region and visits every cell: the walker
 * is guaranteed to reach the goal. Add one loop (an island) and the same rule can orbit it
 * forever, which is why the solver watches for a repeated (cell, heading) state and fails
 * instead of looping. The returned path is the walk with its back-and-forth detours erased.
 */
export const wallFollower: MazeSolver<WallFollowerParams> = {
  meta: wallFollowerMeta,
  *run(maze: MazeState, params?: Partial<WallFollowerParams>) {
    const { grid, start, goal } = maze;
    const total = cellCount(grid);
    const hand: Hand = params?.hand === 'left' ? 'left' : 'right';
    const maxMoves = resolveMaxMoves(params?.maxMoves, total, 8);

    const c = new StepCounter();
    // Start facing north; the hand rule immediately picks the first open side.
    const walk = startWalk(maze, { cell: start, heading: 0 });
    c.expanded++;
    c.discovered++;
    c.frontier(1);
    yield c.count({ t: 'expand', cell: start } satisfies SolveStep);

    const seenState = new Uint8Array(total * 4);
    let reason: 'goal' | 'loop' | 'stuck' | 'budget' = 'goal';

    while (walk.pose.cell !== goal) {
      const { cell, heading } = walk.pose;
      const key = cell * 4 + heading;
      if (seenState[key] === 1) {
        reason = 'loop';
        break;
      }
      seenState[key] = 1;
      if (walk.moves >= maxMoves) {
        reason = 'budget';
        break;
      }
      const dir = handOrder(heading, hand).find((d) => canMove(maze, cell, d));
      if (dir === undefined) {
        reason = 'stuck'; // isolated cell: no passage at all
        break;
      }
      yield* agentMove(c, maze, walk, dir);
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
