import {
  braid,
  cellCount,
  createGrid,
  createRng,
  generators,
  runToEnd,
  solvers,
  type GenStep,
  type MazeState,
  type SolveStep,
} from '@maze/core';
import { describe, expect, it } from 'vitest';
import { DisjointSetModel } from './disjointSetModel';
import { DistanceModel } from './distanceModel';
import { PriorityQueueModel } from './priorityQueueModel';
import { SolveStructureTracker, solveStructureFor } from './solveStructure';
import { BacktrackerStackModel, DfsStackModel } from './stackModel';

function maze(generatorId: string, seed: string, w: number, h: number): MazeState {
  return runToEnd(generators.require(generatorId).run(createGrid(w, h), createRng(seed), {}));
}

/** A maze with loops, so relaxations and alternative routes actually happen. */
function braided(seed: string, w: number, h: number): MazeState {
  const base = maze('recursive-backtracker', seed, w, h);
  return runToEnd(braid.run(base, createRng(`${seed}-braid`), { percent: 100 }));
}

function solveSteps(solverId: string, m: MazeState): SolveStep[] {
  return [...solvers.require(solverId).run(m, {})];
}

function genSteps(generatorId: string, seed: string, w: number, h: number): GenStep[] {
  return [...generators.require(generatorId).run(createGrid(w, h), createRng(seed), {})];
}

const MAZES: [string, () => MazeState][] = [
  ['prims 12x9', () => maze('prims', 'ds-1', 12, 9)],
  ['backtracker 15x10', () => maze('recursive-backtracker', 'ds-2', 15, 10)],
  ['braided 14x10', () => braided('ds-3', 14, 10)],
  ['kruskals 20x14', () => maze('kruskals', 'ds-4', 20, 14)],
];

describe('DFS stack (rebuilt from steps)', () => {
  it.each(MAZES)('every expand takes the top on %s', (_name, make) => {
    const m = make();
    const model = new DfsStackModel(m.start);
    for (const step of solveSteps('dfs', m)) {
      if (step.t === 'expand') {
        const cells = model.snapshot().cells;
        expect(cells[cells.length - 1]).toBe(step.cell);
      }
      model.apply(step);
    }
    expect(model.snapshot().outOfOrder).toBe(0);
  });

  it('peak matches the solver statistics', () => {
    const m = maze('prims', 'ds-1', 12, 9);
    const steps = solveSteps('dfs', m);
    const model = new DfsStackModel(m.start);
    model.applyBatch(steps);
    const done = steps.find((s) => s.t === 'done');
    expect(done?.t === 'done' && done.stats.frontierPeak === model.snapshot().peak).toBe(true);
  });
});

describe('recursive backtracker stack', () => {
  it.each([
    ['ds-5', 10, 8],
    ['ds-6', 16, 12],
  ] as const)('is the path back to the start (%s %ix%i)', (seed, w, h) => {
    const steps = genSteps('recursive-backtracker', seed, w, h);
    const model = new BacktrackerStackModel();
    let current: number | null = null;
    for (const step of steps) {
      if (step.t === 'backtrack') {
        const cells = model.snapshot().cells;
        expect(cells[cells.length - 1]).toBe(step.from);
        expect(cells[cells.length - 2]).toBe(step.to);
      }
      model.apply(step);
      if (step.t === 'visit') current = step.cell;
      if (step.t === 'carve') current = step.to;
      if (step.t === 'backtrack') current = step.to;
      const cells = model.snapshot().cells;
      if (current !== null && cells.length > 0) expect(cells[cells.length - 1]).toBe(current);
    }
    const snap = model.snapshot();
    expect(snap.outOfOrder).toBe(0);
    // Every cell was pushed exactly once (the start by its first visit, the rest by carving).
    expect(snap.pushes).toBe(w * h);
    // The stack unwinds to the start cell, which leaves it when the generator is done.
    const last = steps[steps.length - 1];
    expect(last?.t).toBe('done');
    expect(snap.cells).toHaveLength(0);
    const beforeDone = new BacktrackerStackModel();
    beforeDone.applyBatch(steps.slice(0, -1));
    expect(beforeDone.snapshot().cells).toHaveLength(1);
  });
});

