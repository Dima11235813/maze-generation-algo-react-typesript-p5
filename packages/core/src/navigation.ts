/**
 * Cell-snapped first-person navigation (parity item P-17, redesigned).
 *
 * The legacy "Run Maze" mode moved the camera 10 px per key press and could clip through
 * walls. Here a pose is a cell plus a heading; moves are legal only through open passages.
 */
import { DIRS, NO_CELL, neighbor, opposite, type CellId, type Dir } from './grid';
import { hasWall, type MazeState } from './walls';

export interface Pose {
  readonly cell: CellId;
  readonly heading: Dir;
}

export const turnLeft = (p: Pose): Pose => ({ ...p, heading: ((p.heading + 3) & 3) as Dir });
export const turnRight = (p: Pose): Pose => ({ ...p, heading: ((p.heading + 1) & 3) as Dir });
export const turnAround = (p: Pose): Pose => ({ ...p, heading: opposite(p.heading) });

/** True when there is an open passage from `cell` in direction `dir`. */
export function canMove(state: MazeState, cell: CellId, dir: Dir): boolean {
  return !hasWall(state.walls, cell, dir) && neighbor(state.grid, cell, dir) !== NO_CELL;
}

/** Moves one cell along `dir` if the passage is open; otherwise returns the same pose. */
export function move(state: MazeState, p: Pose, dir: Dir): Pose {
  return canMove(state, p.cell, dir) ? { ...p, cell: neighbor(state.grid, p.cell, dir) } : p;
}

export const stepForward = (state: MazeState, p: Pose): Pose => move(state, p, p.heading);
export const stepBackward = (state: MazeState, p: Pose): Pose =>
  move(state, p, opposite(p.heading));

/** Start cell, facing the first open passage (legacy started at cell 0 facing "out"). */
export function initialPose(state: MazeState): Pose {
  const open = DIRS.find((d) => canMove(state, state.start, d));
  return { cell: state.start, heading: open ?? 1 };
}
