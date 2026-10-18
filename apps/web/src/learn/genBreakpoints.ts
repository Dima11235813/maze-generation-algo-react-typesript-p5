/**
 * Breakpoints for generator runs (proj-mgmt/13 section 4.3, WI-06d): "run until the next
 * backtrack", "until the walk is stuck in a new dead end", "until the stack holds more than N
 * cells", "until the maze is complete". Like the solver ones they are step predicates for
 * `StepPlayer.playUntil`; a generator is offered the ones that fire on a small probe run.
 */
import {
  createGrid,
  createRng,
  describePosition,
  generators,
  type GenStep,
  type Grid,
} from '@maze/core';
import type { BreakHit } from '@maze/player';
import { genStructureFor, type GenStructureTracker } from './genStructure';
import type { Breakpoint, BreakpointCatalogue, BreakpointChoice } from './useBreakpointRun';

export type GenBreakpointId = 'backtrack' | 'deadend' | 'stack' | 'done';

const ORDER: readonly GenBreakpointId[] = ['backtrack', 'deadend', 'stack', 'done'];

const LABELS: Readonly<Record<GenBreakpointId, string>> = {
  backtrack: 'the next backtrack',
  deadend: 'the walk is stuck in a new dead end',
  stack: 'the stack holds more than N cells',
  done: 'the maze is complete',
};

export interface GenBreakpointContext {
  readonly grid: Grid;
  /** The live structure, forked so the breakpoint can fold ahead on its own. */
  readonly tracker: GenStructureTracker | null;
  /** N for "the stack holds more than N cells". */
  readonly count: number;
}

/**
 * A backtrack straight after a carve leaves a cell that was just entered and has no unvisited
 * neighbour: a leaf of the tree, so a dead end of the finished maze.
 */
function stuckMatcher(previous: GenStep | null): (s: GenStep) => boolean {
  let last = previous;
  return (s) => {
    if (s.t === 'visit') return false;
    const stuck = s.t === 'backtrack' && last?.t === 'carve';
    last = s;
    return stuck;
  };
}

const offered = new Map<string, readonly BreakpointChoice[]>();

/** The breakpoints that fire for `generatorId` on a 9 by 7 probe, in a fixed order. */
export function genBreakpointsFor(generatorId: string): readonly BreakpointChoice[] {
  const known = offered.get(generatorId);
  if (known) return known;
  const generator = generators.get(generatorId);
  const fires = new Set<GenBreakpointId>();
  if (generator) {
    const stack = genStructureFor(generatorId) === 'stack';
    if (stack) fires.add('stack');
    const stuck = stuckMatcher(null);
    for (const s of generator.run(createGrid(9, 7), createRng('breakpoint-probe'), {})) {
      if (s.t === 'backtrack') fires.add('backtrack');
      if (s.t === 'done') fires.add('done');
      // "Stuck" reads the path stack's story; other generators' backtracks mean other things.
      if (stack && stuck(s)) fires.add('deadend');
    }
  }
  const choices = ORDER.filter((id) => fires.has(id)).map((id) => ({ id, label: LABELS[id] }));
  offered.set(generatorId, choices);
  return choices;
}

function at(grid: Grid, cell: number): string {
  return describePosition(grid, cell);
}

/** A breakpoint ready for `playUntil`, starting from the player's current position. */
export function makeGenBreakpoint(
  id: GenBreakpointId,
  ctx: GenBreakpointContext,
): Breakpoint<GenStep> {
  const { grid } = ctx;
  const ahead = ctx.tracker?.fork() ?? null;
  const stuck = stuckMatcher(ahead?.lastMove() ?? null);
  /** Folds every tested step, so the stack size is known on the step that stops. */
  const fold = (s: GenStep): number => {
    ahead?.apply(s);
    return ahead?.stackSize() ?? 0;
  };
  const stopped = (hit: BreakHit<GenStep>, text: string) =>
    `Stopped at step ${String(hit.index)}: ${text}.`;
  switch (id) {
    case 'backtrack':
      return {
        predicate: (s) => {
          fold(s);
          return s.t === 'backtrack';
        },
        describe: (hit) =>
          hit?.step.t === 'backtrack'
            ? stopped(
                hit,
                `it backs up from ${at(grid, hit.step.from)} to ${at(grid, hit.step.to)}, ${String(ahead?.stackSize() ?? 0)} cells left on the stack`,
              )
            : 'Ran to the end: there was no backtrack left.',
      };
    case 'deadend':
      return {
        predicate: (s) => {
          fold(s);
          return stuck(s);
        },
        describe: (hit) =>
          hit?.step.t === 'backtrack'
            ? stopped(
                hit,
                `stuck at ${at(grid, hit.step.from)}, a new dead end, so it backs up to ${at(grid, hit.step.to)}`,
              )
            : 'Ran to the end: the walk was never stuck again.',
      };
    case 'stack': {
      let size = 0;
      return {
        predicate: (s) => {
          size = fold(s);
          return size > ctx.count;
        },
        describe: (hit) =>
          hit
            ? stopped(hit, `the stack holds ${String(size)} cells`)
            : `Ran to the end: the stack never held more than ${String(ctx.count)} cells.`,
      };
    }
    case 'done':
      return {
        predicate: (s) => s.t === 'done',
        describe: (hit) =>
          hit ? stopped(hit, 'the maze is complete') : 'Ran to the end: the maze is complete.',
      };
  }
}

const isGenBreakpointId = (id: string): id is GenBreakpointId =>
  (ORDER as readonly string[]).includes(id);

/** The breakpoints `generatorId` offers; `tracker` is read when a run starts. */
export function genBreakpointCatalogue(
  generatorId: string,
  grid: Grid,
  tracker: () => GenStructureTracker | null,
): BreakpointCatalogue<GenStep> {
  return {
    choices: genBreakpointsFor(generatorId),
    needsCount: (id) => id === 'stack',
    make: (id, count) =>
      makeGenBreakpoint(isGenBreakpointId(id) ? id : 'done', {
        grid,
        tracker: tracker(),
        count,
      }),
  };
}
