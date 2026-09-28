import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import type { MazeState } from '../walls';

/**
 * A post-processor transforms a finished maze into another maze (braiding, sparsifying, ...).
 * Like generators it is a generator function so the change can be animated: yield `carve`
 * for every wall it removes and `done` at the end, and return the new frozen state.
 * It must never mutate the input `MazeState`.
 */
export interface MazePostprocessor<P extends Record<string, unknown> = Record<string, never>> {
  readonly meta: AlgorithmMeta;
  run(maze: MazeState, rng: Rng, params?: Partial<P>): Generator<GenStep, MazeState>;
}
