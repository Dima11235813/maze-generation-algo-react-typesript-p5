import fc from 'fast-check';
import {
  cellCount,
  collect,
  createGrid,
  createRng,
  generators,
  isPerfectMaze,
  passageCount,
  recursiveBacktracker,
  replayGenSteps,
  runToEnd,
  type GenStep,
  type MazeState,
} from '../src';

const gridArb = fc.record({
  width: fc.integer({ min: 1, max: 12 }),
  height: fc.integer({ min: 1, max: 12 }),
});
/** Blank seeds normalise to a random seed by design, so determinism tests exclude them. */
const seedArb = fc.string().filter((s) => s.trim().length > 0);

describe.each(generators.all.map((g) => [g.meta.id, g] as const))('generator %s', (_id, gen) => {
  it('has consistent metadata', () => {
    expect(gen.meta.family).toBe('generator');
    expect(gen.meta.id).toMatch(/^[a-z0-9-]+$/);
    expect(gen.meta.since).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('property: always produces a perfect maze (spanning tree) with start/goal in range', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
        const grid = createGrid(width, height);
        const state = runToEnd(gen.run(grid, createRng(seed)));
        expect(isPerfectMaze(state)).toBe(true);
        expect(passageCount(state)).toBe(cellCount(grid) - 1);
        expect(state.start).toBe(0);
        expect(state.goal).toBe(cellCount(grid) - 1);
        expect(Object.isFrozen(state)).toBe(true);
      }),
      { numRuns: 150 },
    );
  });

  it('property: deterministic - same (grid, seed) gives byte-identical walls', () => {
    fc.assert(
      fc.property(gridArb, seedArb, ({ width, height }, seed) => {
        const grid = createGrid(width, height);
        const a = runToEnd(gen.run(grid, createRng(seed)));
        const b = runToEnd(gen.run(grid, createRng(seed)));
        expect(Array.from(a.walls)).toEqual(Array.from(b.walls));
      }),
      { numRuns: 60 },
    );
  });

  it('property: the step stream mirrors the final walls (replaying carve/seal rebuilds the maze)', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
        const grid = createGrid(width, height);
        const { steps, result } = collect(gen.run(grid, createRng(seed)));
        const rebuilt = replayGenSteps(grid, steps);
        expect(Array.from(rebuilt)).toEqual(Array.from(result.walls));
        expect(steps.at(-1)?.t).toBe('done');
        expect(steps.filter((s) => s.t === 'done')).toHaveLength(1);
      }),
      { numRuns: 60 },
    );
  });

  it('different seeds usually give different mazes', () => {
    const grid = createGrid(8, 8);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(Array.from(runToEnd(gen.run(grid, createRng(`s${i}`))).walls).join(','));
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('recursive backtracker specifics (legacy characterisation)', () => {
  function steps(width: number, height: number, seed: string): GenStep[] {
    return collect(recursiveBacktracker.run(createGrid(width, height), createRng(seed))).steps;
  }

  it('emits a visit before every carve/backtrack decision, like one legacy frame', () => {
    const s = steps(5, 5, 'legacy');
    for (let i = 0; i < s.length - 1; i++) {
      const cur = s[i]!;
      const next = s[i + 1]!;
      if (cur.t === 'carve' || cur.t === 'backtrack') {
        expect(next.t === 'visit' || next.t === 'done').toBe(true);
      }
      if (cur.t === 'visit') {
        expect(['carve', 'backtrack', 'done']).toContain(next.t);
      }
    }
    expect(s[0]).toEqual({ t: 'visit', cell: 0 });
  });

  it('carves exactly cells-1 times and backtracks exactly cells-1 times', () => {
    const s = steps(6, 4, 'count');
    expect(s.filter((x) => x.t === 'carve')).toHaveLength(23);
    expect(s.filter((x) => x.t === 'backtrack')).toHaveLength(23);
  });

  it('every carve goes to a not-yet-visited orthogonal neighbour', () => {
    const grid = createGrid(7, 5);
    const { steps: s } = collect(recursiveBacktracker.run(grid, createRng('nb')));
    const visited = new Set<number>([0]);
    for (const step of s) {
      if (step.t === 'carve') {
        expect(visited.has(step.to)).toBe(false);
        visited.add(step.to);
      }
    }
    expect(visited.size).toBe(35);
  });

  it('honours the start parameter', () => {
    const grid = createGrid(4, 4);
    const state: MazeState = runToEnd(recursiveBacktracker.run(grid, createRng('p'), { start: 5 }));
    expect(state.start).toBe(5);
    const { steps: s } = collect(recursiveBacktracker.run(grid, createRng('p'), { start: 5 }));
    expect(s[0]).toEqual({ t: 'visit', cell: 5 });
    // out-of-range start falls back to 0
    expect(runToEnd(recursiveBacktracker.run(grid, createRng('p'), { start: 99 })).start).toBe(0);
  });

  it('handles degenerate 1x1 and 1xN grids', () => {
    const one = runToEnd(recursiveBacktracker.run(createGrid(1, 1), createRng('1')));
    expect(passageCount(one)).toBe(0);
    const line = runToEnd(recursiveBacktracker.run(createGrid(1, 6), createRng('line')));
    expect(isPerfectMaze(line)).toBe(true);
  });

  it('registry exposes it', () => {
    expect(generators.has('recursive-backtracker')).toBe(true);
    expect(generators.require('recursive-backtracker')).toBe(recursiveBacktracker);
    expect(() => generators.require('nope')).toThrow(/Unknown algorithm/);
    expect(generators.get('nope')).toBeUndefined();
  });
});
