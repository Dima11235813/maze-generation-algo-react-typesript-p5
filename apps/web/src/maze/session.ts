/**
 * MazeSession: the one object that owns the current maze, its trackers and step players.
 *
 * It is framework-agnostic (tested in plain Node) and exposes a `useSyncExternalStore`
 * compatible `subscribe`/`getSnapshot`. Renderers read the live trackers; the session only
 * asks them to redraw through `setRenderRequest`.
 */
import {
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
  initialPose,
  removeWall,
  solvers,
  stepBackward,
  stepForward,
  turnLeft,
  turnRight,
  type GenStep,
  type MazeDocument,
  type MazeMetrics,
  type MazeProvenance,
  type MazeState,
  type Pose,
  type SolveResult,
  type SolveStep,
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
};

export class MazeSession {
  private snap: SessionSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private genTracker: GenerationTracker | null = null;
  private solveTrackerRef: SolveTracker | null = null;
  private requestRender: () => void = () => undefined;
  private speed: number;
  private readonly playerOpts: Pick<StepPlayerOptions<unknown, unknown>, 'schedule' | 'now'>;

  constructor(opts: SessionOptions = {}) {
    this.speed = opts.speed ?? 60;
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
        if (step.t === 'carve') removeWall(liveWalls, grid, step.from, step.to);
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
    const solution = metrics.solutionLength === null ? 'no solution' : `solution ${metrics.solutionLength} moves`;
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

    const player = new StepPlayer<SolveStep, SolveResult>({
      source: () => solver.run(state, {}),
      stepsPerSecond: this.speed,
      ...this.playerOpts,
    });
    player.subscribe((batch) => {
      for (const step of batch) tracker.apply(step);
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
    this.update({ solvePlayer: null, solverId: null, solveResult: null });
    this.requestRender();
  }

  // ---- library ---------------------------------------------------------------------------

  loadDocument(doc: MazeDocument, name?: string): void {
    const state = decodeDocument(doc);
    this.disposePlayers();
    this.genTracker = null;
    this.solveTrackerRef = null;
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

  enterFirstPerson(): boolean {
    const { state, phase } = this.snap;
    if (!state || phase !== 'ready') return false;
    const pose = initialPose(state);
    this.update({
      firstPerson: { cell: pose.cell, heading: pose.heading, peek: false },
      reachedGoal: pose.cell === state.goal,
    });
    this.setStatus('Run Maze: arrow keys or W A S D to move, hold P to peek, Escape to exit.');
    this.requestRender();
    return true;
  }

  exitFirstPerson(): void {
    if (!this.snap.firstPerson) return;
    this.update({ firstPerson: null });
    this.setStatus('Left Run Maze mode.');
    this.requestRender();
  }

  private movePose(fn: (state: MazeState, pose: Pose) => Pose): void {
    const { firstPerson, state } = this.snap;
    if (!firstPerson || !state) return;
    const next = fn(state, { cell: firstPerson.cell, heading: firstPerson.heading });
    const reached = next.cell === state.goal;
    this.update({
      firstPerson: { cell: next.cell, heading: next.heading, peek: firstPerson.peek },
      reachedGoal: reached,
    });
    if (reached && !this.snap.reachedGoal) this.setStatus('You reached the goal!');
    else if (reached && next.cell !== firstPerson.cell) this.setStatus('You reached the goal!');
    this.requestRender();
  }

  fpForward(): void {
    this.movePose(stepForward);
  }

  fpBackward(): void {
    this.movePose(stepBackward);
  }

  fpTurnLeft(): void {
    this.movePose((_s, p) => turnLeft(p));
  }

  fpTurnRight(): void {
    this.movePose((_s, p) => turnRight(p));
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
