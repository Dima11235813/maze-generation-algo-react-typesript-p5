/**
 * DOM adapter: renders the maze as semantics instead of pixels (D-17, S3.4).
 *
 * An ARIA grid mirrors the `MazeState` and the live trackers so screen-reader users get the
 * same information a sighted user reads off the canvas: every cell describes its position and
 * exits (via `describeCell`), plus dynamic state such as visit counts, the generator's current
 * cell, solver frontier/explored/path marks and the first-person player. Focus roves with the
 * arrow keys. Large mazes are virtualised to a window of rows around the focused/current cell
 * so the mirror never competes with the visual renderer for frame time; refreshes are
 * coalesced and throttled to a few per second.
 *
 * It implements the same `Renderer` port as the visual adapters, so the app drives it with the
 * exact same calls, and it is meant to be mounted inside a visually hidden container.
 */
import {
  CellMark,
  DIR_NAMES,
  NO_CELL,
  cellCount,
  colOf,
  describeCell,
  idOf,
  rowOf,
  type CellId,
  type GenerationTracker,
  type MazeState,
  type SolveTracker,
} from '@maze/core';
import type {
  CameraState,
  FirstPersonState,
  PointerState,
  RenderOptions,
  RenderTheme,
  Renderer,
  RendererEvents,
  RendererFactoryOptions,
} from '../types';

/** Extra callback the DOM adapter understands (duck-typed; `types.ts` is unchanged). */
export interface DomRendererEvents extends RendererEvents {
  /** The user asked for a description of the focused cell (`I` key) or moved focus. */
  onCellFocus?(cell: CellId, reason: 'move' | 'describe'): void;
}

export interface DomRenderer extends Renderer {
  /** Root element once mounted (the grid lives inside it). */
  readonly element: HTMLElement | null;
  /** Render synchronously, bypassing coalescing/throttling (tests, focus moves). */
  flush(): void;
  /** Move roving focus to a cell (re-windows if needed) and focus its element. */
  focusCell(cell: CellId): void;
  getFocusedCell(): CellId;
}

/** Mazes with more cells than this render only a window of rows. */
export const VIRTUALIZE_ABOVE_CELLS = 400;
/** Rows rendered at once when virtualised. */
export const WINDOW_ROWS = 15;
/** Minimum time between DOM refreshes while steps stream in (about 5 per second). */
export const MIN_REFRESH_MS = 200;

const CLASS_ROOT = 'maze-dom-grid';

export function createDomRenderer(opts: RendererFactoryOptions): DomRenderer {
  return new DomGridRenderer(opts);
}

interface RowWindow {
  start: number;
  /** Exclusive. */
  end: number;
}

class DomGridRenderer implements DomRenderer {
  readonly kind = '2d' as const;

  private host: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private linksEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;

  private maze: MazeState | null = null;
  private gen: GenerationTracker | null = null;
  private solve: SolveTracker | null = null;
  private fp: FirstPersonState | null = null;
  private events: DomRendererEvents;

  private focusedCell: CellId = NO_CELL;
  private hasFocus = false;
  private pathRef: readonly CellId[] | null = null;
  private pathSet: Set<CellId> | null = null;

  private pending = false;
  private rafId: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastRefresh = -Infinity;
  private lastWindow: RowWindow = { start: 0, end: 0 };

  constructor(opts: RendererFactoryOptions) {
    this.events = opts.events ?? {};
  }

  get element(): HTMLElement | null {
    return this.root;
  }

  // ---- Renderer port ------------------------------------------------------------------------

  mount(host: HTMLElement): void {
    if (this.host) this.detach();
    this.host = host;

    const root = document.createElement('div');
    root.className = CLASS_ROOT;

    const summary = document.createElement('p');
    summary.className = `${CLASS_ROOT}__summary`;
    summary.id = uniqueId('maze-dom-summary');

    const links = document.createElement('div');
    links.className = `${CLASS_ROOT}__links`;
    links.setAttribute('role', 'group');
    links.setAttribute('aria-label', 'Jump to');

    const grid = document.createElement('div');
    grid.className = `${CLASS_ROOT}__grid`;
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-describedby', summary.id);
    grid.addEventListener('keydown', this.onKeyDown);
    grid.addEventListener('focusin', this.onFocusIn);
    grid.addEventListener('focusout', this.onFocusOut);

    root.append(summary, links, grid);
    host.appendChild(root);
    this.root = root;
    this.summaryEl = summary;
    this.linksEl = links;
    this.gridEl = grid;
    this.refresh();
  }

