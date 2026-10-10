/**
 * Helpers for the Build editor (WI-03) on top of `editing.ts`: which wall a tap meant, a
 * snapshot edit (so whole-maze operations such as braiding undo in one step) and an SVG export.
 */
import { packWalls, toBase64Url } from './document';
import type { EditOp } from './editing';
import { Dir, NO_CELL, cellCount, colOf, neighbor, rowOf, type CellId, type Grid } from './grid';
import { hasWall, type MazeState } from './walls';

export interface WallRef {
  /** The cell the wall belongs to, and its neighbour across the wall. */
  readonly a: CellId;
  readonly b: CellId;
  readonly dir: Dir;
}

/**
 * The inner wall nearest to a point inside `cell` (`fx`, `fy` in 0..1 from the cell's top-left),
 * or null when the point is near the middle of the cell (closer than `margin` to no edge) or the
 * nearest edge is the maze's outer boundary (which cannot be opened).
 */
export function nearestWall(
  grid: Grid,
  cell: CellId,
  fx: number,
  fy: number,
  margin = 0.3,
): WallRef | null {
  const edges: Array<{ dir: Dir; d: number }> = [
    { dir: Dir.N, d: fy },
    { dir: Dir.E, d: 1 - fx },
    { dir: Dir.S, d: 1 - fy },
    { dir: Dir.W, d: fx },
  ];
  edges.sort((p, q) => p.d - q.d);
  const best = edges[0];
  if (!best || best.d > margin) return null;
  const b = neighbor(grid, cell, best.dir);
  if (b === NO_CELL) return null;
  return { a: cell, b, dir: best.dir };
}

/** An edit that restores `state` exactly (used for braid, clear, fill: one undo step). */
export function snapshotEdit(state: MazeState): EditOp {
  return {
    t: 'restore',
    width: state.grid.width,
    height: state.grid.height,
    walls: toBase64Url(packWalls(state.walls)),
    start: state.start,
    goal: state.goal,
  };
}

export interface SvgOptions {
  readonly cellSize?: number;
  readonly wallWidth?: number;
  readonly background?: string;
  readonly cell?: string;
  readonly wall?: string;
  readonly start?: string;
  readonly goal?: string;
}

/**
 * A standalone SVG of the maze: one rectangle for the floor, one path for every wall (each wall
 * drawn once), circles for start and goal. Deterministic output for the same maze and options.
 */
export function mazeToSvg(state: MazeState, opts: SvgOptions = {}): string {
  const cs = opts.cellSize ?? 20;
  const ww = opts.wallWidth ?? Math.max(1, Math.round(cs / 10));
  const { grid, walls } = state;
  const w = grid.width * cs;
  const h = grid.height * cs;
  const pad = ww;
  const segs: string[] = [];
  for (let c = 0; c < cellCount(grid); c++) {
    const x = colOf(grid, c) * cs + pad;
    const y = rowOf(grid, c) * cs + pad;
    // North and west walls of every cell, plus east/south on the outer boundary: each wall once.
    if (hasWall(walls, c, Dir.N)) segs.push(`M${x} ${y}h${cs}`);
    if (hasWall(walls, c, Dir.W)) segs.push(`M${x} ${y}v${cs}`);
    if (hasWall(walls, c, Dir.E) && neighbor(grid, c, Dir.E) === NO_CELL) {
      segs.push(`M${x + cs} ${y}v${cs}`);
    }
    if (hasWall(walls, c, Dir.S) && neighbor(grid, c, Dir.S) === NO_CELL) {
      segs.push(`M${x} ${y + cs}h${cs}`);
    }
  }
  const centre = (cell: CellId): [number, number] => [
    colOf(grid, cell) * cs + pad + cs / 2,
    rowOf(grid, cell) * cs + pad + cs / 2,
  ];
  const [sx, sy] = centre(state.start);
  const [gx, gy] = centre(state.goal);
  const r = cs * 0.25;
  const W = w + 2 * pad;
  const H = h + 2 * pad;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(W)}" height="${String(H)}" viewBox="0 0 ${String(W)} ${String(H)}">`,
    `<rect width="${String(W)}" height="${String(H)}" fill="${opts.background ?? '#71adf5'}"/>`,
    `<rect x="${String(pad)}" y="${String(pad)}" width="${String(w)}" height="${String(h)}" fill="${opts.cell ?? '#417505'}"/>`,
    `<path d="${segs.join('')}" stroke="${opts.wall ?? '#000000'}" stroke-width="${String(ww)}" stroke-linecap="square" fill="none"/>`,
    `<circle cx="${String(sx)}" cy="${String(sy)}" r="${String(r)}" fill="${opts.start ?? '#f5d000'}"/>`,
    `<circle cx="${String(gx)}" cy="${String(gy)}" r="${String(r)}" fill="${opts.goal ?? '#e53935'}"/>`,
    '</svg>',
  ].join('');
}
