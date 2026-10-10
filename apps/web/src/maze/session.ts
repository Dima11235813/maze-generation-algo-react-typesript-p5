/**
 * MazeSession: the one object that owns the current maze, its trackers and step players.
 *
 * It is framework-agnostic (tested in plain Node) and exposes a `useSyncExternalStore`
 * compatible `subscribe`/`getSnapshot`. Renderers read the live trackers; the session only
 * asks them to redraw through `setRenderRequest`.
 */
import {
  ALL_WALLS,
  CORE_VERSION,
  GenerationTracker,
  SolveTracker,
  cellCount,
  computeMetrics,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  decodeDocument,
  describeCell,
  encodeDocument,
  generators,
  applyGenStep,
  solvers,
  type GenStep,
  type MazeDocument,
  type MazeMetrics,
  type MazeProvenance,
  type MazeState,
  type SolveResult,
  type SolveStep,
  RideAlongTracker,
  formatDuration,
  hintCells,
  recordMove,
  seekRun,
  startRun,
  summarizeRun,
  type CellId,
  type RidePose,
  type RunMove,
  type RunState,
  type RunSummary,
} from '@maze/core';
import { StepPlayer, type StepPlayerOptions } from '@maze/player';
import type { FirstPersonState } from '@maze/renderer';

export type SessionPhase = 'empty' | 'generating' | 'ready';

export interface SessionSnapshot {
  readonly phase: SessionPhase;
  /** What to render: a live view while generating, the frozen result when ready. */
  readonly state: MazeState | null;
  readonly seed: string;
  readonly generatorId: string;
  readonly width: number;
  readonly height: number;
  /** Cell size the grid was sized with (px). */
  readonly cellSize: number;
  readonly genPlayer: StepPlayer<GenStep, MazeState> | null;
  readonly solvePlayer: StepPlayer<SolveStep, SolveResult> | null;
  readonly solverId: string | null;
  readonly solveResult: SolveResult | null;
  readonly metrics: MazeMetrics | null;
  readonly firstPerson: FirstPersonState | null;
  readonly reachedGoal: boolean;
  /** Human-readable status; `statusSeq` increments on every change so it can be announced. */
  readonly status: string;
  readonly statusSeq: number;
  /** Library item name when the maze was loaded rather than generated. */
  readonly sourceName: string | null;
  readonly provenance: MazeProvenance | null;
  // ---- Run Maze as a game (WI-02) ----
  /** The player's run (moves, undo history) while walking the maze; null otherwise. */
  readonly run: RunState | null;
  /** First person (3D) or top-down (2D) walking. */
  readonly runView: '3d' | '2d' | null;
  /** Clock time of the first step, and of reaching the goal (ms, on the session clock). */
  readonly runStartedAt: number | null;
  readonly runFinishedAt: number | null;
  readonly runHints: number;
  readonly runUndos: number;
  /** Cells revealed by the last hint (next cells of the shortest path). */
  readonly hint: readonly CellId[] | null;
  /** A saved run is being replayed (player input is ignored). */
  readonly runReplay: boolean;
  /** Set once the goal is reached. */
  readonly runSummary: RunSummary | null;
}

export interface GenerateOptions {
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
  readonly seed?: string;
  readonly generatorId?: string;
  /** Start playing immediately (legacy behaviour). Default true. */
  readonly autoplay?: boolean;
}

export interface SessionOptions {
  readonly speed?: number;
  readonly schedule?: StepPlayerOptions<unknown, unknown>['schedule'];
  readonly now?: StepPlayerOptions<unknown, unknown>['now'];
}

const INITIAL: SessionSnapshot = {
  phase: 'empty',
  state: null,
  seed: '',
  generatorId: 'recursive-backtracker',
  width: 0,
  height: 0,
  cellSize: 40,
  genPlayer: null,
  solvePlayer: null,
  solverId: null,
  solveResult: null,
  metrics: null,
  firstPerson: null,
  reachedGoal: false,
  status: '',
  statusSeq: 0,
  sourceName: null,
  provenance: null,
  run: null,
  runView: null,
  runStartedAt: null,
  runFinishedAt: null,
  runHints: 0,
  runUndos: 0,
  hint: null,
  runReplay: false,
  runSummary: null,
};

