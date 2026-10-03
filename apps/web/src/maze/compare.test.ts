import { describe, expect, it } from 'vitest';
import { CompareController, parseAlgos } from './compare';
import { MazeSession } from './session';

const manual = { schedule: () => () => undefined, now: () => 0 };

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

function lanes(n: number, seed = 'cmp'): MazeSession[] {
  return Array.from({ length: n }, () => {
    const s = new MazeSession(manual);
    s.generate({ width: 8, height: 6, cellSize: 20, seed, autoplay: false });
    return s;
  });
}

describe('CompareController', () => {
  it('advances every lane by the same number of steps', () => {
    const sessions = lanes(3);
    const c = new CompareController({ sessions, ...manual });
    expect(c.getSnapshot().status).toBe('idle');
    c.step(5);
    expect(c.getSnapshot().status).toBe('paused');
    expect(c.getSnapshot().tick).toBe(5);
    for (const s of sessions) expect(s.generation?.steps).toBe(5);
  });

  it('plays at the shared speed and finishes when every lane is done', () => {
    const clock = fakeClock();
    const sessions = lanes(2);
    const c = new CompareController({
      sessions,
      stepsPerSecond: 1000,
      schedule: clock.schedule,
      now: clock.now,
    });
    c.play();
    expect(c.getSnapshot().status).toBe('playing');
    clock.frame(0);
    clock.frame(50); // 50 steps
    expect(c.getSnapshot().tick).toBe(50);
    for (const s of sessions) expect(s.generation?.steps).toBe(50);
    // A 8x6 maze has 47 carves + 47 backtracks + visits ~= 190 steps; run plenty of frames.
    for (let i = 0; i < 20 && c.getSnapshot().status === 'playing'; i++) clock.frame(100);
    expect(c.getSnapshot().status).toBe('done');
    expect(clock.hasPending()).toBe(false);
    for (const s of sessions) expect(s.getSnapshot().phase).toBe('ready');
  });

  it('runToEnd drains all lanes and reports metrics per lane', () => {
    const sessions = lanes(2, 'drain');
    const c = new CompareController({ sessions, ...manual });
    c.runToEnd();
    expect(c.getSnapshot().status).toBe('done');
    for (const s of sessions) {
      expect(s.getSnapshot().phase).toBe('ready');
      expect(s.getSnapshot().metrics?.cells).toBe(48);
    }
    // Same seed and algorithm => identical mazes.
    const [a, b] = sessions;
    expect(Array.from(a!.getSnapshot().state!.walls)).toEqual(
      Array.from(b!.getSnapshot().state!.walls),
    );
  });

  it('setSpeed propagates to lanes and reset makes it playable again', () => {
    const sessions = lanes(1);
    const c = new CompareController({ sessions, ...manual });
    c.setSpeed(500);
    expect(c.getSpeed()).toBe(500);
    expect(sessions[0]!.getSpeed()).toBe(500);
    c.runToEnd();
    expect(c.getSnapshot().status).toBe('done');
    c.reset();
    expect(c.getSnapshot().status).toBe('idle');
    expect(c.getSnapshot().tick).toBe(0);
    c.dispose();
    c.play();
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('parseAlgos keeps known ids (incl. duplicates), caps at 4 and falls back', () => {
    const known = ['a', 'b', 'c'];
    expect(parseAlgos('a,b', known, 'a')).toEqual(['a', 'b']);
    expect(parseAlgos('a, a ,zzz', known, 'a')).toEqual(['a', 'a']);
    expect(parseAlgos('a,b,c,a,b', known, 'a')).toEqual(['a', 'b', 'c', 'a']);
    expect(parseAlgos(undefined, known, 'c')).toEqual(['c']);
    expect(parseAlgos('nope', known, 'b')).toEqual(['b']);
  });

  it('survives a StrictMode-style dispose and revive', () => {
    const sessions = [new MazeSession(manual)];
    sessions[0]!.generate({ width: 4, height: 4, cellSize: 20, seed: 'revive', autoplay: false });
    const c = new CompareController({ sessions, schedule: () => () => undefined });
    c.dispose();
    c.runToEnd();
    expect(sessions[0]!.getSnapshot().phase).toBe('generating');
    c.revive();
    c.runToEnd();
    expect(sessions[0]!.getSnapshot().phase).toBe('ready');
  });
});
