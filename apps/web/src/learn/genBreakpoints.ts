/**
 * Breakpoints for generator runs (proj-mgmt/13 section 4.3, WI-06d/e): "run until the next
 * backtrack", "until the walk is stuck in a new dead end", "until the stack (or Prim's frontier)
 * holds more than N cells", "until the next union", "until the next wall kept to avoid a loop",
 * "until N pieces are left", "until the maze is complete". Like the solver ones they are step
 * predicates for `StepPlayer.playUntil`; a generator is offered the ones that fire on a small
 * probe run.
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

const ORDER = [
  'backtrack',
  'deadend',
  'stack',
  'frontier',
  'union',
  'reject',
  'pieces',
  'erase',
  'carve',
  'remaining',
  'done',
] as const;

export type GenBreakpointId = (typeof ORDER)[number];

const LABELS: Readonly<Record<GenBreakpointId, string>> = {
  backtrack: 'the next backtrack',
  deadend: 'the walk is stuck in a new dead end',
  stack: 'the stack holds more than N cells',
  frontier: 'the frontier holds more than N cells',
  union: 'the next union',
  reject: 'the next wall kept to avoid a loop',
  pieces: 'N or fewer pieces are left',
  erase: 'the next loop is erased',
  carve: 'the tree grows by one cell',
  remaining: 'N or fewer cells are left outside the tree',
  done: 'the maze is complete',
};

/** The breakpoints that need N. */
const COUNTED: ReadonlySet<string> = new Set(['stack', 'frontier', 'pieces', 'remaining']);

export interface GenBreakpointContext {
  readonly grid: Grid;
  /** The live structure, forked so the breakpoint can fold ahead on its own. */
  readonly tracker: GenStructureTracker | null;
  /** N for the stack, the frontier or the pieces left. */
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
    const kind = genStructureFor(generatorId);
    const stack = kind === 'stack';
    if (stack) fires.add('stack');
    if (kind === 'frontier') fires.add('frontier');
    if (kind === 'sets') fires.add('pieces');
    const walk = kind === 'walk';
    if (walk) {
      fires.add('carve');
      fires.add('remaining');
    }
    const stuck = stuckMatcher(null);
    for (const s of generator.run(createGrid(9, 7), createRng('breakpoint-probe'), {})) {
      if (s.t === 'backtrack') fires.add('backtrack');
      if (s.t === 'union') fires.add('union');
      if (s.t === 'reject') fires.add('reject');
      if (s.t === 'walk' && (s.erased?.length ?? 0) > 0) fires.add('erase');
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
  /** A counted breakpoint: fold, read a size, test it; the message reports the size. */
  const counted = (
    read: (t: GenStructureTracker) => number,
    test: (n: number) => boolean,
    hitText: (n: number) => string,
    missText: string,
  ): Breakpoint<GenStep> => {
    let n = 0;
    return {
      predicate: (s) => {
        ahead?.apply(s);
        n = ahead ? read(ahead) : 0;
        return ahead !== null && test(n);
      },
      describe: (hit) => (hit ? stopped(hit, hitText(n)) : `Ran to the end: ${missText}.`),
    };
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
    case 'frontier':
      return counted(
        (t) => t.frontierSize(),
        (n) => n > ctx.count,
        (n) => `the frontier holds ${String(n)} cells`,
        `the frontier never held more than ${String(ctx.count)} cells`,
      );
    case 'pieces':
      return counted(
        (t) => t.pieces(),
        (n) => n <= ctx.count,
        (n) => `${String(n)} pieces are left`,
        `more than ${String(ctx.count)} pieces were always left`,
      );
    case 'remaining':
      return counted(
        (t) => t.remaining(),
        (n) => n <= ctx.count,
        (n) => `${String(n)} cells are left outside the tree`,
        `more than ${String(ctx.count)} cells were always left outside the tree`,
      );
    case 'erase':
      return {
        predicate: (s) => {
          fold(s);
          return s.t === 'walk' && (s.erased?.length ?? 0) > 0;
        },
        describe: (hit) =>
          hit?.step.t === 'walk'
            ? stopped(
                hit,
                `the walk came back to ${at(grid, hit.step.cell)}, so the loop of ${String(hit.step.erased?.length ?? 0)} cells after it is erased`,
              )
            : 'Ran to the end: no other loop was erased.',
      };
    case 'carve':
      return {
        predicate: (s) => {
          fold(s);
          return s.t === 'carve';
        },
        describe: (hit) =>
          hit?.step.t === 'carve'
            ? stopped(
                hit,
                `the passage from ${at(grid, hit.step.from)} to ${at(grid, hit.step.to)} is carved; ${String(ahead?.remaining() ?? 0)} cells left outside the tree`,
              )
            : 'Ran to the end: nothing else was carved.',
      };
    case 'union':
      return {
        predicate: (s) => {
          fold(s);
          return s.t === 'union';
        },
        describe: (hit) =>
          hit?.step.t === 'union'
            ? stopped(
                hit,
                `${at(grid, hit.step.a)} and ${at(grid, hit.step.b)} were in different pieces, so they are joined; ${String(ahead?.pieces() ?? 0)} pieces left`,
              )
            : 'Ran to the end: there was no union left.',
      };
    case 'reject':
      return {
        predicate: (s) => {
          fold(s);
          return s.t === 'reject';
        },
        describe: (hit) =>
          hit?.step.t === 'reject'
            ? stopped(
                hit,
                `the wall between ${at(grid, hit.step.a)} and ${at(grid, hit.step.b)} stays: they are already in one piece`,
              )
            : 'Ran to the end: no other wall was kept.',
      };
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
    needsCount: (id) => COUNTED.has(id),
    make: (id, count) =>
      makeGenBreakpoint(isGenBreakpointId(id) ? id : 'done', {
        grid,
        tracker: tracker(),
        count,
      }),
  };
}
