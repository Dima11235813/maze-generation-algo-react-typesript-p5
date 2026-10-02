import {
  bfs,
  collect,
  computeMetrics,
  corridorStats,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  deadEnds,
  diameter,
  difficultyScore,
  distances,
  formatDuration,
  generators,
  removeWall,
  runToEnd,
  shortestPath,
  solutionLength,
  solverRelativeMetrics,
  turnsAlong,
  twistiness,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

describe('metrics', () => {
  it('computes the 3x3 snake fixture', () => {
    const s = threeByThree();
    expect(Array.from(distances(s, 0))).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(deadEnds(s)).toBe(2);
    expect(solutionLength(s)).toBe(8);
    expect(shortestPath(s, 0, 8)).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(shortestPath(s, 4, 4)).toEqual([4]);
    const d = diameter(s);
    expect(d.length).toBe(8);
    expect(new Set([d.from, d.to])).toEqual(new Set([0, 8]));
    const m = computeMetrics(s);
    expect(m).toMatchObject({
      cells: 9,
      passages: 8,
      deadEnds: 2,
      solutionLength: 8,
      diameter: 8,
      junctions: 0,
      junctionsOnPath: 0,
      river: 7,
      longestDeadEndCorridor: 0,
    });
    expect(m.deadEndRatio).toBeCloseTo(2 / 9);
    expect(m.averageDegree).toBeCloseTo(16 / 9);
    // E,E,S,W,W,S,E,E -> 4 turns over 8 moves
    expect(m.twistiness).toBeCloseTo(0.5);
    expect(twistiness(s)).toBeCloseTo(0.5);
    expect(turnsAlong(s.grid, [0, 1, 2, 5])).toBe(1);
    expect(m.difficulty).toBeGreaterThan(0);
    expect(m.difficulty).toBeLessThanOrEqual(100);
  });

  it('handles disconnected mazes', () => {
    const s = twoByTwoClosed();
    expect(solutionLength(s)).toBeNull();
    expect(shortestPath(s, 0, 3)).toBeNull();
    expect(Array.from(distances(s, 0))).toEqual([0, -1, -1, -1]);
    const m = computeMetrics(s);
    expect(m.solutionLength).toBeNull();
    expect(m.deadEnds).toBe(0);
    expect(m.twistiness).toBe(0);
    expect(m.river).toBe(0);
    expect(m.difficulty).toBe(0);
  });

  it('measures corridors and dead-end branches on a hand-built maze', () => {
    // 4x1 corridor with a 1-cell stub hanging off cell 1:
    //   row 0: 0-1-2-3 (start 0, goal 3)      row 1: 5 attached below 1
    const g = createGrid(4, 2);
    const w = createWalls(g);
    removeWall(w, g, 0, 1);
    removeWall(w, g, 1, 2);
    removeWall(w, g, 2, 3);
    removeWall(w, g, 1, 5);
    const s = createMazeState(g, w, 0, 3);
    const c = corridorStats(s);
    expect(c.longestDeadEndCorridor).toBe(1); // cell 5 up to the junction at 1
    expect(c.corridorCount).toBe(1); // cell 2 is the only degree-2 run
    expect(c.river).toBe(1);
    const m = computeMetrics(s);
    expect(m.junctions).toBe(1);
    expect(m.junctionsOnPath).toBe(1);
    // Isolated cells 4,6,7 have degree 0 and are ignored.
    expect(m.deadEnds).toBe(3); // 0, 3 and 5
  });

  it('diameter is at least the solution length on generated mazes; extended metrics are sane', () => {
    const s = runToEnd(generators.require('recursive-backtracker').run(createGrid(12, 9), createRng('m')));
    const m = computeMetrics(s);
    expect(m.diameter).toBeGreaterThanOrEqual(m.solutionLength ?? 0);
    expect(m.deadEnds).toBeGreaterThan(0);
    expect(m.passages).toBe(107);
    expect(m.river).toBeGreaterThan(1);
    expect(m.longestDeadEndCorridor).toBeGreaterThanOrEqual(1);
    expect(m.twistiness).toBeGreaterThan(0);
    expect(m.twistiness).toBeLessThanOrEqual(1);
    expect(m.difficulty).toBeGreaterThan(0);
    expect(m.difficulty).toBeLessThanOrEqual(100);
  });

  it('difficultyScore clamps each term', () => {
    expect(difficultyScore({ cells: 100, solutionLength: null, deadEndRatio: 1, twistiness: 1, junctionsOnPath: 50 })).toBe(0);
    expect(difficultyScore({ cells: 100, solutionLength: 100, deadEndRatio: 0.3, twistiness: 1, junctionsOnPath: 100 })).toBe(100);
    expect(difficultyScore({ cells: 100, solutionLength: 20, deadEndRatio: 0, twistiness: 0, junctionsOnPath: 0 })).toBe(7);
  });

  it('solverRelativeMetrics compares a solve with the maze', () => {
    const s = threeByThree();
    const m = computeMetrics(s);
    const { stats } = collect(bfs.run(s)).result;
    expect(solverRelativeMetrics(stats, m)).toEqual({ expandedRatio: 1, optimalityRatio: 1 });
    expect(solverRelativeMetrics({ ...stats, pathLength: null }, m).optimalityRatio).toBeNull();
    expect(solverRelativeMetrics(stats, { cells: 0, solutionLength: null }).expandedRatio).toBe(0);
    expect(solverRelativeMetrics({ ...stats, pathLength: 0 }, { cells: 1, solutionLength: 0 }).optimalityRatio).toBe(1);
  });

  it('formats durations as mm:ss (legacy bug fixed)', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59_999)).toBe('0:59');
    expect(formatDuration(61_000)).toBe('1:01');
    expect(formatDuration(3_600_000 + 65_000)).toBe('1:01:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
