/**
 * Plain-language descriptions for the accessibility narrator and the textual step log.
 */
import { DIR_NAMES, colOf, rowOf, type CellId, type Grid } from './grid';
import type { GenStep, SolveStep } from './steps';
import { openDirs, type MazeState } from './walls';

/** "row 3, column 5" (1-based for humans). */
export function describePosition(grid: Grid, cell: CellId): string {
  return `row ${rowOf(grid, cell) + 1}, column ${colOf(grid, cell) + 1}`;
}

function joinList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] as string}`;
}

/** "Row 3, column 5. Open to the north and east. Goal." */
export function describeCell(state: MazeState, cell: CellId): string {
  const parts: string[] = [];
  const pos = describePosition(state.grid, cell);
  parts.push(pos.charAt(0).toUpperCase() + pos.slice(1) + '.');
  const dirs = openDirs(state, cell).map((d) => DIR_NAMES[d]);
  parts.push(
    dirs.length === 0
      ? 'No open passages.'
      : dirs.length === 1
        ? `Dead end, open to the ${dirs[0] as string}.`
        : `Open to the ${joinList(dirs)}.`,
  );
  if (cell === state.start) parts.push('Start.');
  if (cell === state.goal) parts.push('Goal.');
  return parts.join(' ');
}

export function describeGenStep(grid: Grid, step: GenStep): string {
  switch (step.t) {
    case 'visit':
      return `Visiting ${describePosition(grid, step.cell)}.`;
    case 'carve':
      return `Carving a passage to ${describePosition(grid, step.to)}.`;
    case 'seal':
      return `Adding a wall between ${describePosition(grid, step.a)} and ${describePosition(grid, step.b)}.`;
    case 'backtrack':
      return `Dead end. Backtracking to ${describePosition(grid, step.to)}.`;
    case 'frontier':
      return `Frontier: ${step.add?.length ?? 0} added, ${step.remove?.length ?? 0} removed.`;
    case 'union':
      return `Joining ${describePosition(grid, step.a)} with ${describePosition(grid, step.b)}.`;
    case 'walk':
      return `Random walk reaches ${describePosition(grid, step.cell)}.`;
    case 'divide':
      return `Dividing ${step.cells.length} cells with a gap at ${describePosition(grid, step.gap)}.`;
    case 'rotate':
      return `Root moves to ${describePosition(grid, step.newRoot)}.`;
    case 'done':
      return 'Maze generation complete.';
  }
}

export function describeSolveStep(grid: Grid, step: SolveStep): string {
  switch (step.t) {
    case 'expand':
      return `Expanding ${describePosition(grid, step.cell)}${
        step.g !== undefined ? ` at distance ${step.g}` : ''
      }.`;
    case 'discover':
      return `Discovered ${describePosition(grid, step.cell)}.`;
    case 'relax':
      return `Shorter route to ${describePosition(grid, step.cell)}: ${step.oldG} to ${step.newG}.`;
    case 'deadend':
      return `Dead end at ${describePosition(grid, step.cell)}.`;
    case 'mark':
      return `Marking the ${DIR_NAMES[step.dir]} passage at ${describePosition(grid, step.cell)}.`;
    case 'move':
      return `Moving to ${describePosition(grid, step.to)}.`;
    case 'path':
      return `Path found with ${step.cells.length - 1} moves.`;
    case 'fail':
      return 'No path exists.';
    case 'done':
      return `Solver finished after expanding ${step.stats.expanded} cells.`;
  }
}
