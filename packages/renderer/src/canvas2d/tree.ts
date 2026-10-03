/**
 * 2D drawing of the Tree view (tidy and radial layouts) on the canvas adapter.
 *
 * Every cell is drawn at a blend of where it sits in the maze and where it sits in the tree
 * (`scene.morph`), so the morph literally pulls the maze's passages out into a tree. Branches
 * get thicker towards the root (width grows with the number of cells they carry) and take the
 * colour of the cells they lead to: generation colours while growing, solver marks while
 * solving.
 */
import {
  NO_CELL,
  type CellId,
  type GenerationTracker,
  type MazeState,
  type SolveTracker,
} from '@maze/core';
import { legacyCellColor, legacyCurrentColor, resolve, rgbToCss } from '../color';
import { solveMarkColor } from '../overlay';
import { smoothstep, type TreeScene } from '../tree';
import type { RGB, RenderTheme, TreeViewOptions } from '../types';

export interface TreeDraw2dInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly zoom: number;
  readonly theme: RenderTheme;
  readonly view: TreeViewOptions;
  readonly showStartGoal: boolean;
  readonly maze: MazeState;
  readonly gen: GenerationTracker | null;
  readonly solve: SolveTracker | null;
  readonly scene: TreeScene;
  /** Centre of a cell in the maze drawing (device pixels). */
  readonly gridX: (cell: CellId) => number;
  readonly gridY: (cell: CellId) => number;
  /** Size of a maze cell on screen (device pixels), to size lines at morph 0. */
  readonly cellPx: number;
  /** Output: screen position of every drawn cell (device pixels), for hit testing. */
  readonly outX: Float64Array;
  readonly outY: Float64Array;
}

const MARGIN_CSS_PX = 18;

function nodeColor(
  theme: RenderTheme,
  cell: CellId,
  gen: GenerationTracker | null,
  solve: SolveTracker | null,
): RGB {
  if (solve) {
    const mark = solveMarkColor(theme, solve.marks[cell] ?? 0);
    if (mark) return mark;
  }
  if (gen && !gen.done) {
    return legacyCellColor(theme, gen.visitCount[cell] ?? 0, gen.depthAtVisit[cell] ?? -1);
  }
  return theme.cell;
}

