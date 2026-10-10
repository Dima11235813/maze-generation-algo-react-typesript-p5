/**
 * RaceRun: the web side of a race. Builds the seeded maze, wraps `runRace` in a `StepPlayer`
 * (one player step = one lockstep tick, so play, pause, step back, restart and scrubbing come
 * from the player) and folds every tick into one `SolveTracker` per lane for the renderers.
 *
 * Everything a race shows is a function of its `RaceSetup`, which is what the `/race` URL
 * carries; the same URL always produces the same maze, the same ticks and the same ranking.
 */
import {
  MAX_AGENTS,
  MIN_AGENTS,
  SolveTracker,
  createAgent,
  createGrid,
  createRng,
  encodeDocumentSync,
  generators,
  runRace,
  runToEnd,
  solutionLength,
  solvers,
  type MazeDocument,
  type MazeState,
  type RaceConfig,
  type RaceResult,
  type RaceScoring,
  type RaceTick,
} from '@maze/core';
import { StepPlayer, type StepPlayerOptions } from '@maze/player';
import { paramsFor, type ParamValues } from './algoParams';

export const RACE_SCORINGS: readonly RaceScoring[] = [
  'first-to-goal',
  'fewest-expanded',
  'composite',
];

export const SCORING_LABELS: Record<RaceScoring, string> = {
  'first-to-goal': 'First to goal',
  'fewest-expanded': 'Fewest cells expanded',
  composite: 'Composite (speed, effort, path)',
};

export const RACE_SIZE_DEFAULT = 20;
export const RACE_SIZE_MIN = 5;
export const RACE_SIZE_MAX = 60;

export interface RaceSetup {
  readonly seed: string;
  readonly generatorId: string;
  /** Solver ids, 2-4, unique; they double as agent ids. */
  readonly agents: readonly string[];
  readonly scoring: RaceScoring;
  /** The maze is `size` x `size` cells, so the URL alone fixes the race. */
  readonly size: number;
  /**
   * Parameters per algorithm id (`prefs.algoParams`), clamped per algorithm when used. Not in
   * the URL: a shared link reproduces the race with each recipient's own parameters.
   */
  readonly params?: Readonly<Record<string, ParamValues>>;
}

