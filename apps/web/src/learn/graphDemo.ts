/**
 * The M1 graph demo (WI-06d): a small maze the learner edits by hand while the page reads it as a
 * graph. Cells are vertices, open passages are edges; the stats say how many pieces it is in and
 * how many independent loops it has, so "a perfect maze is a tree" can be seen and tested.
 *
 * `GraphDemoModel` is a small external store over core `EditHistory` (exact undo), with a
 * selected cell and an overlay the 2D renderer draws: the selection as the current cell, cells on
 * a loop as frontier marks, cells cut off from the start as dead-end marks.
 */
import {
  CellMark,
  EditHistory,
  NO_CELL,
  SolveTracker,
  cellCount,
  createGrid,
  createRng,
  generators,
  neighbor,
  openNeighbors,
  passageCount,
  runToEnd,
  type CellId,
  type Dir,
  type MazeState,
} from '@maze/core';

export interface GraphStats {
  /** Vertices: the cells. */
  readonly cells: number;
  /** Edges: the open passages. */
  readonly passages: number;
  /** Connected pieces. */
  readonly pieces: number;
  /** Independent loops: passages - cells + pieces (0 for a tree or a forest). */
  readonly loops: number;
  /** Cells with exactly one passage. */
  readonly deadEnds: number;
  /** Connected with no loop: a spanning tree, so a perfect maze. */
  readonly tree: boolean;
}

/** The pieces of the maze: a piece number per cell, in order of the lowest cell in each. */
function pieceOf(state: MazeState): { piece: Int32Array; pieces: number } {
  const n = cellCount(state.grid);
  const piece = new Int32Array(n).fill(-1);
  let pieces = 0;
  const stack: CellId[] = [];
  for (let s = 0; s < n; s++) {
    if (piece[s] !== -1) continue;
    piece[s] = pieces;
    stack.push(s);
    while (stack.length > 0) {
      const c = stack.pop() as CellId;
      for (const nb of openNeighbors(state, c)) {
        if (piece[nb] === -1) {
          piece[nb] = pieces;
          stack.push(nb);
        }
      }
    }
    pieces++;
  }
  return { piece, pieces };
}

export function graphStats(state: MazeState): GraphStats {
  const cells = cellCount(state.grid);
  const passages = passageCount(state);
  const { pieces } = pieceOf(state);
  let deadEnds = 0;
  for (let c = 0; c < cells; c++) if (openNeighbors(state, c).length === 1) deadEnds++;
  const loops = passages - cells + pieces;
  return { cells, passages, pieces, loops, deadEnds, tree: pieces === 1 && loops === 0 };
}

const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** "1 piece, no loops": the graph in a few words (summaries, announcements). */
export function graphSummary(stats: GraphStats): string {
  const loops = stats.loops === 0 ? 'no loops' : plural(stats.loops, 'loop', 'loops');
  return `${plural(stats.pieces, 'piece', 'pieces')}, ${loops}`;
}

/** Why the maze is or is not a tree, in one sentence. */
export function treeVerdict(stats: GraphStats): string {
  const { cells, passages, pieces, loops } = stats;
  if (stats.tree) {
    return `A tree: one piece with no loops, and ${String(passages)} passages = ${String(cells)} cells - 1.`;
  }
  const why: string[] = [];
  if (pieces > 1) why.push(`it is in ${String(pieces)} pieces`);
  if (loops > 0) why.push(`it has ${plural(loops, 'loop', 'loops')}`);
  return `Not a tree: ${why.join(' and ')} (${String(passages)} passages for ${String(cells)} cells).`;
}

/**
 * Cells that lie on a loop: the ends of passages that are not bridges (a bridge is a passage
 * whose removal splits its piece). Tarjan's low-link, iterative so big grids cannot overflow.
 */
export function loopCells(state: MazeState): Set<CellId> {
  const n = cellCount(state.grid);
  const order = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onLoop = new Set<CellId>();
  let time = 0;
  for (let root = 0; root < n; root++) {
    if (order[root] !== -1) continue;
    // Frames: cell, the cell it came from, its neighbours and how far through them we are.
    const frames: { cell: CellId; from: CellId; nbs: CellId[]; i: number }[] = [
      { cell: root, from: NO_CELL, nbs: openNeighbors(state, root), i: 0 },
    ];
    order[root] = low[root] = time++;
    while (frames.length > 0) {
      const f = frames[frames.length - 1] as (typeof frames)[number];
      if (f.i < f.nbs.length) {
        const nb = f.nbs[f.i++] as CellId;
        if (nb === f.from) continue;
        if (order[nb] === -1) {
          order[nb] = low[nb] = time++;
          frames.push({ cell: nb, from: f.cell, nbs: openNeighbors(state, nb), i: 0 });
        } else {
          // A passage back to a cell already on the path closes a loop.
          low[f.cell] = Math.min(low[f.cell] ?? 0, order[nb] ?? 0);
          onLoop.add(f.cell);
          onLoop.add(nb);
        }
        continue;
      }
      frames.pop();
      const parent = frames[frames.length - 1];
      if (!parent) continue;
      low[parent.cell] = Math.min(low[parent.cell] ?? 0, low[f.cell] ?? 0);
      // Not a bridge: the child reaches above its parent, so the passage is on a loop.
      if ((low[f.cell] ?? 0) <= (order[parent.cell] ?? 0)) {
        onLoop.add(f.cell);
        onLoop.add(parent.cell);
      }
    }
  }
  return onLoop;
}

