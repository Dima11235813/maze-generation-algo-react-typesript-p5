/**
 * Race scheduler: several solvers on the same maze, advanced in lockstep (one step per agent
 * per tick), scored without any reference to wall-clock time so a race is exactly
 * reproducible from its configuration. Semantics: proj-mgmt/02 section 9.
 */
import { decodeDocument } from '../document';
import { dirBetween, type CellId } from '../grid';
import { solutionLength } from '../metrics';
import { createRng } from '../rng';
import { solvers } from '../solvers';
import type { MazeSolver, SolveResult } from '../solvers/types';
import type { SolveStep } from '../steps';
import { hasWall, type MazeState } from '../walls';
import type { Agent, RaceAgentResult, RaceConfig, RaceResult, RaceScoring, RaceTick } from './types';

export const MIN_AGENTS = 2;
export const MAX_AGENTS = 4;
export const DEFAULT_MAX_STEPS = 1_000_000;

export interface CreateAgentOptions {
  readonly id?: string;
  readonly budget?: Agent['budget'];
  readonly rngLabel?: string;
}

/** Looks a solver up in the registry and wraps it as a race agent. */
export function createAgent(
  solverId: string,
  params: Record<string, unknown> = {},
  opts: CreateAgentOptions = {},
): Agent {
  const solver = solvers.require(solverId) as MazeSolver<Record<string, unknown>>;
  const id = opts.id ?? solverId;
  return {
    id,
    solver,
    params,
    budget: opts.budget ?? { maxSteps: DEFAULT_MAX_STEPS },
    rngLabel: opts.rngLabel ?? id,
  };
}

export function validateRaceConfig(config: RaceConfig): void {
  const n = config.agents.length;
  if (n < MIN_AGENTS || n > MAX_AGENTS) {
    throw new RangeError(`A race needs ${MIN_AGENTS}..${MAX_AGENTS} agents, got ${n}`);
  }
  const ids = new Set<string>();
  for (const a of config.agents) {
    if (ids.has(a.id)) throw new RangeError(`Duplicate agent id '${a.id}'`);
    ids.add(a.id);
    if (!(a.budget.maxSteps > 0)) throw new RangeError(`Agent '${a.id}' has a non-positive budget`);
  }
  if (config.lockstep !== true) throw new RangeError('Only lockstep races are supported');
}

export interface RunRaceOptions {
  readonly onTick?: (tick: RaceTick) => void;
}

interface Runner {
  readonly agent: Agent;
  readonly gen: Generator<SolveStep, SolveResult>;
  finished: boolean;
  steps: number;
  expanded: number;
  discovered: number;
  frontierPeak: number;
  result: RaceAgentResult | null;
}

function isValidPath(state: MazeState, path: readonly CellId[]): boolean {
  if (path[0] !== state.start || path[path.length - 1] !== state.goal) return false;
  for (let i = 0; i + 1 < path.length; i++) {
    const d = dirBetween(state.grid, path[i] as CellId, path[i + 1] as CellId);
    if (d === undefined || hasWall(state.walls, path[i] as CellId, d)) return false;
  }
  return true;
}

function partialResult(r: Runner, tick: number, disqualified: string): RaceAgentResult {
  return {
    expanded: r.expanded,
    discovered: r.discovered,
    frontierPeak: r.frontierPeak,
    pathLength: null,
    optimal: null,
    steps: r.steps,
    finishedAtTick: tick,
    reachedGoal: false,
    disqualified,
  };
}

/**
 * Runs a race. Yields one `RaceTick` per tick (also passed to `onTick`) and returns the
 * `RaceResult`. Every unfinished agent advances exactly one step per tick, in agent order.
 *
 * An agent finishes on its `done` step (its generator's return value is read at once so the
 * finish tick is the tick of the `done` step). It is disqualified, with the reason recorded,
 * when it exceeds `budget.maxSteps`, yields a `move` through a wall, returns a path that does
 * not walk from start to goal through open passages, or throws.
 */
