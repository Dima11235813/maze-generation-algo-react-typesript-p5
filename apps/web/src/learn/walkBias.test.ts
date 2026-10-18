import { collect, createGrid, createRng, generators } from '@maze/core';
import { describe, expect, it } from 'vitest';
import { deadEndSamples, histogram } from './bias';
import { WalkModel } from './walkModel';

function steps(generatorId: string, seed: string, w: number, h: number) {
  return collect(generators.require(generatorId).run(createGrid(w, h), createRng(seed), {})).steps;
}

describe('random walk model', () => {
  it.each(['aldous-broder', 'wilsons'])(
    '%s: the tree grows by one cell per carve and ends holding every cell',
    (generatorId) => {
      const all = steps(generatorId, 'walk-1', 9, 7);
      const model = new WalkModel(63);
      let carves = 0;
      let walks = 0;
      let waited = 0;
      let longest = 0;
      for (const s of all) {
        model.apply(s);
        if (s.t === 'carve') {
          carves++;
          waited = 0;
        }
        if (s.t === 'walk') {
          walks++;
          waited++;
          longest = Math.max(longest, waited);
        }
        expect(model.snapshot().inTree).toBe(1 + carves);
        expect(model.remaining).toBe(63 - 1 - carves);
      }
      const snap = model.snapshot();
      expect(snap).toMatchObject({ inTree: 63, walkSteps: walks, longestWait: longest });
      const erased = all.flatMap((s) => (s.t === 'walk' ? (s.erased ?? []) : []));
      expect(snap.erasedCells).toBe(erased.length);
      // Aldous-Broder never erases; Wilson's does, often.
      expect(snap.erasures > 0).toBe(generatorId === 'wilsons');
      model.reset();
      expect(model.snapshot()).toMatchObject({ inTree: 0, walkSteps: 0, erasures: 0 });
    },
  );
});

describe('dead-end bias over seeds', () => {
  it('is the same every time, and shows the lesson: uniform generators agree, others do not', () => {
    const ids = ['recursive-backtracker', 'aldous-broder', 'wilsons', 'prims'];
    const samples = deadEndSamples(ids, 50);
    expect(deadEndSamples(ids, 50)).toEqual(samples);
    const mean = (id: string) => samples.find((s) => s.generatorId === id)?.mean ?? NaN;
    for (const s of samples) {
      expect(s.ratios).toHaveLength(50);
      expect(s.min).toBeLessThanOrEqual(s.mean);
      expect(s.mean).toBeLessThanOrEqual(s.max);
      expect(histogram(s.ratios, 0.025, 0.45).reduce((a, b) => a + b, 0)).toBe(50);
    }
    expect(Math.abs(mean('aldous-broder') - mean('wilsons'))).toBeLessThan(0.03);
    expect(mean('recursive-backtracker')).toBeLessThan(0.2);
    expect(mean('prims')).toBeGreaterThan(mean('wilsons'));
  });

  it('bins values, clamping the ends', () => {
    expect(histogram([0, 0.01, 0.026, 0.9, -1], 0.025, 0.1)).toEqual([3, 1, 0, 1]);
  });
});
