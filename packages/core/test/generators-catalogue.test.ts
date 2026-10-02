import {
  BinaryHeap,
  Dir,
  DisjointSet,
  aldousBroder,
  applyGenStep,
  binaryTree,
  cellCount,
  collect,
  createGrid,
  createMazeState,
  createRng,
  ellers,
  generators,
  growingTree,
  hasWall,
  huntAndKill,
  idOf,
  isPerfectMaze,
  kruskals,
  originShift,
  prims,
  recursiveBacktracker,
  recursiveDivision,
  replayGenSteps,
  runToEnd,
  sidewinder,
  wilsons,
  type GenStep,
  type MazeState,
} from '../src';

const wallsOf = (s: MazeState): number[] => Array.from(s.walls);

describe('registry', () => {
  it('exposes the twelve catalogue generators with unique ids and learn slugs', () => {
    expect([...generators.ids].sort()).toEqual(
      [
        'aldous-broder',
        'binary-tree',
        'ellers',
        'growing-tree',
        'hunt-and-kill',
        'kruskals',
        'origin-shift',
        'prims',
        'recursive-backtracker',
        'recursive-division',
        'sidewinder',
        'wilsons',
      ].sort(),
    );
    for (const g of generators.all) {
      expect(g.meta.docsSlug).toBe(`learn/${g.meta.id}`);
      expect(g.meta.summary.length).toBeGreaterThan(40);
    }
  });
});

describe('growing tree', () => {
  it('newest selection reproduces the recursive backtracker byte for byte', () => {
    for (const [w, h, seed] of [
      [7, 5, 'alpha'],
      [12, 12, 'beta'],
      [1, 9, 'gamma'],
    ] as const) {
      const grid = createGrid(w, h);
      const a = runToEnd(recursiveBacktracker.run(grid, createRng(seed)));
      const b = runToEnd(growingTree.run(grid, createRng(seed), { selection: 'newest' }));
      expect(wallsOf(b)).toEqual(wallsOf(a));
    }
  });

  it('every selection policy yields a perfect maze and the policies differ', () => {
    const grid = createGrid(9, 9);
    const results = (['newest', 'oldest', 'random', 'mixed'] as const).map((selection) =>
      wallsOf(runToEnd(growingTree.run(grid, createRng('policy'), { selection }))),
    );
    for (const w of results) {
      expect(isPerfectMaze(createMazeState(grid, Uint8Array.from(w), 0, 80))).toBe(true);
    }
    expect(new Set(results.map((w) => w.join(','))).size).toBe(4);
  });

  it('oldest selection grows breadth-first: the first cells it visits ring the start', () => {
    const grid = createGrid(5, 5);
    const { steps } = collect(growingTree.run(grid, createRng('bfs'), { selection: 'oldest' }));
    const visits = steps.filter((s): s is Extract<GenStep, { t: 'visit' }> => s.t === 'visit');
    expect(visits[0]?.cell).toBe(0);
    // With `oldest` the start cell stays active until all its neighbours are carved.
    const firstFour = visits.slice(0, 4).map((v) => v.cell);
    expect(firstFour.every((c) => c === 0 || c === 1 || c === 5)).toBe(true);
  });
});

