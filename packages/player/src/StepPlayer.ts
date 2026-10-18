/**
 * StepPlayer: drives a step generator at a chosen steps-per-second rate, independent of the
 * display frame rate. Replaces the legacy "one algorithm step per p5 draw() frame" coupling
 * and the frame-rate slider (parity item P-10, redesigned as playback speed).
 */

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface StepPlayerOptions<S, R> {
  /** Creates a fresh generator; called on construction and on every `reset()`. */
  readonly source: () => Generator<S, R>;
  /** Initial steps per second. Default 60. */
  readonly stepsPerSecond?: number;
  /** Safety cap on steps advanced in one animation frame. Default 50_000. */
  readonly maxStepsPerFrame?: number;
  /** Clock and scheduler injection for tests. */
  readonly now?: () => number;
  readonly schedule?: (cb: (time: number) => void) => () => void;
}

export interface StepPlayerSnapshot<R> {
  readonly status: PlayerStatus;
  readonly speed: number;
  readonly stepCount: number;
  readonly elapsedMs: number;
  readonly result: R | undefined;
  /** Furthest step reached since the last `reset()` (the scrubber can seek anywhere up to it). */
  readonly highWater: number;
  /** Total steps of the source once it has run to completion at least once; null until known. */
  readonly total: number | null;
  /** True while `playUntil` is playing towards a breakpoint. */
  readonly breakpointArmed: boolean;
}

export type StepListener<S> = (steps: readonly S[]) => void;

/**
 * Fired when the player rewinds: consumers must clear whatever they folded from earlier steps
 * (trackers, live wall arrays, logs). The steps up to the new position follow as normal batches.
 */
export type ResetListener = () => void;

/**
 * A breakpoint: tested on every step after the current position, with `index` the step count
 * once that step is taken (1-based). It may keep state (frontier sizes): it sees every step
 * exactly once, in order, until the run stops.
 */
export type StepPredicate<S> = (step: S, index: number) => boolean;

/** The step a breakpoint stopped on; `index` is the step count after it. */
export interface BreakHit<S> {
  readonly step: S;
  readonly index: number;
}

/** Fired when a breakpoint run ends: with the matching step, or null if the source ended first. */
export type BreakListener<S> = (hit: BreakHit<S> | null) => void;

const defaultNow = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const defaultSchedule = (cb: (time: number) => void): (() => void) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(cb);
    return () => {
      cancelAnimationFrame(id);
    };
  }
  const id = setTimeout(() => {
    cb(defaultNow());
  }, 16);
  return () => {
    clearTimeout(id);
  };
};

export const SPEED_MIN = 1;
export const SPEED_MAX = 100_000;

export class StepPlayer<S, R = unknown> {
  private gen: Generator<S, R>;
  private readonly source: () => Generator<S, R>;
  private readonly now: () => number;
  private readonly schedule: (cb: (time: number) => void) => () => void;
  private readonly maxStepsPerFrame: number;

  private status: PlayerStatus = 'idle';
  private speed: number;
  private stepCount = 0;
  private result: R | undefined = undefined;
  private elapsedMs = 0;
  private accumulator = 0;
  private lastTick: number | null = null;
  private cancelFrame: (() => void) | null = null;
  private disposed = false;

  private readonly stepListeners = new Set<StepListener<S>>();
  private readonly changeListeners = new Set<() => void>();
  private readonly resetListeners = new Set<ResetListener>();
  private readonly breakListeners = new Set<BreakListener<S>>();
  /** Armed by `playUntil`; any other command disarms it. */
  private breakpoint: StepPredicate<S> | null = null;
  /** Set by `advance` when its stop predicate matched. */
  private hit: BreakHit<S> | null = null;
  private highWater = 0;
  private total: number | null = null;
  private snapshot: StepPlayerSnapshot<R>;

  constructor(opts: StepPlayerOptions<S, R>) {
    this.source = opts.source;
    this.gen = opts.source();
    this.now = opts.now ?? defaultNow;
    this.schedule = opts.schedule ?? defaultSchedule;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 50_000;
    this.speed = clampSpeed(opts.stepsPerSecond ?? 60);
    this.snapshot = this.buildSnapshot();
  }

  /** Immutable snapshot for `useSyncExternalStore`; identity changes only when state changes. */
  getSnapshot(): StepPlayerSnapshot<R> {
    return this.snapshot;
  }

  getStatus(): PlayerStatus {
    return this.status;
  }

  getResult(): R | undefined {
    return this.result;
  }

  /** Steps delivered in batches (one per frame or per manual `step()` call). */
  subscribe(listener: StepListener<S>): () => void {
    this.stepListeners.add(listener);
    return () => this.stepListeners.delete(listener);
  }

