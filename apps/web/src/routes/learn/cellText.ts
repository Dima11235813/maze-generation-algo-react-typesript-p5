import { colOf, rowOf, type CellId, type Grid } from '@maze/core';

/** "(3,5)": row and column, 1-based, for compact visual lists (screen readers get full text). */
export function shortCell(grid: Grid, cell: CellId): string {
  return `(${String(rowOf(grid, cell) + 1)},${String(colOf(grid, cell) + 1)})`;
}
