import fc from 'fast-check';
import {
  astar,
  bfs,
  bidirectionalBfs,
  collect,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  deadEndFilling,
  dfs,
  dijkstra,
  dirBetween,
  distances,
  floodFill,
  generators,
  greedyBestFirst,
  handOrder,
  hasWall,
  loopErase,
  pledge,
  quarterTurns,
  randomMouse,
  removeWall,
  runToEnd,
  solvers,
  tremaux,
  wallFollower,
  type MazeState,
  type SolveStep,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

function randomMaze(width: number, height: number, seed: string): MazeState {
  return runToEnd(
    generators.require('recursive-backtracker').run(createGrid(width, height), createRng(seed)),
  );
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

/** Every `move` step crosses an open passage between adjacent cells. */
function movesAreLegal(state: MazeState, steps: readonly SolveStep[]): boolean {
  for (const s of steps) {
    if (s.t !== 'move') continue;
    const d = dirBetween(state.grid, s.from, s.to);
    if (d === undefined || hasWall(state.walls, s.from, d)) return false;
    if (s.heading !== undefined && s.heading !== d) return false;
  }
  return true;
}

const gridArb = fc.record({
  width: fc.integer({ min: 1, max: 10 }),
  height: fc.integer({ min: 1, max: 10 }),
});

const KNOWN_TAGS = new Set([
  'graph-search',
  'complete',
  'optimal',
  'heuristic',
  'agent-perspective',
  'randomized',
  'queue',
  'stack',
  'heap',
  'disjoint-set',
  'weighted',
  'bidirectional',
  'elimination',
  'dynamic-programming',
  'simply-connected',
  'heading',
  'counter',
  'marks',
  'baseline',
]);

describe.each(solvers.all.map((s) => [s.meta.id, s] as const))('solver %s', (_id, solver) => {
  const tags = new Set(solver.meta.tags);

  it('has consistent metadata', () => {
    expect(solver.meta.family).toBe('solver');
    expect(solver.meta.id).toMatch(/^[a-z0-9-]+$/);
    expect(solver.meta.docsSlug).toBe(`learn/${solver.meta.id}`);
    expect(solver.meta.summary.length).toBeGreaterThan(40);
    for (const t of tags) expect(KNOWN_TAGS.has(t), `unknown tag ${t}`).toBe(true);
    // Exactly one of "sees the map" vs "walks inside".
    expect(tags.has('graph-search') !== tags.has('agent-perspective')).toBe(true);
  });

  it('property: step stream is well formed and stats are consistent', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
        const maze = randomMaze(width, height, seed);
        const { steps, result } = collect(solver.run(maze));
        expect(steps.at(-1)?.t).toBe('done');
        const terminal = steps.filter((s) => s.t === 'path' || s.t === 'fail');
        expect(terminal).toHaveLength(1);
        expect(result.stats.steps).toBe(steps.length);
        expect(result.stats.expanded).toBeGreaterThan(0);
        expect(result.stats.discovered).toBeGreaterThanOrEqual(1);
        expect(result.stats.frontierPeak).toBeGreaterThanOrEqual(1);
        if (result.path) {
          expect(isValidPath(maze, result.path)).toBe(true);
          expect(result.stats.pathLength).toBe(result.path.length - 1);
          expect(terminal[0]?.t).toBe('path');
        } else {
          expect(result.stats.pathLength).toBeNull();
          expect(terminal[0]?.t).toBe('fail');
        }
        expect(movesAreLegal(maze, steps)).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  if (tags.has('complete') || tags.has('simply-connected')) {
    it('property: finds a path on every perfect maze (simply connected)', () => {
      fc.assert(
        fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
          const maze = randomMaze(width, height, seed);
          const { result } = collect(solver.run(maze));
          expect(result.path).not.toBeNull();
        }),
        { numRuns: 60 },
      );
    });
  }

  if (tags.has('optimal')) {
    it('property: path length equals the BFS distance', () => {
      fc.assert(
        fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
          const maze = randomMaze(width, height, seed);
          const { result } = collect(solver.run(maze));
          expect(result.stats.pathLength).toBe(distances(maze, maze.start)[maze.goal]);
          expect(result.stats.optimal).toBe(true);
        }),
        { numRuns: 60 },
      );
    });
  }

  if (tags.has('agent-perspective')) {
    it('walks a continuous route: consecutive moves chain and never cross walls', () => {
      const maze = randomMaze(7, 6, `walk-${solver.meta.id}`);
      const { steps } = collect(solver.run(maze, {}, createRng('walk')));
      const moves = steps.filter((s): s is Extract<SolveStep, { t: 'move' }> => s.t === 'move');
      expect(movesAreLegal(maze, steps)).toBe(true);
      for (let i = 1; i < moves.length; i++) expect(moves[i]!.from).toBe(moves[i - 1]!.to);
      expect(moves[0]?.from ?? maze.start).toBe(maze.start);
    });
  }

  if (!tags.has('randomized')) {
    it('is deterministic', () => {
      const maze = randomMaze(8, 6, 'det');
      const a = collect(solver.run(maze));
      const b = collect(solver.run(maze));
      expect(a.steps).toEqual(b.steps);
    });
  }

  it('fails gracefully when the goal is unreachable', () => {
    const { steps, result } = collect(solver.run(twoByTwoClosed()));
    expect(result.path).toBeNull();
    expect(result.stats.pathLength).toBeNull();
    expect(steps.some((s) => s.t === 'fail')).toBe(true);
    expect(steps.at(-1)?.t).toBe('done');
    expect(result.stats.steps).toBe(steps.length);
  });

  it('solves the 3x3 fixture along its only corridor', () => {
    const { result } = collect(solver.run(threeByThree(), {}, createRng('fixture')));
    expect(result.path).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
  });

  it('handles the 1x1 maze where start is the goal', () => {
    const one = createMazeState(createGrid(1, 1), createWalls(createGrid(1, 1)), 0, 0);
    const { result } = collect(solver.run(one));
    expect(result.path).toEqual([0]);
    expect(result.stats.pathLength).toBe(0);
  });
});

