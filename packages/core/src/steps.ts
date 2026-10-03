/**
 * Steps: the serialisable event vocabulary emitted by generators and solvers.
 *
 * Every consumer (renderers, narrator, metrics, replay, tests) derives from steps, so a new
 * verb is a new union member here and every exhaustive `switch` fails to compile until it is
 * handled. Steps are plain JSON: numbers, arrays, string literals.
 */
import type { CellId, Dir } from './grid';

/**
 * Generator steps. Only two verbs change walls: `carve` removes the wall between two adjacent
 * cells and `seal` adds one. Every other verb is informational (what the algorithm is looking
 * at) so renderers, narrators and the replay helper stay simple.
 */
export type GenStep =
  | { readonly t: 'visit'; readonly cell: CellId }
  | { readonly t: 'carve'; readonly from: CellId; readonly to: CellId }
  /** Wall added between adjacent cells `a` and `b` (wall-adding algorithms, tree rotations). */
  | { readonly t: 'seal'; readonly a: CellId; readonly b: CellId }
  | { readonly t: 'backtrack'; readonly from: CellId; readonly to: CellId }
  | {
      readonly t: 'frontier';
      readonly add?: readonly CellId[];
      readonly remove?: readonly CellId[];
    }
  | { readonly t: 'union'; readonly a: CellId; readonly b: CellId }
  | { readonly t: 'walk'; readonly cell: CellId; readonly erased?: readonly CellId[] }
  | {
      readonly t: 'divide';
      readonly cells: readonly CellId[];
      readonly wallDir: Dir;
      readonly gap: CellId;
    }
  | { readonly t: 'rotate'; readonly oldRoot: CellId; readonly newRoot: CellId }
  | { readonly t: 'done' };

export interface SolveStats {
  /** Nodes popped / visited. */
  expanded: number;
  /** Nodes pushed. */
  discovered: number;
  /** Max size of the stack/queue/heap. */
  frontierPeak: number;
  /** Cells on the returned path minus 1; null if no path. */
  pathLength: number | null;
  /** Compared against BFS length by the harness; null when unknown. */
  optimal: boolean | null;
  /** Total steps yielded. */
  steps: number;
}

export type SolveStep =
  | {
      readonly t: 'expand';
      readonly cell: CellId;
      readonly g?: number;
      readonly f?: number;
      readonly h?: number;
    }
  | {
      readonly t: 'discover';
      readonly cell: CellId;
      readonly from: CellId;
      readonly g?: number;
      readonly f?: number;
    }
  | {
      readonly t: 'relax';
      readonly cell: CellId;
      readonly from: CellId;
      readonly oldG: number;
      readonly newG: number;
    }
  | { readonly t: 'deadend'; readonly cell: CellId }
  | { readonly t: 'mark'; readonly cell: CellId; readonly dir: Dir; readonly count: 1 | 2 }
  | { readonly t: 'move'; readonly from: CellId; readonly to: CellId; readonly heading?: Dir }
  | { readonly t: 'path'; readonly cells: readonly CellId[] }
  | { readonly t: 'fail' }
  | { readonly t: 'done'; readonly stats: SolveStats };

export type Step = GenStep | SolveStep;

export function assertNever(x: never, message = 'Unhandled step'): never {
  throw new Error(`${message}: ${JSON.stringify(x)}`);
}

/** Drains a step generator, collecting steps and returning the final value. */
export function collect<S, R>(gen: Generator<S, R>): { steps: S[]; result: R } {
  const steps: S[] = [];
  let next = gen.next();
  while (!next.done) {
    steps.push(next.value);
    next = gen.next();
  }
  return { steps, result: next.value };
}

/** Runs a generator to completion, discarding steps. */
export function runToEnd<S, R>(gen: Generator<S, R>): R {
  let next = gen.next();
  while (!next.done) next = gen.next();
  return next.value;
}
