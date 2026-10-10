import {
  Dir,
  createGrid,
  createRng,
  generators,
  hasWall,
  neighbor,
  passageCount,
  runToEnd,
  wallsAreSymmetric,
  type MazeState,
} from '@maze/core';
import { describe, expect, it } from 'vitest';
import { BuildModel } from './build';

function maze(seed = 'build'): MazeState {
  return runToEnd(
    generators.require('recursive-backtracker').run(createGrid(6, 5), createRng(seed), {}),
  );
}

describe('BuildModel', () => {
  it('starts clean, with the cursor on the start and no issues for a generated maze', () => {
    const m = new BuildModel(maze());
    const s = m.getSnapshot();
    expect(s.cursor).toBe(s.state.start);
    expect(s.issues).toEqual([]);
    expect(s.canUndo).toBe(false);
    expect(s.dirty).toBe(false);
    expect(m.overlay.tracker.current).toBe(s.cursor);
  });

  it('toggles walls from the keyboard cursor, validates, and undoes exactly', () => {
    const m = new BuildModel(maze());
    const before = m.getSnapshot().state;
    // Open a wall next to the cursor: a perfect maze gains a loop.
    const closed = [Dir.N, Dir.E, Dir.S, Dir.W].find(
      (d) => neighbor(before.grid, before.start, d) >= 0 && hasWall(before.walls, before.start, d),
    )!;
    expect(m.toggleCursorWall(closed)).toBe(true);
    let s = m.getSnapshot();
    expect(wallsAreSymmetric(s.state)).toBe(true);
    expect(passageCount(s.state)).toBe(passageCount(before) + 1);
    expect(s.issues.map((i) => i.code)).toContain('not-perfect');
    expect(s.dirty).toBe(true);
    m.undo();
    s = m.getSnapshot();
    expect(Array.from(s.state.walls)).toEqual(Array.from(before.walls));
    expect(s.canRedo).toBe(true);
    m.redo();
    expect(passageCount(m.getSnapshot().state)).toBe(passageCount(before) + 1);
  });

  it('closing every wall makes the goal unreachable and marks the isolated cells', () => {
    const m = new BuildModel(maze());
    m.fill('walls');
    const s = m.getSnapshot();
    const codes = s.issues.map((i) => i.code);
    expect(codes).toContain('goal-unreachable');
    expect(codes).toContain('isolated-cells');
    expect(m.overlay.tracker.marks[s.state.goal]).toBeGreaterThan(0);
    m.undo();
    expect(m.getSnapshot().issues).toEqual([]);
  });

  it('sets start and goal with the tools, resizes and braids as single undo steps', () => {
    const m = new BuildModel(maze());
    m.setTool('goal');
    m.useToolOn(7);
    expect(m.getSnapshot().state.goal).toBe(7);
    m.setTool('start');
    m.useToolOn(7);
    expect(m.getSnapshot().issues.map((i) => i.code)).toContain('start-equals-goal');
    m.undo();
    m.resize(8, 3);
    expect(m.getSnapshot().state.grid.width).toBe(8);
    m.undo();
    expect(m.getSnapshot().state.grid.width).toBe(6);
    const p = passageCount(m.getSnapshot().state);
    m.braid(100, 'seed');
    expect(passageCount(m.getSnapshot().state)).toBeGreaterThan(p);
    m.undo();
    expect(passageCount(m.getSnapshot().state)).toBe(p);
  });

  it('moves the cursor within the grid and can show the shortest path', () => {
    const m = new BuildModel(maze());
    m.setCursor(0);
    expect(m.moveCursor(Dir.N)).toBe(0);
    expect(m.moveCursor(Dir.E)).toBe(1);
    m.setShowSolution(true);
    expect(m.overlay.tracker.path?.[0]).toBe(m.getSnapshot().state.start);
    m.setShowSolution(false);
    expect(m.overlay.tracker.path).toBeNull();
  });
});
