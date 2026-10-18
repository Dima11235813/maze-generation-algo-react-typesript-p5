/**
 * Breakpoints for solver runs (proj-mgmt/13 section 4.1, 20-learn-mode WI-06c): "run until the
 * next dead end", "until it reaches the goal", "until the frontier holds more than N cells".
 * Each one is a predicate over steps for `StepPlayer.playUntil`, so it stops exactly on the
 * step that matches. A solver is offered the breakpoints that fire on a small probe run.
 */
import {
  braid,
  createGrid,
  createRng,
  describePosition,
  generators,
  runToEnd,
  solvers,
  type CellId,
  type Grid,
  type MazeState,
  type SolveStep,
} from '@maze/core';
import type { BreakHit } from '@maze/player';
import {
  solveOrigin,
  solveStructureFor,
  structureTitle,
  type SolveStructureTracker,
} from './solveStructure';
import type { Breakpoint, BreakpointCatalogue } from './useBreakpointRun';

export type SolveBreakpointId = 'deadend' | 'goal' | 'frontier' | 'path';

export interface SolveBreakpointChoice {
  readonly id: SolveBreakpointId;
  /** Completes "Run until ...". */
  readonly label: string;
}

export interface SolveBreakpointContext {
  readonly solverId: string;
  readonly maze: MazeState;
  /** The live structure, forked so the breakpoint can fold ahead on its own ("frontier > N"). */
  readonly tracker: SolveStructureTracker | null;
  /** N for "the frontier holds more than N cells". */
  readonly count: number;
}

type SolveBreakpoint = Breakpoint<SolveStep>;

/** The cell the run is heading for: the goal, or the start for solvers that flood from the goal. */
function targetOf(solverId: string, maze: MazeState): CellId {
  return solveOrigin(solverId) === 'goal' ? maze.start : maze.goal;
}

function targetName(solverId: string): string {
  return solveOrigin(solverId) === 'goal' ? 'start' : 'goal';
}

function frontierName(solverId: string): string {
  return structureTitle(solveStructureFor(solverId)).toLowerCase();
}

function reaches(step: SolveStep, target: CellId): boolean {
  return (step.t === 'expand' && step.cell === target) || (step.t === 'move' && step.to === target);
}

/** The stateless breakpoints (the frontier one needs the live structure). */
function stepMatcher(
  id: Exclude<SolveBreakpointId, 'frontier'>,
  target: CellId,
): (s: SolveStep) => boolean {
  switch (id) {
    case 'deadend':
      return (s) => s.t === 'deadend';
    case 'path':
      return (s) => s.t === 'path';
    case 'goal':
      return (s) => reaches(s, target);
  }
}

const ORDER: readonly SolveBreakpointId[] = ['deadend', 'goal', 'frontier', 'path'];

function labelOf(id: SolveBreakpointId, solverId: string): string {
  switch (id) {
    case 'deadend':
      return 'the next dead end';
    case 'goal':
      return `it reaches the ${targetName(solverId)}`;
    case 'frontier':
      return `the ${frontierName(solverId)} holds more than N cells`;
    case 'path':
      return 'the path is found';
  }
}

function maze(generatorId: string, seed: string): MazeState {
  return runToEnd(generators.require(generatorId).run(createGrid(9, 7), createRng(seed), {}));
}

let probes: readonly MazeState[] | null = null;

/** A perfect maze (dead ends) and a braided one (loops: some solvers only meet those). */
function probeMazes(): readonly MazeState[] {
  probes ??= [
    maze('recursive-backtracker', 'breakpoint-probe'),
    runToEnd(
      braid.run(maze('recursive-backtracker', 'breakpoint-loops'), createRng('braid'), {
        percent: 100,
      }),
    ),
  ];
  return probes;
}

const offered = new Map<string, readonly SolveBreakpointChoice[]>();

/** The breakpoints that fire for `solverId` on the probe mazes, in a fixed order. */
export function solveBreakpointsFor(solverId: string): readonly SolveBreakpointChoice[] {
  const known = offered.get(solverId);
  if (known) return known;
  const solver = solvers.get(solverId);
  const fires = new Set<SolveBreakpointId>();
  if (solver) {
    if (solveStructureFor(solverId) !== 'none') fires.add('frontier');
    for (const m of probeMazes()) {
      const tests = (['deadend', 'goal', 'path'] as const).map(
        (id) => [id, stepMatcher(id, targetOf(solverId, m))] as const,
      );
      for (const step of solver.run(m, {})) {
        for (const [id, test] of tests) if (test(step)) fires.add(id);
      }
    }
  }
  const choices = ORDER.filter((id) => fires.has(id)).map((id) => ({
    id,
    label: labelOf(id, solverId),
  }));
  offered.set(solverId, choices);
  return choices;
}

function hitText(step: SolveStep, grid: Grid, ctx: SolveBreakpointContext): string {
  switch (step.t) {
    case 'deadend':
      return `a dead end at ${describePosition(grid, step.cell)}`;
    case 'path':
      return `the path is found, ${String(Math.max(0, step.cells.length - 1))} moves long`;
    default:
      // Only the goal breakpoint stops on other steps (an expand or a move onto the target).
      return `it reached the ${targetName(ctx.solverId)} at ${describePosition(grid, targetOf(ctx.solverId, ctx.maze))}`;
  }
}

function missText(id: SolveBreakpointId, ctx: SolveBreakpointContext): string {
  switch (id) {
    case 'deadend':
      return 'there was no dead end left to find';
    case 'goal':
      return `it never reached the ${targetName(ctx.solverId)}`;
    case 'frontier':
      return `the ${frontierName(ctx.solverId)} never held more than ${String(ctx.count)} cells`;
    case 'path':
      return 'no path was found';
  }
}

/** A breakpoint ready for `playUntil`, starting from the player's current position. */
export function makeSolveBreakpoint(
  id: SolveBreakpointId,
  ctx: SolveBreakpointContext,
): SolveBreakpoint {
  const grid = ctx.maze.grid;
  const describe = (hit: BreakHit<SolveStep> | null, text?: string) =>
    hit
      ? `Stopped at step ${String(hit.index)}: ${text ?? hitText(hit.step, grid, ctx)}.`
      : `Ran to the end: ${missText(id, ctx)}.`;
  if (id === 'frontier') {
    const ahead = ctx.tracker?.fork() ?? null;
    let size = 0;
    return {
      predicate: (step) => {
        if (!ahead) return false;
        ahead.apply(step);
        size = ahead.frontierSize();
        return size > ctx.count;
      },
      describe: (hit) =>
        describe(hit, `the ${frontierName(ctx.solverId)} holds ${String(size)} cells`),
    };
  }
  const test = stepMatcher(id, targetOf(ctx.solverId, ctx.maze));
  return { predicate: (step) => test(step), describe: (hit) => describe(hit) };
}

const isSolveBreakpointId = (id: string): id is SolveBreakpointId =>
  (ORDER as readonly string[]).includes(id);

/** The breakpoints `solverId` offers on `maze`; `tracker` is read when a run starts. */
export function solveBreakpointCatalogue(
  solverId: string,
  maze: MazeState,
  tracker: () => SolveStructureTracker | null,
): BreakpointCatalogue<SolveStep> {
  return {
    choices: solveBreakpointsFor(solverId),
    needsCount: (id) => id === 'frontier',
    make: (id, count) =>
      makeSolveBreakpoint(isSolveBreakpointId(id) ? id : 'path', {
        solverId,
        maze,
        tracker: tracker(),
        count,
      }),
  };
}
