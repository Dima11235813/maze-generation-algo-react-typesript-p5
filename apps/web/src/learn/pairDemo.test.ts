import { SolveTracker, collect, solvers, type SolveStep } from '@maze/core';
import { describe, expect, it } from 'vitest';
import { graphStats } from './graphDemo';
import {
  PairDemoModel,
  laneName,
  pairBreakpointCatalogue,
  pairDemoMaze,
  pairRun,
  type PairDemoSetup,
} from './pairDemo';

const SETUP: PairDemoSetup = {
  generatorId: 'prims',
  seed: 'pair-test',
  width: 9,
  height: 7,
  braid: 50,
  solverIds: ['bfs', 'dfs'],
};

const paused = { schedule: () => () => undefined };

describe('pair demo', () => {
  it('builds the same braided maze every time', () => {
    const m = pairDemoMaze(SETUP);
    expect(graphStats(m).loops).toBeGreaterThan(0);
    expect(graphStats(m).pieces).toBe(1);
    expect(pairDemoMaze(SETUP).walls).toEqual(m.walls);
  });

  it('runs the solvers in lockstep: each lane replays its solver exactly', () => {
    for (const ids of [
      ['bfs', 'dfs'],
      ['dfs', 'astar'],
      ['wall-follower', 'bfs'],
    ] as const) {
      const m = pairDemoMaze({ ...SETUP, solverIds: ids });
      const own = ids.map((id) => collect(solvers.require(id).run(m, {})).steps);
      const ticks = collect(pairRun(m, ids)).steps;
      expect(ticks.length, ids.join()).toBe(Math.max(...own.map((s) => s.length)));
      ids.forEach((_, lane) => {
        const steps = ticks.map((t) => t.steps[lane]);
        const taken = steps.filter((s): s is SolveStep => s !== null && s !== undefined);
        expect(taken, `${ids.join()} lane ${String(lane)}`).toEqual(own[lane]);
        // Once a lane has finished it only sits out.
        expect(steps.slice(taken.length).every((s) => s === null)).toBe(true);
      });
    }
  });

  it('folds each lane into its own tracker, and rewinds exactly', () => {
    const model = new PairDemoModel(SETUP, paused);
    const maze = pairDemoMaze(SETUP);
    const alone = (id: string, n: number) => {
      const t = new SolveTracker(maze.grid);
      for (const s of collect(solvers.require(id).run(maze, {})).steps.slice(0, n)) t.apply(s);
      return t;
    };
    model.player.step(40);
    const at40 = model.lanes();
    expect(model.lanes()).toBe(at40);
    SETUP.solverIds.forEach((id, i) => {
      expect(model.trackers[i]?.expanded).toBe(alone(id, 40).expanded);
      expect(Array.from(model.trackers[i]?.marks ?? [])).toEqual(Array.from(alone(id, 40).marks));
    });
    model.player.step(30);
    model.player.seek(40);
    expect(model.lanes()).toEqual(at40);
    model.player.runToEnd();
    const end = model.lanes();
    expect(end.every((l) => l.done && l.pathMoves !== null)).toBe(true);
    // BFS finds a shortest path; on this braided maze DFS may not, but never a shorter one.
    expect(end[0]?.pathMoves).toBe(model.shortest);
    expect(end[1]?.pathMoves ?? 0).toBeGreaterThanOrEqual(model.shortest ?? 0);
    model.player.restart();
    expect(model.lanes().every((l) => l.expanded === 0 && l.pathMoves === null)).toBe(true);
  });

  it('stops on the first tick where a lane finds its path, and says which', () => {
    const model = new PairDemoModel(SETUP, paused);
    const ticks = collect(pairRun(model.maze, SETUP.solverIds)).steps;
    const firstPath = ticks.findIndex((t) => t.steps.some((s) => s?.t === 'path')) + 1;
    const catalogue = pairBreakpointCatalogue(model);
    expect(catalogue.choices.map((c) => c.id)).toEqual(['path']);
    const bp = catalogue.make('path', 0);
    const hit = model.player.runUntil(bp.predicate);
    expect(hit?.index).toBe(firstPath);
    expect(bp.describe(hit)).toMatch(
      /^Stopped at step \d+: (Breadth|Depth)-First Search found a path of \d+ moves\.$/,
    );
    const second = catalogue.make('path', 0);
    expect(second.describe(model.player.runUntil(second.predicate))).toMatch(/found a path/);
    const third = catalogue.make('path', 0);
    expect(third.describe(model.player.runUntil(third.predicate))).toBe(
      'Ran to the end: no other path was found.',
    );
  });

  it('names a tuned lane by what differs from the defaults', () => {
    expect(laneName('astar')).toBe('A* Search');
    expect(laneName('astar', { weight: 1 })).toBe('A* Search');
    // In the order of the solver's parameter form, whatever order the values come in.
    expect(laneName('astar', { weight: 2, heuristic: 'euclidean' })).toBe(
      'A* Search, heuristic euclidean, heuristic weight 2',
    );
    expect(laneName('no-such-solver')).toBe('no-such-solver');
  });

  it('runs each lane with its own parameters and counts lowered costs', () => {
    const setup: PairDemoSetup = {
      ...SETUP,
      braid: 100,
      solverIds: ['astar', 'astar'],
      solverParams: [{}, { weight: 3 }],
    };
    const model = new PairDemoModel(setup, paused);
    model.player.runToEnd();
    const [plain, heavy] = model.lanes();
    for (const [i, lane] of [plain, heavy].entries()) {
      const steps = collect(
        solvers.require('astar').run(model.maze, setup.solverParams?.[i] ?? {}),
      ).steps;
      expect(lane?.expanded).toBe(steps.filter((s) => s.t === 'expand').length);
      expect(lane?.relaxed).toBe(steps.filter((s) => s.t === 'relax').length);
    }
    expect(heavy?.name).toBe('A* Search, heuristic weight 3');
    expect(heavy?.params).toEqual({ weight: 3 });
    expect(plain?.pathMoves).toBe(model.shortest);
    model.player.restart();
    expect(model.lanes().every((l) => l.relaxed === 0)).toBe(true);
  });

  it('offers "a cost is lowered" only when a lane can relax, and stops on that tick', () => {
    expect(
      pairBreakpointCatalogue(new PairDemoModel(SETUP, paused)).choices.map((c) => c.id),
    ).toEqual(['path']);
    // The M7.2 maze: plain A* lowers three costs on it (probe, 2026-10-31).
    const model = new PairDemoModel(
      {
        generatorId: 'recursive-backtracker',
        seed: 'm7-3',
        width: 12,
        height: 9,
        braid: 100,
        solverIds: ['astar', 'bfs'],
      },
      paused,
    );
    const ticks = collect(pairRun(model.maze, model.solverIds)).steps;
    const firstRelax = ticks.findIndex((t) => t.steps.some((s) => s?.t === 'relax')) + 1;
    const catalogue = pairBreakpointCatalogue(model);
    expect(catalogue.choices.map((c) => c.id)).toEqual(['path', 'relax']);
    const bp = catalogue.make('relax', 0);
    expect(firstRelax).toBeGreaterThan(0);
    const hit = model.player.runUntil(bp.predicate);
    expect(hit?.index).toBe(firstRelax);
    expect(bp.describe(hit)).toMatch(
      /^Stopped at step \d+: A\* Search found a cheaper way to row \d+, column \d+: its cost fell from \d+ to \d+\.$/,
    );
    model.player.runToEnd();
    const after = catalogue.make('relax', 0);
    expect(after.describe(model.player.runUntil(after.predicate))).toBe(
      'Ran to the end: no cost was lowered.',
    );
  });
});