export function* runRace(
  config: RaceConfig,
  options: RunRaceOptions = {},
): Generator<RaceTick, RaceResult> {
  validateRaceConfig(config);
  const state = decodeDocument(config.document);
  const seed = config.seed ?? config.document.provenance?.seed ?? 'race';
  const base = createRng(seed);

  const runners: Runner[] = config.agents.map((agent) => ({
    agent,
    gen: agent.solver.run(state, agent.params, base.fork(agent.rngLabel)),
    finished: false,
    steps: 0,
    expanded: 0,
    discovered: 0,
    frontierPeak: 1,
    result: null,
  }));

  let tick = 0;
  while (runners.some((r) => !r.finished)) {
    tick++;
    const entries: Array<SolveStep | null> = [];
    for (const r of runners) {
      if (r.finished) {
        entries.push(null);
        continue;
      }
      if (r.steps >= r.agent.budget.maxSteps) {
        r.finished = true;
        r.result = partialResult(r, tick, 'budget');
        entries.push(null);
        continue;
      }
      let next: IteratorResult<SolveStep, SolveResult>;
      try {
        next = r.gen.next();
      } catch (err) {
        r.finished = true;
        r.result = partialResult(r, tick, `error: ${err instanceof Error ? err.message : String(err)}`);
        entries.push(null);
        continue;
      }
      if (next.done) {
        // Defensive: a generator that returns without a `done` step.
        r.finished = true;
        r.result = finishFrom(next.value, state, tick);
        entries.push(null);
        continue;
      }
      const step = next.value;
      r.steps++;
      if (step.t === 'expand') r.expanded++;
      if (step.t === 'discover') r.discovered++;
      entries.push(step);

      if (step.t === 'move') {
        const d = dirBetween(state.grid, step.from, step.to);
        if (d === undefined || hasWall(state.walls, step.from, d)) {
          r.finished = true;
          r.result = partialResult(r, tick, 'illegal-move');
          continue;
        }
      }
      if (step.t === 'done') {
        const ret = r.gen.next();
        r.finished = true;
        r.result = ret.done
          ? finishFrom(ret.value, state, tick)
          : partialResult(r, tick, 'error: solver kept yielding after done');
      }
    }
    const raceTick: RaceTick = { tick, steps: entries };
    options.onTick?.(raceTick);
    yield raceTick;
  }

  const perAgent: Record<string, RaceAgentResult> = {};
  for (const r of runners) perAgent[r.agent.id] = r.result as RaceAgentResult;
  const ranking = raceRanking(perAgent, config.scoring, { solutionLength: solutionLength(state) });
  return { config, ranking, perAgent, ticks: tick };
}

function finishFrom(value: SolveResult, state: MazeState, tick: number): RaceAgentResult {
  const stats = value.stats;
  if (value.path && !isValidPath(state, value.path)) {
    return { ...stats, finishedAtTick: tick, reachedGoal: false, disqualified: 'invalid-path' };
  }
  return { ...stats, finishedAtTick: tick, reachedGoal: value.path !== null };
}

export interface RankingReference {
  /** Shortest possible path length; used for the composite optimality term. */
  readonly solutionLength: number | null;
}

/**
 * Orders agent ids best first. Finishers that reached the goal come first (ordered by the
 * scoring rule), then agents that finished without a path (by finish tick), then disqualified
 * agents (by id). Every rule ends with the lexical id so rankings are total and reproducible.
 */
export function raceRanking(
  perAgent: Readonly<Record<string, RaceAgentResult>>,
  scoring: RaceScoring,
  reference: RankingReference = { solutionLength: null },
): string[] {
  const ids = Object.keys(perAgent);
  const winners = ids.filter((id) => perAgent[id]!.reachedGoal && !perAgent[id]!.disqualified);
  const failed = ids.filter((id) => !perAgent[id]!.reachedGoal && !perAgent[id]!.disqualified);
  const disqualified = ids.filter((id) => perAgent[id]!.disqualified);

  const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const cmp = (...keys: Array<(id: string) => number>) => (a: string, b: string): number => {
    for (const k of keys) {
      const d = k(a) - k(b);
      if (d !== 0) return d;
    }
    return byId(a, b);
  };
  const tickOf = (id: string): number => perAgent[id]!.finishedAtTick ?? Number.POSITIVE_INFINITY;
  const expandedOf = (id: string): number => perAgent[id]!.expanded;
  const lengthOf = (id: string): number => perAgent[id]!.pathLength ?? Number.POSITIVE_INFINITY;

  let orderedWinners: string[];
  switch (scoring) {
    case 'fewest-expanded':
      orderedWinners = [...winners].sort(cmp(expandedOf, tickOf, lengthOf));
      break;
    case 'composite': {
      const scores = compositeScores(perAgent, winners, reference);
      orderedWinners = [...winners].sort(cmp((id) => scores[id] ?? 0));
      break;
    }
    case 'first-to-goal':
    default:
      orderedWinners = [...winners].sort(cmp(tickOf, expandedOf, lengthOf));
  }
  return [
    ...orderedWinners,
    ...[...failed].sort(cmp(tickOf, expandedOf)),
    ...[...disqualified].sort(byId),
  ];
}

/**
 * Composite score (lower is better):
 * `0.5 * tick / bestTick + 0.3 * expanded / bestExpanded + 0.2 * (optimalityRatio - 1)`
 * where `bestX` is the smallest value among finishers and `optimalityRatio` is the agent's path
 * length divided by the shortest solution (or by the shortest finisher path when unknown).
 */
export function compositeScores(
  perAgent: Readonly<Record<string, RaceAgentResult>>,
  ids: readonly string[],
  reference: RankingReference,
): Record<string, number> {
  const scores: Record<string, number> = {};
  if (ids.length === 0) return scores;
  const bestTick = Math.max(1, Math.min(...ids.map((id) => perAgent[id]!.finishedAtTick ?? 1)));
  const bestExpanded = Math.max(1, Math.min(...ids.map((id) => perAgent[id]!.expanded)));
  const bestLength =
    reference.solutionLength ?? Math.min(...ids.map((id) => perAgent[id]!.pathLength ?? 0));
  for (const id of ids) {
    const r = perAgent[id]!;
    const ratio = bestLength > 0 && r.pathLength !== null ? r.pathLength / bestLength : 1;
    scores[id] =
      0.5 * ((r.finishedAtTick ?? bestTick) / bestTick) +
      0.3 * (r.expanded / bestExpanded) +
      0.2 * (ratio - 1);
  }
  return scores;
}