describe("prim's", () => {
  it('both variants are perfect and the weighted one differs from the simplified one', () => {
    const grid = createGrid(10, 8);
    const simple = runToEnd(prims.run(grid, createRng('p'), { weighted: false }));
    const weighted = runToEnd(prims.run(grid, createRng('p'), { weighted: true }));
    expect(isPerfectMaze(simple)).toBe(true);
    expect(isPerfectMaze(weighted)).toBe(true);
    expect(wallsOf(simple)).not.toEqual(wallsOf(weighted));
  });

  it('keeps the frontier bookkeeping consistent: every removed cell was added once', () => {
    const grid = createGrid(6, 6);
    const { steps } = collect(prims.run(grid, createRng('frontier')));
    const added = new Map<number, number>();
    const removed = new Map<number, number>();
    for (const s of steps) {
      if (s.t !== 'frontier') continue;
      for (const c of s.add ?? []) added.set(c, (added.get(c) ?? 0) + 1);
      for (const c of s.remove ?? []) removed.set(c, (removed.get(c) ?? 0) + 1);
    }
    expect(added.size).toBe(cellCount(grid) - 1);
    for (const [cell, n] of added) {
      expect(n).toBe(1);
      expect(removed.get(cell)).toBe(1);
    }
  });

  it('binary heap pops keys in ascending order', () => {
    const heap = new BinaryHeap<string>();
    const rng = createRng('heap');
    const keys: number[] = [];
    for (let i = 0; i < 200; i++) {
      const k = rng.next();
      keys.push(k);
      heap.push(k, `v${i}`);
    }
    expect(heap.size).toBe(200);
    const out: number[] = [];
    for (let e = heap.pop(); e; e = heap.pop()) out.push(e.key);
    expect(out).toEqual([...keys].sort((a, b) => a - b));
    expect(heap.pop()).toBeUndefined();
  });
});

describe("kruskal's", () => {
  it('emits exactly cells - 1 unions, each immediately followed by its carve', () => {
    const grid = createGrid(9, 7);
    const { steps } = collect(kruskals.run(grid, createRng('k')));
    const unions = steps.filter((s) => s.t === 'union');
    expect(unions).toHaveLength(cellCount(grid) - 1);
    for (let i = 0; i < steps.length - 1; i++) {
      const s = steps[i]!;
      if (s.t === 'union') {
        const next = steps[i + 1]!;
        expect(next.t).toBe('carve');
        if (next.t === 'carve') {
          expect([next.from, next.to].sort()).toEqual([s.a, s.b].sort());
        }
      }
    }
  });

  it('disjoint set merges and reports connectivity', () => {
    const ds = new DisjointSet(6);
    expect(ds.count).toBe(6);
    expect(ds.union(0, 1)).toBe(true);
    expect(ds.union(1, 2)).toBe(true);
    expect(ds.union(0, 2)).toBe(false);
    expect(ds.connected(0, 2)).toBe(true);
    expect(ds.connected(0, 3)).toBe(false);
    expect(ds.union(3, 4)).toBe(true);
    expect(ds.union(5, 4)).toBe(true);
    expect(ds.union(2, 5)).toBe(true);
    expect(ds.count).toBe(1);
    expect(ds.find(0)).toBe(ds.find(5));
  });
});

describe('uniform spanning tree generators', () => {
  /** A 2x2 grid has exactly four spanning trees (the 4-cycle minus one edge). */
  const allFourTrees = (gen: typeof aldousBroder) => {
    const grid = createGrid(2, 2);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(wallsOf(runToEnd(gen.run(grid, createRng(`u${i}`)))).join(','));
    }
    return seen;
  };

  it('aldous-broder produces every 2x2 spanning tree across seeds', () => {
    expect(allFourTrees(aldousBroder).size).toBe(4);
  });

  it("wilson's produces every 2x2 spanning tree across seeds", () => {
    expect(allFourTrees(wilsons).size).toBe(4);
  });

  it("wilson's erases loops: erased cells never end up carved twice in one walk", () => {
    const grid = createGrid(8, 8);
    const { steps } = collect(wilsons.run(grid, createRng('loops')));
    const erasedSteps = steps.filter(
      (s): s is Extract<GenStep, { t: 'walk' }> => s.t === 'walk' && (s.erased?.length ?? 0) > 0,
    );
    expect(erasedSteps.length).toBeGreaterThan(0);
    // Every cell is carved into exactly once (a tree edge per non-root cell).
    const carvedInto = new Map<number, number>();
    for (const s of steps) {
      if (s.t === 'carve') carvedInto.set(s.from, (carvedInto.get(s.from) ?? 0) + 1);
    }
    expect(carvedInto.size).toBe(cellCount(grid) - 1);
    for (const n of carvedInto.values()) expect(n).toBe(1);
  });

  it('aldous-broder only carves on first arrival', () => {
    const grid = createGrid(6, 6);
    const { steps } = collect(aldousBroder.run(grid, createRng('ab')));
    const walks = steps.filter((s) => s.t === 'walk').length;
    const carves = steps.filter((s) => s.t === 'carve').length;
    expect(carves).toBe(cellCount(grid) - 1);
    expect(walks).toBeGreaterThanOrEqual(carves);
  });
});