/** Resets every Run Maze field (spread into updates that leave or replace a run). */
const NO_RUN = {
  run: null,
  runView: null,
  runStartedAt: null,
  runFinishedAt: null,
  runHints: 0,
  runUndos: 0,
  hint: null,
  runReplay: false,
  runSummary: null,
} as const;

export class MazeSession {
  private snap: SessionSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private genTracker: GenerationTracker | null = null;
  private solveTrackerRef: SolveTracker | null = null;
  /** First-person pose following the solver (Ride along), rebuilt from steps like the tracker. */
  private rideRef: RideAlongTracker | null = null;
  private requestRender: () => void = () => undefined;
  private speed: number;
  private readonly now: () => number;
  /** Moves still to apply while replaying a saved run. */
  private replayQueue: RunMove[] = [];
  /** Overlay showing the hint as a path (drawn like a solver's path). */
  private hintTrackerRef: SolveTracker | null = null;
  private readonly playerOpts: Pick<StepPlayerOptions<unknown, unknown>, 'schedule' | 'now'>;

  constructor(opts: SessionOptions = {}) {
    this.speed = opts.speed ?? 60;
    this.now =
      opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.playerOpts = {
      ...(opts.schedule ? { schedule: opts.schedule } : {}),
      ...(opts.now ? { now: opts.now } : {}),
    };
  }

