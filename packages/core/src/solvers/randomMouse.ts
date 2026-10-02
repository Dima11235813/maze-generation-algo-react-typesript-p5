import { DIRS, cellCount, opposite } from '../grid';
import type { AlgorithmMeta } from '../meta';
import { canMove } from '../navigation';
import { createRng, type Rng } from '../rng';
import type { SolveStep } from '../steps';
import type { MazeState } from '../walls';
import { CORE_VERSION } from '../version';
import { StepCounter, agentMove, loopErase, maxMovesParam, resolveMaxMoves, startWalk } from './shared';
import type { MazeSolver, SolveResult } from './types';

export interface RandomMouseParams extends Record<string, unknown> {
  readonly maxMoves: number;
  /** Avoid immediately turning back when another passage exists (the classic mouse). */
  readonly noBacktrack: boolean;
}

export const randomMouseMeta: AlgorithmMeta = {
  id: 'random-mouse',
  name: 'Random Mouse',
  family: 'solver',
  summary:
    'Wander at random, preferring not to turn straight back. No memory, no map. It gets there ' +
    'eventually on a finite maze but the expected time is awful; the baseline every other ' +
    'solver is measured against.',
  complexity: { time: 'expected O(V^2) moves, unbounded worst case', space: 'O(1)' },
  tags: ['agent-perspective', 'randomized', 'baseline'],
  params: [
    maxMovesParam(50),
    {
      key: 'noBacktrack',
      label: 'Avoid turning back',
      description: 'Only reverse at a dead end.',
      kind: 'bool',
      default: true,
    },
  ],
  docsSlug: 'learn/random-mouse',
  since: CORE_VERSION,
};

/**
 * Teaches: why memory matters. The mouse is complete only in expectation; in Race mode it
 * usually loses to anything that remembers where it has been. Randomness comes from the
 * injected `Rng` (forked per agent in a race), so every run is reproducible from its seed.
 */
export const randomMouse: MazeSolver<RandomMouseParams> = {
  meta: randomMouseMeta,
  *run(maze: MazeState, params?: Partial<RandomMouseParams>, rng?: Rng) {
    const { grid, start, goal } = maze;
    const total = cellCount(grid);
    const maxMoves = resolveMaxMoves(params?.maxMoves, total, 50);
    const noBacktrack = params?.noBacktrack !== false;
    const random = rng ?? createRng('random-mouse');

    const c = new StepCounter();
    const walk = startWalk(maze, { cell: start, heading: 0 });
    c.expanded++;
    c.discovered++;
    c.frontier(1);
    yield c.count({ t: 'expand', cell: start } satisfies SolveStep);

    let reason: 'goal' | 'stuck' | 'budget' = 'goal';
    let first = true;
    while (walk.pose.cell !== goal) {
      if (walk.moves >= maxMoves) {
        reason = 'budget';
        break;
      }
      const { cell, heading } = walk.pose;
      const open = DIRS.filter((d) => canMove(maze, cell, d));
      if (open.length === 0) {
        reason = 'stuck';
        break;
      }
      const back = opposite(heading);
      const choices =
        noBacktrack && !first && open.length > 1 ? open.filter((d) => d !== back) : open;
      first = false;
      yield* agentMove(c, maze, walk, random.pick(choices));
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
