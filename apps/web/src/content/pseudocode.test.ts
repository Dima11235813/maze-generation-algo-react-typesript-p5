import { createGrid, createRng, generators, runToEnd, solvers, type SolveStep } from '@maze/core';
import { describe, expect, it } from 'vitest';
import { GENERIC_PSEUDOCODE, PSEUDOCODE, pseudocodeFor } from './pseudocode';

/** One instance of every `SolveStep` variant (exhaustive via the `satisfies` check). */
const EVERY_STEP = [
  { t: 'expand', cell: 1, g: 1 },
  { t: 'discover', cell: 2, from: 1, g: 2 },
  { t: 'relax', cell: 2, from: 1, oldG: 5, newG: 2 },
  { t: 'deadend', cell: 3 },
  { t: 'mark', cell: 3, dir: 0, count: 1 },
  { t: 'move', from: 3, to: 4 },
  { t: 'path', cells: [0, 1, 2] },
  { t: 'fail' },
  {
    t: 'done',
    stats: { expanded: 1, discovered: 1, frontierPeak: 1, pathLength: 1, optimal: true, steps: 1 },
  },
] as const satisfies readonly SolveStep[];

type Variant = SolveStep['t'];
const VARIANTS: readonly Variant[] = [
  'expand',
  'discover',
  'relax',
  'deadend',
  'mark',
  'move',
  'path',
  'fail',
  'done',
];

describe('pseudocode listings', () => {
  it('covers every SolveStep variant in the fixture', () => {
    expect(EVERY_STEP.map((s) => s.t).sort()).toEqual([...VARIANTS].sort());
  });

  it.each(Object.entries({ ...PSEUDOCODE, generic: GENERIC_PSEUDOCODE }))(
    '%s maps every step to a valid line (or null only for done)',
    (_id, listing) => {
      for (const step of EVERY_STEP) {
        const line = listing.stepToLine(step);
        if (step.t === 'done') {
          expect(line).toBeNull();
        } else {
          expect(line).not.toBeNull();
          expect(line).toBeGreaterThanOrEqual(0);
          expect(line).toBeLessThan(listing.lines.length);
        }
      }
    },
  );

  it('has a dedicated listing for every solver in the registry', () => {
    const missing = solvers.ids.filter((id) => !(id in PSEUDOCODE));
    expect(missing).toEqual([]);
    for (const s of solvers.all) {
      const listing = pseudocodeFor(s.meta.id);
      expect(listing).not.toBe(GENERIC_PSEUDOCODE);
      expect(listing.lines.length).toBeGreaterThan(3);
    }
    expect(pseudocodeFor('does-not-exist')).toBe(GENERIC_PSEUDOCODE);
    expect(pseudocodeFor(null)).toBe(GENERIC_PSEUDOCODE);
    expect(pseudocodeFor('bfs').title).toMatch(/breadth/i);
    expect(pseudocodeFor('dfs').title).toMatch(/depth/i);
  });

  it.each(solvers.ids)('%s: every step of a real solve lands on a line', (id) => {
    const grid = createGrid(9, 7);
    const maze = runToEnd(generators.require('recursive-backtracker').run(grid, createRng(7)));
    const listing = pseudocodeFor(id);
    const seen = new Set<number>();
    for (const step of solvers.require(id).run(maze, {}, createRng(3))) {
      const line = listing.stepToLine(step);
      if (step.t === 'done') continue;
      expect(line).not.toBeNull();
      seen.add(line as number);
    }
    // A real solve highlights more than one line, so the panel visibly follows the algorithm.
    expect(seen.size).toBeGreaterThan(1);
  });
});
