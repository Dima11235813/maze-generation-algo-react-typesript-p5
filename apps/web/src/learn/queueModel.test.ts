import {
  createGrid,
  createRng,
  generators,
  runToEnd,
  solvers,
  type MazeState,
  type SolveStep,
} from '@maze/core';
import { describe, expect, it } from 'vitest';
import { QueueModel } from './queueModel';

function maze(generatorId: string, seed: string, w: number, h: number): MazeState {
  return runToEnd(generators.require(generatorId).run(createGrid(w, h), createRng(seed), {}));
}

function bfsSteps(m: MazeState): SolveStep[] {
  return [...solvers.require('bfs').run(m, {})];
}

describe('QueueModel (BFS queue rebuilt from steps)', () => {
  const cases: [string, string, number, number][] = [
    ['prims', 'frontier-ring', 12, 9],
    ['recursive-backtracker', 'q-1', 15, 10],
    ['kruskals', 'q-2', 20, 14],
    ['wilsons', 'q-3', 9, 9],
  ];

  it.each(cases)('every expand takes the front on %s %s %ix%i', (gen, seed, w, h) => {
    const m = maze(gen, seed, w, h);
    const model = new QueueModel(m.start);
    for (const step of bfsSteps(m)) {
      if (step.t === 'expand') {
        // Before folding: the cell BFS expands is the head of the rebuilt queue.
        expect(model.snapshot().entries[0]?.cell).toBe(step.cell);
      }
      model.apply(step);
    }
    const snap = model.snapshot();
    expect(snap.outOfOrder).toBe(0);
    expect(snap.expanded).toBeGreaterThan(0);
  });

  it('holds at most two neighbouring depths at any time (the ring)', () => {
    const m = maze('prims', 'frontier-ring', 12, 9);
    const model = new QueueModel(m.start);
    for (const step of bfsSteps(m)) {
      model.apply(step);
      const depths = new Set(model.snapshot().entries.map((e) => e.depth));
      expect(depths.size).toBeLessThanOrEqual(2);
      const [a, b] = [...depths].map(Number).sort((x, y) => x - y);
      if (a !== undefined && b !== undefined) expect(b - a).toBe(1);
    }
  });

  it('peak matches the solver statistics, and reset replays identically', () => {
    const m = maze('kruskals', 'q-2', 20, 14);
    const steps = bfsSteps(m);
    const done = steps.find((s) => s.t === 'done');
    const model = new QueueModel(m.start);
    model.applyBatch(steps);
    const first = model.snapshot();
    expect(done?.t === 'done' && first.peak === done.stats.frontierPeak).toBe(true);
    expect(done?.t === 'done' && first.expanded === done.stats.expanded).toBe(true);

    model.reset();
    expect(model.snapshot().entries.map((e) => e.cell)).toEqual([m.start]);
    model.applyBatch(steps.slice(0, 10));
    model.applyBatch(steps.slice(10));
    expect(model.snapshot().entries).toEqual(first.entries);
  });

  it('reports the cells added in the latest batch and the last expanded cell', () => {
    const m = maze('prims', 'frontier-ring', 12, 9);
    const steps = bfsSteps(m);
    const model = new QueueModel(m.start);
    model.applyBatch(steps.slice(0, 1)); // expand start
    expect(model.snapshot().lastExpanded?.cell).toBe(m.start);
    const firstDiscover = steps.slice(1).find((s) => s.t === 'discover');
    model.applyBatch(steps.slice(1, 2));
    if (firstDiscover?.t === 'discover' && steps[1]?.t === 'discover') {
      expect(model.snapshot().justAdded).toEqual([firstDiscover.cell]);
    }
  });
});
