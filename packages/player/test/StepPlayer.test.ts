import { SPEED_MAX, SPEED_MIN, SPEED_PRESETS, StepPlayer, clampSpeed } from '../src';

/** Deterministic scheduler: frames fire only when the test calls `frame(time)`. */
function fakeClock() {
  let pending: ((t: number) => void) | null = null;
  let now = 0;
  return {
    schedule: (cb: (t: number) => void) => {
      pending = cb;
      return () => {
        pending = null;
      };
    },
    now: () => now,
    frame(advanceMs: number) {
      now += advanceMs;
      const cb = pending;
      pending = null;
      cb?.(now);
    },
    hasPending: () => pending !== null,
  };
}

function* counter(n: number): Generator<number, string> {
  for (let i = 0; i < n; i++) yield i;
  return `done:${n}`;
}

describe('StepPlayer', () => {
  it('starts idle and steps manually while paused', () => {
    const p = new StepPlayer({ source: () => counter(5), schedule: () => () => undefined });
    const seen: number[] = [];
    p.subscribe((batch) => seen.push(...batch));
    expect(p.getStatus()).toBe('idle');
    expect(p.step()).toEqual([0]);
    expect(p.getStatus()).toBe('paused');
    expect(p.step(2)).toEqual([1, 2]);
    expect(seen).toEqual([0, 1, 2]);
    expect(p.getSnapshot().stepCount).toBe(3);
    expect(p.step(10)).toEqual([3, 4]);
    expect(p.getStatus()).toBe('done');
    expect(p.getResult()).toBe('done:5');
    expect(p.step()).toEqual([]);
  });

  it('advances at the configured steps-per-second, independent of frame rate', () => {
    const clock = fakeClock();
    const p = new StepPlayer({
      source: () => counter(1000),
      stepsPerSecond: 100,
      schedule: clock.schedule,
      now: clock.now,
    });
    const seen: number[] = [];
    p.subscribe((b) => seen.push(...b));
    p.play();
    expect(p.getStatus()).toBe('playing');
    clock.frame(16); // first frame sets the baseline, no steps
    expect(seen).toHaveLength(0);
    clock.frame(100); // 100 ms at 100 sps = 10 steps
    expect(seen).toHaveLength(10);
    clock.frame(5); // 0.5 step accumulates
    expect(seen).toHaveLength(10);
    clock.frame(5); // now 1 step
    expect(seen).toHaveLength(11);
    // a 4 s tab-switch gap is clamped to 250 ms
    clock.frame(4000);
    expect(seen).toHaveLength(11 + 25);
    expect(p.getSnapshot().elapsedMs).toBe(16 + 100 + 5 + 5 + 250 - 16);
    p.pause();
    expect(p.getStatus()).toBe('paused');
    expect(clock.hasPending()).toBe(false);
  });

  it('finishes and stops scheduling when the generator completes', () => {
    const clock = fakeClock();
    const changes: string[] = [];
    const p = new StepPlayer({
      source: () => counter(3),
      stepsPerSecond: 1000,
      schedule: clock.schedule,
      now: clock.now,
    });
    p.onChange(() => changes.push(p.getStatus()));
    p.play();
    clock.frame(0);
    clock.frame(100);
    expect(p.getStatus()).toBe('done');
    expect(p.getResult()).toBe('done:3');
    expect(clock.hasPending()).toBe(false);
    expect(changes.at(-1)).toBe('done');
    p.play(); // no-op when done
    expect(p.getStatus()).toBe('done');
  });

  it('runToEnd drains synchronously and reset starts over', () => {
    const p = new StepPlayer({ source: () => counter(4), schedule: () => () => undefined });
    expect(p.runToEnd()).toEqual([0, 1, 2, 3]);
    expect(p.getStatus()).toBe('done');
    p.reset();
    expect(p.getStatus()).toBe('idle');
    expect(p.getSnapshot().stepCount).toBe(0);
    expect(p.getResult()).toBeUndefined();
    expect(p.step()).toEqual([0]);
  });

  it('respects maxStepsPerFrame and leaves the rest for later', () => {
    const p = new StepPlayer({
      source: () => counter(100),
      maxStepsPerFrame: 7,
      schedule: () => () => undefined,
    });
    expect(p.runToEnd()).toHaveLength(7);
    expect(p.getStatus()).toBe('paused');
  });

  it('clamps speed and toggles', () => {
    const p = new StepPlayer({ source: () => counter(10), schedule: () => () => undefined });
    p.setSpeed(0);
    expect(p.getSpeed()).toBe(SPEED_MIN);
    p.setSpeed(1e9);
    expect(p.getSpeed()).toBe(SPEED_MAX);
    expect(clampSpeed(Number.NaN)).toBe(60);
    expect(clampSpeed(33.4)).toBe(33);
    expect(SPEED_PRESETS[0]).toBe(1);
    p.toggle();
    expect(p.getStatus()).toBe('playing');
    p.toggle();
    expect(p.getStatus()).toBe('paused');
    p.dispose();
    p.play();
    expect(p.getStatus()).toBe('paused');
  });

  it('snapshot identity changes only on change', () => {
    const p = new StepPlayer({ source: () => counter(10), schedule: () => () => undefined });
    const a = p.getSnapshot();
    expect(p.getSnapshot()).toBe(a);
    p.step();
    expect(p.getSnapshot()).not.toBe(a);
  });

  describe('timeline: seek, step back, restart', () => {
    function recorder() {
      const seen: number[] = [];
      let resets = 0;
      const p = new StepPlayer({ source: () => counter(10), schedule: () => () => undefined });
      p.subscribe((b) => {
        seen.push(...b);
      });
      p.onReset(() => {
        resets++;
        seen.length = 0;
      });
      return { p, seen, resets: () => resets };
    }

    it('rewinds by replaying the deterministic source, then resumes from there', () => {
      const { p, seen, resets } = recorder();
      p.step(6);
      expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
      p.stepBack();
      expect(resets()).toBe(1);
      expect(seen).toEqual([0, 1, 2, 3, 4]);
      expect(p.getSnapshot().stepCount).toBe(5);
      expect(p.getSnapshot().highWater).toBe(6);
      expect(p.step()).toEqual([5]);
      p.stepBack(10);
      expect(p.getSnapshot().stepCount).toBe(0);
      expect(seen).toEqual([]);
    });

    it('seeks forward without a reset and knows the total once finished', () => {
      const { p, seen, resets } = recorder();
      p.seek(4);
      expect(resets()).toBe(0);
      expect(seen).toEqual([0, 1, 2, 3]);
      expect(p.getSnapshot().total).toBeNull();
      p.seek(1_000);
      expect(p.getStatus()).toBe('done');
      expect(p.getResult()).toBe('done:10');
      expect(p.getSnapshot().total).toBe(10);
      // Rewinding a finished run reopens it.
      p.seek(3);
      expect(p.getStatus()).toBe('paused');
      expect(p.getResult()).toBeUndefined();
      expect(seen).toEqual([0, 1, 2]);
      expect(p.getSnapshot().total).toBe(10);
    });

    it('restart pauses at step 0', () => {
      const clock = { cb: null as ((t: number) => void) | null };
      const p = new StepPlayer({
        source: () => counter(10),
        schedule: (cb) => {
          clock.cb = cb;
          return () => {
            clock.cb = null;
          };
        },
      });
      p.step(3);
      p.play();
      p.restart();
      expect(p.getStatus()).toBe('paused');
      expect(p.getSnapshot().stepCount).toBe(0);
      expect(clock.cb).toBeNull();
    });

    it('keeps playing after a seek while playing', () => {
      let pending: ((t: number) => void) | null = null;
      const p = new StepPlayer({
        source: () => counter(100),
        schedule: (cb) => {
          pending = cb;
          return () => {
            pending = null;
          };
        },
      });
      p.step(10);
      p.play();
      p.seek(2);
      expect(p.getStatus()).toBe('playing');
      expect(pending).not.toBeNull();
    });

    it('reset clears the timeline bounds and notifies', () => {
      const { p, resets } = recorder();
      p.seek(1_000);
      p.reset();
      expect(resets()).toBe(1);
      expect(p.getSnapshot()).toMatchObject({
        highWater: 0,
        total: null,
        stepCount: 0,
        status: 'idle',
      });
    });
  });
});