/** The cells not in the start's piece. */
export function cutOffCells(state: MazeState): CellId[] {
  const { piece } = pieceOf(state);
  const home = piece[state.start];
  const out: CellId[] = [];
  for (let c = 0; c < piece.length; c++) if (piece[c] !== home) out.push(c);
  return out;
}

export interface GraphDemoSetup {
  readonly generatorId: string;
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  /** Passages closed after generating, so the maze starts in `cut + 1` pieces. */
  readonly cut?: number;
}

/** The smallest piece a cut may leave, so every piece is easy to spot and to join. */
const MIN_PIECE = 4;

/**
 * The demo's starting maze: a perfect maze, then `cut` passages closed. Each cut is a passage
 * whose removal leaves both sides at least `MIN_PIECE` cells, chosen by a seeded shuffle.
 */
export function graphDemoMaze(setup: GraphDemoSetup): MazeState {
  const grid = createGrid(setup.width, setup.height);
  let state = runToEnd(generators.require(setup.generatorId).run(grid, createRng(setup.seed), {}));
  const rng = createRng(`${setup.seed}/cut`);
  for (let k = 0; k < (setup.cut ?? 0); k++) {
    const passages: [CellId, CellId][] = [];
    for (let c = 0; c < cellCount(grid); c++) {
      for (const nb of openNeighbors(state, c)) if (c < nb) passages.push([c, nb]);
    }
    for (let i = passages.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [passages[i], passages[j]] = [
        passages[j] as [CellId, CellId],
        passages[i] as [CellId, CellId],
      ];
    }
    for (const [a, b] of passages) {
      const history = new EditHistory(state);
      const next = history.apply({ t: 'toggleWall', a, b });
      const { piece, pieces } = pieceOf(next);
      const sizes = new Array<number>(pieces).fill(0);
      for (const p of piece) sizes[p] = (sizes[p] ?? 0) + 1;
      if (Math.min(...sizes.filter((_, p) => p === piece[a] || p === piece[b])) >= MIN_PIECE) {
        state = next;
        break;
      }
    }
  }
  return state;
}

export interface GraphDemoSnapshot {
  readonly state: MazeState;
  readonly stats: GraphStats;
  /** The selected cell, or null before the learner picks one. */
  readonly selected: CellId | null;
  readonly edits: number;
  readonly canUndo: boolean;
  readonly version: number;
}

export class GraphDemoModel {
  private history: EditHistory;
  private readonly initial: MazeState;
  private snap: GraphDemoSnapshot;
  private readonly listeners = new Set<() => void>();
  private requestRender: () => void = () => undefined;
  /** Drawn by the renderer as the "solve" overlay. */
  readonly overlay: { tracker: SolveTracker };

  constructor(initial: MazeState) {
    this.initial = initial;
    this.history = new EditHistory(initial);
    this.overlay = { tracker: new SolveTracker(initial.grid) };
    this.snap = this.build(initial, null, 0, 0, null);
    this.refreshOverlay();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): GraphDemoSnapshot => this.snap;

  /** `MazeCanvas` hook: the canvas registers its redraw here. */
  setRenderRequest(fn: () => void): void {
    this.requestRender = fn;
  }

  /** Opens or closes the wall between two neighbouring cells. */
  toggleWall(a: CellId, b: CellId): void {
    const next = this.history.apply({ t: 'toggleWall', a, b });
    this.commit(next, this.snap.selected, this.snap.edits + 1);
  }

  /** Toggles the selected cell's wall on side `dir`; false with no selection or at the edge. */
  toggleSelectedWall(dir: Dir): boolean {
    const cell = this.snap.selected;
    if (cell === null) return false;
    const b = neighbor(this.snap.state.grid, cell, dir);
    if (b === NO_CELL) return false;
    this.toggleWall(cell, b);
    return true;
  }

  select(cell: CellId | null): void {
    this.commit(this.snap.state, cell, this.snap.edits);
  }

  /** Moves the selection one cell (from the start when nothing is selected). */
  moveSelection(dir: Dir): CellId {
    const from = this.snap.selected;
    if (from === null) {
      this.select(this.snap.state.start);
      return this.snap.state.start;
    }
    const next = neighbor(this.snap.state.grid, from, dir);
    if (next !== NO_CELL) this.select(next);
    return this.snap.selected ?? from;
  }

  undo(): void {
    if (!this.history.canUndo) return;
    this.commit(this.history.undo(), this.snap.selected, Math.max(0, this.snap.edits - 1));
  }

  /** Back to the starting maze, nothing selected. */
  reset(): void {
    this.history = new EditHistory(this.initial);
    this.commit(this.initial, null, 0);
  }

  private build(
    state: MazeState,
    selected: CellId | null,
    edits: number,
    version: number,
    prev: GraphDemoSnapshot | null,
  ): GraphDemoSnapshot {
    return {
      state,
      stats: prev?.state === state ? prev.stats : graphStats(state),
      selected,
      edits,
      canUndo: this.history.canUndo,
      version,
    };
  }

  private commit(state: MazeState, selected: CellId | null, edits: number): void {
    this.snap = this.build(state, selected, edits, this.snap.version + 1, this.snap);
    this.refreshOverlay();
    for (const l of this.listeners) l();
    this.requestRender();
  }

  /** Selection as the current cell, loop cells as frontier, cut-off cells as dead ends. */
  private refreshOverlay(): void {
    const { state, selected } = this.snap;
    const t = this.overlay.tracker;
    t.reset();
    t.current = selected ?? NO_CELL;
    for (const c of loopCells(state)) t.marks[c] = CellMark.Frontier;
    for (const c of cutOffCells(state)) t.marks[c] = CellMark.DeadEnd;
  }
}
