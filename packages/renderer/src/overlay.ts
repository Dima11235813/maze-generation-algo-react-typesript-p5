/**
 * Per-cell colour resolution shared by adapters that paint a single colour per cell
 * (three.js instance colours). The 2D adapter layers translucent fills instead, which is
 * visually equivalent for the alphas used here.
 */
import {
  CellMark,
  NO_CELL,
  type CellId,
  type GenerationTracker,
  type SolveTracker,
} from '@maze/core';
import { legacyCellColor, legacyCurrentColor, mix, resolve } from './color';
import type { RGB, RenderTheme } from './types';

export const SOLVE_TINT_ALPHA = 0.6;

/** Colour for a solve mark, or null for unmarked cells. */
export function solveMarkColor(theme: RenderTheme, mark: number): RGB | null {
  switch (mark) {
    case CellMark.Frontier:
      return theme.solveFrontier;
    case CellMark.Expanded:
      return theme.solveExpanded;
    case CellMark.DeadEnd:
      return theme.solveDeadEnd;
    default:
      return null;
  }
}

/**
 * Final flat colour of a floor tile: legacy visit/depth colour (or the base cell colour when
 * no generation tracker), tinted by the solve mark and the generator's current-cell highlight.
 */
export function tileColor(
  theme: RenderTheme,
  gen: GenerationTracker | null,
  solve: SolveTracker | null,
  cell: CellId,
): RGB {
  let c: RGB = gen
    ? legacyCellColor(theme, gen.visitCount[cell] ?? 0, gen.depthAtVisit[cell] ?? -1)
    : resolve(theme, theme.cell);
  if (solve) {
    const markColor = solveMarkColor(theme, solve.marks[cell] ?? 0);
    if (markColor) c = mix(c, resolve(theme, markColor), SOLVE_TINT_ALPHA);
    if (solve.current === cell && !solve.done) c = mix(c, resolve(theme, theme.path), 0.5);
  }
  if (gen?.current === cell && !gen.done && gen.current !== NO_CELL) {
    const { color, alpha } = legacyCurrentColor(theme, gen.visitCount[cell] ?? 0);
    c = mix(c, color, alpha);
  }
  return c;
}