  /** Fires when the player rewinds (see {@link ResetListener}). */
  onReset(listener: ResetListener): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  /** Fires when a `runUntil` / `playUntil` run ends (see {@link BreakListener}). */
  onBreak(listener: BreakListener<S>): () => void {
    this.breakListeners.add(listener);
    return () => this.breakListeners.delete(listener);
  }

  /**
   * Moves to an absolute step index. Rewinding re-creates the source and replays it from the
   * start, so sources MUST be deterministic (seeded); that is what makes rewind exact. Forward
   * seeks simply advance. A playing player keeps playing from the new position.
   * Returns the steps delivered by this call (after a rewind: the replayed prefix).
   */
  seek(target: number): readonly S[] {
    if (this.disposed) return [];
    this.breakpoint = null;
    const to = Math.max(0, Math.floor(Number.isFinite(target) ? target : 0));
    const wasPlaying = this.status === 'playing';
    if (to < this.stepCount) {
      this.cancelTick();
      this.gen = this.source();
      this.stepCount = 0;
      this.result = undefined;
      this.accumulator = 0;
      if (this.status === 'done') this.status = 'paused';
      for (const l of this.resetListeners) l();
    }
    if (this.status === 'idle') this.status = 'paused';
    const delivered = this.advanceUncapped(to - this.stepCount);
    if (wasPlaying && this.getStatus() !== 'done' && this.cancelFrame === null) {
      this.status = 'playing';
      this.lastTick = null;
      this.requestTick();
    }
    this.emitChange();
    return delivered;
  }

  /** Rewinds `n` steps (exact replay of the deterministic source). */
  stepBack(n = 1): readonly S[] {
    return this.seek(this.stepCount - Math.max(1, Math.floor(n)));
  }

  /** Back to step 0 and paused. */
  restart(): void {
    this.pause();
    this.seek(0);
    if (this.status === 'idle') this.status = 'paused';
    this.emitChange();
  }

  /** Fires after any status/speed/count change. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  play(): void {
    if (this.disposed || this.status === 'playing' || this.status === 'done') return;
    this.status = 'playing';
    this.lastTick = null;
    this.accumulator = 0;
    this.requestTick();
    this.emitChange();
  }

  pause(): void {
    this.disarm();
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.cancelTick();
    this.emitChange();
  }

  toggle(): void {
    if (this.status === 'playing') this.pause();
    else this.play();
  }

  /** Advances `n` steps immediately (works while paused). */
  step(n = 1): readonly S[] {
    this.disarm();
    if (this.disposed || this.status === 'done') return [];
    if (this.status === 'idle') {
      this.status = 'paused';
    }
    const batch = this.advance(n);
    this.emitChange();
    return batch;
  }

  /** Drains the generator synchronously (bounded by `maxSteps`). */
  runToEnd(maxSteps = 50_000_000): readonly S[] {
    this.disarm();
    if (this.disposed || this.status === 'done') return [];
    this.cancelTick();
    const batch = this.advance(maxSteps);
    // `advance` may have moved us to 'done'; read through the getter to defeat narrowing.
    if (this.getStatus() !== 'done') this.status = 'paused';
    this.emitChange();
    return batch;
  }

  /**
   * Advances synchronously until `predicate` matches a step - that step is the last one
   * delivered - or the source ends (bounded by `maxSteps`). Leaves the player paused (or done).
   * Returns the hit, or null when nothing matched; break listeners hear the same.
   */
  runUntil(predicate: StepPredicate<S>, maxSteps = 50_000_000): BreakHit<S> | null {
    this.disarm();
    if (this.disposed || this.status === 'done') return null;
    this.cancelTick();
    this.hit = null;
    let remaining = Math.max(0, Math.floor(maxSteps));
    while (remaining > 0 && this.getStatus() !== 'done') {
      const batch = this.advance(Math.min(remaining, this.maxStepsPerFrame), predicate);
      remaining -= batch.length;
      if (this.hitPending() || batch.length === 0) break;
    }
    if (this.getStatus() !== 'done') this.status = 'paused';
    const hit = this.takeHit();
    this.emitChange();
    for (const l of this.breakListeners) l(hit);
    return hit;
  }

  /**
   * Plays at the current speed and pauses right after the first step that matches `predicate`
   * (a debugger's "continue to breakpoint"). Pausing, stepping, seeking or any other command
   * disarms it silently; break listeners hear the hit, or null if the source ends first.
   */
  playUntil(predicate: StepPredicate<S>): void {
    if (this.disposed || this.status === 'done') return;
    this.breakpoint = predicate;
    this.hit = null;
    if (this.status !== 'playing') {
      this.status = 'playing';
      this.lastTick = null;
      this.accumulator = 0;
      this.requestTick();
    }
    this.emitChange();
  }

  setSpeed(stepsPerSecond: number): void {
    const next = clampSpeed(stepsPerSecond);
    if (next === this.speed) return;
    this.speed = next;
    this.emitChange();
  }

