import {
  MAX_AGENTS,
  MIN_AGENTS,
  bfs,
  collect,
  compositeScores,
  createAgent,
  createGrid,
  createRng,
  encodeDocument,
  generators,
  raceRanking,
  runRace,
  runToEnd,
  type Agent,
  type MazeDocument,
  type MazeSolver,
  type RaceAgentResult,
  type RaceConfig,
  type SolveStep,
} from '../src';

let doc: MazeDocument;
beforeAll(async () => {
  const state = runToEnd(
    generators.require('recursive-backtracker').run(createGrid(10, 8), createRng('race-seed')),
  );
  doc = await encodeDocument(state, {
    provenance: { algorithm: 'recursive-backtracker', seed: 'race-seed', params: {} },
  });
});

function config(agents: Agent[], scoring: RaceConfig['scoring'] = 'first-to-goal'): RaceConfig {
  return { document: doc, agents, lockstep: true, scoring };
}

/** A fake solver for disqualification scenarios. */
function fakeSolver(id: string, body: () => Generator<SolveStep, { path: number[] | null }>): Agent {
  const solver: MazeSolver<Record<string, unknown>> = {
    meta: { ...bfs.meta, id, name: id },
    *run() {
      const r = yield* body();
      const stats = { expanded: 1, discovered: 1, frontierPeak: 1, pathLength: r.path ? r.path.length - 1 : null, optimal: null, steps: 1 };
      return { path: r.path, stats };
    },
  };
  return { id, solver, params: {}, budget: { maxSteps: 1000 }, rngLabel: id };
}

describe('runRace', () => {
  it('validates the configuration', () => {
    expect(() => collect(runRace(config([createAgent('bfs')])))).toThrow(RangeError);
    expect(() =>
      collect(runRace(config(['a', 'b', 'c', 'd', 'e'].map((id) => createAgent('bfs', {}, { id }))))),
    ).toThrow(RangeError);
    expect(() => collect(runRace(config([createAgent('bfs'), createAgent('bfs')])))).toThrow(/Duplicate/);
    expect(() =>
      collect(runRace(config([createAgent('bfs'), createAgent('dfs', {}, { budget: { maxSteps: 0 } })]))),
    ).toThrow(RangeError);
    expect(MIN_AGENTS).toBe(2);
    expect(MAX_AGENTS).toBe(4);
  });

  it('is deterministic and ticks until the last agent finishes', () => {
    const make = () => config([createAgent('bfs'), createAgent('random-mouse'), createAgent('dfs')]);
    const a = collect(runRace(make()));
    const b = collect(runRace(make()));
    expect(a.result.ranking).toEqual(b.result.ranking);
    expect(a.result.perAgent).toEqual(b.result.perAgent);
    expect(a.steps).toEqual(b.steps);
    const finishTicks = Object.values(a.result.perAgent).map((r) => r.finishedAtTick ?? 0);
    expect(a.result.ticks).toBe(Math.max(...finishTicks));
    expect(a.steps).toHaveLength(a.result.ticks);
    // Lockstep: every tick has one entry per agent; entries are null once finished.
    for (const t of a.steps) expect(t.steps).toHaveLength(3);
    const last = a.steps.at(-1)!;
    expect(last.steps.filter((s) => s === null).length).toBeGreaterThanOrEqual(2);
  });

  it('BFS beats the random mouse on first-to-goal', () => {
    const { result } = collect(runRace(config([createAgent('random-mouse'), createAgent('bfs')])));
    expect(result.ranking[0]).toBe('bfs');
    expect(result.perAgent['bfs']!.reachedGoal).toBe(true);
    expect(result.perAgent['bfs']!.optimal).toBe(true);
  });

  it('fewest-expanded orders DFS and BFS by their expansion counts', () => {
    const { result } = collect(runRace(config([createAgent('dfs'), createAgent('bfs')], 'fewest-expanded')));
    const d = result.perAgent['dfs']!.expanded;
    const b = result.perAgent['bfs']!.expanded;
    expect(result.ranking[0]).toBe(d < b ? 'dfs' : b < d ? 'bfs' : 'bfs');
  });

  it('disqualifies an agent that exceeds its step budget and ranks it last', () => {
    const { result } = collect(
      runRace(config([createAgent('bfs', {}, { id: 'tiny', budget: { maxSteps: 5 } }), createAgent('dfs')])),
    );
    expect(result.perAgent['tiny']!.disqualified).toBe('budget');
    expect(result.perAgent['tiny']!.steps).toBe(5);
    expect(result.ranking).toEqual(['dfs', 'tiny']);
  });

  it('breaks exact ties by agent id', () => {
    const { result } = collect(
      runRace(config([createAgent('bfs', {}, { id: 'zeta' }), createAgent('bfs', {}, { id: 'alpha' })])),
    );
    expect(result.ranking).toEqual(['alpha', 'zeta']);
  });

  it('calls onTick for every tick', () => {
    const ticks: number[] = [];
    const { result } = collect(runRace(config([createAgent('bfs'), createAgent('astar')]), { onTick: (t) => ticks.push(t.tick) }));
    expect(ticks).toEqual(Array.from({ length: result.ticks }, (_, i) => i + 1));
  });

  it('gives each randomised agent its own forked stream', () => {
    const { result } = collect(
      runRace(config([createAgent('random-mouse', {}, { id: 'm1' }), createAgent('random-mouse', {}, { id: 'm2' })])),
    );
    expect(result.perAgent['m1']!.steps).not.toBe(result.perAgent['m2']!.steps);
  });

  it('disqualifies illegal moves, invalid paths and throwing solvers', () => {
    const illegal = fakeSolver('illegal', function* () {
      yield { t: 'move', from: 0, to: 79 };
      return { path: null };
    });
    const badPath = fakeSolver('bad-path', function* () {
      yield { t: 'expand', cell: 0 };
      yield { t: 'path', cells: [0, 79] };
      yield { t: 'done', stats: { expanded: 1, discovered: 1, frontierPeak: 1, pathLength: 1, optimal: null, steps: 3 } };
      return { path: [0, 79] };
    });
    const thrower = fakeSolver('thrower', function* () {
      yield { t: 'expand', cell: 0 };
      throw new Error('boom');
    });
    const { result } = collect(runRace(config([illegal, badPath, thrower, createAgent('bfs')])));
    expect(result.perAgent['illegal']!.disqualified).toBe('illegal-move');
    expect(result.perAgent['bad-path']!.disqualified).toBe('invalid-path');
    expect(result.perAgent['thrower']!.disqualified).toMatch(/^error: boom/);
    expect(result.ranking).toEqual(['bfs', 'bad-path', 'illegal', 'thrower']);
  });

  it('ranks agents that finish without a path after winners and before disqualified', () => {
    const failer = fakeSolver('failer', function* () {
      yield { t: 'expand', cell: 0 };
      yield { t: 'fail' };
      yield { t: 'done', stats: { expanded: 1, discovered: 1, frontierPeak: 1, pathLength: null, optimal: null, steps: 3 } };
      return { path: null };
    });
    const { result } = collect(
      runRace(config([failer, createAgent('bfs', {}, { id: 'tiny', budget: { maxSteps: 2 } }), createAgent('dfs')])),
    );
    expect(result.ranking).toEqual(['dfs', 'failer', 'tiny']);
  });
});

