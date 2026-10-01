/**
 * Pure editing operations for Build mode (proj-mgmt/02 section 7, backlog S9.1/S9.2).
 *
 * Every edit is copy-on-write: it returns the next frozen `MazeState`, the forward patch and
 * the inverse patch, so undo/redo, diffing for saves and (later) collaborative editing all fall
 * out of the same primitive. Nothing here mutates its input.
 */
import { fromBase64Url, packWalls, toBase64Url, unpackWalls } from './document';
import {
  NO_CELL,
  cellCount,
  colOf,
  createGrid,
  dirBetween,
  idOf,
  isValidCell,
  neighbor,
  rowOf,
  type CellId,
  type Grid,
} from './grid';
import { distances } from './metrics';
import {
  ALL_WALLS,
  addWall,
  cloneWalls,
  createMazeState,
  hasWall,
  isConnected,
  openDirs,
  passageCount,
  removeWall,
  wallsAreSymmetric,
  type MazeState,
} from './walls';

export type EditOp =
  /** Flip the wall between two adjacent cells (kept symmetric). Self-inverse. */
  | { readonly t: 'toggleWall'; readonly a: CellId; readonly b: CellId }
  | { readonly t: 'setStart'; readonly cell: CellId }
  | { readonly t: 'setGoal'; readonly cell: CellId }
  /** Crop or pad from the top-left; padded cells start fully walled. */
  | { readonly t: 'resize'; readonly width: number; readonly height: number }
  /** Full snapshot restore (the inverse of a lossy resize). Walls are base64url nibbles. */
  | {
      readonly t: 'restore';
      readonly width: number;
      readonly height: number;
      readonly walls: string;
      readonly start: CellId;
      readonly goal: CellId;
    };

export interface Patch {
  readonly ops: readonly EditOp[];
}

export interface EditResult {
  readonly next: MazeState;
  readonly patch: Patch;
  readonly inverse: Patch;
}

function snapshotOp(state: MazeState): EditOp {
  return {
    t: 'restore',
    width: state.grid.width,
    height: state.grid.height,
    walls: toBase64Url(packWalls(state.walls)),
    start: state.start,
    goal: state.goal,
  };
}

/** Copies the overlapping region of `state` into a new grid; new cells are fully walled. */
function resizeWalls(state: MazeState, grid: Grid): Uint8Array {
  const walls = new Uint8Array(cellCount(grid)).fill(ALL_WALLS);
  const rows = Math.min(grid.height, state.grid.height);
  const cols = Math.min(grid.width, state.grid.width);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      walls[idOf(grid, r, c)] = state.walls[idOf(state.grid, r, c)] ?? ALL_WALLS;
    }
  }
  // Re-seal the new perimeter: cells on the cut edge may have been open towards cropped cells.
  for (let r = 0; r < rows; r++) {
    const last = idOf(grid, r, cols - 1);
    if (cols < state.grid.width && neighbor(grid, last, 1) === NO_CELL) walls[last] = (walls[last] ?? 0) | 2;
  }
  for (let c = 0; c < cols; c++) {
    const last = idOf(grid, rows - 1, c);
    if (rows < state.grid.height && neighbor(grid, last, 2) === NO_CELL) walls[last] = (walls[last] ?? 0) | 4;
  }
  return walls;
}

function clampCell(state: MazeState, grid: Grid, cell: CellId): CellId {
  const r = Math.min(rowOf(state.grid, cell), grid.height - 1);
  const c = Math.min(colOf(state.grid, cell), grid.width - 1);
  return idOf(grid, r, c);
}

/** Applies one operation; throws `RangeError` for invalid cells/dimensions. */
export function applyEdit(state: MazeState, op: EditOp): EditResult {
  switch (op.t) {
    case 'toggleWall': {
      const d = dirBetween(state.grid, op.a, op.b);
      if (d === undefined) throw new RangeError(`Cells ${op.a} and ${op.b} are not adjacent`);
      const walls = cloneWalls(state.walls);
      if (hasWall(walls, op.a, d)) removeWall(walls, state.grid, op.a, op.b);
      else addWall(walls, state.grid, op.a, op.b);
      return {
        next: createMazeState(state.grid, walls, state.start, state.goal),
        patch: { ops: [op] },
        inverse: { ops: [op] },
      };
    }
    case 'setStart': {
      if (!isValidCell(state.grid, op.cell)) throw new RangeError(`Invalid cell ${op.cell}`);
      return {
        next: createMazeState(state.grid, state.walls, op.cell, state.goal),
        patch: { ops: [op] },
        inverse: { ops: [{ t: 'setStart', cell: state.start }] },
      };
    }
    case 'setGoal': {
      if (!isValidCell(state.grid, op.cell)) throw new RangeError(`Invalid cell ${op.cell}`);
      return {
        next: createMazeState(state.grid, state.walls, state.start, op.cell),
        patch: { ops: [op] },
        inverse: { ops: [{ t: 'setGoal', cell: state.goal }] },
      };
    }
    case 'resize': {
      const grid = createGrid(op.width, op.height);
      const walls = resizeWalls(state, grid);
      const next = createMazeState(
        grid,
        walls,
        clampCell(state, grid, state.start),
        clampCell(state, grid, state.goal),
      );
      return { next, patch: { ops: [op] }, inverse: { ops: [snapshotOp(state)] } };
    }
    case 'restore': {
      const grid = createGrid(op.width, op.height);
      const walls = unpackWalls(fromBase64Url(op.walls), cellCount(grid));
      const next = createMazeState(grid, walls, op.start, op.goal);
      return { next, patch: { ops: [op] }, inverse: { ops: [snapshotOp(state)] } };
    }
  }
}