/** Parses `agents=bfs,astar`: known solver ids, unique, at most four; tops up to two. */
export function parseAgents(raw: string | undefined, known: readonly string[]): string[] {
  const ids: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const id = part.trim();
    if (id && known.includes(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === MAX_AGENTS) break;
  }
  for (const id of ['bfs', 'astar', ...known]) {
    if (ids.length >= MIN_AGENTS) break;
    if (known.includes(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseScoring(raw: string | undefined): RaceScoring {
  return RACE_SCORINGS.find((s) => s === raw) ?? 'first-to-goal';
}

export function parseSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return RACE_SIZE_DEFAULT;
  return Math.min(RACE_SIZE_MAX, Math.max(RACE_SIZE_MIN, n));
}

/** Generates the race maze synchronously from the setup (seeded, so always identical). */
export function buildRaceMaze(setup: Pick<RaceSetup, 'seed' | 'generatorId' | 'size' | 'params'>): {
  state: MazeState;
  document: MazeDocument;
} {
  const generator = generators.require(setup.generatorId);
  const params = paramsFor(setup.params ?? {}, generator.meta);
  const state = runToEnd(
    generator.run(createGrid(setup.size, setup.size), createRng(setup.seed), params),
  );
  const document: MazeDocument = {
    id: '',
    ...encodeDocumentSync(state, {
      provenance: { algorithm: setup.generatorId, seed: setup.seed, params },
    }),
  };
  return { state, document };
}

export function raceConfig(setup: RaceSetup, document: MazeDocument): RaceConfig {
  return {
    document,
    agents: setup.agents.map((id) =>
      createAgent(id, paramsFor(setup.params ?? {}, solvers.require(id).meta)),
    ),
    lockstep: true,
    scoring: setup.scoring,
    seed: setup.seed,
  };
}

/** Runs a whole race synchronously; used by tests and as the reference for the UI. */
export function runRaceToEnd(setup: RaceSetup): RaceResult {
  const { document } = buildRaceMaze(setup);
  return runToEnd(runRace(raceConfig(setup, document)));
}

export type LaneStatus = 'running' | 'goal' | 'no-path' | 'out';

export interface LaneStanding {
  readonly index: number;
  readonly agentId: string;
  readonly name: string;
  readonly status: LaneStatus;
  readonly steps: number;
  readonly expanded: number;
  readonly discovered: number;
  /** Moves on the found path, once the agent has one. */
  readonly pathLength: number | null;
  /** Tick on which the agent finished (or was stopped). */
  readonly finishedAtTick: number | null;
}

/** Restarts the race when any parameter that affects it changes. */
export function raceParamsKey(setup: RaceSetup): string {
  const stored = setup.params ?? {};
  const gen = generators.get(setup.generatorId);
  const parts = [gen ? paramsFor(stored, gen.meta) : {}];
  for (const id of setup.agents) {
    const s = solvers.get(id);
    parts.push(s ? paramsFor(stored, s.meta) : {});
  }
  return JSON.stringify(parts);
}

export function solverName(id: string): string {
  return solvers.get(id)?.meta.name ?? id;
}

export type RaceRunOptions = Pick<
  StepPlayerOptions<RaceTick, RaceResult>,
  'stepsPerSecond' | 'now' | 'schedule'
>;

export class RaceRun {
  readonly setup: RaceSetup;
  readonly state: MazeState;
  readonly document: MazeDocument;
  readonly player: StepPlayer<RaceTick, RaceResult>;
  readonly trackers: readonly SolveTracker[];
  /** Shortest possible path; agents whose path matches it are optimal. */
  readonly solutionLength: number | null;

  private readonly finishedAt: Array<number | null>;
  private readonly out: boolean[];
  private readonly renderRequests: Array<() => void>;
  /** Stable per lane so the canvas effect that registers its redraw runs once. */
  private readonly sinks: ReadonlyArray<{ setRenderRequest(fn: () => void): void }>;
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(setup: RaceSetup, opts: RaceRunOptions = {}) {
    this.setup = setup;
    const { state, document } = buildRaceMaze(setup);
    this.state = state;
    this.document = document;
    this.solutionLength = solutionLength(state);
    const n = setup.agents.length;
    this.trackers = setup.agents.map(() => new SolveTracker(state.grid));
    this.finishedAt = new Array<number | null>(n).fill(null);
    this.out = new Array<boolean>(n).fill(false);
    this.renderRequests = setup.agents.map(() => () => undefined);
    this.sinks = setup.agents.map((_, i) => ({
      setRenderRequest: (fn: () => void) => {
        this.renderRequests[i] = fn;
      },
    }));

    const config = raceConfig(setup, document);
    this.player = new StepPlayer<RaceTick, RaceResult>({
      source: () => runRace(config),
      // A tick is one step per agent; the per-frame cap keeps "run to end" responsive.
      maxStepsPerFrame: 20_000,
      ...opts,
    });
    this.player.subscribe((batch) => {
      for (const tick of batch) this.apply(tick);
      this.renderAll();
      this.emit();
    });
    this.player.onReset(() => {
      for (const t of this.trackers) t.reset();
      this.finishedAt.fill(null);
      this.out.fill(false);
      this.renderAll();
      this.emit();
    });
    this.player.onChange(() => {
      this.emit();
    });
  }

  /** The `MazeCanvas` hook for lane `index` (the canvas calls it with its redraw function). */
  renderSink(index: number): { setRenderRequest(fn: () => void): void } {
    return this.sinks[index] ?? { setRenderRequest: () => undefined };
  }

  /** Re-renders on any change in standings; the number only ever grows. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  get result(): RaceResult | undefined {
    return this.player.getResult();
  }

  standings(): LaneStanding[] {
    return this.setup.agents.map((agentId, index) => {
      const t = this.trackers[index] as SolveTracker;
      const status: LaneStatus = this.out[index]
        ? 'out'
        : t.done
          ? t.path
            ? 'goal'
            : 'no-path'
          : 'running';
      return {
        index,
        agentId,
        name: solverName(agentId),
        status,
        steps: t.steps,
        expanded: t.expanded,
        discovered: t.discovered,
        pathLength: t.path ? t.path.length - 1 : null,
        finishedAtTick: this.finishedAt[index] ?? null,
      };
    });
  }

  dispose(): void {
    this.player.dispose();
    this.listeners.clear();
  }

  private apply(tick: RaceTick): void {
    tick.steps.forEach((step, i) => {
      const tracker = this.trackers[i];
      if (!tracker || this.finishedAt[i] !== null) return;
      if (step === null) {
        // Stopped without a `done` step: over budget, an illegal move or an error.
        this.out[i] = true;
        this.finishedAt[i] = tick.tick;
        return;
      }
      tracker.apply(step);
      if (step.t === 'done') this.finishedAt[i] = tick.tick;
    });
  }

  private renderAll(): void {
    for (const r of this.renderRequests) r();
  }

  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }
}
