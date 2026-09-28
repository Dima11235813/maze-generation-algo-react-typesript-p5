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
}

export type StepListener<S> = (steps: readonly S[]) => void;

const defaultNow = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const defaultSchedule = (cb: (time: number) => void): (() => void) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(cb);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(() => cb(defaultNow()), 16);
  return () => clearTimeout(id);
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
    if (this.disposed || this.status === 'done') return [];
    this.cancelTick();
    const batch = this.advance(maxSteps);
    // `advance` may have moved us to 'done'; read through the getter to defeat narrowing.
    if (this.getStatus() !== 'done') this.status = 'paused';
    this.emitChange();
    return batch;
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
    this.cancelTick();
    this.gen = this.source();
    this.status = 'idle';
    this.stepCount = 0;
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
  }

  // ---- internals -----------------------------------------------------------------------

  private advance(n: number): readonly S[] {
    const limit = Math.min(n, this.maxStepsPerFrame);
    const batch: S[] = [];
    for (let i = 0; i < limit; i++) {
      const next = this.gen.next();
      if (next.done) {
        this.result = next.value;
        this.status = 'done';
        this.cancelTick();
        break;
      }
      batch.push(next.value);
      this.stepCount++;
    }
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
      this.advance(whole);
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
      result: this.result,
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