export function applyPatch(state: MazeState, patch: Patch): MazeState {
  let cur = state;
  for (const op of patch.ops) cur = applyEdit(cur, op).next;
  return cur;
}

export type ValidationCode =
  | 'goal-unreachable'
  | 'isolated-cells'
  | 'start-equals-goal'
  | 'not-perfect'
  | 'asymmetric-walls';

export interface ValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly code: ValidationCode;
  readonly message: string;
  /** Cells to highlight/focus in the editor, when applicable. */
  readonly cells?: readonly CellId[];
}

/** Editor validation (S9.2). Errors block saving as a playable maze; warnings inform. */
export function validateMaze(state: MazeState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!wallsAreSymmetric(state)) {
    issues.push({
      severity: 'error',
      code: 'asymmetric-walls',
      message: 'Some walls are open on one side only; the maze data is corrupt.',
    });
  }
  if (state.start === state.goal) {
    issues.push({
      severity: 'error',
      code: 'start-equals-goal',
      message: 'Start and goal are the same cell.',
      cells: [state.start],
    });
  }
  const dist = distances(state, state.start);
  if ((dist[state.goal] ?? -1) < 0) {
    issues.push({
      severity: 'error',
      code: 'goal-unreachable',
      message: 'The goal cannot be reached from the start.',
      cells: [state.goal],
    });
  }
  const isolated: CellId[] = [];
  for (let i = 0; i < dist.length; i++) if (dist[i] === -1) isolated.push(i);
  if (isolated.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'isolated-cells',
      message: `${isolated.length} cell${isolated.length === 1 ? ' is' : 's are'} unreachable from the start.`,
      cells: isolated,
    });
  }
  if (isolated.length === 0 && isConnected(state) && passageCount(state) !== cellCount(state.grid) - 1) {
    issues.push({
      severity: 'warning',
      code: 'not-perfect',
      message: 'The maze contains loops (it is braided, not a perfect maze).',
    });
  }
  return issues;
}

/** Cells whose only open passage leads to `cell` - handy for editors showing dead ends. */
export function isDeadEnd(state: MazeState, cell: CellId): boolean {
  return openDirs(state, cell).length === 1;
}

/** Immutable undo/redo history over `applyEdit`. */
export class EditHistory {
  private past: Patch[] = [];
  private future: Patch[] = [];
  private inversePast: Patch[] = [];
  private inverseFuture: Patch[] = [];
  private current: MazeState;

  constructor(initial: MazeState, readonly limit = 500) {
    this.current = initial;
  }

  get state(): MazeState {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  apply(op: EditOp): MazeState {
    const { next, patch, inverse } = applyEdit(this.current, op);
    this.past.push(patch);
    this.inversePast.push(inverse);
    if (this.past.length > this.limit) {
      this.past.shift();
      this.inversePast.shift();
    }
    this.future = [];
    this.inverseFuture = [];
    this.current = next;
    return next;
  }

  undo(): MazeState {
    const inverse = this.inversePast.pop();
    const patch = this.past.pop();
    if (!inverse || !patch) return this.current;
    this.current = applyPatch(this.current, inverse);
    this.future.push(patch);
    this.inverseFuture.push(inverse);
    return this.current;
  }

  redo(): MazeState {
    const patch = this.future.pop();
    const inverse = this.inverseFuture.pop();
    if (!patch || !inverse) return this.current;
    this.current = applyPatch(this.current, patch);
    this.past.push(patch);
    this.inversePast.push(inverse);
    return this.current;
  }

  /** All forward patches since construction (for saving an edit trail). */
  patches(): readonly Patch[] {
    return [...this.past];
  }
}
