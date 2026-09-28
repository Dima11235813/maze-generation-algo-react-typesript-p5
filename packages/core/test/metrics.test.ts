import {
  computeMetrics,
  createGrid,
  createRng,
  deadEnds,
  diameter,
  distances,
  formatDuration,
  generators,
  runToEnd,
  solutionLength,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

describe('metrics', () => {
  it('computes the 3x3 snake fixture', () => {
    const s = threeByThree();
    expect(Array.from(distances(s, 0))).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(deadEnds(s)).toBe(2);
    expect(solutionLength(s)).toBe(8);
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
    });
    expect(m.deadEndRatio).toBeCloseTo(2 / 9);
    expect(m.averageDegree).toBeCloseTo(16 / 9);
  });

  it('handles disconnected mazes', () => {
    const s = twoByTwoClosed();
    expect(solutionLength(s)).toBeNull();
    expect(Array.from(distances(s, 0))).toEqual([0, -1, -1, -1]);
    expect(computeMetrics(s).solutionLength).toBeNull();
    expect(computeMetrics(s).deadEnds).toBe(0);
  });

  it('diameter is at least the solution length on generated mazes', () => {
    const s = runToEnd(generators.require('recursive-backtracker').run(createGrid(12, 9), createRng('m')));
    const m = computeMetrics(s);
    expect(m.diameter).toBeGreaterThanOrEqual(m.solutionLength ?? 0);
    expect(m.deadEnds).toBeGreaterThan(0);
    expect(m.passages).toBe(107);
  });

  it('formats durations as mm:ss (legacy bug fixed)', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59_999)).toBe('0:59');
    expect(formatDuration(61_000)).toBe('1:01');
    expect(formatDuration(3_600_000 + 65_000)).toBe('1:01:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