describe('raceRanking and compositeScores', () => {
  const base = { discovered: 1, frontierPeak: 1, optimal: null, steps: 10, reachedGoal: true };
  const perAgent: Record<string, RaceAgentResult> = {
    slowOptimal: { ...base, expanded: 50, pathLength: 20, finishedAtTick: 100 },
    fastLong: { ...base, expanded: 20, pathLength: 40, finishedAtTick: 40 },
    failed: { ...base, expanded: 5, pathLength: null, finishedAtTick: 10, reachedGoal: false },
    dq: { ...base, expanded: 1, pathLength: null, finishedAtTick: 3, reachedGoal: false, disqualified: 'budget' },
  };

  it('orders by each scoring rule', () => {
    expect(raceRanking(perAgent, 'first-to-goal')).toEqual(['fastLong', 'slowOptimal', 'failed', 'dq']);
    expect(raceRanking(perAgent, 'fewest-expanded')).toEqual(['fastLong', 'slowOptimal', 'failed', 'dq']);
    const composite = raceRanking(perAgent, 'composite', { solutionLength: 20 });
    expect(composite.slice(2)).toEqual(['failed', 'dq']);
    const scores = compositeScores(perAgent, ['slowOptimal', 'fastLong'], { solutionLength: 20 });
    // fastLong: 0.5*1 + 0.3*1 + 0.2*(2-1) = 1.0 ; slowOptimal: 0.5*2.5 + 0.3*2.5 + 0 = 2.0
    expect(scores['fastLong']).toBeCloseTo(1.0);
    expect(scores['slowOptimal']).toBeCloseTo(2.0);
    expect(composite[0]).toBe('fastLong');
    expect(compositeScores(perAgent, [], { solutionLength: null })).toEqual({});
  });

  it('falls back to the best finisher path when the solution length is unknown', () => {
    const scores = compositeScores(perAgent, ['slowOptimal', 'fastLong'], { solutionLength: null });
    expect(scores['slowOptimal']).toBeCloseTo(2.0);
    expect(scores['fastLong']).toBeCloseTo(1.0);
  });
});
