/**
 * Replay: rebuild walls from a generator step stream.
 *
 * Only `carve` and `seal` change walls; every other verb is informational. Consumers that
 * mirror a generation live (the web session, race replays, tests) call {@link applyGenStep}
 * for each step instead of special-casing verbs themselves.
 */
import type { Grid } from './grid';
import type { GenStep } from './steps';
import { addWall, createWalls, removeWall } from './walls';

/** Applies the wall change (if any) described by `step` to `walls` in place. */
export function applyGenStep(walls: Uint8Array, grid: Grid, step: GenStep): void {
  switch (step.t) {
    case 'carve':
      removeWall(walls, grid, step.from, step.to);
      break;
    case 'seal':
      addWall(walls, grid, step.a, step.b);
      break;
    default:
      break;
  }
}

/** Walls obtained by replaying `steps` over a fully walled grid. */
export function replayGenSteps(grid: Grid, steps: Iterable<GenStep>): Uint8Array {
  const walls = createWalls(grid);
  for (const step of steps) applyGenStep(walls, grid, step);
  return walls;
}
