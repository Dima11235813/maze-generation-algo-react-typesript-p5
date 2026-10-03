import fc from 'fast-check';
import {
  GenerationTracker,
  NO_CELL,
  braid,
  cellCount,
  childrenOf,
  collect,
  createGrid,
  createRng,
  deadEnds,
  diameter,
  dirBetween,
  generators,
  hasWall,
  layout3d,
  openDirs,
  passageCount,
  radialLayout,
  runToEnd,
  solutionLength,
  tidyLayout,
  treeMetrics,
  treeify,
  type CellId,
  type MazeState,
  type MazeTree,
  type TreeLayout,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

const gridArb = fc.record({
  width: fc.integer({ min: 1, max: 14 }),
  height: fc.integer({ min: 1, max: 14 }),
});
const genArb = fc.constantFrom(...generators.ids);

function maze(id: string, width: number, height: number, seed: string): MazeState {
  return runToEnd(generators.require(id).run(createGrid(width, height), createRng(seed), {}));
}

function isTreeEdge(state: MazeState, a: CellId, b: CellId): boolean {
  const d = dirBetween(state.grid, a, b);
  return d !== undefined && !hasWall(state.walls, a, d);
}

/** Every included cell sits at a distinct position (a drawn node never hides another). */
function distinctPositions(tree: MazeTree, layout: TreeLayout): boolean {
  const seen = new Set<string>();
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const key = `${(layout.x[c] as number).toFixed(6)},${(layout.y[c] as number).toFixed(6)},${(layout.z[c] as number).toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

describe('treeify on perfect mazes', () => {
  it('is a spanning tree rooted at the start with the solution as its trunk', () => {
    fc.assert(
      fc.property(gridArb, genArb, fc.string(), ({ width, height }, gen, seed) => {
        const state = maze(gen, width, height, seed);
        const n = cellCount(state.grid);
        const tree = treeify(state, { root: state.start, target: state.goal });
        expect(tree.count).toBe(n);
        expect(tree.roots).toEqual([state.start]);
        // n - 1 tree edges, no loops.
        expect(tree.children.length).toBe(n - 1);
        expect(tree.loopEdges.length).toBe(0);
        // Every tree edge is an open passage and depth grows by one along it.
        for (let c = 0; c < n; c++) {
          const p = tree.parent[c] as number;
          if (c === state.start) {
            expect(p).toBe(-1);
            continue;
          }
          expect(isTreeEdge(state, p, c)).toBe(true);
          expect(tree.depth[c]).toBe((tree.depth[p] as number) + 1);
        }
        // Trunk = solution path; goal depth = solution length.
        expect(tree.trunk[0]).toBe(state.start);
        expect(tree.trunk[tree.trunk.length - 1]).toBe(state.goal);
        expect(tree.depth[state.goal]).toBe(solutionLength(state));
        expect(tree.trunk.length - 1).toBe(solutionLength(state));
        // Leaves are the dead ends, except the root when the start is one.
        const rootIsDeadEnd = openDirs(state, state.start).length === 1 ? 1 : 0;
        if (n > 1) expect(tree.leaves).toBe(deadEnds(state) - rootIsDeadEnd);
        // Subtree bookkeeping.
        expect(tree.subtreeSize[state.start]).toBe(n);
        expect(tree.subtreeLeaves[state.start]).toBe(Math.max(1, tree.leaves));
      }),
      { numRuns: 60 },
    );
  });

  it('rooted at one end of the diameter, the height is the diameter', () => {
    fc.assert(
      fc.property(gridArb, genArb, fc.string(), ({ width, height }, gen, seed) => {
        const state = maze(gen, width, height, seed);
        const d = diameter(state);
        expect(treeify(state, { root: d.from }).height).toBe(d.length);
      }),
      { numRuns: 40 },
    );
  });

  it('children are listed in breadth-first order and each child once', () => {
    const state = threeByThree();
    const tree = treeify(state, { root: 0, target: 8 });
    expect(Array.from(tree.order)).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(childrenOf(tree, 0)).toEqual([1]);
    expect(tree.trunk).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(tree.height).toBe(8);
    expect(tree.leaves).toBe(1);
  });
});

describe('treeify with loops and partial mazes', () => {
  it('a braided maze keeps a shortest-path tree and reports the extra passages as loops', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const perfect = maze('recursive-backtracker', 10, 8, seed);
        const braided = runToEnd(braid.run(perfect, createRng(`${seed}-braid`), { percent: 100 }));
        const tree = treeify(braided, { root: braided.start, target: braided.goal });
        const n = cellCount(braided.grid);
        expect(tree.count).toBe(n);
        expect(tree.loopEdges.length / 2).toBe(passageCount(braided) - (n - 1));
        // Breadth first from the start: depth = shortest distance, so the trunk is a shortest path.
        expect(tree.trunk.length - 1).toBe(solutionLength(braided));
        for (let i = 0; i < tree.loopEdges.length; i += 2) {
          expect(
            isTreeEdge(braided, tree.loopEdges[i] as number, tree.loopEdges[i + 1] as number),
          ).toBe(true);
        }
      }),
      { numRuns: 25 },
    );
  });

  it('a closed grid is a forest of single cells ordered by rank', () => {
    const state = twoByTwoClosed();
    const tree = treeify(state, { rank: (c) => 3 - c });
    expect(tree.roots).toEqual([3, 2, 1, 0]);
    expect(tree.leaves).toBe(0);
    expect(tree.trunk).toEqual([3]);
  });

  it('a maze mid-generation is a forest rooted at the oldest cell of each piece', () => {
    const grid = createGrid(12, 9);
    const tracker = new GenerationTracker(grid);
    const { steps, result } = collect(
      generators.require('kruskals').run(grid, createRng('forest'), {}),
    );
    // Replay half the steps onto live walls.
    const live = { ...result, walls: new Uint8Array(result.walls.length).fill(0b1111) };
    for (const step of steps.slice(0, Math.floor(steps.length / 2))) {
      tracker.apply(step);
      if (step.t === 'carve') {
        const d = dirBetween(grid, step.from, step.to);
        const back = dirBetween(grid, step.to, step.from);
        if (d !== undefined && back !== undefined) {
          live.walls[step.from] = (live.walls[step.from] as number) & ~(1 << d);
          live.walls[step.to] = (live.walls[step.to] as number) & ~(1 << back);
        }
      }
    }
    const tree = treeify(live, {
      include: (c) => tracker.isSeen(c),
      rank: (c) => tracker.seenOrder[c] as number,
    });
    expect(tree.roots.length).toBeGreaterThan(1);
    for (const r of tree.roots) {
      // No cell in a piece was seen before its root.
      for (let c = 0; c < cellCount(grid); c++) {
        if (tree.component[c] === tree.component[r] && c !== r) {
          expect(tracker.seenOrder[c] as number).toBeGreaterThan(tracker.seenOrder[r] as number);
        }
      }
    }
    expect(tree.loopEdges.length).toBe(0);
    expect(tree.included[NO_CELL + 1]).toBeDefined();
  });
});

describe('tree layouts', () => {
  it('tidy: root at the bottom, trunk straight, parents one row below children, no shared spots', () => {
    fc.assert(
      fc.property(gridArb, genArb, fc.string(), ({ width, height }, gen, seed) => {
        const state = maze(gen, width, height, seed);
        const tree = treeify(state, { root: state.start, target: state.goal });
        const layout = tidyLayout(tree);
        expect(layout.y[state.start]).toBe(0);
        for (const t of tree.trunk) expect(layout.x[t]).toBe(layout.x[state.start]);
        for (let c = 0; c < cellCount(state.grid); c++) {
          const p = tree.parent[c] as number;
          if (p >= 0) expect(layout.y[c]).toBe((layout.y[p] as number) + 1);
        }
        expect(distinctPositions(tree, layout)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('radial and 3D layouts are deterministic and keep nodes apart', () => {
    fc.assert(
      fc.property(gridArb, genArb, fc.string(), ({ width, height }, gen, seed) => {
        const state = maze(gen, width, height, seed);
        const tree = treeify(state, { root: state.start, target: state.goal });
        for (const fn of [radialLayout, layout3d]) {
          const a = fn(tree);
          const b = fn(treeify(state, { root: state.start, target: state.goal }));
          expect(Array.from(a.x)).toEqual(Array.from(b.x));
          expect(Array.from(a.y)).toEqual(Array.from(b.y));
          expect(Array.from(a.z)).toEqual(Array.from(b.z));
          expect(distinctPositions(tree, a)).toBe(true);
        }
        // 3D: depth is height and the trunk stands on one vertical line.
        const l3 = layout3d(tree);
        for (const t of tree.trunk) {
          expect(l3.x[t]).toBe(l3.x[state.start]);
          expect(l3.z[t]).toBe(l3.z[state.start]);
        }
      }),
      { numRuns: 40 },
    );
  });
});

describe('treeMetrics', () => {
  it('describes the shape of a perfect maze', () => {
    fc.assert(
      fc.property(gridArb, genArb, fc.string(), ({ width, height }, gen, seed) => {
        const state = maze(gen, width, height, seed);
        const m = treeMetrics(state);
        expect(m.loopEdges).toBe(0);
        expect(m.trunkLength - 1).toBe(solutionLength(state));
        expect(m.largestBranch).toBeLessThanOrEqual(cellCount(state.grid) - m.trunkLength);
        expect(m.leafShare).toBeGreaterThanOrEqual(0);
        expect(m.leafShare).toBeLessThanOrEqual(1);
        if (m.forks === 0) expect(m.trunkBranches).toBeLessThanOrEqual(2);
      }),
      { numRuns: 40 },
    );
  });
});
