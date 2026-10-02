import fc from 'fast-check';
import {
  braid,
  collect,
  createGrid,
  createRng,
  deadEnds,
  generators,
  isConnected,
  isPerfectMaze,
  postprocessors,
  recursiveBacktracker,
  replayGenSteps,
  runToEnd,
  wallsAreSymmetric,
} from '../src';

const perfect = (w: number, h: number, seed: string) =>
  runToEnd(recursiveBacktracker.run(createGrid(w, h), createRng(seed)));

describe('postprocessors registry', () => {
  it('exposes braid with postprocessor metadata', () => {
    expect(postprocessors.ids).toEqual(['braid']);
    expect(postprocessors.require('braid').meta.family).toBe('postprocessor');
  });
});

describe('braid', () => {
  it('property: never disconnects, keeps symmetry, never adds dead ends, and mirrors its steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 100 }),
        fc.string(),
        (w, h, percent, seed) => {
          const input = perfect(w, h, seed);
          const before = Array.from(input.walls);
          const { steps, result } = collect(braid.run(input, createRng(seed), { percent }));
          expect(Array.from(input.walls)).toEqual(before); // input untouched
          expect(isConnected(result)).toBe(true);
          expect(wallsAreSymmetric(result)).toBe(true);
          expect(deadEnds(result)).toBeLessThanOrEqual(deadEnds(input));
          expect(result.start).toBe(input.start);
          expect(result.goal).toBe(input.goal);
          // Replaying the braid steps over the input reproduces the output.
          const replayed = replayGenSteps(input.grid, steps);
          for (let c = 0; c < before.length; c++) {
            replayed[c] = (before[c] as number) & (replayed[c] as number);
          }
          expect(Array.from(replayed)).toEqual(Array.from(result.walls));
          expect(steps.at(-1)?.t).toBe('done');
        },
      ),
      { numRuns: 80 },
    );
  });

  it('percent 0 leaves the maze unchanged; percent 100 removes every dead end on a 2D grid', () => {
    const input = perfect(12, 9, 'braid');
    expect(deadEnds(input)).toBeGreaterThan(0);
    const none = runToEnd(braid.run(input, createRng('x'), { percent: 0 }));
    expect(Array.from(none.walls)).toEqual(Array.from(input.walls));
    expect(isPerfectMaze(none)).toBe(true);

    const all = runToEnd(braid.run(input, createRng('x'), { percent: 100 }));
    expect(deadEnds(all)).toBe(0);
    expect(isPerfectMaze(all)).toBe(false);
  });

  it('percent 50 removes roughly half the dead ends', () => {
    const input = perfect(20, 20, 'half');
    const start = deadEnds(input);
    const half = runToEnd(braid.run(input, createRng('h'), { percent: 50 }));
    const removed = start - deadEnds(half);
    expect(removed).toBeGreaterThanOrEqual(Math.floor(start * 0.4));
    expect(removed).toBeLessThanOrEqual(Math.ceil(start * 0.6));
  });

  it('runs on every generator output', () => {
    const grid = createGrid(7, 7);
    for (const gen of generators.all) {
      const input = runToEnd(gen.run(grid, createRng(gen.meta.id)));
      const out = runToEnd(braid.run(input, createRng('b'), { percent: 100 }));
      expect(isConnected(out)).toBe(true);
      expect(deadEnds(out)).toBe(0);
    }
  });

  it('cannot fix the two ends of a 1 x N corridor and says so by leaving them', () => {
    const input = perfect(6, 1, 'line');
    const out = runToEnd(braid.run(input, createRng('l'), { percent: 100 }));
    expect(deadEnds(out)).toBe(2);
  });
});
