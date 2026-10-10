/**
 * BuildModel: the Build editor's state (WI-03) as a small external store for React.
 *
 * It wraps core `EditHistory` (copy-on-write edits with exact undo/redo), keeps a keyboard cell
 * cursor and the current tool, validates after every edit and maintains an overlay tracker that
 * the 2D renderer draws: the cursor (as the "current" cell), cells named by validation issues
 * and, on request, the shortest path.
 */
import {
  CellMark,
  Dir,
  EditHistory,
  NO_CELL,
  SolveTracker,
  braid,
  createRng,
  neighbor,
  runToEnd,
  shortestPath,
  snapshotEdit,
  validateMaze,
  type CellId,
  type EditOp,
  type MazeState,
  type ValidationIssue,
} from '@maze/core';
import { ALL_WALLS, createMazeState } from '@maze/core';

export type BuildTool = 'walls' | 'start' | 'goal';

export interface BuildSource {
  /** Library item being edited (Save updates it), or null for a new maze. */
  readonly itemId: string | null;
  readonly name: string;
}

export interface BuildSnapshot {
  readonly state: MazeState;
  readonly cursor: CellId;
  readonly tool: BuildTool;
  readonly issues: readonly ValidationIssue[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly showSolution: boolean;
  readonly source: BuildSource;
  /** Edits since the last load or save. */
  readonly dirty: boolean;
  readonly version: number;
}

const DIR_FOR_KEY: Record<string, Dir> = {
  ArrowUp: Dir.N,
  ArrowRight: Dir.E,
  ArrowDown: Dir.S,
  ArrowLeft: Dir.W,
};

export function dirForArrow(key: string): Dir | undefined {
  return DIR_FOR_KEY[key];
}

export class BuildModel {
  private history: EditHistory;
  private snap: BuildSnapshot;
  private readonly listeners = new Set<() => void>();
  private requestRender: () => void = () => undefined;
  /** Drawn by the renderer as the "solve" overlay. */
  readonly overlay: { tracker: SolveTracker };

  constructor(initial: MazeState, source: BuildSource = { itemId: null, name: 'New maze' }) {
    this.history = new EditHistory(initial);
    this.overlay = { tracker: new SolveTracker(initial.grid) };
    this.snap = this.build(initial, initial.start, 'walls', false, source, false, 0);
    this.refreshOverlay();
  }

  // ---- store ------------------------------------------------------------------------------

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): BuildSnapshot => this.snap;

  /** `MazeCanvas` hook: the canvas registers its redraw here. */
  setRenderRequest(fn: () => void): void {
    this.requestRender = fn;
  }

  // ---- loading ----------------------------------------------------------------------------

  load(state: MazeState, source: BuildSource): void {
    this.history = new EditHistory(state);
    this.overlay.tracker = new SolveTracker(state.grid);
    this.commit(state, { cursor: state.start, source, dirty: false });
  }

  markSaved(source: BuildSource): void {
    this.commit(this.snap.state, { source, dirty: false });
  }

  // ---- edits ------------------------------------------------------------------------------

  private apply(op: EditOp): void {
    const next = this.history.apply(op);
    this.commit(next, { dirty: true });
  }

  toggleWall(a: CellId, b: CellId): void {
    this.apply({ t: 'toggleWall', a, b });
  }

  setStart(cell: CellId): void {
    if (cell !== this.snap.state.start) this.apply({ t: 'setStart', cell });
  }

  setGoal(cell: CellId): void {
    if (cell !== this.snap.state.goal) this.apply({ t: 'setGoal', cell });
  }

  /** Applies the current tool to a cell (taps away from any wall, Enter on the cursor). */
  useToolOn(cell: CellId): void {
    this.commit(this.snap.state, { cursor: cell });
    if (this.snap.tool === 'start') this.setStart(cell);
    else if (this.snap.tool === 'goal') this.setGoal(cell);
  }

  resize(width: number, height: number): void {
    const { grid } = this.snap.state;
    if (width === grid.width && height === grid.height) return;
    this.apply({ t: 'resize', width, height });
    this.overlay.tracker = new SolveTracker(this.snap.state.grid);
    this.commit(this.snap.state, { cursor: Math.min(this.snap.cursor, width * height - 1) });
  }

