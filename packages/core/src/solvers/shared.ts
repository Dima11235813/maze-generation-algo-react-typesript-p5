/**
 * Helpers shared by the solver catalogue: heuristics, parameter descriptors, step/stat
 * bookkeeping and the agent-perspective walking primitive.
 */
import { colOf, neighbor, rowOf, type CellId, type Dir, type Grid } from '../grid';
import type { ParamDescriptor } from '../meta';
import type { Pose } from '../navigation';
import type { SolveStats, SolveStep } from '../steps';
import type { MazeState } from '../walls';

// ---------------------------------------------------------------------------------------
// Heuristics (A*, greedy best-first)
// ---------------------------------------------------------------------------------------

export type HeuristicId = 'manhattan' | 'euclidean' | 'chebyshev';

export const HEURISTIC_IDS: readonly HeuristicId[] = ['manhattan', 'euclidean', 'chebyshev'];

export const HEURISTIC_PARAM: ParamDescriptor = {
  key: 'heuristic',
  label: 'Heuristic',
  description:
    'Estimate of the remaining distance. Manhattan is exact for 4-connected grids; Euclidean ' +
    'and Chebyshev are looser (never over-estimate, so all three keep A* optimal).',
  kind: 'enum',
  options: [
    { value: 'manhattan', label: 'Manhattan (|dr| + |dc|)' },
    { value: 'euclidean', label: 'Euclidean (straight line)' },
    { value: 'chebyshev', label: 'Chebyshev (max(|dr|, |dc|))' },
  ],
  default: 'manhattan',
};

export function parseHeuristic(v: unknown): HeuristicId {
  return typeof v === 'string' && (HEURISTIC_IDS as readonly string[]).includes(v)
    ? (v as HeuristicId)
    : 'manhattan';
}

/** Returns `h(cell)`: the chosen distance estimate from `cell` to `goal`. */
export function heuristicFn(grid: Grid, goal: CellId, id: HeuristicId): (cell: CellId) => number {
  const gr = rowOf(grid, goal);
  const gc = colOf(grid, goal);
  switch (id) {
    case 'euclidean':
      return (c) => Math.hypot(rowOf(grid, c) - gr, colOf(grid, c) - gc);
    case 'chebyshev':
      return (c) => Math.max(Math.abs(rowOf(grid, c) - gr), Math.abs(colOf(grid, c) - gc));
    case 'manhattan':
    default:
      return (c) => Math.abs(rowOf(grid, c) - gr) + Math.abs(colOf(grid, c) - gc);
  }
}

// ---------------------------------------------------------------------------------------
// Budgets for agent-perspective solvers
// ---------------------------------------------------------------------------------------

/** `maxMoves` descriptor; 0 means "automatic" (cells x multiplier). */
export function maxMovesParam(multiplier: number): ParamDescriptor {
  return {
    key: 'maxMoves',
    label: 'Move budget',
    description: `Give up after this many moves. 0 = automatic (cells x ${multiplier}).`,
    kind: 'int',
    min: 0,
    max: 10_000_000,
    default: 0,
  };
}

export function resolveMaxMoves(raw: unknown, cells: number, multiplier: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
  return n > 0 ? n : Math.max(1, cells * multiplier);
}

// ---------------------------------------------------------------------------------------
// Step and statistics bookkeeping
// ---------------------------------------------------------------------------------------

/**
 * Counts yielded steps and search statistics so `stats.steps` always equals the number of
 * steps a consumer received (the shared test harness checks this for every solver).
 */
export class StepCounter {
  steps = 0;
  expanded = 0;
  discovered = 0;
  frontierPeak = 0;

  /** Wrap every yielded step: `yield c.count({ t: 'expand', cell })`. */
  count<S extends SolveStep>(step: S): S {
    this.steps++;
    return step;
  }

  frontier(size: number): void {
    if (size > this.frontierPeak) this.frontierPeak = size;
  }

  /** Final statistics; `+ 2` accounts for the trailing `path`/`fail` and `done` steps. */
  stats(pathLength: number | null, optimal: boolean | null): SolveStats {
    return {
      expanded: this.expanded,
      discovered: this.discovered,
      frontierPeak: this.frontierPeak,
      pathLength,
      optimal,
      steps: this.steps + 2,
    };
  }
}

/**
 * Removes every cycle from a walk (an agent's route with backtracking) leaving a simple path.
 * Whenever a cell is revisited the loop between the two visits is cut out.
 */
export function loopErase(walk: readonly CellId[]): CellId[] {
  const path: CellId[] = [];
  const indexOf = new Map<CellId, number>();
  for (const cell of walk) {
    const seenAt = indexOf.get(cell);
    if (seenAt !== undefined) {
      for (let i = path.length - 1; i > seenAt; i--) indexOf.delete(path[i] as CellId);
      path.length = seenAt + 1;
    } else {
      indexOf.set(cell, path.length);
      path.push(cell);
    }
  }
  return path;
}

/** Mutable state of an agent walking the maze from the inside. */
export interface AgentWalk {
  pose: Pose;
  /** Every cell visited, in order (start first). */
  readonly route: CellId[];
  /** 1 once a cell has been visited. */
  readonly seen: Uint8Array;
  moves: number;
}

export function startWalk(state: MazeState, pose: Pose): AgentWalk {
  const seen = new Uint8Array(state.grid.width * state.grid.height);
  seen[pose.cell] = 1;
  return { pose, route: [pose.cell], seen, moves: 0 };
}

/**
 * Moves the agent one cell in direction `dir` (the caller guarantees the passage is open),
 * yielding `move` then `expand` and updating the counters. Returns the new pose.
 */
export function* agentMove(
  c: StepCounter,
  state: MazeState,
  walk: AgentWalk,
  dir: Dir,
): Generator<SolveStep, Pose> {
  const from = walk.pose.cell;
  const to = neighbor(state.grid, from, dir);
  walk.pose = { cell: to, heading: dir };
  walk.route.push(to);
  walk.moves++;
  c.expanded++;
  if (walk.seen[to] === 0) {
    walk.seen[to] = 1;
    c.discovered++;
  }
  c.frontier(1);
  yield c.count({ t: 'move', from, to, heading: dir });
  yield c.count({ t: 'expand', cell: to });
  return walk.pose;
}