  // ---- external store -------------------------------------------------------------------

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): SessionSnapshot => this.snap;

  /** Live tracker for the generation in progress (renderers read it directly). */
  get generation(): GenerationTracker | null {
    return this.genTracker;
  }

  get solveTracker(): SolveTracker | null {
    return this.solveTrackerRef;
  }

  /** The hint path overlay (a solved tracker holding only the hint), or null. */
  get hintTracker(): SolveTracker | null {
    return this.hintTrackerRef;
  }

  /** Current time on the session clock (ms), for elapsed-time displays. */
  clock(): number {
    return this.now();
  }

  /** Where a first-person camera riding along with the solver stands (null without a solve). */
  get ridePose(): RidePose | null {
    return this.rideRef?.pose ?? null;
  }

  setRenderRequest(fn: () => void): void {
    this.requestRender = fn;
  }

  // ---- generation -----------------------------------------------------------------------

  generate(opts: GenerateOptions): void {
    this.disposePlayers();
    const generatorId = opts.generatorId ?? this.snap.generatorId;
    const generator = generators.require(generatorId);
    const seed = createRng(opts.seed).seed;
    const grid = createGrid(opts.width, opts.height);
    const total = cellCount(grid);

    const tracker = new GenerationTracker(grid);
    this.genTracker = tracker;
    this.solveTrackerRef = null;
    this.rideRef = null;

    // Live view of the walls being carved (the generator's own array is internal until it
    // returns). Mirroring `carve` steps keeps the renderer honest during playback.
    const liveWalls = createWalls(grid);
    const liveState = createMazeState(grid, liveWalls, 0, total - 1);

    const player = new StepPlayer<GenStep, MazeState>({
      source: () => generator.run(grid, createRng(seed), {}),
      stepsPerSecond: this.speed,
      ...this.playerOpts,
    });
    player.subscribe((batch) => {
      for (const step of batch) {
        tracker.apply(step);
        applyGenStep(liveWalls, grid, step);
      }
      this.requestRender();
    });
    player.onChange(() => {
      if (player.getStatus() !== 'done') return;
      const result = player.getResult();
      if (result && this.snap.genPlayer === player && this.snap.phase === 'generating') {
        this.finishGeneration(result);
      }
    });
    // Rewind: forget everything folded so far; the replayed prefix arrives as normal batches.
    // Rewinding a finished maze reopens it, which invalidates any solve and first-person run.
    player.onReset(() => {
      tracker.reset();
      liveWalls.fill(ALL_WALLS);
      if (this.snap.genPlayer !== player) return;
      if (this.snap.phase === 'ready') {
        this.snap.solvePlayer?.dispose();
        this.solveTrackerRef = null;
        this.rideRef = null;
        this.update({
          phase: 'generating',
          state: liveState,
          metrics: null,
          solvePlayer: null,
          solverId: null,
          solveResult: null,
          firstPerson: null,
          ...NO_RUN,
          reachedGoal: false,
        });
      }
      this.requestRender();
    });

    this.update({
      phase: 'generating',
      state: liveState,
      seed,
      generatorId,
      width: grid.width,
      height: grid.height,
      cellSize: opts.cellSize,
      genPlayer: player,
      solvePlayer: null,
      solverId: null,
      solveResult: null,
      metrics: null,
      firstPerson: null,
      ...NO_RUN,
      reachedGoal: false,
      sourceName: null,
      provenance: { algorithm: generatorId, seed, params: {}, coreVersion: CORE_VERSION },
    });
    this.setStatus(
      `Generating a ${grid.width} by ${grid.height} maze with ${generator.meta.name}.`,
    );
    this.requestRender();
    if (opts.autoplay !== false) player.play();
  }

  /** Same seed, same dimensions, fresh run. */
  regenerate(): void {
    if (this.snap.phase === 'empty' || !this.snap.seed) return;
    this.generate({
      width: this.snap.width,
      height: this.snap.height,
      cellSize: this.snap.cellSize,
      seed: this.snap.seed,
      generatorId: this.snap.generatorId,
    });
  }

  private finishGeneration(result: MazeState): void {
    const metrics = computeMetrics(result);
    this.update({ phase: 'ready', state: result, metrics });
    const solution =
      metrics.solutionLength === null ? 'no solution' : `solution ${metrics.solutionLength} moves`;
    this.setStatus(
      `Maze generation complete: ${result.grid.width} by ${result.grid.height}, ${metrics.deadEnds} dead ends, ${solution}.`,
    );
    this.requestRender();
  }

  // ---- playback (delegates to whichever player is active) -------------------------------

  /** The solve player while a solve is running/paused, else the generation player. */
  get activePlayer(): StepPlayer<GenStep, MazeState> | StepPlayer<SolveStep, SolveResult> | null {
    const { solvePlayer, genPlayer } = this.snap;
    if (solvePlayer && solvePlayer.getStatus() !== 'done') return solvePlayer;
    if (genPlayer && genPlayer.getStatus() !== 'done') return genPlayer;
    return solvePlayer ?? genPlayer;
  }

  play(): void {
    this.activePlayer?.play();
  }

  pause(): void {
    this.activePlayer?.pause();
  }

  toggle(): void {
    this.activePlayer?.toggle();
  }

  step(n = 1): void {
    this.activePlayer?.step(n);
  }

  /** Rewinds the active player `n` steps (exact replay; see StepPlayer.seek). */
  stepBack(n = 1): void {
    this.activePlayer?.stepBack(n);
  }

  /** Jumps the active player to an absolute step and pauses there (scrubber). */
  seek(step: number): void {
    const p = this.activePlayer;
    if (!p) return;
    p.pause();
    p.seek(step);
  }

  /** Back to the first step of the active player, paused. */
  restart(): void {
    this.activePlayer?.restart();
  }

  runToEnd(): void {
    const { genPlayer } = this.snap;
    if (genPlayer && genPlayer.getStatus() !== 'done') {
      genPlayer.runToEnd();
      return;
    }
    this.snap.solvePlayer?.runToEnd();
  }

  setSpeed(stepsPerSecond: number): void {
    this.speed = stepsPerSecond;
    this.snap.genPlayer?.setSpeed(stepsPerSecond);
    this.snap.solvePlayer?.setSpeed(stepsPerSecond);
  }

  getSpeed(): number {
    return this.speed;
  }

  // ---- solving ---------------------------------------------------------------------------

  startSolve(solverId: string, autoplay = true): boolean {
    const { state, phase } = this.snap;
    if (!state || phase !== 'ready') return false;
    this.snap.solvePlayer?.dispose();
    const solver = solvers.require(solverId);
    const tracker = new SolveTracker(state.grid);
    this.solveTrackerRef = tracker;
    const ride = new RideAlongTracker(state);
    this.rideRef = ride;

    const player = new StepPlayer<SolveStep, SolveResult>({
      source: () => solver.run(state, {}),
      stepsPerSecond: this.speed,
      ...this.playerOpts,
    });
    player.subscribe((batch) => {
      for (const step of batch) {
        tracker.apply(step);
        ride.apply(step);
      }
      this.requestRender();
    });
    player.onReset(() => {
      tracker.reset();
      ride.reset();
      if (this.snap.solvePlayer === player && this.snap.solveResult)
        this.update({ solveResult: null });
      this.requestRender();
    });
    player.onChange(() => {
      if (player.getStatus() !== 'done') return;
      const result = player.getResult();
      if (result && this.snap.solvePlayer === player && !this.snap.solveResult) {
        this.update({ solveResult: result });
        this.setStatus(
          result.path
            ? `Solved with ${solver.meta.name} in ${result.path.length - 1} moves, expanding ${result.stats.expanded} cells.`
            : `${solver.meta.name} found no path.`,
        );
        this.requestRender();
      }
    });

    this.update({ solvePlayer: player, solverId, solveResult: null });
    this.setStatus(`Solving with ${solver.meta.name}.`);
    this.requestRender();
    if (autoplay) player.play();
    return true;
  }

  clearSolve(): void {
    this.snap.solvePlayer?.dispose();
    this.solveTrackerRef = null;
    this.rideRef = null;
    this.update({ solvePlayer: null, solverId: null, solveResult: null });
    this.requestRender();
  }

  // ---- library ---------------------------------------------------------------------------

  loadDocument(doc: MazeDocument, name?: string): void {
    const state = decodeDocument(doc);
    this.disposePlayers();
    this.genTracker = null;
    this.solveTrackerRef = null;
    this.rideRef = null;
    const sourceName = name ?? doc.meta?.name ?? null;
    this.update({
      phase: 'ready',
      state,
      seed: doc.provenance?.seed ?? '',
      generatorId: doc.provenance?.algorithm ?? this.snap.generatorId,
      width: state.grid.width,
      height: state.grid.height,
      genPlayer: null,
      solvePlayer: null,
      solverId: null,
      solveResult: null,
      metrics: computeMetrics(state),
      firstPerson: null,
      ...NO_RUN,
      reachedGoal: false,
      sourceName,
      provenance: doc.provenance ?? null,
    });
    this.setStatus(
      `Loaded ${sourceName ? `"${sourceName}"` : 'maze'}: ${state.grid.width} by ${state.grid.height}.`,
    );
    this.requestRender();
  }

  /** Serialises the finished maze (P-19). Throws while generating or empty. */
  async save(name: string): Promise<MazeDocument> {
    const { state, phase, provenance } = this.snap;
    if (!state || phase !== 'ready') throw new Error('No finished maze to save');
    return encodeDocument(state, {
      ...(provenance ? { provenance } : {}),
      meta: { name: name.trim() || 'Untitled maze', createdAt: new Date().toISOString() },
    });
  }

  // ---- first person ("Run Maze", P-17) ---------------------------------------------------

  /** Starts walking the finished maze: first person (3D) or top-down (2D). */
  enterRun(view: '3d' | '2d' = '3d'): boolean {
    const { state, phase } = this.snap;
    if (!state || phase !== 'ready') return false;
    this.replayQueue = [];
    this.hintTrackerRef = null;
    const run = startRun(state);
    this.update({
      ...NO_RUN,
      run,
      runView: view,
      firstPerson: { cell: run.pose.cell, heading: run.pose.heading, peek: false },
      reachedGoal: run.finished,
    });
    this.setStatus(
      view === '3d'
        ? 'Run Maze: arrow keys or W A S D to move, hold P to peek, U to undo, H for a hint, Escape to exit.'
        : 'Walk the maze from above: arrow keys, W A S D or swipe to move, U to undo, H for a hint, Escape to exit.',
    );
    this.requestRender();
    return true;
  }

  /** First person "Run Maze" (P-17). */
  enterFirstPerson(): boolean {
    return this.enterRun('3d');
  }

  exitFirstPerson(): void {
    if (!this.snap.firstPerson) return;
    this.replayQueue = [];
    this.hintTrackerRef = null;
    this.update({ ...NO_RUN, firstPerson: null, reachedGoal: false });
    this.setStatus('Left Run Maze mode.');
    this.requestRender();
  }

  /** Same view, fresh run from the start. */
  restartRun(): void {
    const view = this.snap.runView;
    if (view) this.enterRun(view);
  }

  /** Applies a run (after a move, undo or redo): pose, goal, timer and summary. */
  private setRun(run: RunState, extra: Partial<SessionSnapshot> = {}): void {
    const { state, firstPerson } = this.snap;
    if (!state) return;
    const now = this.now();
    const startedAt = this.snap.runStartedAt ?? (run.moves > 0 ? now : null);
    const justFinished = run.finished && this.snap.run?.finished !== true;
    const finishedAt = run.finished ? (this.snap.runFinishedAt ?? now) : null;
    const undos = extra.runUndos ?? this.snap.runUndos;
    const summary = run.finished
      ? summarizeRun(state, run, {
          timeMs: (finishedAt ?? now) - (startedAt ?? now),
          hints: this.snap.runHints,
          undos,
        })
      : null;
    this.update({
      ...extra,
      run,
      runStartedAt: startedAt,
      runFinishedAt: finishedAt,
      runSummary: summary,
      firstPerson: {
        cell: run.pose.cell,
        heading: run.pose.heading,
        peek: firstPerson?.peek ?? false,
      },
      reachedGoal: run.finished,
    });
    if (justFinished && summary) this.setStatus(describeSummary(summary));
    this.requestRender();
  }

  /** One player move; walking into a wall changes nothing (and says so). */
  runMove(m: RunMove, opts: { replay?: boolean } = {}): boolean {
    const { run, state } = this.snap;
    if (!run || !state || (this.snap.runReplay && opts.replay !== true)) return false;
    const next = recordMove(state, run, m);
    if (next === run) {
      if (opts.replay !== true) this.setStatus('A wall blocks the way.');
      return false;
    }
    const moved = next.pose.cell !== run.pose.cell;
    if (moved) this.hintTrackerRef = null;
    this.setRun(next, moved ? { hint: null } : {});
    return true;
  }

  runUndo(n = 1): void {
    const { run, state } = this.snap;
    if (!run || !state || this.snap.runReplay || run.cursor === 0) return;
    this.hintTrackerRef = null;
    this.setRun(seekRun(state, run, run.cursor - n), {
      runUndos: this.snap.runUndos + 1,
      hint: null,
    });
  }

  runRedo(n = 1): void {
    const { run, state } = this.snap;
    if (!run || !state || this.snap.runReplay || run.cursor >= run.history.length) return;
    this.setRun(seekRun(state, run, run.cursor + n));
  }

  /** Rewinds or replays the player's own moves to any point (the "your moves" scrubber). */
  runSeek(cursor: number): void {
    const { run, state } = this.snap;
    if (!run || !state || this.snap.runReplay) return;
    const to = Math.max(0, Math.min(run.history.length, Math.floor(cursor)));
    if (to === run.cursor) return;
    this.hintTrackerRef = null;
    this.setRun(seekRun(state, run, to), {
      hint: null,
      ...(to < run.cursor ? { runUndos: this.snap.runUndos + 1 } : {}),
    });
  }

  /** Reveals the next `n` cells of the shortest path from where the player stands. */
  runHint(n = 5): void {
    const { run, state } = this.snap;
    if (!run || !state || run.finished || this.snap.runReplay) return;
    const cells = hintCells(state, run.pose.cell, n);
    if (cells.length === 0) return;
    const tracker = new SolveTracker(state.grid);
    tracker.path = [run.pose.cell, ...cells];
    tracker.done = true;
    this.hintTrackerRef = tracker;
    const dir = describeDirection(state, run.pose.cell, cells[0] as CellId);
    this.update({ hint: cells, runHints: this.snap.runHints + 1 });
    this.setStatus(`Hint: head ${dir}. The next ${String(cells.length)} cells are marked.`);
    this.requestRender();
  }

  /** Starts replaying a saved run; call `replayTick` to advance it. */
  startReplay(moves: readonly RunMove[], view: '3d' | '2d'): boolean {
    if (!this.enterRun(view)) return false;
    this.replayQueue = [...moves];
    this.update({ runReplay: true });
    this.setStatus(`Replaying a saved run of ${String(moves.length)} moves.`);
    return true;
  }

  /** Applies the next replayed move; returns false once the replay has ended. */
  replayTick(): boolean {
    if (!this.snap.runReplay) return false;
    const m = this.replayQueue.shift();
    if (m === undefined) {
      this.update({ runReplay: false });
      return false;
    }
    this.runMove(m, { replay: true });
    if (this.replayQueue.length === 0) this.update({ runReplay: false });
    return true;
  }

  stopReplay(): void {
    this.replayQueue = [];
    if (this.snap.runReplay) this.update({ runReplay: false });
  }

  fpForward(): void {
    this.runMove('F');
  }

  fpBackward(): void {
    this.runMove('B');
  }

  fpTurnLeft(): void {
    this.runMove('L');
  }

  fpTurnRight(): void {
    this.runMove('R');
  }

  setPeek(peek: boolean): void {
    const fp = this.snap.firstPerson;
    if (!fp || fp.peek === peek) return;
    this.update({ firstPerson: { ...fp, peek } });
    this.requestRender();
  }

  /** Plain-language description of the current first-person cell (a11y "where am I"). */
  describeCurrentCell(): string | null {
    const { firstPerson, state } = this.snap;
    return firstPerson && state ? describeCell(state, firstPerson.cell) : null;
  }

  // ---- lifecycle -------------------------------------------------------------------------

  /** Stops players and returns to the empty state. Listeners stay attached (safe for React StrictMode). */
  dispose(): void {
    this.disposePlayers();
    this.genTracker = null;
    this.solveTrackerRef = null;
    this.rideRef = null;
    this.snap = INITIAL;
    this.emit();
  }

  private disposePlayers(): void {
    this.snap.genPlayer?.dispose();
    this.snap.solvePlayer?.dispose();
  }

  private update(partial: Partial<SessionSnapshot>): void {
    this.snap = { ...this.snap, ...partial };
    this.emit();
  }

  private setStatus(status: string): void {
    this.update({ status, statusSeq: this.snap.statusSeq + 1 });
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

const DIRECTION_WORDS = ['north', 'east', 'south', 'west'] as const;

function describeDirection(state: MazeState, from: CellId, to: CellId): string {
  const w = state.grid.width;
  const dc = (to % w) - (from % w);
  const dr = Math.floor(to / w) - Math.floor(from / w);
  const d = Math.abs(dc) >= Math.abs(dr) ? (dc > 0 ? 1 : 3) : dr > 0 ? 2 : 0;
  return DIRECTION_WORDS[d];
}

/** Spoken and shown when the goal is reached. */
export function describeSummary(s: RunSummary): string {
  const eff = s.efficiency === null ? '' : `, ${String(Math.round(s.efficiency * 100))}% efficient`;
  const optimal = s.optimalMoves === null ? '' : ` (shortest ${String(s.optimalMoves)})`;
  const extras = [
    s.hints > 0 ? `${String(s.hints)} hint${s.hints === 1 ? '' : 's'}` : '',
    s.undos > 0 ? `${String(s.undos)} undo${s.undos === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const tail = extras.length > 0 ? `, ${extras.join(' and ')}` : '';
  return `You reached the goal in ${formatDuration(s.timeMs)} with ${String(s.moves)} moves${optimal}${eff}${tail}.`;
}
