import type { Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import type { MazeState } from '../walls';

/**
 * A maze generator is a generator function: it yields serialisable `GenStep`s and returns the
 * finished, frozen `MazeState`. Run it to completion in a Worker, step it in the UI, or drain
 * it in a test - same code path.
 */
export interface MazeGenerator<P extends Record<string, unknown> = Record<string, never>> {
  readonly meta: AlgorithmMeta;
  run(grid: Grid, rng: Rng, params?: Partial<P>): Generator<GenStep, MazeState>;
}
