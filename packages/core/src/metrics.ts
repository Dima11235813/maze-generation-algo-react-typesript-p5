/**
 * Maze metrics computed from a `MazeState`. Formulas are documented in
 * proj-mgmt/02-domain-model-and-algorithms.md section 6.
 */
import { cellCount, type CellId } from './grid';
import { openDirs, openNeighbors, passageCount, type MazeState } from './walls';

/** BFS distances from `from` through open passages; -1 for unreachable cells. */
export function distances(state: MazeState, from: CellId): Int32Array {
  const total = cellCount(state.grid);
  const dist = new Int32Array(total).fill(-1);
  const queue: CellId[] = [from];
  dist[from] = 0;
  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++] as CellId;
    const d = dist[cell] ?? 0;
    for (const nb of openNeighbors(state, cell)) {
      if (dist[nb] === -1) {
        dist[nb] = d + 1;
        queue.push(nb);
      }
    }
  }
  return dist;
}

function farthest(dist: Int32Array): { cell: CellId; distance: number } {
  let best = 0;
  let bestCell = 0;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i] ?? -1;
    if (d > best) {
      best = d;
      bestCell = i;
    }
  }
  return { cell: bestCell, distance: best };
}

/** Cells with exactly one open passage. */
export function deadEnds(state: MazeState): number {
  let n = 0;
  const total = cellCount(state.grid);
  for (let id = 0; id < total; id++) if (openDirs(state, id).length === 1) n++;
  return n;
}

/** Number of moves on the shortest start->goal path, or null when unreachable. */
export function solutionLength(state: MazeState): number | null {
  const d = distances(state, state.start)[state.goal] ?? -1;
  return d < 0 ? null : d;
}

/** Longest shortest-path in the maze (tree diameter via double BFS). */
export function diameter(state: MazeState): { length: number; from: CellId; to: CellId } {
  const first = farthest(distances(state, state.start));
  const second = farthest(distances(state, first.cell));
  return { length: second.distance, from: first.cell, to: second.cell };
}

export interface MazeMetrics {
  cells: number;
  passages: number;
  deadEnds: number;
  /** deadEnds / cells. */
  deadEndRatio: number;
  solutionLength: number | null;
  diameter: number;
  /** Mean number of open passages per cell (2 * passages / cells). */
  averageDegree: number;
  /** Cells with 3 or 4 open passages. */
  junctions: number;
}

export function computeMetrics(state: MazeState): MazeMetrics {
  const cells = cellCount(state.grid);
  const passages = passageCount(state);
  let dead = 0;
  let junctions = 0;
  for (let id = 0; id < cells; id++) {
    const deg = openDirs(state, id).length;
    if (deg === 1) dead++;
    if (deg >= 3) junctions++;
  }
  return {
    cells,
    passages,
    deadEnds: dead,
    deadEndRatio: cells > 0 ? dead / cells : 0,
    solutionLength: solutionLength(state),
    diameter: diameter(state).length,
    averageDegree: cells > 0 ? (2 * passages) / cells : 0,
    junctions,
  };
}

/** `mm:ss` (or `h:mm:ss` past an hour). Fixes the legacy `Math.floor(seconds * 100)` bug. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