  /** Removes dead ends (percent of them) in one undoable step. */
  braid(percent: number, seed: string): void {
    const braided = runToEnd(braid.run(this.snap.state, createRng(seed), { percent }));
    this.apply(snapshotEdit(braided));
  }

  /** Every wall closed (start from scratch) or every inner wall open, in one undoable step. */
  fill(kind: 'walls' | 'open'): void {
    const { grid, start, goal } = this.snap.state;
    const walls = new Uint8Array(grid.width * grid.height).fill(ALL_WALLS);
    if (kind === 'open') {
      for (let c = 0; c < walls.length; c++) {
        let w = ALL_WALLS;
        for (const d of [Dir.N, Dir.E, Dir.S, Dir.W]) {
          if (neighbor(grid, c, d) !== NO_CELL) w &= ~(1 << d);
        }
        walls[c] = w;
      }
    }
    this.apply(snapshotEdit(createMazeState(grid, walls, start, goal)));
  }

  undo(): void {
    if (!this.history.canUndo) return;
    this.commit(this.history.undo(), { dirty: true });
  }

  redo(): void {
    if (!this.history.canRedo) return;
    this.commit(this.history.redo(), { dirty: true });
  }

  // ---- cursor, tool, overlay --------------------------------------------------------------

  setTool(tool: BuildTool): void {
    this.commit(this.snap.state, { tool });
  }

  /** Moves the keyboard cursor one cell (stays put at the edge). Returns the new cell. */
  moveCursor(dir: Dir): CellId {
    const next = neighbor(this.snap.state.grid, this.snap.cursor, dir);
    if (next !== NO_CELL) this.commit(this.snap.state, { cursor: next });
    return this.snap.cursor;
  }

  setCursor(cell: CellId): void {
    this.commit(this.snap.state, { cursor: cell });
  }

  /** Toggles the wall on one side of the cursor; false at the outer boundary. */
  toggleCursorWall(dir: Dir): boolean {
    const b = neighbor(this.snap.state.grid, this.snap.cursor, dir);
    if (b === NO_CELL) return false;
    this.toggleWall(this.snap.cursor, b);
    return true;
  }

  setShowSolution(show: boolean): void {
    this.commit(this.snap.state, { showSolution: show });
  }

  // ---- internals --------------------------------------------------------------------------

  private build(
    state: MazeState,
    cursor: CellId,
    tool: BuildTool,
    showSolution: boolean,
    source: BuildSource,
    dirty: boolean,
    version: number,
  ): BuildSnapshot {
    return {
      state,
      cursor,
      tool,
      issues: validateMaze(state),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      showSolution,
      source,
      dirty,
      version,
    };
  }

  private commit(
    state: MazeState,
    patch: Partial<Pick<BuildSnapshot, 'cursor' | 'tool' | 'showSolution' | 'source' | 'dirty'>>,
  ): void {
    const prev = this.snap;
    const cursor = Math.max(
      0,
      Math.min(state.grid.width * state.grid.height - 1, patch.cursor ?? prev.cursor),
    );
    this.snap =
      state === prev.state
        ? {
            ...prev,
            cursor,
            tool: patch.tool ?? prev.tool,
            showSolution: patch.showSolution ?? prev.showSolution,
            source: patch.source ?? prev.source,
            dirty: patch.dirty ?? prev.dirty,
            canUndo: this.history.canUndo,
            canRedo: this.history.canRedo,
            version: prev.version + 1,
          }
        : this.build(
            state,
            cursor,
            patch.tool ?? prev.tool,
            patch.showSolution ?? prev.showSolution,
            patch.source ?? prev.source,
            patch.dirty ?? prev.dirty,
            prev.version + 1,
          );
    this.refreshOverlay();
    for (const l of this.listeners) l();
    this.requestRender();
  }

  /** Cursor as the tracker's current cell, issue cells as dead-end marks, optional path. */
  private refreshOverlay(): void {
    const { state, cursor, issues, showSolution } = this.snap;
    let t = this.overlay.tracker;
    if (t.grid !== state.grid) {
      t = new SolveTracker(state.grid);
      this.overlay.tracker = t;
    }
    t.reset();
    t.current = cursor;
    for (const issue of issues) {
      for (const c of issue.cells ?? []) {
        if (issue.code !== 'start-equals-goal') t.marks[c] = CellMark.DeadEnd;
      }
    }
    t.path = showSolution ? shortestPath(state, state.start, state.goal) : null;
  }
}
