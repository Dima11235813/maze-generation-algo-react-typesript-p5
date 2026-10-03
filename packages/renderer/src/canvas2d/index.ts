/**
 * Canvas 2D adapter: top-down view of a maze plus generation/solve overlays.
 *
 * Every coordinate is snapped to device pixels so adjacent cells never show seams and walls
 * stay crisp (the legacy app papered over this with a `+1` pixel hack). The whole frame is
 * redrawn on demand; `requestRender()` coalesces to one draw per animation frame.
 */
import {
  NO_CELL,
  cellCount,
  colOf,
  rowOf,
  type CellId,
  type GenerationTracker,
  type MazeState,
  type SolveTracker,
} from '@maze/core';
import { legacyCellColor, legacyCurrentColor, resolve, rgbToCss } from '../color';
import {
  cellAt,
  clampZoom,
  collectWallSegments,
  createSegmentBuffer,
  fitScale,
  headingVector,
  mazeExtent,
  wheelZoomFactor,
  type Point2,
  type SegmentBuffer,
} from '../layout';
import { SOLVE_TINT_ALPHA, solveMarkColor } from '../overlay';
import { TreeScene, smoothstep } from '../tree';
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
import { drawTree2d, nearestTreeCell } from './tree';

const DEFAULT_CAMERA: CameraState = { preset: 'top', followPointer: false, zoom: 1 };
/** CSS pixels of breathing room around the maze at zoom 1. */
const MARGIN_CSS_PX = 12;
/** Pointer travel (CSS px) above which a pointerup is a drag, not a click. */
const CLICK_SLOP_PX = 6;

/** Device-pixel placement of the maze for the current frame. */
interface Layout {
  /** Device pixels per maze-local unit. */
  scale: number;
  /** Device-pixel offset of the maze's top-left corner. */
  ox: number;
  oy: number;
}

export function createCanvas2dRenderer(opts: RendererFactoryOptions): Renderer {
  return new Canvas2dRenderer(opts);
}

class Canvas2dRenderer implements Renderer {
  readonly kind = '2d' as const;

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private observer: ResizeObserver | null = null;
  private rafId: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  private dpr = 1;
  private widthPx = 0;
  private heightPx = 0;

  private maze: MazeState | null = null;
  private gen: GenerationTracker | null = null;
  private solve: SolveTracker | null = null;
  private theme: RenderTheme;
  private options: RenderOptions;
  private camera: CameraState;
  private fp: FirstPersonState | null = null;
  private events: RendererEvents;

  private segments: SegmentBuffer | null = null;
  private xs = new Float64Array(0);
  private ys = new Float64Array(0);
  private readonly pt: Point2 = { x: 0, y: 0 };
  /** css colour strings keyed by (visitCount, depthAtVisit); cleared when the theme changes. */
  private readonly cellColorCache = new Map<number, string>();
  private layout: Layout = { scale: 1, ox: 0, oy: 0 };
  private downX = 0;
  private downY = 0;
  /** Tree view state while `options.tree` asks for a 2D tree layout; null otherwise. */
  private treeScene: TreeScene | null = null;
  private treeX = new Float64Array(0);
  private treeY = new Float64Array(0);
  private lastFrameTime = 0;

  constructor(opts: RendererFactoryOptions) {
    this.theme = opts.theme;
    this.options = opts.options;
    this.camera = opts.camera ?? DEFAULT_CAMERA;
    this.events = opts.events ?? {};
  }

  // ---- Renderer port ----------------------------------------------------------------------