/** Draws the tree; returns nothing. Positions of drawn cells land in `outX`/`outY`. */
export function drawTree2d(input: TreeDraw2dInput): void {
  const { ctx, scene, theme, dpr } = input;
  const tree = scene.tree;
  if (!tree || tree.count === 0) return;
  const t = smoothstep(scene.morph);

  // Fit the tree box (stretch for tidy, keep aspect for radial) and apply zoom about the centre.
  const margin = MARGIN_CSS_PX * dpr;
  const availW = Math.max(1, input.width - 2 * margin);
  const availH = Math.max(1, input.height - 2 * margin);
  let boxW = availW;
  let boxH = availH;
  if (scene.uniform) {
    const s = Math.min(availW / scene.aspect, availH);
    boxW = s * scene.aspect;
    boxH = s;
  }
  boxW *= input.zoom;
  boxH *= input.zoom;
  const boxX = (input.width - boxW) / 2;
  const boxY = (input.height - boxH) / 2;

  const { outX, outY } = input;
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const treeX = boxX + (scene.x[c] as number) * boxW;
    const treeY = boxY + boxH - (scene.y[c] as number) * boxH;
    outX[c] = input.gridX(c) + (treeX - input.gridX(c)) * t;
    outY[c] = input.gridY(c) + (treeY - input.gridY(c)) * t;
  }

  // Line widths: at morph 0 like the maze's passages, in the tree like the gap between rows.
  const rowGap = boxH / Math.max(1, tree.height);
  const slotGap = boxW / Math.max(1, tree.leaves || 1);
  const treeBase = Math.min(6 * dpr, Math.max(1 * dpr, Math.min(rowGap, slotGap) * 0.3));
  const gridBase = Math.max(1 * dpr, input.cellPx * 0.22);
  const base = gridBase + (treeBase - gridBase) * t;
  const total = Math.max(1, tree.count);

  // Loop edges (mazes with loops, or a wall-adding generator mid-way): dashed, faint.
  if (tree.loopEdges.length > 0) {
    ctx.save();
    ctx.strokeStyle = rgbToCss(resolve(theme, theme.wall), 0.45);
    ctx.lineWidth = Math.max(1, base * 0.5);
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    for (let i = 0; i < tree.loopEdges.length; i += 2) {
      const a = tree.loopEdges[i] as CellId;
      const b = tree.loopEdges[i + 1] as CellId;
      ctx.moveTo(outX[a] as number, outY[a] as number);
      ctx.lineTo(outX[b] as number, outY[b] as number);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Tree edges, batched by colour and (half-pixel) width.
  const batches = new Map<string, number[]>();
  const cssCache = new Map<number, string>();
  const { gen, solve } = input;
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const p = tree.parent[c] as number;
    if (p < 0) continue;
    const color = nodeColor(theme, c, gen, solve);
    const colorKey = (color.r << 16) | (color.g << 8) | color.b;
    let css = cssCache.get(colorKey);
    if (css === undefined) {
      css = rgbToCss(resolve(theme, color));
      cssCache.set(colorKey, css);
    }
    const w = base * (0.6 + 1.8 * Math.sqrt((tree.subtreeSize[c] as number) / total));
    const key = `${css}|${(Math.round(w * 2) / 2).toFixed(1)}`;
    let list = batches.get(key);
    if (!list) {
      list = [];
      batches.set(key, list);
    }
    list.push(outX[p] as number, outY[p] as number, outX[c] as number, outY[c] as number);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [key, coords] of batches) {
    const sep = key.lastIndexOf('|');
    ctx.strokeStyle = key.slice(0, sep);
    ctx.lineWidth = Number(key.slice(sep + 1));
    ctx.beginPath();
    for (let i = 0; i < coords.length; i += 4) {
      ctx.moveTo(coords[i] as number, coords[i + 1] as number);
      ctx.lineTo(coords[i + 2] as number, coords[i + 3] as number);
    }
    ctx.stroke();
  }

  // Lone cells (a fresh forest) have no edge: draw a dot so they are visible.
  const dot = Math.max(1 * dpr, base * 0.6);
  for (const root of tree.roots) {
    if ((tree.subtreeSize[root] as number) > 1) continue;
    ctx.fillStyle = rgbToCss(resolve(theme, nodeColor(theme, root, gen, solve)));
    ctx.beginPath();
    ctx.arc(outX[root] as number, outY[root] as number, dot, 0, Math.PI * 2);
    ctx.fill();
  }

  // Highlighted branch (outline selection).
  const highlight = input.view.highlight;
  if (highlight && highlight.length > 0) {
    const set = new Set(highlight);
    ctx.strokeStyle = rgbToCss(resolve(theme, theme.current), 0.9);
    ctx.lineWidth = base * 2.2;
    ctx.beginPath();
    for (const c of highlight) {
      const p = tree.parent[c] as number;
      if (p >= 0 && set.has(p)) {
        ctx.moveTo(outX[p] as number, outY[p] as number);
        ctx.lineTo(outX[c] as number, outY[c] as number);
      }
    }
    ctx.stroke();
    if (highlight.length <= 2) {
      for (const c of highlight) {
        ctx.fillStyle = rgbToCss(resolve(theme, theme.current), 0.9);
        ctx.beginPath();
        ctx.arc(outX[c] as number, outY[c] as number, base * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // The solver's path (thick, on top).
  const path = solve?.path;
  if (path && path.length > 1) {
    ctx.strokeStyle = rgbToCss(resolve(theme, theme.path));
    ctx.lineWidth = base * 1.6;
    ctx.beginPath();
    path.forEach((c, i) => {
      if (i === 0) ctx.moveTo(outX[c] as number, outY[c] as number);
      else ctx.lineTo(outX[c] as number, outY[c] as number);
    });
    ctx.stroke();
  }

  // Current cells: the generator's head and the solver's cell.
  if (gen && !gen.done && gen.current !== NO_CELL && tree.included[gen.current] === 1) {
    const { color, alpha } = legacyCurrentColor(theme, gen.visitCount[gen.current] ?? 0);
    ctx.fillStyle = rgbToCss(color, Math.max(alpha, 0.85));
    ctx.beginPath();
    ctx.arc(outX[gen.current] as number, outY[gen.current] as number, base * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (solve && !solve.done && solve.current !== NO_CELL) {
    ctx.strokeStyle = rgbToCss(resolve(theme, theme.path));
    ctx.lineWidth = Math.max(1, base * 0.6);
    ctx.beginPath();
    ctx.arc(outX[solve.current] as number, outY[solve.current] as number, base * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Start (the root once finished) and goal.
  if (input.showStartGoal) {
    const { start, goal } = input.maze;
    const r = Math.max(2.5 * dpr, base * 1.8);
    if (tree.included[start] === 1) {
      ctx.fillStyle = rgbToCss(resolve(theme, theme.start));
      ctx.beginPath();
      ctx.arc(outX[start] as number, outY[start] as number, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (tree.included[goal] === 1) {
      const gx = outX[goal] as number;
      const gy = outY[goal] as number;
      ctx.fillStyle = rgbToCss(resolve(theme, theme.goal));
      ctx.beginPath();
      ctx.moveTo(gx, gy - r * 1.2);
      ctx.lineTo(gx + r * 1.2, gy);
      ctx.lineTo(gx, gy + r * 1.2);
      ctx.lineTo(gx - r * 1.2, gy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Nearest drawn cell to a device-pixel point, within `maxDist`, or null. */
export function nearestTreeCell(
  scene: TreeScene,
  outX: Float64Array,
  outY: Float64Array,
  px: number,
  py: number,
  maxDist: number,
): CellId | null {
  const tree = scene.tree;
  if (!tree) return null;
  let best: CellId | null = null;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const dx = (outX[c] as number) - px;
    const dy = (outY[c] as number) - py;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
