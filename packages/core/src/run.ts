/**
 * Run Maze as a game (WI-02): the player's own walk through a maze as data.
 *
 * A run is the list of moves the player made (`history`) plus a cursor into it. The pose, the
 * move count and whether the goal was reached are always derived by replaying the moves up to
 * the cursor, so undo, redo, rewinding to any point and replaying a saved run are the same
 * operation and are exact.
 *
 * Moves: `F`/`B` step forward/backward and `L`/`R` turn (first person); `N`/`E`/`S`/`W` step in
 * a compass direction and face it (top-down 2D). A move that would walk into a wall is not
 * recorded (it is a bump, counted separately by the caller if wanted).
 */
import { Dir, cellCount, type CellId } from './grid';
import { shortestPath, solutionLength } from './metrics';
import {
  canMove,
  initialPose,
  move,
  stepBackward,
  stepForward,
  turnLeft,
  turnRight,
  type Pose,
} from './navigation';
import type { MazeState } from './walls';

export type RunMove = 'F' | 'B' | 'L' | 'R' | 'N' | 'E' | 'S' | 'W';

export const RUN_MOVES: readonly RunMove[] = ['F', 'B', 'L', 'R', 'N', 'E', 'S', 'W'];

const COMPASS: Record<'N' | 'E' | 'S' | 'W', Dir> = { N: Dir.N, E: Dir.E, S: Dir.S, W: Dir.W };

export interface RunState {
  /** Every recorded move, including undone ones that can be redone. */
  readonly history: readonly RunMove[];
  /** Moves in effect: `history.slice(0, cursor)`. */
  readonly cursor: number;
  readonly pose: Pose;
  /** Cell-to-cell moves in effect (turns are free). */
  readonly moves: number;
  readonly turns: number;
  /** The goal has been reached by the moves in effect. */
  readonly finished: boolean;
}

/** Applies one move to a pose; returns null when the move walks into a wall. */
export function applyMove(state: MazeState, pose: Pose, m: RunMove): Pose | null {
  switch (m) {
    case 'L':
      return turnLeft(pose);
    case 'R':
      return turnRight(pose);
    case 'F': {
      const next = stepForward(state, pose);
      return next.cell === pose.cell ? null : next;
    }
    case 'B': {
      const next = stepBackward(state, pose);
      return next.cell === pose.cell ? null : next;
    }
    default: {
      const dir = COMPASS[m];
      if (!canMove(state, pose.cell, dir)) return null;
      return { ...move(state, pose, dir), heading: dir };
    }
  }
}

const isStep = (m: RunMove): boolean => m !== 'L' && m !== 'R';

/** Replays the first `cursor` moves of `history` from the start. Illegal moves are skipped. */
export function replayRun(
  state: MazeState,
  history: readonly RunMove[],
  cursor = history.length,
): RunState {
  let pose = initialPose(state);
  let moves = 0;
  let turns = 0;
  let finished = pose.cell === state.goal;
  const kept: RunMove[] = [];
  const end = Math.max(0, Math.min(cursor, history.length));
  for (let i = 0; i < history.length; i++) {
    const m = history[i] as RunMove;
    if (i >= end) {
      kept.push(m);
      continue;
    }
    const next = applyMove(state, pose, m);
    if (!next) continue;
    kept.push(m);
    pose = next;
    if (isStep(m)) moves++;
    else turns++;
    if (pose.cell === state.goal) finished = true;
  }
  const skipped = history.length - kept.length;
  return { history: kept, cursor: end - Math.min(skipped, end), pose, moves, turns, finished };
}

export function startRun(state: MazeState): RunState {
  return replayRun(state, []);
}

/**
 * Records a move at the cursor (dropping any undone moves after it). Returns the same run when
 * the move walks into a wall, so callers can tell a bump by identity.
 */
export function recordMove(state: MazeState, run: RunState, m: RunMove): RunState {
  const next = applyMove(state, run.pose, m);
  if (!next) return run;
  const history = [...run.history.slice(0, run.cursor), m];
  const step = isStep(m);
  return {
    history,
    cursor: history.length,
    pose: next,
    moves: run.moves + (step ? 1 : 0),
    turns: run.turns + (step ? 0 : 1),
    finished: run.finished || next.cell === state.goal,
  };
}

/** Moves the cursor (undo with negative `delta`, redo with positive), replaying exactly. */
export function seekRun(state: MazeState, run: RunState, cursor: number): RunState {
  const to = Math.max(0, Math.min(run.history.length, Math.floor(cursor)));
  return to === run.cursor ? run : replayRun(state, run.history, to);
}

export const undoRun = (state: MazeState, run: RunState, n = 1): RunState =>
  seekRun(state, run, run.cursor - n);
export const redoRun = (state: MazeState, run: RunState, n = 1): RunState =>
  seekRun(state, run, run.cursor + n);

/** Cells visited by the moves in effect, in order (start included, repeats kept). */
export function runCells(
  state: MazeState,
  history: readonly RunMove[],
  cursor = history.length,
): CellId[] {
  let pose = initialPose(state);
  const cells: CellId[] = [pose.cell];
  for (let i = 0; i < Math.min(cursor, history.length); i++) {
    const next = applyMove(state, pose, history[i] as RunMove);
    if (!next) continue;
    if (next.cell !== pose.cell) cells.push(next.cell);
    pose = next;
  }
  return cells;
}

/** The next `n` cells of the shortest path from `cell` to the goal (excluding `cell`). */
export function hintCells(state: MazeState, cell: CellId, n: number): CellId[] {
  const path = shortestPath(state, cell, state.goal);
  return path ? path.slice(1, 1 + Math.max(0, n)) : [];
}

export interface RunSummary {
  readonly timeMs: number;
  readonly moves: number;
  readonly turns: number;
  /** Shortest possible number of moves from start to goal. */
  readonly optimalMoves: number | null;
  /** optimal / moves, 0..1 (1 = a perfect run). */
  readonly efficiency: number | null;
  readonly hints: number;
  readonly undos: number;
}

export function summarizeRun(
  state: MazeState,
  run: RunState,
  extra: { timeMs: number; hints: number; undos: number },
): RunSummary {
  const optimal = solutionLength(state);
  return {
    timeMs: Math.max(0, extra.timeMs),
    moves: run.moves,
    turns: run.turns,
    optimalMoves: optimal,
    efficiency: optimal !== null && run.moves > 0 ? Math.min(1, optimal / run.moves) : null,
    hints: extra.hints,
    undos: extra.undos,
  };
}

/** Compact text form of the moves in effect, e.g. "FFRFFLB" or "EESSW". */
export function encodeRun(run: Pick<RunState, 'history' | 'cursor'>): string {
  return run.history.slice(0, run.cursor).join('');
}

/** Parses a saved run; throws on characters that are not moves. */
export function decodeRun(text: string): RunMove[] {
  const out: RunMove[] = [];
  for (const ch of text) {
    if (!RUN_MOVES.includes(ch as RunMove)) throw new SyntaxError(`Not a run move: '${ch}'`);
    out.push(ch as RunMove);
  }
  return out;
}

/** Upper bound used to reject absurd saved runs (each cell visited ~16 times). */
export function maxRunLength(state: MazeState): number {
  return cellCount(state.grid) * 16 + 64;
}
