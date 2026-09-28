import fc from 'fast-check';
import {
  bfs,
  collect,
  createGrid,
  createRng,
  dfs,
  distances,
  generators,
  hasWall,
  dirBetween,
  runToEnd,
  solvers,
  type MazeState,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

function randomMaze(width: number, height: number, seed: string): MazeState {
  return runToEnd(generators.require('recursive-backtracker').run(createGrid(width, height), createRng(seed)));
}

function isValidPath(state: MazeState, path: readonly number[]): boolean {
  if (path[0] !== state.start || path.at(-1) !== state.goal) return false;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const d = dirBetween(state.grid, a, b);
    if (d === undefined || hasWall(state.walls, a, d)) return false;
  }
  return true;
}

const gridArb = fc.record({
  width: fc.integer({ min: 1, max: 10 }),
  height: fc.integer({ min: 1, max: 10 }),
});

describe.each(solvers.all.map((s) => [s.meta.id, s] as const))('solver %s', (_id, solver) => {
  it('has consistent metadata', () => {
    expect(solver.meta.family).toBe('solver');
    expect(solver.meta.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('property: finds a valid path on every perfect maze and reports stats', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
        const maze = randomMaze(width, height, seed);
        const { steps, result } = collect(solver.run(maze));
        expect(result.path).not.toBeNull();
        expect(isValidPath(maze, result.path!)).toBe(true);
        expect(result.stats.pathLength).toBe(result.path!.length - 1);
        expect(result.stats.expanded).toBeGreaterThan(0);
        expect(result.stats.discovered).toBeGreaterThanOrEqual(1);
        expect(result.stats.frontierPeak).toBeGreaterThanOrEqual(1);
        expect(steps.at(-1)?.t).toBe('done');
        expect(steps.filter((s) => s.t === 'path')).toHaveLength(1);
        expect(result.stats.steps).toBe(steps.length);
      }),
      { numRuns: 100 },
    );
  });

  it('fails gracefully when the goal is unreachable', () => {
    const { steps, result } = collect(solver.run(twoByTwoClosed()));
    expect(result.path).toBeNull();
    expect(result.stats.pathLength).toBeNull();
    expect(steps.some((s) => s.t === 'fail')).toBe(true);
    expect(steps.at(-1)?.t).toBe('done');
  });

  it('solves the 3x3 fixture along its only corridor', () => {
    const { result } = collect(solver.run(threeByThree()));
    expect(result.path).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
  });
});

describe('bfs optimality', () => {
  it('property: BFS path length equals the BFS distance map (shortest path)', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
        const maze = randomMaze(width, height, seed);
        const { result } = collect(bfs.run(maze));
        const dist = distances(maze, maze.start);
        expect(result.stats.pathLength).toBe(dist[maze.goal]);
        expect(result.stats.optimal).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('BFS expands in non-decreasing distance order', () => {
    const maze = randomMaze(9, 7, 'order');
    const { steps } = collect(bfs.run(maze));
    let last = -1;
    for (const s of steps) {
      if (s.t === 'expand') {
        expect(s.g).toBeGreaterThanOrEqual(last);
        last = s.g ?? last;
      }
    }
  });
});

describe('dfs', () => {
  it('emits deadend steps and never a worse-than-necessary path on a perfect maze', () => {
    // In a perfect maze there is exactly one simple path, so DFS's path equals BFS's.
    const maze = randomMaze(8, 8, 'dfs');
    const a = collect(dfs.run(maze)).result;
    const b = collect(bfs.run(maze)).result;
    expect(a.path).toEqual(b.path);
    const { steps } = collect(dfs.run(randomMaze(6, 6, 'dead')));
    expect(steps.some((s) => s.t === 'deadend')).toBe(true);
  });
});
