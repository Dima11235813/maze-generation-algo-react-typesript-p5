/**
 * Maze metrics computed from a `MazeState`. Formulas are documented in
 * proj-mgmt/02-domain-model-and-algorithms.md section 6.
 */
import { cellCount, dirBetween, type CellId, type Grid } from './grid';
import type { SolveStats } from './steps';
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

/** Shortest path between two cells (BFS), or null when disconnected. */
export function shortestPath(state: MazeState, from: CellId, to: CellId): CellId[] | null {
  const total = cellCount(state.grid);
  const parent = new Int32Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const queue: CellId[] = [from];
  seen[from] = 1;
  let head = 0;
  let found = from === to;
  while (head < queue.length && !found) {
    const cell = queue[head++] as CellId;
    for (const nb of openNeighbors(state, cell)) {
      if (seen[nb] === 1) continue;
      seen[nb] = 1;
      parent[nb] = cell;
      queue.push(nb);
      if (nb === to) {
        found = true;
        break;
      }
    }
  }
  if (!found) return null;
  const path: CellId[] = [];
  for (let cur = to; cur !== -1; cur = cur === from ? -1 : (parent[cur] ?? -1)) path.push(cur);
  return path.reverse();
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

/** Number of direction changes along a cell path. */
export function turnsAlong(grid: Grid, path: readonly CellId[]): number {
  let turns = 0;
  let prev: number | undefined;
  for (let i = 0; i + 1 < path.length; i++) {
    const d = dirBetween(grid, path[i] as CellId, path[i + 1] as CellId);
    if (d === undefined) continue;
    if (prev !== undefined && d !== prev) turns++;
    prev = d;
  }
  return turns;
}

/** Direction changes per move on the solution path (0 when there is no solution). */
export function twistiness(state: MazeState): number {
  const path = shortestPath(state, state.start, state.goal);
  if (!path || path.length < 2) return 0;
  return turnsAlong(state.grid, path) / (path.length - 1);
}

export interface CorridorStats {
  /** Mean length (in cells) of maximal runs of degree-2 cells; 0 when there are none. */
  river: number;
  corridorCount: number;
  /**
   * Longest dead-end branch: cells walked from a dead end (not start/goal) until a junction,
   * the start, the goal, or another dead end. 0 when the maze has no such branch.
   */
  longestDeadEndCorridor: number;
}

export function corridorStats(state: MazeState): CorridorStats {
  const { start, goal } = state;
  const total = cellCount(state.grid);
  const degree = new Uint8Array(total);
  for (let id = 0; id < total; id++) degree[id] = openDirs(state, id).length;

  // River: connected components of degree-2 cells.
  const seen = new Uint8Array(total);
  let corridorCount = 0;
  let corridorCells = 0;
  for (let id = 0; id < total; id++) {
    if (degree[id] !== 2 || seen[id] === 1) continue;
    corridorCount++;
    const stack: CellId[] = [id];
    seen[id] = 1;
    while (stack.length > 0) {
      const cell = stack.pop() as CellId;
      corridorCells++;
      for (const nb of openNeighbors(state, cell)) {
        if (degree[nb] === 2 && seen[nb] === 0) {
          seen[nb] = 1;
          stack.push(nb);
        }
      }
    }
  }

  // Longest dead-end branch.
  let longest = 0;
  for (let id = 0; id < total; id++) {
    if (degree[id] !== 1 || id === start || id === goal) continue;
    let prev: CellId = -1;
    let cur: CellId = id;
    let length = 1;
    for (;;) {
      const next = openNeighbors(state, cur).find((n) => n !== prev);
      if (next === undefined) break;
      if (next === start || next === goal || degree[next] !== 2) {
        if (degree[next] === 1 && next !== start && next !== goal) length++;
        break;
      }
      prev = cur;
      cur = next;
      length++;
    }
    if (length > longest) longest = length;
  }

  return {
    river: corridorCount > 0 ? corridorCells / corridorCount : 0,
    corridorCount,
    longestDeadEndCorridor: longest,
  };
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
  /** Junctions lying on the solution path (choices a human must make). */
  junctionsOnPath: number;
  /** Turns per move along the solution path. */
  twistiness: number;
  /** Mean corridor length (runs of degree-2 cells). */
  river: number;
  longestDeadEndCorridor: number;
  /** Heuristic difficulty score, 0..100 (see {@link difficultyScore}). */
  difficulty: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Difficulty heuristic in 0..100 for Play-mode level labels:
 *
 * `100 * (0.35 * L + 0.20 * D + 0.15 * T + 0.30 * B)` where (each clamped to 0..1)
 * - `L = solutionLength / cells` (how much of the maze the solution crosses),
 * - `D = deadEndRatio / 0.3` (decoys; 30 % dead ends saturates the term),
 * - `T = twistiness` (turns per move on the solution),
 * - `B = 3 * junctionsOnPath / solutionLength` (choices per move along the solution).
 *
 * Unsolvable mazes score 0. Weights are versioned with the core and tuned empirically.
 */
export function difficultyScore(m: {
  cells: number;
  solutionLength: number | null;
  deadEndRatio: number;
  twistiness: number;
  junctionsOnPath: number;
}): number {
  if (m.solutionLength === null || m.cells <= 0) return 0;
  const L = clamp01(m.solutionLength / m.cells);
  const D = clamp01(m.deadEndRatio / 0.3);
  const T = clamp01(m.twistiness);
  const B = clamp01((3 * m.junctionsOnPath) / Math.max(1, m.solutionLength));
  return Math.round(100 * (0.35 * L + 0.2 * D + 0.15 * T + 0.3 * B));
}

export function computeMetrics(state: MazeState): MazeMetrics {
  const cells = cellCount(state.grid);
  const passages = passageCount(state);
  let dead = 0;
  let junctions = 0;
  const degree = new Uint8Array(cells);
  for (let id = 0; id < cells; id++) {
    const deg = openDirs(state, id).length;
    degree[id] = deg;
    if (deg === 1) dead++;
    if (deg >= 3) junctions++;
  }
  const path = shortestPath(state, state.start, state.goal);
  const solution = path ? path.length - 1 : null;
  let junctionsOnPath = 0;
  if (path) {
    for (let i = 1; i + 1 < path.length; i++) {
      if ((degree[path[i] as CellId] ?? 0) >= 3) junctionsOnPath++;
    }
  }
  const twist = path && path.length > 1 ? turnsAlong(state.grid, path) / (path.length - 1) : 0;
  const corridors = corridorStats(state);
  const deadEndRatio = cells > 0 ? dead / cells : 0;
  return {
    cells,
    passages,
    deadEnds: dead,
    deadEndRatio,
    solutionLength: solution,
    diameter: diameter(state).length,
    averageDegree: cells > 0 ? (2 * passages) / cells : 0,
    junctions,
    junctionsOnPath,
    twistiness: twist,
    river: corridors.river,
    longestDeadEndCorridor: corridors.longestDeadEndCorridor,
    difficulty: difficultyScore({
      cells,
      solutionLength: solution,
      deadEndRatio,
      twistiness: twist,
      junctionsOnPath,
    }),
  };
}

export interface SolverRelativeMetrics {
  /** Cells expanded as a fraction of all cells. */
  expandedRatio: number;
  /** pathLength / solutionLength; 1 = optimal; null when either is unknown. */
  optimalityRatio: number | null;
}

/** Compares a solver's statistics with the maze's own metrics (Race and Compare modes). */
export function solverRelativeMetrics(
  stats: SolveStats,
  metrics: Pick<MazeMetrics, 'cells' | 'solutionLength'>,
): SolverRelativeMetrics {
  const expandedRatio = metrics.cells > 0 ? stats.expanded / metrics.cells : 0;
  const optimalityRatio =
    stats.pathLength !== null && metrics.solutionLength !== null && metrics.solutionLength > 0
      ? stats.pathLength / metrics.solutionLength
      : stats.pathLength !== null && metrics.solutionLength === 0
        ? 1
        : null;
  return { expandedRatio, optimalityRatio };
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