  mount(host: HTMLElement): void {
    if (this.host) this.detach();
    this.host = host;
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Maze, top-down view');
    host.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => { this.resize(); });
      this.observer.observe(host);
    }
    this.resize();
  }

  setMaze(state: MazeState | null): void {
    this.maze = state;
    this.segments = state ? createSegmentBuffer(state.grid) : null;
    this.requestRender();
  }

  setGeneration(tracker: GenerationTracker | null): void {
    this.gen = tracker;
    this.requestRender();
  }

  setSolve(tracker: SolveTracker | null): void {
    this.solve = tracker;
    this.requestRender();
  }

  setTheme(theme: RenderTheme): void {
    this.theme = theme;
    this.cellColorCache.clear();
    this.requestRender();
  }

  setOptions(options: RenderOptions): void {
    this.options = options;
    this.requestRender();
  }

  setCamera(camera: CameraState): void {
    this.camera = { ...camera, zoom: clampZoom(camera.zoom) };
    this.requestRender();
  }

  setFirstPerson(state: FirstPersonState | null): void {
    this.fp = state;
    this.requestRender();
  }

  setPointer(_pointer: PointerState | null): void {
    // The 2D view has no parallax or pointer light; nothing to do.
  }

  setEvents(events: RendererEvents): void {
    this.events = events;
  }

  resize(): void {
    const { host, canvas } = this;
    if (!host || !canvas) return;
    const cssW = host.clientWidth;
    const cssH = host.clientHeight;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(cssW * this.dpr));
    const h = Math.max(1, Math.round(cssH * this.dpr));
    if (w !== this.widthPx || h !== this.heightPx) {
      this.widthPx = w;
      this.heightPx = h;
      canvas.width = w;
      canvas.height = h;
    }
    this.requestRender();
  }

  requestRender(): void {
    if (this.rafId !== null || this.timerId !== null || !this.ctx) return;
    if (typeof requestAnimationFrame === 'function') {
      this.rafId = requestAnimationFrame((time) => {
        this.rafId = null;
        this.draw(time);
      });
    } else {
      this.timerId = setTimeout(() => {
        this.timerId = null;
        this.draw(this.lastFrameTime + 16);
      }, 16);
    }
  }

  toDataURL(): string {
    if (!this.canvas) return '';
    this.draw();
    return this.canvas.toDataURL('image/png');
  }

  destroy(): void {
    this.detach();
    this.maze = null;
    this.gen = null;
    this.solve = null;
    this.segments = null;
    this.treeScene = null;
    this.cellColorCache.clear();
  }

  // ---- interaction ------------------------------------------------------------------------

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const zoom = clampZoom(this.camera.zoom * wheelZoomFactor(e.deltaY));
    if (zoom === this.camera.zoom) return;
    this.camera = { ...this.camera, zoom };
    this.events.onCameraChange?.(this.camera);
    this.requestRender();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.events.onPointerMove?.(this.normalizePointer(e));
  };

  private readonly onPointerLeave = (): void => {
    this.events.onPointerMove?.(null);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > CLICK_SLOP_PX) return;
    this.events.onCellClick?.(this.cellFromClient(e.clientX, e.clientY), e);
  };

  /** Pointer position normalised to [-1, 1]; x grows right, y grows down (screen-like). */
  private normalizePointer(e: PointerEvent): PointerState {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
    };
  }

  private cellFromClient(clientX: number, clientY: number): CellId | null {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect || !this.maze) return null;
    if (this.treeScene && smoothstep(this.treeScene.morph) > 0.5) {
      return nearestTreeCell(
        this.treeScene,
        this.treeX,
        this.treeY,
        (clientX - rect.left) * this.dpr,
        (clientY - rect.top) * this.dpr,
        16 * this.dpr,
      );
    }
    const { scale, ox, oy } = this.layout;
    if (!(scale > 0)) return null;
    const lx = ((clientX - rect.left) * this.dpr - ox) / scale;
    const ly = ((clientY - rect.top) * this.dpr - oy) / scale;
    return cellAt(this.maze.grid, lx, ly, this.options.cellSize);
  }

  private detach(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    if (this.timerId !== null) clearTimeout(this.timerId);
    this.timerId = null;
    this.observer?.disconnect();
    this.observer = null;
    const canvas = this.canvas;
    if (canvas) {
      canvas.removeEventListener('wheel', this.onWheel);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerleave', this.onPointerLeave);
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.remove();
    }
    this.canvas = null;
    this.ctx = null;
    this.host = null;
    this.widthPx = 0;
    this.heightPx = 0;
  }

  // ---- drawing ----------------------------------------------------------------------------

  private computeLayout(maze: MazeState): Layout {
    const { width, height } = mazeExtent(maze.grid, this.options.cellSize);
    const base = fitScale(this.widthPx, this.heightPx, width, height, MARGIN_CSS_PX * this.dpr);
    const scale = base * this.camera.zoom;
    return {
      scale,
      ox: (this.widthPx - width * scale) / 2,
      oy: (this.heightPx - height * scale) / 2,
    };
  }

  private draw(time?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = time ?? (this.lastFrameTime > 0 ? this.lastFrameTime + 16 : 0);
    const dt = this.lastFrameTime > 0 ? Math.min(100, Math.max(0, now - this.lastFrameTime)) : 16;
    this.lastFrameTime = now;
    const { theme, widthPx: W, heightPx: H } = this;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = rgbToCss(resolve(theme, theme.background));
    ctx.fillRect(0, 0, W, H);

    const maze = this.maze;
    if (!maze || W === 0 || H === 0) return;

    const { grid } = maze;
    const cs = this.options.cellSize;
    const layout = this.computeLayout(maze);
    this.layout = layout;
    const px = cs * layout.scale;
    const w = grid.width;
    const h = grid.height;

    // Snapped grid-line coordinates shared by cells, walls and overlays.
    if (this.xs.length !== w + 1) this.xs = new Float64Array(w + 1);
    if (this.ys.length !== h + 1) this.ys = new Float64Array(h + 1);
    const xs = this.xs;
    const ys = this.ys;
    for (let c = 0; c <= w; c++) xs[c] = Math.round(layout.ox + c * px);
    for (let r = 0; r <= h; r++) ys[r] = Math.round(layout.oy + r * px);

    const view = this.options.tree;
    if (view && view.layout !== '3d') {
      this.drawTreeView(ctx, maze, xs, ys, px, dt);
      return;
    }
    this.treeScene = null;
    this.lastFrameTime = 0;

    this.drawCells(ctx, maze, xs, ys);
    if (this.options.showGrid) this.drawGrid(ctx, xs, ys, w, h);
    if (this.solve) this.drawSolveTint(ctx, this.solve, xs, ys, w, h);
    this.drawCurrent(ctx, xs, ys, w);
    this.drawWalls(ctx, maze, xs, ys, layout.scale);
    if (this.solve?.path) this.drawPath(ctx, maze, this.solve.path, xs, ys, px);
    if (this.solve && this.solve.current !== NO_CELL && !this.solve.done) {
      this.drawSolveCurrent(ctx, this.solve.current, xs, ys, w, px);
    }
    if (this.options.showStartGoal) this.drawMarkers(ctx, maze, xs, ys, px);
    if (this.fp) this.drawAvatar(ctx, maze, this.fp, xs, ys, px);
  }

  /**
   * Tree view: the maze fades out while its passages are pulled into the tree. Keeps
   * requesting frames while the tree is still easing into place.
   */
  private drawTreeView(
    ctx: CanvasRenderingContext2D,
    maze: MazeState,
    xs: Float64Array,
    ys: Float64Array,
    px: number,
    dt: number,
  ): void {
    const view = this.options.tree;
    if (!view) return;
    const scene = (this.treeScene ??= new TreeScene());
    scene.update(maze, this.gen, view);
    scene.step(dt, view.morph, this.options.reducedMotion);

    const fade = 1 - smoothstep(scene.morph / 0.35);
    if (fade > 0.01) {
      ctx.globalAlpha = fade;
      this.drawCells(ctx, maze, xs, ys);
      this.drawWalls(ctx, maze, xs, ys, this.layout.scale);
      ctx.globalAlpha = 1;
    }
    const n = maze.grid.width * maze.grid.height;
    if (this.treeX.length !== n) {
      this.treeX = new Float64Array(n);
      this.treeY = new Float64Array(n);
    }
    const w = maze.grid.width;
    drawTree2d({
      ctx,
      width: this.widthPx,
      height: this.heightPx,
      dpr: this.dpr,
      zoom: this.camera.zoom,
      theme: this.theme,
      view,
      showStartGoal: this.options.showStartGoal,
      maze,
      gen: this.gen,
      solve: this.solve,
      scene,
      gridX: (c) => this.centerX(xs, c % w),
      gridY: (c) => this.centerY(ys, Math.floor(c / w)),
      cellPx: px,
      outX: this.treeX,
      outY: this.treeY,
    });
    if (scene.animating) this.requestRender();
    else this.lastFrameTime = 0;
  }

  private cellCss(visitCount: number, depthAtVisit: number): string {
    const key = visitCount * 16_777_216 + (depthAtVisit + 1);
    let css = this.cellColorCache.get(key);
    if (css === undefined) {
      css = rgbToCss(legacyCellColor(this.theme, visitCount, depthAtVisit));
      this.cellColorCache.set(key, css);
    }
    return css;
  }

  private drawCells(
    ctx: CanvasRenderingContext2D,
    maze: MazeState,
    xs: Float64Array,
    ys: Float64Array,
  ): void {
    const { grid } = maze;
    const w = grid.width;
    const h = grid.height;
    const gen = this.gen;
    const base = rgbToCss(resolve(this.theme, this.theme.cell));
    for (let row = 0; row < h; row++) {
      const y0 = ys[row] as number;
      const rowH = (ys[row + 1] as number) - y0;
      for (let col = 0; col < w; col++) {
        const cell = row * w + col;
        if (gen && !gen.isSeen(cell)) continue;
        ctx.fillStyle = gen
          ? this.cellCss(gen.visitCount[cell] ?? 0, gen.depthAtVisit[cell] ?? -1)
          : base;
        const x0 = xs[col] as number;
        ctx.fillRect(x0, y0, (xs[col + 1] as number) - x0, rowH);
      }
    }
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    xs: Float64Array,
    ys: Float64Array,
    w: number,
    h: number,
  ): void {
    ctx.strokeStyle = rgbToCss(resolve(this.theme, this.theme.wall), 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const top = ys[0] as number;
    const bottom = ys[h] as number;
    const left = xs[0] as number;
    const right = xs[w] as number;
    for (let c = 0; c <= w; c++) {
      const x = (xs[c] as number) + 0.5;
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let r = 0; r <= h; r++) {
      const y = (ys[r] as number) + 0.5;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  private drawSolveTint(
    ctx: CanvasRenderingContext2D,
    solve: SolveTracker,
    xs: Float64Array,
    ys: Float64Array,
    w: number,
    h: number,
  ): void {
    const { theme } = this;
    const css = [1, 2, 3].map((mark) => {
      const c = solveMarkColor(theme, mark);
      return c ? rgbToCss(resolve(theme, c), SOLVE_TINT_ALPHA) : '';
    });
    const marks = solve.marks;
    for (let row = 0; row < h; row++) {
      const y0 = ys[row] as number;
      const rowH = (ys[row + 1] as number) - y0;
      for (let col = 0; col < w; col++) {
        const mark = marks[row * w + col] ?? 0;
        if (mark === 0) continue;
        ctx.fillStyle = css[mark - 1] as string;
        const x0 = xs[col] as number;
        ctx.fillRect(x0, y0, (xs[col + 1] as number) - x0, rowH);
      }
    }
  }

  private drawCurrent(
    ctx: CanvasRenderingContext2D,
    xs: Float64Array,
    ys: Float64Array,
    w: number,
  ): void {
    const gen = this.gen;
    if (!gen || gen.done || gen.current === NO_CELL) return;
    const cell = gen.current;
    const { color, alpha } = legacyCurrentColor(this.theme, gen.visitCount[cell] ?? 0);
    const col = cell % w;
    const row = Math.floor(cell / w);
    const x0 = xs[col] as number;
    const y0 = ys[row] as number;
    ctx.fillStyle = rgbToCss(color, alpha);
    ctx.fillRect(x0, y0, (xs[col + 1] as number) - x0, (ys[row + 1] as number) - y0);
  }

  private drawWalls(
    ctx: CanvasRenderingContext2D,
    maze: MazeState,
    xs: Float64Array,
    ys: Float64Array,
    scale: number,
  ): void {
    const segments = this.segments ?? (this.segments = createSegmentBuffer(maze.grid));
    const gen = this.gen;
    const n = collectWallSegments(maze, segments, gen ? (c) => gen.isSeen(c) : undefined);
    if (n === 0) return;

    const lineWidth = Math.max(1, Math.round(this.options.wallWidth * scale));
    const off = lineWidth % 2 === 1 ? 0.5 : 0; // centre odd widths on the pixel grid
    ctx.strokeStyle = rgbToCss(resolve(this.theme, this.theme.wall));
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'square';
    ctx.beginPath();

    const w = maze.grid.width;
    const cells = segments.cells;
    const dirs = segments.dirs;
    for (let i = 0; i < n; i++) {
      const cell = cells[i] as number;
      const col = cell % w;
      const row = (cell - col) / w;
      const x0 = (xs[col] as number) + off;
      const x1 = (xs[col + 1] as number) + off;
      const y0 = (ys[row] as number) + off;
      const y1 = (ys[row + 1] as number) + off;
      switch (dirs[i]) {
        case 0: // N
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y0);
          break;
        case 1: // E
          ctx.moveTo(x1, y0);
          ctx.lineTo(x1, y1);
          break;
        case 2: // S
          ctx.moveTo(x0, y1);
          ctx.lineTo(x1, y1);
          break;
        default: // W
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0, y1);
          break;
      }
    }
    ctx.stroke();
  }

  private centerX(xs: Float64Array, col: number): number {
    return ((xs[col] as number) + (xs[col + 1] as number)) / 2;
  }

  private centerY(ys: Float64Array, row: number): number {
    return ((ys[row] as number) + (ys[row + 1] as number)) / 2;
  }

  private drawPath(
    ctx: CanvasRenderingContext2D,
    maze: MazeState,
    path: readonly CellId[],
    xs: Float64Array,
    ys: Float64Array,
    px: number,
  ): void {
    if (path.length === 0) return;
    const { grid } = maze;
    ctx.strokeStyle = rgbToCss(resolve(this.theme, this.theme.path));
    ctx.lineWidth = Math.max(2, px * 0.3);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const cell = path[i] as CellId;
      const x = this.centerX(xs, colOf(grid, cell));
      const y = this.centerY(ys, rowOf(grid, cell));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawSolveCurrent(
    ctx: CanvasRenderingContext2D,
    cell: CellId,
    xs: Float64Array,
    ys: Float64Array,
    w: number,
    px: number,
  ): void {
    const col = cell % w;
    const row = Math.floor(cell / w);
    const inset = Math.max(1, px * 0.1);
    ctx.strokeStyle = rgbToCss(resolve(this.theme, this.theme.path));
    ctx.lineWidth = Math.max(1, px * 0.08);
    const x0 = (xs[col] as number) + inset;
    const y0 = (ys[row] as number) + inset;
    ctx.strokeRect(
      x0,
      y0,
      (xs[col + 1] as number) - x0 - inset,
      (ys[row + 1] as number) - y0 - inset,
    );
  }

  private drawMarkers(
    ctx: CanvasRenderingContext2D,
    maze: MazeState,
    xs: Float64Array,
    ys: Float64Array,
    px: number,
  ): void {
    const { grid, start, goal } = maze;
    const gen = this.gen;
    if (!gen || gen.isSeen(start)) {
      const cx = this.centerX(xs, colOf(grid, start));
      const cy = this.centerY(ys, rowOf(grid, start));
      ctx.fillStyle = rgbToCss(resolve(this.theme, this.theme.start));
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, px * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    if (!gen || gen.isSeen(goal)) {
      const cx = this.centerX(xs, colOf(grid, goal));
      const cy = this.centerY(ys, rowOf(grid, goal));
      const r = Math.max(2, px * 0.3);
      ctx.fillStyle = rgbToCss(resolve(this.theme, this.theme.goal));
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawAvatar(
    ctx: CanvasRenderingContext2D,
    maze: MazeState,
    fp: FirstPersonState,
    xs: Float64Array,
    ys: Float64Array,
    px: number,
  ): void {
    const { grid } = maze;
    if (fp.cell < 0 || fp.cell >= cellCount(grid)) return;
    const cx = this.centerX(xs, colOf(grid, fp.cell));
    const cy = this.centerY(ys, rowOf(grid, fp.cell));
    const dir = headingVector(fp.heading, this.pt);
    const hx = dir.x;
    const hy = dir.y;
    const color = resolve(this.theme, this.theme.player);

    // soft ring
    ctx.strokeStyle = rgbToCss(color, fp.peek ? 0.9 : 0.55);
    ctx.lineWidth = Math.max(1, px * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    // heading triangle
    const tipX = cx + hx * px * 0.34;
    const tipY = cy + hy * px * 0.34;
    const baseX = cx - hx * px * 0.22;
    const baseY = cy - hy * px * 0.22;
    const perpX = -hy * px * 0.22;
    const perpY = hx * px * 0.22;
    ctx.fillStyle = rgbToCss(color);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + perpX, baseY + perpY);
    ctx.lineTo(baseX - perpX, baseY - perpY);
    ctx.closePath();
    ctx.fill();
  }
}
