/**
 * Two solvers side by side on one maze (M3 "DFS or BFS?", WI-06d). Both run in lockstep: one
 * tick is one step of every solver still running, and one `StepPlayer` plays the ticks, so play,
 * step back, seek and breakpoints work exactly as in the single demos. Each tick folds into a
 * `SolveTracker` per lane, which its own canvas draws. The maze is braided (it has loops), so
 * the solvers can disagree about the path. Each lane may carry its own solver parameters (M7: A*'s
 * heuristic and weight), so two lanes can run the same solver tuned differently.
 */
import {
  SolveTracker,
  braid,
  createGrid,
  describePosition,
  createRng,
  generators,
  runToEnd,
  solutionLength,
  solvers,
  type MazeState,
  type SolveStep,
} from '@maze/core';
import { StepPlayer, type StepPlayerOptions } from '@maze/player';
import type { Breakpoint, BreakpointCatalogue } from './useBreakpointRun';

export interface PairDemoSetup {
  readonly generatorId: string;
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  /** Percent of dead ends braided away, which adds loops. */
  readonly braid: number;
  readonly solverIds: readonly [string, string];
  /** Solver parameters per lane; a lane left out runs with its solver's defaults. */
  readonly solverParams?: readonly LaneParams[];
}

export type LaneParams = Readonly<Record<string, unknown>>;

/** Solvers that can lower a cost already queued (and so emit `relax`). */
const RELAXING = new Set(['astar', 'dijkstra']);

/** One lockstep tick: the step each lane took, or null for a lane that has finished. */
export interface PairTick {
  readonly steps: readonly (SolveStep | null)[];
}

export function pairDemoMaze(setup: PairDemoSetup): MazeState {
  const perfect = runToEnd(
    generators
      .require(setup.generatorId)
      .run(createGrid(setup.width, setup.height), createRng(setup.seed), {}),
  );
  return runToEnd(braid.run(perfect, createRng(`${setup.seed}/braid`), { percent: setup.braid }));
}

/** The solvers in lockstep, until every one has finished. */
export function* pairRun(
  maze: MazeState,
  solverIds: readonly string[],
  params: readonly LaneParams[] = [],
): Generator<PairTick, null> {
  const runs = solverIds.map((id, i) => solvers.require(id).run(maze, params[i] ?? {}));
  const done = runs.map(() => false);
  for (;;) {
    const steps = runs.map((run, i) => {
      if (done[i]) return null;
      const next = run.next();
      if (next.done) {
        done[i] = true;
        return null;
      }
      return next.value;
    });
    if (steps.every((s) => s === null)) return null;
    yield { steps };
  }
}

/**
 * "A* Search" with the defaults; a tuned lane says what differs ("A* Search, heuristic weight 2",
 * "A* Search, heuristic euclidean"), so two lanes of one solver can be told apart.
 */
export function laneName(solverId: string, params: LaneParams = {}): string {
  const meta = solvers.get(solverId)?.meta;
  if (!meta) return solverId;
  const changed = meta.params.flatMap((p) => {
    const v = params[p.key];
    if (v === undefined || v === p.default) return [];
    const text =
      typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'
        ? String(v)
        : JSON.stringify(v);
    return [`${p.label.toLowerCase()} ${text}`];
  });
  return [meta.name, ...changed].join(', ');
}

export interface PairLane {
  readonly solverId: string;
  /** The parameters this lane runs with (empty: the solver's defaults). */
  readonly params: LaneParams;
  readonly name: string;
  readonly expanded: number;
  /** Costs lowered so far (`relax` steps: a cheaper way to a queued cell). */
  readonly relaxed: number;
  /** Moves on the path found, or null before one is found. */
  readonly pathMoves: number | null;
  readonly done: boolean;
}

export class PairDemoModel {
  readonly maze: MazeState;
  readonly solverIds: readonly string[];
  readonly solverParams: readonly LaneParams[];
  readonly player: StepPlayer<PairTick, null>;
  readonly trackers: readonly SolveTracker[];
  /** Moves on a shortest path, for comparing what each lane found. */
  readonly shortest: number | null;
  private readonly done: boolean[];
  private readonly relaxed: number[];
  private readonly redraws: (() => void)[];
  private lanesAt: { readonly at: number; readonly lanes: readonly PairLane[] } | null = null;

