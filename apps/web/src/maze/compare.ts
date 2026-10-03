/**
 * CompareController: one transport (play/pause/step/speed) that advances several
 * `MazeSession`s in lockstep - the same number of generator steps per tick for every lane.
 *
 * Lanes whose generation has finished simply stay complete; a slow algorithm never stalls the
 * others. The controller is framework-agnostic and exposes `onChange`/`getSnapshot` for
 * `useSyncExternalStore`.
 */
import { SPEED_MAX, SPEED_MIN } from '@maze/player';
import type { MazeSession } from './session';

export type CompareStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface CompareSnapshot {
  readonly status: CompareStatus;
  readonly speed: number;
  /** Lockstep steps issued so far (each lane received this many `step()` calls' worth). */
  readonly tick: number;
  readonly elapsedMs: number;
  /** Lane indices still generating. */
  readonly active: readonly number[];
}

export interface CompareControllerOptions {
  readonly sessions: readonly MazeSession[];
  readonly stepsPerSecond?: number;
  readonly maxStepsPerFrame?: number;
  readonly now?: () => number;
  readonly schedule?: (cb: (time: number) => void) => () => void;
}

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

function clampSpeed(v: number): number {
  if (!Number.isFinite(v)) return 60;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(v)));
}

export class CompareController {
  private readonly sessions: readonly MazeSession[];
  private readonly now: () => number;
  private readonly schedule: (cb: (time: number) => void) => () => void;
  private readonly maxStepsPerFrame: number;

  private status: CompareStatus = 'idle';
  private speed: number;
  private tick = 0;
  private elapsedMs = 0;
  private accumulator = 0;
  private lastTick: number | null = null;
  private cancelFrame: (() => void) | null = null;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private snapshot: CompareSnapshot;

  constructor(opts: CompareControllerOptions) {
    this.sessions = opts.sessions;
    this.now = opts.now ?? defaultNow;
    this.schedule = opts.schedule ?? defaultSchedule;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 20_000;
    this.speed = clampSpeed(opts.stepsPerSecond ?? 60);
    this.snapshot = this.build();
  }

  getSnapshot(): CompareSnapshot {
    return this.snapshot;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Indices of lanes whose generation is still running. */
  activeLanes(): number[] {
    const out: number[] = [];
    this.sessions.forEach((s, i) => {
      if (s.getSnapshot().phase === 'generating') out.push(i);
    });
    return out;
  }

  play(): void {
    if (this.disposed || this.status === 'playing') return;
    if (this.activeLanes().length === 0) {
      this.status = 'done';
      this.emit();
      return;
    }
    this.status = 'playing';
    this.lastTick = null;
    this.accumulator = 0;
    this.request();
    this.emit();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.cancel();
    this.emit();
  }

  toggle(): void {
    if (this.status === 'playing') this.pause();
    else this.play();
  }

  /** Advances every active lane by `n` steps immediately. */
  step(n = 1): void {
    if (this.disposed) return;
    if (this.status === 'idle') this.status = 'paused';
    this.advance(n);
    this.emit();
  }

  /** Drains every lane synchronously (bounded per lane by `maxSteps`). */
  runToEnd(maxSteps = 5_000_000): void {
    if (this.disposed) return;
    this.cancel();
    for (const s of this.sessions) {
      let guard = 0;
      while (s.getSnapshot().phase === 'generating' && guard < maxSteps) {
        s.step(this.maxStepsPerFrame);
        guard += this.maxStepsPerFrame;
      }
    }
    this.tick += 1;
    this.status = this.activeLanes().length === 0 ? 'done' : 'paused';
    this.emit();
  }

  setSpeed(stepsPerSecond: number): void {
    const next = clampSpeed(stepsPerSecond);
    if (next === this.speed) return;
    this.speed = next;
    for (const s of this.sessions) s.setSpeed(next);
    this.emit();
  }

  getSpeed(): number {
    return this.speed;
  }

  /** Call after the lanes were (re)generated so `done` can become playable again. */
  reset(): void {
    this.cancel();
    this.status = 'idle';
    this.tick = 0;
    this.elapsedMs = 0;
    this.accumulator = 0;
    this.emit();
  }

  dispose(): void {
    this.cancel();
    this.disposed = true;
  }

  /**
   * Undoes `dispose()`. React StrictMode runs effect cleanups once on mount in development, so
   * the page revives its controller when the effect re-runs instead of losing the transport.
   * Listeners are kept across dispose for the same reason (useSyncExternalStore resubscribes).
   */
  revive(): void {
    this.disposed = false;
  }

  // ---- internals ------------------------------------------------------------------------

  private advance(n: number): void {
    const k = Math.min(n, this.maxStepsPerFrame);
    if (k <= 0) return;
    let anyActive = false;
    for (const s of this.sessions) {
      if (s.getSnapshot().phase !== 'generating') continue;
      s.step(k);
      anyActive = true;
    }
    this.tick += k;
    if (!anyActive || this.activeLanes().length === 0) {
      this.status = 'done';
      this.cancel();
    }
  }

  private request(): void {
    this.cancelFrame = this.schedule((time) => {
      this.cancelFrame = null;
      this.frame(time);
    });
  }

  private cancel(): void {
    if (this.cancelFrame) {
      this.cancelFrame();
      this.cancelFrame = null;
    }
    this.lastTick = null;
  }

  private frame(time: number): void {
    if (this.status !== 'playing') return;
    const now = Number.isFinite(time) ? time : this.now();
    if (this.lastTick !== null) {
      const dt = Math.max(0, Math.min(250, now - this.lastTick));
      this.elapsedMs += dt;
      this.accumulator += (dt * this.speed) / 1000;
    }
    this.lastTick = now;
    const whole = Math.floor(this.accumulator);
    if (whole > 0) {
      this.accumulator -= whole;
      this.advance(whole);
      this.emit();
    }
    if ((this.status as CompareStatus) === 'playing') this.request();
  }

  private build(): CompareSnapshot {
    return {
      status: this.status,
      speed: this.speed,
      tick: this.tick,
      elapsedMs: this.elapsedMs,
      active: this.activeLanes(),
    };
  }

  private emit(): void {
    this.snapshot = this.build();
    for (const l of this.listeners) l();
  }
}

/** Parses the `algos` search param: comma-separated generator ids, unknown ones dropped, max 4. */
export function parseAlgos(
  raw: string | undefined,
  known: readonly string[],
  fallback: string,
): string[] {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && known.includes(s))
    .slice(0, 4);
  return ids.length > 0 ? ids : [fallback];
}

export const MAX_COMPARE_LANES = 4;