describe('hunt-and-kill', () => {
  it('hunts by scanning rows and resumes from a visited neighbour', () => {
    const grid = createGrid(8, 8);
    const { steps, result } = collect(huntAndKill.run(grid, createRng('hunt')));
    expect(isPerfectMaze(result)).toBe(true);
    const scans = steps.filter((s) => s.t === 'frontier');
    expect(scans.length).toBeGreaterThan(0);
    // The scan never emits more than one step per row per hunt and stays bounded.
    expect(steps.length).toBeLessThan(cellCount(grid) * 12);
    expect(steps.filter((s) => s.t === 'backtrack')).toHaveLength(0);
  });
});

describe("eller's", () => {
  it('honours the probabilities at their extremes', () => {
    const grid = createGrid(8, 6);
    // joinProb 1: every row is one corridor (except that joins never create loops).
    const corridors = runToEnd(ellers.run(grid, createRng('e'), { joinProb: 1, dropProb: 0 }));
    expect(isPerfectMaze(corridors)).toBe(true);
    for (let col = 0; col < 7; col++) {
      expect(hasWall(corridors.walls, idOf(grid, 0, col), Dir.E)).toBe(false);
    }
    // joinProb 0, dropProb 1: no horizontal joins until the last row, every cell drops south.
    const columns = runToEnd(ellers.run(grid, createRng('e'), { joinProb: 0, dropProb: 1 }));
    expect(isPerfectMaze(columns)).toBe(true);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        expect(hasWall(columns.walls, idOf(grid, row, col), Dir.S)).toBe(false);
      }
    }
  });
});

describe('sidewinder', () => {
  it('leaves the top row as a single corridor and every other row linked north', () => {
    const grid = createGrid(10, 6);
    const state = runToEnd(sidewinder.run(grid, createRng('side')));
    for (let col = 0; col < 9; col++) {
      expect(hasWall(state.walls, idOf(grid, 0, col), Dir.E)).toBe(false);
    }
    for (let row = 1; row < 6; row++) {
      let linkedNorth = 0;
      for (let col = 0; col < 10; col++) {
        if (!hasWall(state.walls, idOf(grid, row, col), Dir.N)) linkedNorth++;
      }
      expect(linkedNorth).toBeGreaterThan(0);
    }
  });

  it('verticalBias 1 makes columns, 0 makes full-width runs', () => {
    const grid = createGrid(6, 4);
    const cols = runToEnd(sidewinder.run(grid, createRng('v'), { verticalBias: 1 }));
    for (let row = 1; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        expect(hasWall(cols.walls, idOf(grid, row, col), Dir.N)).toBe(false);
      }
    }
    const runs = runToEnd(sidewinder.run(grid, createRng('v'), { verticalBias: 0 }));
    for (let row = 1; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        expect(hasWall(runs.walls, idOf(grid, row, col), Dir.E)).toBe(false);
      }
    }
    expect(isPerfectMaze(cols)).toBe(true);
    expect(isPerfectMaze(runs)).toBe(true);
  });
});

describe('binary tree', () => {
  it('ne bias opens the top row eastward and the right column northward', () => {
    const grid = createGrid(7, 5);
    const state = runToEnd(binaryTree.run(grid, createRng('bt')));
    for (let col = 0; col < 6; col++) {
      expect(hasWall(state.walls, idOf(grid, 0, col), Dir.E)).toBe(false);
    }
    for (let row = 1; row < 5; row++) {
      expect(hasWall(state.walls, idOf(grid, row, 6), Dir.N)).toBe(false);
    }
    // Every cell except the root links N or E, never S or W first.
    for (let cell = 0; cell < cellCount(grid); cell++) {
      const { walls } = state;
      const linksNE = !hasWall(walls, cell, Dir.N) || !hasWall(walls, cell, Dir.E);
      if (cell !== 6) expect(linksNE).toBe(true);
    }
  });

  it('sw bias mirrors the structure: bottom row open westward, left column open southward', () => {
    const grid = createGrid(7, 5);
    const state = runToEnd(binaryTree.run(grid, createRng('bt'), { bias: 'sw' }));
    for (let col = 1; col < 7; col++) {
      expect(hasWall(state.walls, idOf(grid, 4, col), Dir.W)).toBe(false);
    }
    for (let row = 0; row < 4; row++) {
      expect(hasWall(state.walls, idOf(grid, row, 0), Dir.S)).toBe(false);
    }
  });
});

