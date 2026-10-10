import {
  DIRS,
  canMove,
  decodeDocument,
  decodeRun,
  dirBetween,
  encodeRun,
  hintCells,
  isPerfectMaze,
} from '@maze/core';
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

  describe('timeline', () => {
    it('rewinds generation exactly and replays to the same maze', () => {
      const s = new MazeSession(manual);
      s.generate({ width: 8, height: 6, cellSize: 20, seed: 'rewind', autoplay: false });
      s.step(40);
      const live = s.getSnapshot().state!;
      const at40 = Array.from(live.walls);
      const visits40 = s.generation!.visits;
      s.step(10);
      s.stepBack(10);
      expect(Array.from(s.getSnapshot().state!.walls)).toEqual(at40);
      expect(s.generation!.visits).toBe(visits40);
      expect(s.getSnapshot().genPlayer!.getSnapshot().stepCount).toBe(40);
      s.seek(0);
      expect(s.generation!.steps).toBe(0);
      expect(Array.from(s.getSnapshot().state!.walls).every((w) => w === 15)).toBe(true);
    });

    it('rewinding a finished maze reopens it and clears solve and first person', () => {
      const s = finishedSession('reopen');
      const finalWalls = Array.from(s.getSnapshot().state!.walls);
      s.startSolve('bfs', false);
      s.runToEnd();
      expect(s.getSnapshot().solveResult).not.toBeNull();
      s.clearSolve();
      s.enterFirstPerson();
      s.restart();
      const snap = s.getSnapshot();
      expect(snap.phase).toBe('generating');
      expect(snap.metrics).toBeNull();
      expect(snap.firstPerson).toBeNull();
      expect(snap.solvePlayer).toBeNull();
      s.runToEnd();
      expect(s.getSnapshot().phase).toBe('ready');
      expect(Array.from(s.getSnapshot().state!.walls)).toEqual(finalWalls);
      expect(s.getSnapshot().metrics).not.toBeNull();
    });

    it('rewinds a solve and clears its result until it finishes again', () => {
      const s = finishedSession('solve-rewind');
      s.startSolve('bfs', false);
      s.runToEnd();
      const path = s.getSnapshot().solveResult!.path;
      s.stepBack(3);
      expect(s.getSnapshot().solveResult).toBeNull();
      expect(s.solveTracker!.done).toBe(false);
      expect(s.getSnapshot().phase).toBe('ready');
      s.runToEnd();
      expect(s.getSnapshot().solveResult!.path).toEqual(path);
    });
  });
});

describe('MazeSession: Run Maze as a game', () => {
  /** A finished session whose clock is under the test's control. */
  function gameSession(seed = 'game') {
    let t = 1_000;
    const s = new MazeSession({ schedule: () => () => undefined, now: () => t });
    s.generate({ width: 7, height: 6, cellSize: 20, seed, autoplay: false });
    s.runToEnd();
    return {
      s,
      advance: (ms: number) => {
        t += ms;
      },
    };
  }

  /** Compass moves along the shortest path from the current cell to the goal. */
  function compassToGoal(s: MazeSession): Array<'N' | 'E' | 'S' | 'W'> {
    const { state, run } = s.getSnapshot();
    const cells = [run!.pose.cell, ...hintCells(state!, run!.pose.cell, 10_000)];
    const out: Array<'N' | 'E' | 'S' | 'W'> = [];
    for (let i = 0; i + 1 < cells.length; i++) {
      out.push((['N', 'E', 'S', 'W'] as const)[dirBetween(state!.grid, cells[i]!, cells[i + 1]!)!]);
    }
    return out;
  }

  it('times the run from the first step to the goal and announces a summary', () => {
    const { s, advance } = gameSession();
    expect(s.enterRun('2d')).toBe(true);
    expect(s.getSnapshot().runView).toBe('2d');
    expect(s.getSnapshot().runStartedAt).toBeNull();
    advance(5_000); // thinking before the first step is free
    const moves = compassToGoal(s);
    for (const m of moves) {
      advance(500);
      s.runMove(m);
    }
    const snap = s.getSnapshot();
    expect(snap.reachedGoal).toBe(true);
    expect(snap.runSummary).toMatchObject({
      moves: moves.length,
      optimalMoves: moves.length,
      efficiency: 1,
      hints: 0,
      undos: 0,
      timeMs: (moves.length - 1) * 500,
    });
    expect(snap.status).toMatch(
      /^You reached the goal in .* with \d+ moves \(shortest \d+\), 100% efficient\.$/,
    );
  });

  it('walls block moves, undo/redo/seek rewind exactly and are counted', () => {
    const { s } = gameSession('undo');
    s.enterRun('2d');
    const start = s.getSnapshot().run!.pose;
    // A blocked direction leaves the run untouched and says so.
    const blocked = (['N', 'E', 'S', 'W'] as const).find(
      (m) => !canMove(s.getSnapshot().state!, start.cell, DIRS[['N', 'E', 'S', 'W'].indexOf(m)]!),
    );
    if (blocked) {
      expect(s.runMove(blocked)).toBe(false);
      expect(s.getSnapshot().status).toMatch(/wall/i);
    }
    const path = compassToGoal(s).slice(0, 3);
    for (const m of path) s.runMove(m);
    const after3 = s.getSnapshot().run!;
    s.runUndo();
    s.runUndo();
    expect(s.getSnapshot().run!.cursor).toBe(1);
    expect(s.getSnapshot().runUndos).toBe(2);
    s.runRedo();
    s.runRedo();
    expect(s.getSnapshot().run!.pose).toEqual(after3.pose);
    s.runSeek(0);
    expect(s.getSnapshot().run!.pose).toEqual(start);
    expect(s.getSnapshot().runUndos).toBe(3);
  });

  it('a hint marks the next cells of the shortest way and clears once you move', () => {
    const { s } = gameSession('hint');
    s.enterRun('3d');
    s.runHint(4);
    const snap = s.getSnapshot();
    expect(snap.runHints).toBe(1);
    expect(snap.hint).toHaveLength(Math.min(4, snap.metrics!.solutionLength!));
    expect(s.hintTracker?.path?.[0]).toBe(snap.run!.pose.cell);
    expect(snap.status).toMatch(/^Hint: head (north|east|south|west)/);
    const first = compassToGoal(s)[0]!;
    s.runMove(first);
    expect(s.hintTracker).toBeNull();
    expect(s.getSnapshot().hint).toBeNull();
  });

  it('replays a saved run move by move and ignores the player meanwhile', () => {
    const { s } = gameSession('replay');
    s.enterRun('2d');
    const moves = compassToGoal(s);
    for (const m of moves) s.runMove(m);
    const saved = encodeRun(s.getSnapshot().run!);
    s.exitFirstPerson();
    expect(s.getSnapshot().run).toBeNull();

    expect(s.startReplay(decodeRun(saved), '2d')).toBe(true);
    expect(s.getSnapshot().runReplay).toBe(true);
    expect(s.runMove(moves[0]!)).toBe(false); // input ignored while replaying
    let ticks = 0;
    while (s.replayTick()) ticks++;
    expect(ticks).toBe(moves.length);
    expect(s.getSnapshot().runReplay).toBe(false);
    expect(s.getSnapshot().reachedGoal).toBe(true);
  });

  it('generating a new maze ends the run', () => {
    const { s } = gameSession('ends');
    s.enterRun('3d');
    s.generate({ width: 5, height: 5, cellSize: 20, seed: 'next', autoplay: false });
    expect(s.getSnapshot().run).toBeNull();
    expect(s.getSnapshot().firstPerson).toBeNull();
  });
});
