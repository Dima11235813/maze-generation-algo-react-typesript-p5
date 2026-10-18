import fc from 'fast-check';
import { StepPlayer, type BreakHit } from '../src';

/** Deterministic scheduler: frames fire only when the test calls `frame(ms)`. */
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

function* values(xs: readonly number[]): Generator<number, string> {
  for (const x of xs) yield x;
  return 'end';
}

/** The step count a breakpoint must stop at: just after the first match beyond `from`. */
function expectedStop(xs: readonly number[], from: number, match: (x: number) => boolean) {
  for (let i = from; i < xs.length; i++) if (match(xs[i] ?? Number.NaN)) return i + 1;
  return null;
}

const source = fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 300 });

describe('StepPlayer breakpoints', () => {
  it('runUntil stops exactly on the first matching step after the current position', () => {
    fc.assert(
      fc.property(
        source,
        fc.nat({ max: 320 }),
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 1, max: 64 }),
        (xs, from, target, perFrame) => {
          const p = new StepPlayer({
            source: () => values(xs),
            maxStepsPerFrame: perFrame,
            schedule: () => () => undefined,
          });
          p.seek(from);
          const start = p.getSnapshot().stepCount;
          const seen: number[] = [];
          p.subscribe((b) => seen.push(...b));
          const hit = p.runUntil((x) => x === target);
          const stop = expectedStop(xs, start, (x) => x === target);
          if (stop === null) {
            expect(hit).toBeNull();
            expect(p.getStatus()).toBe('done');
            expect(p.getSnapshot().stepCount).toBe(xs.length);
          } else {
            expect(hit).toEqual({ step: target, index: stop });
            expect(p.getStatus()).toBe('paused');
            expect(p.getSnapshot().stepCount).toBe(stop);
            // The matching step is the last one listeners were given.
            expect(seen[seen.length - 1]).toBe(target);
          }
          expect(seen).toEqual(xs.slice(start, stop ?? xs.length));
        },
      ),
    );
  });

  it('playUntil pauses on the same step whatever the speed and frame size', () => {
    fc.assert(
      fc.property(
        source,
        fc.nat({ max: 100 }),
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 1, max: 5_000 }),
        fc.integer({ min: 1, max: 40 }),
        (xs, from, target, speed, perFrame) => {
          const clock = fakeClock();
          const p = new StepPlayer({
            source: () => values(xs),
            stepsPerSecond: speed,
            maxStepsPerFrame: perFrame,
            schedule: clock.schedule,
            now: clock.now,
          });
          p.seek(from);
          const start = p.getSnapshot().stepCount;
          const hits: (BreakHit<number> | null)[] = [];
          p.onBreak((h) => hits.push(h));
          const armed = p.getStatus() !== 'done';
          p.playUntil((x) => x === target);
          expect(p.getSnapshot().breakpointArmed).toBe(armed);
          for (let i = 0; i < 100_000 && clock.hasPending(); i++) clock.frame(16);
          const stop = expectedStop(xs, start, (x) => x === target);
          expect(p.getSnapshot().breakpointArmed).toBe(false);
          if (stop === null) {
            expect(p.getSnapshot().stepCount).toBe(xs.length);
            expect(hits).toEqual(armed ? [null] : []);
          } else {
            expect(hits).toEqual([{ step: target, index: stop }]);
            expect(p.getStatus()).toBe('paused');
            expect(p.getSnapshot().stepCount).toBe(stop);
          }
        },
      ),
    );
  });

  it('shows a stateful breakpoint every step once, in order, with its index', () => {
    const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    const p = new StepPlayer({ source: () => values(xs), schedule: () => () => undefined });
    p.step(2);
    const seen: [number, number][] = [];
    let sum = 0;
    const hit = p.runUntil((x, i) => {
      seen.push([x, i]);
      sum += x;
      return sum > 10;
    });
    // 4 + 1 + 5 = 10, + 9 = 19 > 10: stops on the 9, the sixth step.
    expect(hit).toEqual({ step: 9, index: 6 });
    expect(seen).toEqual([
      [4, 3],
      [1, 4],
      [5, 5],
      [9, 6],
    ]);
  });

  it('any other command disarms a playUntil without a break event', () => {
    const clock = fakeClock();
    const make = () =>
      new StepPlayer({
        source: () => values([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
        stepsPerSecond: 1,
        schedule: clock.schedule,
        now: clock.now,
      });
    const commands: [string, (p: StepPlayer<number, string>) => void][] = [
      ['pause', (p) => p.pause()],
      ['step', (p) => p.step()],
      ['seek', (p) => p.seek(3)],
      ['restart', (p) => p.restart()],
      ['reset', (p) => p.reset()],
      ['runToEnd', (p) => p.runToEnd()],
    ];
    for (const [name, command] of commands) {
      const p = make();
      const hits: unknown[] = [];
      p.onBreak((h) => hits.push(h));
      p.playUntil((x) => x === 1);
      expect(p.getSnapshot().breakpointArmed, name).toBe(true);
      command(p);
      expect(p.getSnapshot().breakpointArmed, name).toBe(false);
      expect(hits, name).toEqual([]);
    }
  });

  it('does nothing once the source is done', () => {
    const p = new StepPlayer({ source: () => values([1, 2]), schedule: () => () => undefined });
    p.runToEnd();
    const hits: unknown[] = [];
    p.onBreak((h) => hits.push(h));
    expect(p.runUntil(() => true)).toBeNull();
    p.playUntil(() => true);
    expect(p.getSnapshot().breakpointArmed).toBe(false);
    expect(p.getStatus()).toBe('done');
    // Neither starts a run, so there is no break to report.
    expect(hits).toEqual([]);
  });
});