describe('bfs', () => {
  it('expands in non-decreasing distance order', () => {
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
  it('emits deadend steps and finds the unique path of a perfect maze', () => {
    const maze = randomMaze(8, 8, 'dfs');
    expect(collect(dfs.run(maze)).result.path).toEqual(collect(bfs.run(maze)).result.path);
    expect(collect(dfs.run(randomMaze(6, 6, 'dead'))).steps.some((s) => s.t === 'deadend')).toBe(
      true,
    );
  });
});

/** A braided maze: a perfect maze with a few extra passages, so loops exist. */
function braidedMaze(seed: string): MazeState {
  const base = randomMaze(8, 8, seed);
  const walls = new Uint8Array(base.walls);
  const rng = createRng(`${seed}-braid`);
  let opened = 0;
  for (let tries = 0; tries < 200 && opened < 6; tries++) {
    const a = rng.int(64);
    const d = rng.int(4) as 0 | 1 | 2 | 3;
    const r = Math.floor(a / 8) + [-1, 0, 1, 0][d]!;
    const c = (a % 8) + [0, 1, 0, -1][d]!;
    if (r < 0 || c < 0 || r >= 8 || c >= 8) continue;
    const b = r * 8 + c;
    if (!hasWall(walls, a, d)) continue;
    removeWall(walls, base.grid, a, b);
    opened++;
  }
  return createMazeState(base.grid, walls, base.start, base.goal);
}

describe('dijkstra', () => {
  it('equals BFS on unit costs and finds minimum-cost paths on weighted braids', () => {
    const maze = randomMaze(9, 9, 'dij');
    expect(collect(dijkstra.run(maze)).result.stats.pathLength).toBe(
      collect(bfs.run(maze)).result.stats.pathLength,
    );
    const braided = braidedMaze('dij-w');
    const weights = new Float32Array(64).fill(1);
    const seed = createRng('weights');
    for (let i = 0; i < 64; i++) weights[i] = 1 + seed.int(9);
    const { result } = collect(dijkstra.run(braided, { weights }));
    expect(result.path).not.toBeNull();
    // Reference: Bellman-Ford style relaxation until stable gives the exact minimum cost.
    const ref = new Float64Array(64).fill(Number.POSITIVE_INFINITY);
    ref[braided.start] = 0;
    for (let changed = true; changed;) {
      changed = false;
      for (let a = 0; a < 64; a++) {
        if (!Number.isFinite(ref[a]!)) continue;
        for (const d of [0, 1, 2, 3] as const) {
          if (hasWall(braided.walls, a, d)) continue;
          const r = Math.floor(a / 8) + [-1, 0, 1, 0][d]!;
          const col = (a % 8) + [0, 1, 0, -1][d]!;
          if (r < 0 || col < 0 || r >= 8 || col >= 8) continue;
          const b = r * 8 + col;
          if (ref[a]! + weights[b]! < ref[b]!) {
            ref[b] = ref[a]! + weights[b]!;
            changed = true;
          }
        }
      }
    }
    const cost = (p: readonly number[]) => p.slice(1).reduce((s, c) => s + weights[c]!, 0);
    expect(cost(result.path!)).toBeCloseTo(ref[braided.goal]!);
    // With per-cell entry costs Dijkstra never needs a decrease-key: the first discovery of a
    // cell always comes from the cheapest predecessor, so no `relax` step is expected here.
    expect(collect(dijkstra.run(braided, { weights })).steps.some((s) => s.t === 'relax')).toBe(
      false,
    );
  });

  it('validates weights', () => {
    const maze = randomMaze(3, 3, 'w');
    expect(() => collect(dijkstra.run(maze, { weights: [1, 2] }))).toThrow(RangeError);
    expect(() => collect(dijkstra.run(maze, { weights: new Array(9).fill(-1) }))).toThrow(
      RangeError,
    );
  });
});

describe('astar', () => {
  it('expands no more cells than BFS with every admissible heuristic and carries g/h/f', () => {
    for (const seed of ['a1', 'a2', 'a3']) {
      const maze = randomMaze(12, 10, seed);
      const bfsExpanded = collect(bfs.run(maze)).result.stats.expanded;
      for (const heuristic of ['manhattan', 'euclidean', 'chebyshev'] as const) {
        const { steps, result } = collect(astar.run(maze, { heuristic }));
        expect(result.stats.expanded).toBeLessThanOrEqual(bfsExpanded);
        expect(result.stats.optimal).toBe(true);
        const ex = steps.find((s) => s.t === 'expand');
        expect(ex && ex.t === 'expand' && ex.f !== undefined && ex.h !== undefined).toBe(true);
      }
    }
  });

  it('weighted A* is marked non-optimal and both tie-break modes are deterministic', () => {
    const maze = randomMaze(10, 10, 'wa');
    const weighted = collect(astar.run(maze, { weight: 3 })).result;
    expect(weighted.stats.optimal).toBe(false);
    expect(weighted.path).not.toBeNull();
    const fifo = collect(astar.run(maze, { tieBreak: 'fifo' }));
    expect(fifo.steps).toEqual(collect(astar.run(maze, { tieBreak: 'fifo' })).steps);
    expect(collect(astar.run(maze, { heuristic: 'bogus' as never })).result.path).not.toBeNull();
  });

  it('relaxes when a braided maze offers a shorter route later', () => {
    let relaxed = false;
    for (let i = 0; i < 20 && !relaxed; i++) {
      const { steps } = collect(astar.run(braidedMaze(`relax-${i}`), { heuristic: 'chebyshev' }));
      relaxed = steps.some((s) => s.t === 'relax');
    }
    expect(relaxed).toBe(true);
  });
});

describe('greedy best-first', () => {
  it('can return a longer path than BFS on a braided maze', () => {
    let longer = false;
    for (let i = 0; i < 30 && !longer; i++) {
      const maze = braidedMaze(`greedy-${i}`);
      const g = collect(greedyBestFirst.run(maze)).result.stats.pathLength!;
      const b = collect(bfs.run(maze)).result.stats.pathLength!;
      expect(g).toBeGreaterThanOrEqual(b);
      longer = g > b;
    }
    expect(longer).toBe(true);
  });
});

describe('bidirectional bfs', () => {
  it('expands fewer cells than BFS on long mazes and stays optimal on braided ones', () => {
    const maze = randomMaze(20, 20, 'bi');
    expect(collect(bidirectionalBfs.run(maze)).result.stats.expanded).toBeLessThan(
      collect(bfs.run(maze)).result.stats.expanded,
    );
    for (let i = 0; i < 10; i++) {
      const b = braidedMaze(`bi-${i}`);
      expect(collect(bidirectionalBfs.run(b)).result.stats.pathLength).toBe(
        distances(b, b.start)[b.goal],
      );
    }
  });
});

describe('dead-end filling and flood fill', () => {
  it('dead-end filling marks every dead end except start/goal and stays optimal on braids', () => {
    const maze = randomMaze(10, 8, 'def');
    const { steps, result } = collect(deadEndFilling.run(maze));
    const filled = new Set(
      steps.filter((s) => s.t === 'deadend').map((s) => (s as { cell: number }).cell),
    );
    expect(filled.has(maze.start)).toBe(false);
    expect(filled.has(maze.goal)).toBe(false);
    for (const cell of result.path!) expect(filled.has(cell)).toBe(false);
    for (let i = 0; i < 10; i++) {
      const b = braidedMaze(`def-${i}`);
      expect(collect(deadEndFilling.run(b)).result.stats.pathLength).toBe(
        distances(b, b.start)[b.goal],
      );
    }
  });

  it('flood fill labels every cell with its distance to the goal, then descends', () => {
    const maze = randomMaze(9, 9, 'flood');
    const { steps, result } = collect(floodFill.run(maze));
    const dist = distances(maze, maze.goal);
    for (const s of steps) {
      if (s.t === 'discover' || s.t === 'expand') expect(s.g).toBe(dist[s.cell]);
    }
    const moves = steps.filter((s) => s.t === 'move');
    expect(moves).toHaveLength(result.path!.length - 1);
  });
});

describe('wall follower and pledge', () => {
  it('handOrder puts the hand side first and back last', () => {
    expect(handOrder(0, 'right')).toEqual([1, 0, 3, 2]);
    expect(handOrder(0, 'left')).toEqual([3, 0, 1, 2]);
    expect(handOrder(1, 'right')).toEqual([2, 1, 0, 3]);
  });

  it('quarterTurns is signed and U-turns depend on the hand', () => {
    expect(quarterTurns(0, 0, 'left')).toBe(0);
    expect(quarterTurns(0, 1, 'left')).toBe(1);
    expect(quarterTurns(0, 3, 'left')).toBe(-1);
    expect(quarterTurns(0, 2, 'left')).toBe(2);
    expect(quarterTurns(0, 2, 'right')).toBe(-2);
  });

  it('both hands solve perfect mazes; a loop around an island is detected and fails', () => {
    const maze = randomMaze(9, 7, 'hands');
    expect(collect(wallFollower.run(maze, { hand: 'left' })).result.path).not.toBeNull();
    expect(collect(wallFollower.run(maze, { hand: 'right' })).result.path).not.toBeNull();

    // A 3x3 ring: start at the centre's neighbour, goal in the unreachable... build an
    // island: outer ring open, centre cell walled off and the goal placed on the centre.
    const g = createGrid(3, 3);
    const walls = createWalls(g);
    const ring = [0, 1, 2, 5, 8, 7, 6, 3];
    for (let i = 0; i < ring.length; i++)
      removeWall(walls, g, ring[i]!, ring[(i + 1) % ring.length]!);
    const island = createMazeState(g, walls, 0, 4);
    const { steps, result } = collect(wallFollower.run(island));
    expect(result.path).toBeNull();
    expect(steps.some((s) => s.t === 'fail')).toBe(true);
    expect(steps.filter((s) => s.t === 'move').length).toBeLessThanOrEqual(9 * 8);
  });

  it('budget exhaustion fails cleanly', () => {
    const maze = randomMaze(10, 10, 'budget');
    const { result } = collect(wallFollower.run(maze, { maxMoves: 3 }));
    expect(result.path).toBeNull();
    expect(result.stats.expanded).toBeLessThanOrEqual(4);
  });

  it('pledge reaches the goal on sample perfect mazes with every preferred direction', () => {
    let solved = 0;
    let total = 0;
    for (const preferred of ['N', 'E', 'S', 'W'] as const) {
      for (let i = 0; i < 8; i++) {
        const maze = randomMaze(8, 7, `pledge-${preferred}-${i}`);
        const { steps, result } = collect(pledge.run(maze, { preferred }));
        expect(movesAreLegal(maze, steps)).toBe(true);
        total++;
        if (result.path) solved++;
      }
    }
    expect(solved).toBeGreaterThan(total / 2);
    expect(
      collect(pledge.run(randomMaze(6, 6, 'p-left'), { hand: 'left' })).result.path,
    ).not.toBeNull();
  });
});

describe('tremaux', () => {
  it('never marks a passage end more than twice and reports dead ends', () => {
    let deadEnds = 0;
    for (const seed of ['trem', 'trem2', 'trem3', 'trem4', 'trem5']) {
      const maze = randomMaze(9, 8, seed);
      const { steps, result } = collect(tremaux.run(maze));
      expect(result.path).not.toBeNull();
      const marks = new Map<string, number>();
      for (const s of steps) {
        if (s.t === 'mark') {
          const k = `${s.cell}:${s.dir}`;
          expect((marks.get(k) ?? 0) + 1).toBe(s.count);
          marks.set(k, s.count);
        }
        if (s.t === 'deadend') deadEnds++;
      }
    }
    expect(deadEnds).toBeGreaterThan(0);
  });

  it('is complete on braided mazes too', () => {
    for (let i = 0; i < 10; i++) {
      const b = braidedMaze(`trem-${i}`);
      const { result } = collect(tremaux.run(b));
      expect(result.path).not.toBeNull();
      expect(isValidPath(b, result.path!)).toBe(true);
    }
  });
});

describe('random mouse', () => {
  it('is reproducible from its rng and usually solves small mazes within budget', () => {
    const maze = randomMaze(5, 5, 'mouse');
    const a = collect(randomMouse.run(maze, {}, createRng('m1')));
    const b = collect(randomMouse.run(maze, {}, createRng('m1')));
    expect(a.steps).toEqual(b.steps);
    expect(a.result.path).not.toBeNull();
    let solved = 0;
    for (let i = 0; i < 20; i++) {
      if (collect(randomMouse.run(maze, { maxMoves: 5000 }, createRng(`m-${i}`))).result.path)
        solved++;
    }
    expect(solved).toBeGreaterThanOrEqual(18);
    // Without an rng it still runs (fixed internal seed) and respects the budget.
    const tight = collect(randomMouse.run(randomMaze(10, 10, 'mouse-b'), { maxMoves: 2 })).result;
    expect(tight.path).toBeNull();
    const backtracking = collect(
      randomMouse.run(maze, { noBacktrack: false, maxMoves: 5000 }, createRng('bt')),
    );
    expect(backtracking.result.stats.steps).toBe(backtracking.steps.length);
  });
});

describe('loopErase', () => {
  it('removes cycles and keeps the first visit order', () => {
    expect(loopErase([0, 1, 2, 1, 3])).toEqual([0, 1, 3]);
    expect(loopErase([0, 1, 2, 3, 1, 4, 5, 4, 6])).toEqual([0, 1, 4, 6]);
    expect(loopErase([7])).toEqual([7]);
    expect(loopErase([])).toEqual([]);
  });
});
