/**
 * TreeScene: the renderer-side state of the Tree view, shared by the 2D and 3D adapters.
 *
 * It re-derives the maze's spanning tree whenever the maze or the generation advanced, lays it
 * out with the chosen layout, normalises the layout into a unit box and eases every cell from
 * where it was drawn last frame towards its new place. New cells sprout from their parent, the
 * whole tree re-roots smoothly when generation finishes (the growing forest is rooted at its
 * oldest cells; the finished maze at the start, with the solution as its trunk), and the
 * maze <-> tree morph is eased the same way.
 */
import {
  ALL_WALLS,
  type CellId,
  type SolveTracker,
  cellCount,
  layout3d,
  radialLayout,
  tidyLayout,
  treeify,
  type GenerationTracker,
  type MazeState,
  type MazeTree,
  type TreeLayout,
} from '@maze/core';
import { legacyCellColor } from './color';
import { solveMarkColor } from './overlay';
import type { RGB, RenderTheme, TreeLayoutKind, TreeViewOptions } from './types';

/** Time constant of the position ease, ms (about 95 % of the way in three of these). */
const POSITION_TAU_MS = 140;
const MORPH_TAU_MS = 380;
const SETTLED = 1e-4;

export const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

const ease = (from: number, to: number, k: number): number => from + (to - from) * k;

/**
 * Colour of a tree node (and of the branch leading to it): the solver's mark while solving,
 * the generation colours while the maze grows, the cell colour otherwise.
 */