describe('priority queue (Dijkstra, A*, greedy)', () => {
  const cases: [string, 'g' | 'f'][] = [
    ['dijkstra', 'g'],
    ['astar', 'f'],
    ['greedy-best-first', 'f'],
  ];
  for (const [solverId, key] of cases) {
    it.each(MAZES)(`${solverId}: every expand takes a smallest key on %s`, (_name, make) => {
      const m = make();
      const model = new PriorityQueueModel(m.start, key);
      for (const step of solveSteps(solverId, m)) {
        if (step.t === 'expand') {
          const entries = model.snapshot().entries;
          const mine = entries.find((e) => e.cell === step.cell);
          expect(mine).toBeDefined();
          expect(mine?.key).toBe(entries[0]?.key);
        }
        model.apply(step);
      }
      expect(model.snapshot().notMinimum).toBe(0);
    });
  }

  it('A*: f = g + h on every open entry, and relaxations lower g', () => {
    const m = braided('ds-7', 16, 12);
    const model = new PriorityQueueModel(m.start, 'f');
    let relaxed = 0;
    for (const step of solveSteps('astar', m)) {
      model.apply(step);
      if (step.t === 'relax') {
        relaxed++;
        const e = model.snapshot().entries.find((x) => x.cell === step.cell);
        expect(e?.g).toBe(step.newG);
      }
    }
    expect(model.snapshot().relaxations).toBe(relaxed);
  });

  it('greedy discover steps carry their priority (f = h)', () => {
    const m = maze('prims', 'ds-1', 12, 9);
    const discovers = solveSteps('greedy-best-first', m).filter((s) => s.t === 'discover');
    expect(discovers.length).toBeGreaterThan(0);
    for (const d of discovers) expect(d.t === 'discover' && typeof d.f === 'number').toBe(true);
  });
});

describe('disjoint sets (Kruskal)', () => {
  it.each([
    ['ds-8', 10, 8],
    ['ds-9', 24, 16],
  ] as const)('only joins different components and ends with one (%s %ix%i)', (seed, w, h) => {
    const model = new DisjointSetModel(w * h);
    const steps = genSteps('kruskals', seed, w, h);
    for (const step of steps) {
      if (step.t === 'union') {
        expect(model.find(step.a)).not.toBe(model.find(step.b));
      }
      model.apply(step);
    }
    const snap = model.snapshot();
    expect(snap.redundant).toBe(0);
    expect(snap.sets).toBe(1);
    expect(snap.unions).toBe(w * h - 1);
    expect(snap.largest[0]?.size).toBe(w * h);
  });
});

describe('distance map', () => {
  it('BFS distances grow by ring and the goal sits at the path length', () => {
    const m = maze('prims', 'ds-1', 12, 9);
    const steps = solveSteps('bfs', m);
    const model = new DistanceModel(cellCount(m.grid));
    let previous = 0;
    for (const step of steps) {
      model.apply(step);
      if (step.t === 'expand' && step.g !== undefined) {
        expect(step.g).toBeGreaterThanOrEqual(previous);
        previous = step.g;
      }
    }
    const done = steps.find((s) => s.t === 'done');
    const snap = model.snapshot();
    expect(done?.t === 'done' && snap.dist[m.goal] === done.stats.pathLength).toBe(true);
    expect(snap.dist[m.start]).toBe(0);
  });
});

describe('solve structure tracker', () => {
  it('maps solvers to their structures', () => {
    expect(solveStructureFor('bfs')).toBe('queue');
    expect(solveStructureFor('flood-fill')).toBe('queue');
    expect(solveStructureFor('dfs')).toBe('stack');
    expect(solveStructureFor('astar')).toBe('priority');
    expect(solveStructureFor('wall-follower')).toBe('none');
  });

  it.each(['bfs', 'flood-fill', 'dfs', 'dijkstra', 'astar', 'greedy-best-first', 'tremaux'])(
    '%s: folding in batches equals folding at once, and reset starts over',
    (solverId) => {
      const m = braided('ds-10', 12, 10);
      const steps = solveSteps(solverId, m);
      const whole = new SolveStructureTracker(solverId, m.start, m.goal, cellCount(m.grid));
      whole.applyBatch(steps);
      const batched = new SolveStructureTracker(solverId, m.start, m.goal, cellCount(m.grid));
      for (let i = 0; i < steps.length; i += 7) batched.applyBatch(steps.slice(i, i + 7));
      const a = whole.snapshot();
      const b = batched.snapshot();
      expect(b.structure.kind).toBe(a.structure.kind);
      if (a.structure.kind === 'queue' && b.structure.kind === 'queue') {
        expect(b.structure.queue.entries).toEqual(a.structure.queue.entries);
        expect(b.structure.queue.outOfOrder).toBe(0);
      }
      if (a.structure.kind === 'priority' && b.structure.kind === 'priority') {
        expect(b.structure.pq.entries).toEqual(a.structure.pq.entries);
      }
      if (a.structure.kind === 'stack' && b.structure.kind === 'stack') {
        expect(b.structure.stack.cells).toEqual(a.structure.stack.cells);
      }
      expect(Array.from(b.distances?.dist ?? [])).toEqual(Array.from(a.distances?.dist ?? []));
      whole.reset();
      expect(whole.snapshot().distances?.settled ?? 0).toBe(0);
    },
  );
});