  setMaze(state: MazeState | null): void {
    const sameGrid =
      this.maze &&
      state &&
      this.maze.grid.width === state.grid.width &&
      this.maze.grid.height === state.grid.height;
    this.maze = state;
    if (!sameGrid) {
      this.focusedCell = NO_CELL;
      this.pathRef = null;
      this.pathSet = null;
    }
    this.requestRender();
  }

  setGeneration(tracker: GenerationTracker | null): void {
    this.gen = tracker;
    this.requestRender();
  }

  setSolve(tracker: SolveTracker | null): void {
    this.solve = tracker;
    if (!tracker) {
      this.pathRef = null;
      this.pathSet = null;
    }
    this.requestRender();
  }

  setTheme(_theme: RenderTheme): void {
    // Colours carry no semantics here.
  }

  setOptions(_options: RenderOptions): void {
    // Sizes and effects carry no semantics here.
  }

  setCamera(_camera: CameraState): void {
    // No camera in a semantic view.
  }

  setFirstPerson(state: FirstPersonState | null): void {
    const entered = state !== null && this.fp === null;
    this.fp = state;
    if (entered && !this.hasFocus) this.focusedCell = state.cell;
    this.requestRender();
  }

  setPointer(_pointer: PointerState | null): void {
    // Pointer position is irrelevant to the mirror.
  }

  setEvents(events: RendererEvents): void {
    this.events = events;
  }

  resize(): void {
    // Nothing to fit.
  }

  requestRender(): void {
    if (!this.gridEl || this.pending) return;
    this.pending = true;
    const wait = Math.max(0, MIN_REFRESH_MS - (nowMs() - this.lastRefresh));
    if (wait === 0) {
      this.rafId = scheduleFrame(() => {
        this.rafId = null;
        this.pending = false;
        this.refresh();
      });
    } else {
      this.timerId = setTimeout(() => {
        this.timerId = null;
        this.pending = false;
        this.refresh();
      }, wait);
    }
  }

  toDataURL(): string {
    return '';
  }

  destroy(): void {
    this.detach();
    this.maze = null;
    this.gen = null;
    this.solve = null;
    this.fp = null;
  }

  // ---- DomRenderer extras -------------------------------------------------------------------

  flush(): void {
    this.cancelPending();
    this.refresh();
  }

  focusCell(cell: CellId): void {
    if (!this.maze || cell < 0 || cell >= cellCount(this.maze.grid)) return;
    this.focusedCell = cell;
    this.hasFocus = true;
    this.flush();
    this.focusFocusedElement();
    this.events.onCellFocus?.(cell, 'move');
  }

  getFocusedCell(): CellId {
    return this.focusedCell === NO_CELL ? (this.maze?.start ?? NO_CELL) : this.focusedCell;
  }

  // ---- rendering ----------------------------------------------------------------------------

  private refresh(): void {
    const grid = this.gridEl;
    const summary = this.summaryEl;
    const links = this.linksEl;
    if (!grid || !summary || !links) return;
    this.lastRefresh = nowMs();

    const maze = this.maze;
    if (!maze) {
      grid.setAttribute('aria-label', 'Maze grid, empty');
      grid.removeAttribute('aria-rowcount');
      grid.removeAttribute('aria-colcount');
      grid.replaceChildren();
      links.replaceChildren();
      summary.textContent = 'No maze yet.';
      return;
    }

    const { width, height } = maze.grid;
    const total = cellCount(maze.grid);
    this.syncPath();

    const anchor = this.anchorCell();
    const win = this.computeWindow(height, rowOf(maze.grid, anchor));
    this.lastWindow = win;
    const virtualised = total > VIRTUALIZE_ABOVE_CELLS;

    grid.setAttribute('aria-label', `Maze grid, ${width} by ${height}`);
    grid.setAttribute('aria-rowcount', String(height));
    grid.setAttribute('aria-colcount', String(width));

    summary.textContent = virtualised
      ? `Showing rows ${win.start + 1} to ${win.end} of ${height}. Use arrow keys to move between cells, Page Up and Page Down to move by ${WINDOW_ROWS} rows, Control plus Home for the start.`
      : `Maze grid, ${width} by ${height}. Use arrow keys to move between cells, Home and End for row edges, I to hear the focused cell again.`;

    this.renderLinks(links, maze);

    let focusTarget = this.getFocusedCell();
    const focusRow = rowOf(maze.grid, focusTarget);
    // The roving tab stop must exist inside the rendered window, or the grid is unreachable.
    if (focusRow < win.start || focusRow >= win.end) {
      focusTarget = idOf(maze.grid, win.start, 0);
      if (!this.hasFocus) this.focusedCell = focusTarget;
    }
    const frag = document.createDocumentFragment();
    for (let r = win.start; r < win.end; r++) {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.setAttribute('aria-rowindex', String(r + 1));
      row.className = `${CLASS_ROOT}__row`;
      for (let c = 0; c < width; c++) {
        const cell = idOf(maze.grid, r, c);
        const el = document.createElement('div');
        el.setAttribute('role', 'gridcell');
        el.setAttribute('aria-colindex', String(c + 1));
        el.className = `${CLASS_ROOT}__cell`;
        el.dataset.cell = String(cell);
        el.tabIndex = cell === focusTarget ? 0 : -1;
        el.setAttribute('aria-label', this.cellName(maze, cell));
        if (this.isCurrentLocation(cell)) el.setAttribute('aria-current', 'location');
        row.appendChild(el);
      }
      frag.appendChild(row);
    }
    grid.replaceChildren(frag);

    if (this.hasFocus) this.focusFocusedElement();
  }

