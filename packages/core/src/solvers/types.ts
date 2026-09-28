import type { CellId } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { SolveStats, SolveStep } from '../steps';
import type { MazeState } from '../walls';

export interface SolveResult {
  readonly path: CellId[] | null;
  readonly stats: SolveStats;
}

/**
 * A solver is a generator function over an immutable `MazeState`. Solvers never mutate walls;
 * they keep their own visited/distance arrays so many can run on one maze concurrently.
 */
export interface MazeSolver<P extends Record<string, unknown> = Record<string, never>> {
  readonly meta: AlgorithmMeta;
  run(maze: MazeState, params?: Partial<P>, rng?: Rng): Generator<SolveStep, SolveResult>;
}

/** Walks `parent` links back from `goal` to `start`. */
export function reconstructPath(parent: Int32Array, start: CellId, goal: CellId): CellId[] {
  const path: CellId[] = [];
  let cur = goal;
  while (cur !== -1) {
    path.push(cur);
    if (cur === start) break;
    cur = parent[cur] ?? -1;
  }
  path.reverse();
  return path;
}