describe('recursive division', () => {
  it('opens the field, then seals walls with divide steps, ending perfect', () => {
    const grid = createGrid(9, 7);
    const { steps, result } = collect(recursiveDivision.run(grid, createRng('rd')));
    const divides = steps.filter((s) => s.t === 'divide');
    const seals = steps.filter((s) => s.t === 'seal');
    expect(divides.length).toBeGreaterThan(0);
    expect(seals.length).toBeGreaterThan(0);
    expect(isPerfectMaze(result)).toBe(true);
    // The first wall-changing steps are carves (the open field), seals come later.
    const firstSeal = steps.findIndex((s) => s.t === 'seal');
    const lastCarve = steps.map((s) => s.t).lastIndexOf('carve');
    expect(lastCarve).toBeLessThan(firstSeal);
    // Each divide step's gap lies on the wall it describes.
    for (const d of divides) {
      if (d.t === 'divide') expect(d.cells).toContain(d.gap);
    }
  });

  it('minSize > 1 leaves open rooms (cycles) but stays connected', () => {
    const grid = createGrid(12, 12);
    const state = runToEnd(recursiveDivision.run(grid, createRng('rooms'), { minSize: 3 }));
    expect(isPerfectMaze(state)).toBe(false);
    // Connected: BFS from start reaches every cell.
    const seen = new Set<number>([0]);
    const queue = [0];
    while (queue.length > 0) {
      const c = queue.shift()!;
      for (const d of [Dir.N, Dir.E, Dir.S, Dir.W] as const) {
        if (hasWall(state.walls, c, d)) continue;
        const r = Math.floor(c / 12) + (d === Dir.S ? 1 : d === Dir.N ? -1 : 0);
        const col = (c % 12) + (d === Dir.E ? 1 : d === Dir.W ? -1 : 0);
        if (r < 0 || col < 0 || r >= 12 || col >= 12) continue;
        const nb = r * 12 + col;
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    expect(seen.size).toBe(144);
  });
});

describe('origin shift', () => {
  it('stays a spanning tree after every rotation', () => {
    const grid = createGrid(5, 5);
    const { steps, result } = collect(originShift.run(grid, createRng('os'), { iterations: 250 }));
    const walls = replayGenSteps(grid, []);
    let rotations = 0;
    let checks = 0;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      applyGenStep(walls, grid, s);
      if (s.t === 'rotate') rotations++;
      // A rotation's wall changes are complete once the next step is not carve/seal.
      const next = steps[i + 1];
      if (rotations > 0 && next && next.t !== 'carve' && next.t !== 'seal' && s.t !== 'rotate') {
        expect(isPerfectMaze(createMazeState(grid, walls, 0, 24))).toBe(true);
        checks++;
      }
    }
    expect(rotations).toBe(250);
    expect(checks).toBeGreaterThan(50);
    expect(isPerfectMaze(result)).toBe(true);
  });

  it('automatic iterations scale with the grid and differ from the comb start', () => {
    const grid = createGrid(6, 6);
    const { steps, result } = collect(originShift.run(grid, createRng('auto')));
    expect(steps.filter((s) => s.t === 'rotate')).toHaveLength(360);
    // The deterministic comb start has the whole top row open eastward; after mixing it does not.
    let topOpen = 0;
    for (let col = 0; col < 5; col++) {
      if (!hasWall(result.walls, idOf(grid, 0, col), Dir.E)) topOpen++;
    }
    expect(topOpen).toBeLessThan(5);
  });
});