  private renderLinks(links: HTMLElement, maze: MazeState): void {
    const items: Array<{ label: string; cell: CellId }> = [
      { label: 'Go to start', cell: maze.start },
      { label: 'Go to goal', cell: maze.goal },
    ];
    if (this.gen && !this.gen.done && this.gen.current !== NO_CELL) {
      items.push({ label: 'Go to the current cell', cell: this.gen.current });
    }
    if (this.fp) items.push({ label: 'Go to the player', cell: this.fp.cell });
    if (this.solve && this.solve.current !== NO_CELL && !this.solve.done) {
      items.push({ label: 'Go to the solver', cell: this.solve.current });
    }
    // Reuse buttons when the label set is unchanged to keep focus stable on them.
    const existing = Array.from(links.children) as HTMLButtonElement[];
    const same =
      existing.length === items.length &&
      existing.every((b, i) => b.textContent === items[i]?.label);
    if (same) {
      existing.forEach((b, i) => {
        b.dataset.cell = String(items[i]?.cell ?? NO_CELL);
      });
      return;
    }
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.label;
      b.dataset.cell = String(item.cell);
      b.className = `${CLASS_ROOT}__link`;
      b.addEventListener('click', this.onLinkClick);
      frag.appendChild(b);
    }
    links.replaceChildren(frag);
  }

  private cellName(maze: MazeState, cell: CellId): string {
    const parts: string[] = [describeCell(maze, cell)];
    const gen = this.gen;
    if (gen) {
      if (!gen.isSeen(cell)) {
        parts.push('Not yet visited.');
      } else {
        const n = gen.visitCount[cell] ?? 0;
        parts.push(`Visited ${n} ${n === 1 ? 'time' : 'times'}.`);
        if (gen.current === cell && !gen.done) parts.push('Current cell.');
      }
    }
    const solve = this.solve;
    if (solve) {
      const mark = solve.marks[cell] ?? CellMark.Unseen;
      if (mark === CellMark.Frontier) parts.push('Frontier.');
      else if (mark === CellMark.Expanded) parts.push('Explored.');
      else if (mark === CellMark.DeadEnd) parts.push('Dead end for the solver.');
      if (solve.current === cell && !solve.done) parts.push('Solver is here.');
      if (this.pathSet?.has(cell)) parts.push('On the solution path.');
    }
    const fp = this.fp;
    if (fp && fp.cell === cell) {
      parts.push(`Player here, facing ${DIR_NAMES[fp.heading]}${fp.peek ? ', peeking' : ''}.`);
    }
    return parts.join(' ');
  }

  private isCurrentLocation(cell: CellId): boolean {
    if (this.fp) return this.fp.cell === cell;
    if (this.gen && !this.gen.done) return this.gen.current === cell;
    if (this.solve && !this.solve.done) return this.solve.current === cell;
    return false;
  }

  private syncPath(): void {
    const path = this.solve?.path ?? null;
    if (path === this.pathRef) return;
    this.pathRef = path;
    this.pathSet = path ? new Set(path) : null;
  }

  /** Row the window centres on: focus wins, then player, then the generator/solver. */
  private anchorCell(): CellId {
    const maze = this.maze;
    if (!maze) return 0;
    if (this.hasFocus && this.focusedCell !== NO_CELL) return this.focusedCell;
    if (this.fp) return this.fp.cell;
    if (this.gen && !this.gen.done && this.gen.current !== NO_CELL) return this.gen.current;
    if (this.solve && !this.solve.done && this.solve.current !== NO_CELL) return this.solve.current;
    if (this.focusedCell !== NO_CELL) return this.focusedCell;
    return maze.start;
  }

  private computeWindow(height: number, anchorRow: number): RowWindow {
    const total = this.maze ? cellCount(this.maze.grid) : 0;
    if (total <= VIRTUALIZE_ABOVE_CELLS || height <= WINDOW_ROWS) return { start: 0, end: height };
    // Keep the previous window while the anchor stays inside it (less churn for readers).
    const prev = this.lastWindow;
    if (
      prev.end > prev.start &&
      anchorRow >= prev.start &&
      anchorRow < prev.end &&
      prev.end <= height
    ) {
      return prev;
    }
    let start = anchorRow - Math.floor(WINDOW_ROWS / 2);
    start = Math.max(0, Math.min(height - WINDOW_ROWS, start));
    return { start, end: start + WINDOW_ROWS };
  }

  private focusFocusedElement(): void {
    const grid = this.gridEl;
    if (!grid) return;
    const target = this.getFocusedCell();
    const el = grid.querySelector<HTMLElement>(`[data-cell="${target}"]`);
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  }

  // ---- interaction --------------------------------------------------------------------------

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const maze = this.maze;
    if (!maze) return;
    const { width, height } = maze.grid;
    const cur = this.getFocusedCell();
    let r = rowOf(maze.grid, cur);
    let c = colOf(maze.grid, cur);
    switch (e.key) {
      case 'ArrowUp':
        r = Math.max(0, r - 1);
        break;
      case 'ArrowDown':
        r = Math.min(height - 1, r + 1);
        break;
      case 'ArrowLeft':
        c = Math.max(0, c - 1);
        break;
      case 'ArrowRight':
        c = Math.min(width - 1, c + 1);
        break;
      case 'Home':
        if (e.ctrlKey) {
          r = rowOf(maze.grid, maze.start);
          c = colOf(maze.grid, maze.start);
        } else c = 0;
        break;
      case 'End':
        if (e.ctrlKey) {
          r = rowOf(maze.grid, maze.goal);
          c = colOf(maze.grid, maze.goal);
        } else c = width - 1;
        break;
      case 'PageUp':
        r = Math.max(0, r - WINDOW_ROWS);
        break;
      case 'PageDown':
        r = Math.min(height - 1, r + WINDOW_ROWS);
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        this.events.onCellFocus?.(cur, 'describe');
        return;
      default:
        return;
    }
    e.preventDefault();
    const next = idOf(maze.grid, r, c);
    if (next === cur) return;
    this.focusedCell = next;
    this.hasFocus = true;
    this.flush();
    this.focusFocusedElement();
    this.events.onCellFocus?.(next, 'move');
  };

  private readonly onFocusIn = (e: FocusEvent): void => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const raw = target.dataset.cell;
    if (raw === undefined) return;
    this.hasFocus = true;
    const cell = Number(raw);
    if (Number.isInteger(cell) && cell !== this.focusedCell) {
      // Focus arrived by mouse/tab on a cell that is not the roving one: adopt it.
      const prev = this.gridEl?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
      if (prev) prev.tabIndex = -1;
      target.tabIndex = 0;
      this.focusedCell = cell;
    }
  };

  private readonly onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget;
    if (next instanceof Node && this.gridEl?.contains(next)) return;
    this.hasFocus = false;
  };

  private readonly onLinkClick = (e: Event): void => {
    const btn = e.currentTarget;
    if (!(btn instanceof HTMLElement)) return;
    const cell = Number(btn.dataset.cell);
    if (Number.isInteger(cell) && cell >= 0) this.focusCell(cell);
  };

  private cancelPending(): void {
    if (this.rafId !== null) {
      cancelFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.pending = false;
  }

  private detach(): void {
    this.cancelPending();
    const grid = this.gridEl;
    if (grid) {
      grid.removeEventListener('keydown', this.onKeyDown);
      grid.removeEventListener('focusin', this.onFocusIn);
      grid.removeEventListener('focusout', this.onFocusOut);
    }
    this.root?.remove();
    this.root = null;
    this.summaryEl = null;
    this.linksEl = null;
    this.gridEl = null;
    this.host = null;
    this.hasFocus = false;
    this.lastRefresh = -Infinity;
    this.lastWindow = { start: 0, end: 0 };
  }
}

// ---- small platform helpers ---------------------------------------------------------------

let idCounter = 0;
function uniqueId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function scheduleFrame(cb: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
  // Number(): with both DOM and Node timer types loaded, which `setTimeout` overload TypeScript
  // picks depends on file order; a numeric id works with `clearTimeout` everywhere.
  return Number(setTimeout(cb, 0));
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}