export function treeNodeColor(
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

export class TreeScene {
  tree: MazeTree | null = null;
  /**
   * Normalised positions being drawn. 2D: x in [0, 1] left to right, y in [0, 1] bottom to top.
   * 3D: y in [0, 1] (height), x and z centred on the first trunk. NaN until a cell is placed.
   */
  x = new Float64Array(0);
  y = new Float64Array(0);
  z = new Float64Array(0);
  /** Width / height of the layout in layout units (2D radial keeps it when fitting). */
  aspect = 1;
  /** True when the layout must keep its aspect ratio (radial); tidy trees stretch to fit. */
  uniform = false;
  /** Eased maze <-> tree morph, 0..1 (apply `smoothstep` when interpolating). */
  morph = 0;
  /** True while anything is still easing. */
  animating = false;

  private tx = new Float64Array(0);
  private ty = new Float64Array(0);
  private tz = new Float64Array(0);
  private key = '';
  private lastMaze: MazeState | null = null;
  private lastGen: GenerationTracker | null = null;
  private pullKey: number | undefined = undefined;

  /**
   * Re-derives the tree when the maze, the generation or the layout changed. Cheap otherwise.
   * Returns true when the topology was rebuilt.
   */
  update(maze: MazeState, gen: GenerationTracker | null, view: TreeViewOptions): boolean {
    if (view.pullKey !== this.pullKey) {
      if (this.pullKey !== undefined) this.morph = 0;
      this.pullKey = view.pullKey;
      this.animating = true;
    }
    const growing = gen !== null && !gen.done;
    const key = `${view.layout}|${growing ? gen.steps : 'done'}|${maze.start}|${maze.goal}`;
    if (this.lastMaze === maze && this.lastGen === gen && this.key === key) return false;
    this.lastMaze = maze;
    this.lastGen = gen;
    this.key = key;

    const n = cellCount(maze.grid);
    if (this.x.length !== n) {
      this.x = new Float64Array(n).fill(Number.NaN);
      this.y = new Float64Array(n).fill(Number.NaN);
      this.z = new Float64Array(n).fill(Number.NaN);
      this.tx = new Float64Array(n);
      this.ty = new Float64Array(n);
      this.tz = new Float64Array(n);
    }
    const { walls } = maze;
    const tree = growing
      ? treeify(maze, {
          include: (c) => gen.isSeen(c) || (walls[c] ?? ALL_WALLS) !== ALL_WALLS,
          rank: (c) => {
            const order = gen.seenOrder[c] ?? -1;
            return order >= 0 ? order : n + c;
          },
        })
      : treeify(maze, { root: maze.start, target: maze.goal });
    this.tree = tree;
    this.place(tree, view.layout);
    this.animating = true;
    return true;
  }

  /** Advances the eases by `dtMs`; returns true while still moving. */
  step(dtMs: number, targetMorph: number, reducedMotion: boolean): boolean {
    const tree = this.tree;
    const goal = Math.min(1, Math.max(0, targetMorph));
    if (!tree) {
      this.morph = goal;
      this.animating = false;
      return false;
    }
    const kPos = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / POSITION_TAU_MS);
    const kMorph = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / MORPH_TAU_MS);
    let moving = false;
    for (let i = 0; i < tree.count; i++) {
      const c = tree.order[i] as number;
      const p = tree.parent[c] as number;
      if (Number.isNaN(this.x[c])) {
        // Sprout from the parent (or appear in place for roots).
        const fromParent = p >= 0 && !Number.isNaN(this.x[p]);
        this.x[c] = fromParent ? (this.x[p] as number) : (this.tx[c] as number);
        this.y[c] = fromParent ? (this.y[p] as number) : (this.ty[c] as number);
        this.z[c] = fromParent ? (this.z[p] as number) : (this.tz[c] as number);
      }
      const nx = ease(this.x[c] as number, this.tx[c] as number, kPos);
      const ny = ease(this.y[c] as number, this.ty[c] as number, kPos);
      const nz = ease(this.z[c] as number, this.tz[c] as number, kPos);
      if (
        Math.abs(nx - (this.tx[c] as number)) > SETTLED ||
        Math.abs(ny - (this.ty[c] as number)) > SETTLED ||
        Math.abs(nz - (this.tz[c] as number)) > SETTLED
      ) {
        moving = true;
      }
      this.x[c] = nx;
      this.y[c] = ny;
      this.z[c] = nz;
    }
    this.morph = ease(this.morph, goal, kMorph);
    if (Math.abs(this.morph - goal) > SETTLED) moving = true;
    else this.morph = goal;
    this.animating = moving;
    return moving;
  }

  private place(tree: MazeTree, kind: TreeLayoutKind): void {
    const layout: TreeLayout =
      kind === 'radial' ? radialLayout(tree) : kind === '3d' ? layout3d(tree) : tidyLayout(tree);
    const spanX = Math.max(1, layout.maxX - layout.minX);
    const spanY = Math.max(1, layout.maxY - layout.minY);
    this.uniform = kind === 'radial';
    this.aspect = spanX / spanY;
    if (kind === '3d') {
      // Height 0..1; the trunk of the first component on the axis. Very wide trees are squeezed
      // horizontally so the tree, not one long branch, fills the view.
      const root = tree.roots[0] ?? 0;
      const ox = layout.x[root] ?? 0;
      const oz = layout.z[root] ?? 0;
      let reach = 1;
      for (let i = 0; i < tree.count; i++) {
        const c = tree.order[i] as number;
        reach = Math.max(
          reach,
          Math.abs((layout.x[c] as number) - ox),
          Math.abs((layout.z[c] as number) - oz),
        );
      }
      const k = 1 / spanY;
      const squeeze = Math.min(1, (0.6 * spanY) / reach);
      for (let i = 0; i < tree.count; i++) {
        const c = tree.order[i] as number;
        this.tx[c] = ((layout.x[c] as number) - ox) * k * squeeze;
        this.ty[c] = ((layout.y[c] as number) - layout.minY) * k;
        this.tz[c] = ((layout.z[c] as number) - oz) * k * squeeze;
      }
      return;
    }
    for (let i = 0; i < tree.count; i++) {
      const c = tree.order[i] as number;
      this.tx[c] = ((layout.x[c] as number) - layout.minX) / spanX;
      this.ty[c] = ((layout.y[c] as number) - layout.minY) / spanY;
      this.tz[c] = 0;
    }
    // A single cell (or a single row) has no span: centre it.
    if (layout.maxX === layout.minX)
      for (let i = 0; i < tree.count; i++) this.tx[tree.order[i] as number] = 0.5;
  }
}