  getSpeed(): number {
    return this.speed;
  }

  /** New generator from `source`; keeps speed; status becomes `idle`. */
  reset(): void {
    this.breakpoint = null;
    this.cancelTick();
    this.gen = this.source();
    this.status = 'idle';
    this.stepCount = 0;
    this.highWater = 0;
    this.total = null;
    for (const l of this.resetListeners) l();
    this.result = undefined;
    this.elapsedMs = 0;
    this.accumulator = 0;
    this.lastTick = null;
    this.emitChange();
  }

  dispose(): void {
    this.cancelTick();
    this.disposed = true;
    this.stepListeners.clear();
    this.changeListeners.clear();
    this.resetListeners.clear();
    this.breakListeners.clear();
    this.breakpoint = null;
  }

  // ---- internals -----------------------------------------------------------------------

  /** Advances `n` steps in frame-sized batches, ignoring the per-frame cap (used by seek). */
  private advanceUncapped(n: number): readonly S[] {
    const out: S[] = [];
    let remaining = n;
    while (remaining > 0 && this.status !== 'done') {
      const batch = this.advance(Math.min(remaining, this.maxStepsPerFrame));
      if (batch.length === 0) break;
      remaining -= batch.length;
      if (out.length < this.maxStepsPerFrame) out.push(...batch);
    }
    return out;
  }

  /** Clears an armed breakpoint without telling break listeners (another command took over). */
  private disarm(): void {
    if (this.breakpoint === null) return;
    this.breakpoint = null;
    this.emitChange();
  }

  /** Read through a method: `advance` sets `hit`, which TypeScript cannot see from here. */
  private hitPending(): boolean {
    return this.hit !== null;
  }

  private takeHit(): BreakHit<S> | null {
    const hit = this.hit;
    this.hit = null;
    return hit;
  }

  /** Advances up to `n` steps; with `stop`, ends the batch right after the first matching step. */
  private advance(n: number, stop?: StepPredicate<S>): readonly S[] {
    const limit = Math.min(n, this.maxStepsPerFrame);
    const batch: S[] = [];
    for (let i = 0; i < limit; i++) {
      const next = this.gen.next();
      if (next.done) {
        this.result = next.value;
        this.total = this.stepCount;
        this.status = 'done';
        this.cancelTick();
        break;
      }
      batch.push(next.value);
      this.stepCount++;
      if (stop?.(next.value, this.stepCount)) {
        this.hit = { step: next.value, index: this.stepCount };
        break;
      }
    }
    if (this.stepCount > this.highWater) this.highWater = this.stepCount;
    if (batch.length > 0) {
      for (const l of this.stepListeners) l(batch);
    }
    return batch;
  }

  private requestTick(): void {
    this.cancelFrame = this.schedule((time) => {
      this.cancelFrame = null;
      this.tick(time);
    });
  }

  private cancelTick(): void {
    if (this.cancelFrame) {
      this.cancelFrame();
      this.cancelFrame = null;
    }
    this.lastTick = null;
  }

  private tick(time: number): void {
    if (this.status !== 'playing') return;
    const now = Number.isFinite(time) ? time : this.now();
    if (this.lastTick !== null) {
      const dt = Math.max(0, Math.min(250, now - this.lastTick)); // clamp tab-switch gaps
      this.elapsedMs += dt;
      this.accumulator += (dt * this.speed) / 1000;
    }
    this.lastTick = now;

    const whole = Math.floor(this.accumulator);
    if (whole > 0) {
      this.accumulator -= whole;
      const breakpoint = this.breakpoint;
      this.advance(whole, breakpoint ?? undefined);
      const hit = this.takeHit();
      if (breakpoint && (hit || this.getStatus() === 'done')) {
        this.breakpoint = null;
        if (hit) {
          this.status = 'paused';
          this.cancelTick();
        }
        this.emitChange();
        for (const l of this.breakListeners) l(hit);
        return;
      }
      this.emitChange();
    }
    if (this.getStatus() === 'playing') this.requestTick();
  }

  private buildSnapshot(): StepPlayerSnapshot<R> {
    return {
      status: this.status,
      speed: this.speed,
      stepCount: this.stepCount,
      elapsedMs: this.elapsedMs,
      highWater: this.highWater,
      total: this.total,
      result: this.result,
      breakpointArmed: this.breakpoint !== null,
    };
  }

  private emitChange(): void {
    this.snapshot = this.buildSnapshot();
    for (const l of this.changeListeners) l();
  }
}

export function clampSpeed(v: number): number {
  if (!Number.isFinite(v)) return 60;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(v)));
}

/** Preset speeds for a logarithmic slider. */
export const SPEED_PRESETS: readonly number[] = [
  1, 2, 5, 10, 20, 40, 60, 120, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 100_000,
];
