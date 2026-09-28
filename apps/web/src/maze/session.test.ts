import { DIRS, canMove, decodeDocument, dirBetween, isPerfectMaze } from '@maze/core';
import { describe, expect, it } from 'vitest';
import { MazeSession } from './session';

/** Scheduler that never fires: tests drive players with step()/runToEnd(). */
const manual = { schedule: () => () => undefined, now: () => 0 };

function finishedSession(seed = 'unit-test') {
  const s = new MazeSession(manual);
  s.generate({ width: 12, height: 9, cellSize: 20, seed, autoplay: false });
  s.runToEnd();
  return s;
}

describe('MazeSession', () => {
  it('generates a perfect maze and exposes metrics', () => {
    const s = new MazeSession(manual);
    let renders = 0;
    s.setRenderRequest(() => renders++);
    s.generate({ width: 12, height: 9, cellSize: 20, seed: 'unit-test', autoplay: false });
    expect(s.getSnapshot().phase).toBe('generating');
    expect(s.getSnapshot().seed).toBe('unit-test');
    expect(s.generation).not.toBeNull();

    s.step(5);
    expect(s.generation?.visits).toBeGreaterThan(0);

    s.runToEnd();
    const snap = s.getSnapshot();
    expect(snap.phase).toBe('ready');
    expect(snap.state).not.toBeNull();
    expect(isPerfectMaze(snap.state!)).toBe(true);
    expect(snap.metrics?.cells).toBe(108);
    expect(snap.metrics?.solutionLength).toBeGreaterThan(0);
    expect(snap.status).toMatch(/complete/i);
    expect(renders).toBeGreaterThan(0);
  });

  it('is deterministic for a seed and regenerate reproduces the same walls', () => {
    const a = finishedSession('same-seed');
    const wallsA = Array.from(a.getSnapshot().state!.walls);
    a.regenerate();
    a.runToEnd();
    const wallsB = Array.from(a.getSnapshot().state!.walls);
    expect(wallsB).toEqual(wallsA);
    const c = finishedSession('other-seed');
    expect(Array.from(c.getSnapshot().state!.walls)).not.toEqual(wallsA);
  });

  it('mirrors carves into the live state while generating', () => {
    const s = new MazeSession(manual);
    s.generate({ width: 6, height: 6, cellSize: 20, seed: 'live', autoplay: false });
    const live = s.getSnapshot().state!;
    const before = Array.from(live.walls).reduce((n, w) => n + w, 0);
    s.step(10);
    const after = Array.from(live.walls).reduce((n, w) => n + w, 0);
    expect(after).toBeLessThan(before);
  });

  it('solves with BFS and reports a shortest path', () => {
    const s = finishedSession();
    expect(s.startSolve('bfs', false)).toBe(true);
    expect(s.getSnapshot().solvePlayer).not.toBeNull();
    s.runToEnd();
    const snap = s.getSnapshot();
    expect(snap.solveResult?.path).not.toBeNull();
    expect(snap.solveResult!.path!.length - 1).toBe(snap.metrics!.solutionLength);
    expect(snap.status).toMatch(/solved/i);
    s.clearSolve();
    expect(s.getSnapshot().solvePlayer).toBeNull();
    expect(s.solveTracker).toBeNull();
  });

  it('refuses to solve or run first-person before generation finishes', () => {
    const s = new MazeSession(manual);
    s.generate({ width: 5, height: 5, cellSize: 20, seed: 'x', autoplay: false });
    expect(s.startSolve('bfs')).toBe(false);
    expect(s.enterFirstPerson()).toBe(false);
  });

  it('moves in first person only through open passages and detects the goal', () => {
    const s = finishedSession();
    expect(s.enterFirstPerson()).toBe(true);
    const state = s.getSnapshot().state!;
    const fp = () => s.getSnapshot().firstPerson!;
    expect(fp().cell).toBe(state.start);

    // Walking into a wall does not move.
    const blocked = DIRS.find((d) => !canMove(state, state.start, d));
    expect(blocked).toBeDefined();
    let guard = 0;
    while (fp().heading !== blocked && guard++ < 4) s.fpTurnRight();
    s.fpForward();
    expect(fp().cell).toBe(state.start);

    // Walk the BFS solution: face each next cell, then step forward.
    s.startSolve('bfs', false);
    s.runToEnd();
    const path = s.getSnapshot().solveResult!.path!;
    for (let i = 1; i < path.length; i++) {
      const target = path[i]!;
      const want = dirBetween(state.grid, fp().cell, target);
      expect(want).toBeDefined();
      guard = 0;
      while (fp().heading !== want && guard++ < 4) s.fpTurnRight();
      s.fpForward();
      expect(fp().cell).toBe(target);
    }
    expect(s.getSnapshot().reachedGoal).toBe(true);
    expect(s.getSnapshot().status).toMatch(/goal/i);

    // Backward returns along the corridor we came from.
    s.fpBackward();
    expect(fp().cell).toBe(path[path.length - 2]);

    s.setPeek(true);
    expect(fp().peek).toBe(true);
    s.exitFirstPerson();
    expect(s.getSnapshot().firstPerson).toBeNull();
  });

  it('saves a MazeDocument with provenance and loads it back', async () => {
    const s = finishedSession('save-me');
    const doc = await s.save('Saved maze');
    expect(doc.id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(doc.provenance?.seed).toBe('save-me');
    expect(doc.meta?.name).toBe('Saved maze');
    expect(Array.from(decodeDocument(doc).walls)).toEqual(Array.from(s.getSnapshot().state!.walls));

    const t = new MazeSession(manual);
    t.loadDocument(doc, 'Saved maze');
    const snap = t.getSnapshot();
    expect(snap.phase).toBe('ready');
    expect(snap.sourceName).toBe('Saved maze');
    expect(snap.width).toBe(12);
    expect(snap.genPlayer).toBeNull();
    expect(t.generation).toBeNull();
    expect(snap.metrics?.solutionLength).toBe(s.getSnapshot().metrics?.solutionLength);
  });

  it('rejects saving while generating', async () => {
    const s = new MazeSession(manual);
    s.generate({ width: 5, height: 5, cellSize: 20, seed: 'x', autoplay: false });
    await expect(s.save('nope')).rejects.toThrow();
  });

  it('dispose returns to the empty state but keeps listeners', () => {
    const s = finishedSession();
    let calls = 0;
    s.subscribe(() => calls++);
    s.dispose();
    expect(s.getSnapshot().phase).toBe('empty');
    expect(calls).toBe(1);
  });
});