  constructor(
    setup: PairDemoSetup,
    opts: Pick<StepPlayerOptions<PairTick, null>, 'stepsPerSecond' | 'schedule' | 'now'> = {},
  ) {
    const maze = pairDemoMaze(setup);
    this.maze = maze;
    this.solverIds = setup.solverIds;
    this.solverParams = setup.solverIds.map((_, i) => setup.solverParams?.[i] ?? {});
    this.shortest = solutionLength(maze);
    this.trackers = this.solverIds.map(() => new SolveTracker(maze.grid));
    this.done = this.solverIds.map(() => false);
    this.relaxed = this.solverIds.map(() => 0);
    this.redraws = this.solverIds.map(() => () => undefined);
    this.player = new StepPlayer<PairTick, null>({
      source: () => pairRun(maze, this.solverIds, this.solverParams),
      ...opts,
    });
    this.player.onReset(() => {
      for (const t of this.trackers) t.reset();
      this.done.fill(false);
      this.relaxed.fill(0);
      this.redraw();
    });
    this.player.subscribe((batch) => {
      for (const tick of batch) {
        tick.steps.forEach((s, i) => {
          if (!s) return;
          this.trackers[i]?.apply(s);
          if (s.t === 'done') this.done[i] = true;
          if (s.t === 'relax') this.relaxed[i] = (this.relaxed[i] ?? 0) + 1;
        });
      }
      this.redraw();
    });
  }

  /** What one lane's canvas registers its redraw with. */
  renderSink(lane: number): { setRenderRequest(fn: () => void): void } {
    return {
      setRenderRequest: (fn) => {
        this.redraws[lane] = fn;
      },
    };
  }

  /** Each lane's progress; the same array until the player moves (so React can compare it). */
  lanes(): readonly PairLane[] {
    const at = this.player.getSnapshot().stepCount;
    if (this.lanesAt?.at === at) return this.lanesAt.lanes;
    const lanes = this.solverIds.map((solverId, i) => {
      const t = this.trackers[i];
      const path = t?.path ?? null;
      return {
        solverId,
        params: this.solverParams[i] ?? {},
        name: laneName(solverId, this.solverParams[i]),
        expanded: t?.expanded ?? 0,
        relaxed: this.relaxed[i] ?? 0,
        pathMoves: path ? Math.max(0, path.length - 1) : null,
        done: this.done[i] ?? false,
      };
    });
    this.lanesAt = { at, lanes };
    return lanes;
  }

  dispose(): void {
    this.player.dispose();
  }

  private redraw(): void {
    for (const r of this.redraws) r();
  }
}

/**
 * "Run until the next path is found": stops on the tick where either lane finds its path, and
 * says which one and how long it is. Pairs with a lane that can relax (A*, Dijkstra) also offer
 * "a cost is lowered" (M7: a weighted A* finds a cheaper way to a cell it has queued).
 */
export function pairBreakpointCatalogue(model: PairDemoModel): BreakpointCatalogue<PairTick> {
  const name = (i: number) => laneName(model.solverIds[i] ?? '', model.solverParams[i]);
  const grid = model.maze.grid;
  const relax = (): Breakpoint<PairTick> => ({
    predicate: (tick) => tick.steps.some((s) => s?.t === 'relax'),
    describe: (hit) => {
      if (!hit) return 'Ran to the end: no cost was lowered.';
      const lowered = hit.step.steps.flatMap((s, i) =>
        s?.t === 'relax'
          ? [
              `${name(i)} found a cheaper way to ${describePosition(grid, s.cell)}: its cost fell from ${String(s.oldG)} to ${String(s.newG)}`,
            ]
          : [],
      );
      return `Stopped at step ${String(hit.index)}: ${lowered.join(', and ')}.`;
    },
  });
  const make = (id: string): Breakpoint<PairTick> =>
    id === 'relax'
      ? relax()
      : {
          predicate: (tick) => tick.steps.some((s) => s?.t === 'path'),
          describe: (hit) => {
            if (!hit) return 'Ran to the end: no other path was found.';
            const found = hit.step.steps.flatMap((s, i) =>
              s?.t === 'path'
                ? [`${name(i)} found a path of ${String(Math.max(0, s.cells.length - 1))} moves`]
                : [],
            );
            return `Stopped at step ${String(hit.index)}: ${found.join(', and ')}.`;
          },
        };
  const canRelax = model.solverIds.some((id) => RELAXING.has(id));
  return {
    choices: [
      { id: 'path', label: 'the next path is found' },
      ...(canRelax ? [{ id: 'relax', label: 'a cost is lowered' }] : []),
    ],
    needsCount: () => false,
    make,
  };
}
