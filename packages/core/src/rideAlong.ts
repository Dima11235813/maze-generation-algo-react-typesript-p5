/**
 * Ride along: a first-person pose that follows a solver, derived from its steps alone (so a
 * rewind, which replays the steps, gives exactly the same pose).
 *
 * - Walking solvers (wall follower, Tremaux, Pledge, random mouse, flood-fill descent) yield
 *   `move` steps with a heading: the pose follows them at eye level.
 * - Search solvers (BFS, DFS, A*, ...) yield `expand` steps for cells that are often not next to
 *   the previous one. A step to an open neighbour is a walk; anything else is a glide, which the
 *   renderer draws above the walls so the camera never passes through one at eye level.
 */
import { DIRS, Dir, colOf, dirBetween, rowOf, type CellId, type Grid } from './grid';
import type { SolveStep } from './steps';
import { hasWall, type MazeState } from './walls';

export type RideMode = 'start' | 'walking' | 'searching';

export interface RidePose {
  readonly cell: CellId;
  readonly heading: Dir;
  /** Travelled over the walls to get here (non-adjacent jump or through a wall). */
  readonly glide: boolean;
  readonly mode: RideMode;
}

/** Direction of the larger axis from `from` towards `to` (ties prefer east/west). */
export function headingToward(grid: Grid, from: CellId, to: CellId): Dir {
  const dc = colOf(grid, to) - colOf(grid, from);
  const dr = rowOf(grid, to) - rowOf(grid, from);
  if (dc === 0 && dr === 0) return Dir.N;
  if (Math.abs(dc) >= Math.abs(dr)) return dc > 0 ? Dir.E : Dir.W;
  return dr > 0 ? Dir.S : Dir.N;
}

/** Standing at the start, facing the first open passage. */
export function startPose(state: MazeState): RidePose {
  const open = DIRS.find((d) => !hasWall(state.walls, state.start, d));
  return { cell: state.start, heading: open ?? Dir.N, glide: false, mode: 'start' };
}

export class RideAlongTracker {
  pose: RidePose;
  /** Steps applied since the last reset. */
  steps = 0;

  constructor(readonly state: MazeState) {
    this.pose = startPose(state);
  }

  apply(step: SolveStep): void {
    this.steps++;
    const { grid, walls } = this.state;
    const here = this.pose.cell;
    switch (step.t) {
      case 'move': {
        const heading =
          step.heading ??
          dirBetween(grid, step.from, step.to) ??
          headingToward(grid, step.from, step.to);
        this.pose = { cell: step.to, heading, glide: false, mode: 'walking' };
        return;
      }
      case 'expand':
      case 'deadend': {
        const cell = step.cell;
        if (cell === here) return;
        const d = dirBetween(grid, here, cell);
        const walkable = d !== undefined && !hasWall(walls, here, d);
        const mode: RideMode = this.pose.mode === 'walking' ? 'walking' : 'searching';
        this.pose = {
          cell,
          heading: walkable ? d : headingToward(grid, here, cell),
          glide: !walkable,
          mode: walkable && mode === 'walking' ? 'walking' : 'searching',
        };
        return;
      }
      default:
        return;
    }
  }

  applyAll(steps: Iterable<SolveStep>): void {
    for (const s of steps) this.apply(s);
  }

  reset(): void {
    this.pose = startPose(this.state);
    this.steps = 0;
  }
}

/** Poses for walking a path cell by cell, each facing the next cell (the last keeps its heading). */
export function pathPoses(grid: Grid, path: readonly CellId[]): RidePose[] {
  const out: RidePose[] = [];
  let heading: Dir = Dir.N;
  for (let i = 0; i < path.length; i++) {
    const cell = path[i] as CellId;
    const next = path[i + 1];
    if (next !== undefined)
      heading = dirBetween(grid, cell, next) ?? headingToward(grid, cell, next);
    out.push({ cell, heading, glide: false, mode: 'walking' });
  }
  return out;
}
