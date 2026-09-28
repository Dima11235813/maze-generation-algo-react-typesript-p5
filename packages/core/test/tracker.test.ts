import {
  CellMark,
  GenerationTracker,
  NO_CELL,
  SolveTracker,
  bfs,
  cellCount,
  collect,
  createGrid,
  createRng,
  recursiveBacktracker,
} from '../src';
import { threeByThree } from './fixtures';

describe('GenerationTracker', () => {
  it('reproduces legacy visit counts and depth bookkeeping from steps', () => {
    const grid = createGrid(6, 5);
    const { steps } = collect(recursiveBacktracker.run(grid, createRng('track')));
    const t = new GenerationTracker(grid);
    expect(t.current).toBe(NO_CELL);
    expect(t.isSeen(0)).toBe(false);

    t.applyAll(steps);

    expect(t.done).toBe(true);
    expect(t.seenCount).toBe(cellCount(grid));
    expect(t.carves).toBe(cellCount(grid) - 1);
    expect(t.backtracks).toBe(cellCount(grid) - 1);
    expect(t.depth).toBe(0); // back at the root
    expect(t.maxDepth).toBeGreaterThan(0);
    expect(t.steps).toBe(steps.length);
    // every cell was current at least once; the root's visit count is >= 2 (start + final return)
    for (let c = 0; c < cellCount(grid); c++) expect(t.visitCount[c]).toBeGreaterThan(0);
    expect(t.visitCount[0]).toBeGreaterThanOrEqual(2);
    expect(t.depthAtVisit[0]).toBe(0);
    expect(t.visits).toBe(steps.filter((s) => s.t === 'visit').length);
  });

  it('projectionHeight is |current depth - depth at first visit| and 0 for unseen cells', () => {
    const grid = createGrid(1, 4); // a single column: depths are 0,1,2,3
    const { steps } = collect(recursiveBacktracker.run(grid, createRng('line')));
    const t = new GenerationTracker(grid);
    // Apply until the deepest cell is visited (depth 3).
    for (const s of steps) {
      t.apply(s);
      if (s.t === 'visit' && s.cell === 3) break;
    }
    expect(t.depth).toBe(3);
    expect(t.projectionHeight(0)).toBe(3);
    expect(t.projectionHeight(1)).toBe(2);
    expect(t.projectionHeight(3)).toBe(0);
    // Now finish: everything backtracks to depth 0 and the far cell rises to 3.
    t.reset();
    t.applyAll(steps);
    expect(t.depth).toBe(0);
    expect(t.projectionHeight(3)).toBe(3);
    expect(t.projectionHeight(0)).toBe(0);
    const fresh = new GenerationTracker(grid);
    expect(fresh.projectionHeight(2)).toBe(0);
  });

  it('marks cells touched by other generator verbs as seen', () => {
    const grid = createGrid(3, 3);
    const t = new GenerationTracker(grid);
    t.apply({ t: 'frontier', add: [4, 5] });
    t.apply({ t: 'union', a: 0, b: 1 });
    t.apply({ t: 'walk', cell: 8 });
    t.apply({ t: 'divide', cells: [2], wallDir: 1, gap: 2 });
    t.apply({ t: 'rotate', oldRoot: 6, newRoot: 7 });
    t.apply({ t: 'frontier', remove: [4] });
    for (const c of [0, 1, 2, 4, 5, 6, 7, 8]) expect(t.isSeen(c)).toBe(true);
    expect(t.isSeen(3)).toBe(false);
    expect(t.visitCount[4]).toBe(1);
  });

  it('reset clears everything', () => {
    const grid = createGrid(2, 2);
    const t = new GenerationTracker(grid);
    t.applyAll(collect(recursiveBacktracker.run(grid, createRng('r'))).steps);
    t.reset();
    expect(t.done).toBe(false);
    expect(t.seenCount).toBe(0);
    expect(t.current).toBe(NO_CELL);
    expect(Array.from(t.visitCount)).toEqual([0, 0, 0, 0]);
    expect(Array.from(t.depthAtVisit)).toEqual([-1, -1, -1, -1]);
  });
});

describe('SolveTracker', () => {
  it('folds BFS steps into marks, costs, path and stats', () => {
    const maze = threeByThree();
    const { steps } = collect(bfs.run(maze));
    const t = new SolveTracker(maze.grid);
    t.applyAll(steps);
    expect(t.done).toBe(true);
    expect(t.failed).toBe(false);
    expect(t.path).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(t.marks[8]).toBe(CellMark.Expanded);
    expect(t.cost[8]).toBe(8);
    expect(t.cost[0]).toBe(0);
    expect(t.expanded).toBe(9);
    expect(t.stats?.pathLength).toBe(8);
    t.apply({ t: 'deadend', cell: 4 });
    expect(t.marks[4]).toBe(CellMark.DeadEnd);
    t.apply({ t: 'relax', cell: 4, from: 3, oldG: 5, newG: 2 });
    expect(t.cost[4]).toBe(2);
    t.apply({ t: 'move', from: 4, to: 5 });
    expect(t.current).toBe(5);
    t.apply({ t: 'mark', cell: 5, dir: 0, count: 1 });
    t.apply({ t: 'fail' });
    expect(t.failed).toBe(true);
    t.reset();
    expect(t.path).toBeNull();
    expect(t.stats).toBeNull();
    expect(t.current).toBe(NO_CELL);
  });
});
