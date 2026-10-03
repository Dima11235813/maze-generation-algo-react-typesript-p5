import { Dir, cellCount, type Dir as DirT } from '../grid';
import type { AlgorithmMeta } from '../meta';
import { canMove } from '../navigation';
import type { SolveStep } from '../steps';
import type { MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import {
  StepCounter,
  agentMove,
  loopErase,
  maxMovesParam,
  resolveMaxMoves,
  startWalk,
} from './shared';
import type { MazeSolver, SolveResult } from './types';
import { HAND_PARAM, handOrder, type Hand } from './wallFollower';

export interface PledgeParams extends Record<string, unknown> {
  readonly preferred: 'N' | 'E' | 'S' | 'W';
  readonly hand: Hand;
  readonly maxMoves: number;
}

const PREFERRED: Readonly<Record<PledgeParams['preferred'], DirT>> = {
  N: Dir.N,
  E: Dir.E,
  S: Dir.S,
  W: Dir.W,
};

export const pledgeMeta: AlgorithmMeta = {
  id: 'pledge',
  name: "Pledge's Algorithm",
  family: 'solver',
  summary:
    'Walk in a preferred direction; when blocked, follow the wall while counting quarter turns ' +
    'and let go of the wall once the count returns to zero. The counter is what lets it get ' +
    'off islands that trap a plain wall follower.',
  complexity: { time: 'O(V) moves', space: 'O(1)' },
  tags: ['agent-perspective', 'heading', 'counter'],
  params: [
    {
      key: 'preferred',
      label: 'Preferred direction',
      kind: 'enum',
      options: [
        { value: 'N', label: 'North' },
        { value: 'E', label: 'East' },
        { value: 'S', label: 'South' },
        { value: 'W', label: 'West' },
      ],
      default: 'S',
    },
    HAND_PARAM,
    maxMovesParam(20),
  ],
  docsSlug: 'learn/pledge',
  since: CORE_VERSION,
};

/** Signed quarter turns from `from` to `to` (left -1, right +1, back +-2 depending on hand). */
export function quarterTurns(from: DirT, to: DirT, hand: Hand): number {
  const delta = (to - from + 4) & 3; // 0 straight, 1 right, 2 back, 3 left
  if (delta === 0) return 0;
  if (delta === 1) return 1;
  if (delta === 3) return -1;
  // A U-turn pivots toward the wall: clockwise (+2) with the left hand on the wall,
  // counter-clockwise (-2) with the right hand.
  return hand === 'left' ? 2 : -2;
}

/**
 * Teaches: invariant reasoning. Pledge's counter records the net rotation since the walker
 * grabbed the wall; leaving only when it is zero (facing the preferred direction again)
 * prevents the endless orbit around an island that defeats the plain wall follower, which
 * is why Pledge escapes any finite 2D maze to the outside. With the goal *inside* a bounded
 * maze the guarantee weakens, so the solver tracks (cell, heading, counter) states and fails
 * on repetition or when the move budget runs out.
 */
export const pledge: MazeSolver<PledgeParams> = {
  meta: pledgeMeta,
  *run(maze: MazeState, params?: Partial<PledgeParams>) {
    const { grid, start, goal } = maze;
    const total = cellCount(grid);
    const preferred = PREFERRED[params?.preferred ?? 'S'] ?? Dir.S;
    const hand: Hand = params?.hand === 'left' ? 'left' : 'right';
    const maxMoves = resolveMaxMoves(params?.maxMoves, total, 20);

    const c = new StepCounter();
    const walk = startWalk(maze, { cell: start, heading: preferred });
    c.expanded++;
    c.discovered++;
    c.frontier(1);
    yield c.count({ t: 'expand', cell: start } satisfies SolveStep);

    let counter = 0;
    const seenState = new Set<string>();
    let reason: 'goal' | 'loop' | 'stuck' | 'budget' = 'goal';

    while (walk.pose.cell !== goal) {
      if (walk.moves >= maxMoves) {
        reason = 'budget';
        break;
      }
      const { cell, heading } = walk.pose;
      const key = `${cell}:${heading}:${counter}`;
      if (seenState.has(key)) {
        reason = 'loop';
        break;
      }
      seenState.add(key);

      let next: DirT | undefined;
      if (counter === 0 && canMove(maze, cell, preferred)) {
        next = preferred; // free walking in the preferred direction
      } else {
        next = handOrder(heading, hand).find((d) => canMove(maze, cell, d));
        if (next !== undefined) counter += quarterTurns(heading, next, hand);
      }
      if (next === undefined) {
        reason = 'stuck';
        break;
      }
      yield* agentMove(c, maze, walk, next);
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
