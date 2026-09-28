/**
 * Legacy "fill the window" sizing: columns/rows derive from the canvas host size and the cell
 * size at generation time. Resizing later only re-fits the view (P-13).
 */
export const MIN_CELL_SIZE = 3;
export const MIN_SIDE = 2;
export const MAX_CELLS = 40_000;
/** Legacy MIN_NUMBER_OF_CELLS_HORIZONTALLY: the cell-size slider max is width / 9 (P-08). */
export const MIN_CELLS_HORIZONTALLY = 9;

export interface GridDims {
  width: number;
  height: number;
  /** Possibly raised from the requested size to respect MAX_CELLS. */
  cellSize: number;
}

export function computeGridDims(hostWidth: number, hostHeight: number, cellSize: number): GridDims {
  const w0 = Math.max(1, Math.floor(hostWidth));
  const h0 = Math.max(1, Math.floor(hostHeight));
  let cs = Math.max(MIN_CELL_SIZE, Math.floor(cellSize) || MIN_CELL_SIZE);
  let width = Math.max(MIN_SIDE, Math.floor(w0 / cs));
  let height = Math.max(MIN_SIDE, Math.floor(h0 / cs));
  while (width * height > MAX_CELLS) {
    cs += 1;
    width = Math.max(MIN_SIDE, Math.floor(w0 / cs));
    height = Math.max(MIN_SIDE, Math.floor(h0 / cs));
  }
  return { width, height, cellSize: cs };
}

export function maxCellSizeFor(hostWidth: number): number {
  return Math.max(MIN_CELL_SIZE + 1, Math.floor(Math.max(1, hostWidth) / MIN_CELLS_HORIZONTALLY));
}

/** Legacy `rows * cellSize / 10` px with `cellSize / 6` per unit -> about 0.6 * rows units. */
export function autoProjectionDepth(rows: number): number {
  return Math.max(1, Math.round(0.6 * Math.max(1, rows)));
}
