import {
  ALL_WALLS,
  applyGenStep,
  cellCount,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  generators,
  openNeighbors,
  runToEnd,
  solutionLength,
  solvers,
  type GenStep,
  type MazeState,
  type SolveResult,
  type SolveStep,
} from '@maze/core';
import { StepPlayer } from '@maze/player';
import { describe, expect, it } from 'vitest';
import { makeSolveBreakpoint } from '../../learn/breakpoints';
import { makeGenBreakpoint } from '../../learn/genBreakpoints';
import { GenStructureTracker } from '../../learn/genStructure';
import { GraphDemoModel, cutOffCells, graphDemoMaze } from '../../learn/graphDemo';
import { PairDemoModel, pairBreakpointCatalogue } from '../../learn/pairDemo';
import { SolveStructureTracker } from '../../learn/solveStructure';
import { CURRICULUM } from './curriculum';
import type {
  GraphDemoSpec,
  PairDemoSpec,
  DemoState,
  GenerateDemoSpec,
  LessonContent,
  SolveDemoSpec,
  TryItCheck,
} from './types';

const LESSONS = CURRICULUM.flatMap((m) => m.lessons);
const paused = () => () => undefined;

/** A solve demo outside React: its maze, a paused solver player and the live structure. */
function solveRig(spec: SolveDemoSpec) {
  const maze: MazeState = runToEnd(
    generators
      .require(spec.generatorId)
      .run(createGrid(spec.width, spec.height), createRng(spec.seed), {}),
  );
  const player = new StepPlayer<SolveStep, SolveResult>({
    source: () => solvers.require(spec.solverId).run(maze, {}),
    schedule: paused,
  });
  const tracker = new SolveStructureTracker(
    spec.solverId,
    maze.start,
    maze.goal,
    cellCount(maze.grid),
  );
  let lastStep: SolveStep | null = null;
  player.onReset(() => {
    tracker.reset();
    lastStep = null;
  });
  player.subscribe((b) => {
    tracker.applyBatch(b);
    lastStep = b[b.length - 1] ?? lastStep;
  });
  const state = (): DemoState => ({
    status: player.getStatus(),
    stepCount: player.getSnapshot().stepCount,
    lastStep,
    maze,
    structure: tracker.snapshot(),
    genStructure: null,
    graph: null,
    pair: null,
  });
  return { maze, player, tracker, state };
}

/** A generate demo outside React: live walls carved by a paused generator player. */
function genRig(spec: GenerateDemoSpec) {
  const grid = createGrid(spec.width, spec.height);
  const walls = createWalls(grid);
  const maze = createMazeState(grid, walls, 0, cellCount(grid) - 1);
  const player = new StepPlayer<GenStep, MazeState>({
    source: () => generators.require(spec.generatorId).run(grid, createRng(spec.seed), {}),
    schedule: paused,
  });
  const tracker = new GenStructureTracker(spec.generatorId, cellCount(grid));
  let lastStep: GenStep | null = null;
  player.onReset(() => {
    tracker.reset();
    walls.fill(ALL_WALLS);
    lastStep = null;
  });
  player.subscribe((b) => {
    for (const s of b) applyGenStep(walls, grid, s);
    tracker.applyBatch(b);
    lastStep = b[b.length - 1] ?? lastStep;
  });
  const state = (): DemoState => ({
    status: player.getStatus(),
    stepCount: player.getSnapshot().stepCount,
    lastStep,
    maze,
    structure: null,
    genStructure: tracker.snapshot(),
    graph: null,
    pair: null,
  });
  return { grid, maze, player, tracker, state };
}

/** A graph demo outside React: the edit model and the state the page derives from it. */
function graphRig(spec: GraphDemoSpec) {
  const model = new GraphDemoModel(graphDemoMaze(spec));
  const state = (): DemoState => {
    const s = model.getSnapshot();
    return {
      status: null,
      stepCount: s.edits,
      lastStep: null,
      maze: s.state,
      structure: null,
      genStructure: null,
      graph: {
        stats: s.stats,
        selected: s.selected,
        degree: s.selected === null ? null : openNeighbors(s.state, s.selected).length,
        edits: s.edits,
      },
      pair: null,
    };
  };
  /** Neighbouring pairs with a wall between them (each once). */
  const walls = (): [number, number][] => {
    const m = model.getSnapshot().state;
    const out: [number, number][] = [];
    for (let c = 0; c < cellCount(m.grid); c++) {
      const right = c % m.grid.width < m.grid.width - 1 ? c + 1 : -1;
      const below = c + m.grid.width < cellCount(m.grid) ? c + m.grid.width : -1;
      for (const nb of [right, below]) {
        if (nb >= 0 && !openNeighbors(m, c).includes(nb)) out.push([c, nb]);
      }
    }
    return out;
  };
  return { model, state, walls };
}

/** A pair demo outside React: the lockstep model and the state the page derives from it. */
function pairRig(spec: PairDemoSpec) {
  const model = new PairDemoModel(spec, { schedule: paused });
  const state = (): DemoState => ({
    status: model.player.getStatus(),
    stepCount: model.player.getSnapshot().stepCount,
    lastStep: null,
    maze: model.maze,
    structure: null,
    genStructure: null,
    graph: null,
    pair: { lanes: model.lanes(), shortest: model.shortest },
  });
  return { model, state };
}

function pairSpec(lesson: LessonContent): PairDemoSpec {
  if (lesson.demo.kind !== 'pair') throw new Error('a pair demo');
  return lesson.demo;
}

function graphSpec(lesson: LessonContent): GraphDemoSpec {
  if (lesson.demo.kind !== 'graph') throw new Error('a graph demo');
  return lesson.demo;
}

async function load(id: string): Promise<LessonContent> {
  const lesson = await LESSONS.find((l) => l.id === id)?.load();
  if (!lesson?.tryIt) throw new Error(`${id} has try-it checks`);
  return lesson;
}

function checkOf(lesson: LessonContent, id: string): TryItCheck {
  const c = lesson.tryIt?.find((t) => t.id === id);
  if (!c) throw new Error(id);
  return c;
}

function solveSpec(lesson: LessonContent): SolveDemoSpec {
  if (lesson.demo.kind !== 'solve') throw new Error('a solve demo');
  return lesson.demo;
}

function genSpec(lesson: LessonContent): GenerateDemoSpec {
  if (lesson.demo.kind !== 'generate') throw new Error('a generate demo');
  return lesson.demo;
}

describe('lesson content', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))(
    '%s: quiz and checks are well formed',
    async (_id, info) => {
      const lesson: LessonContent = await info.load();
      const quiz = lesson.quiz;
      if (quiz) {
        expect(quiz.questions.length).toBeGreaterThan(0);
        expect(new Set(quiz.questions.map((q) => q.id)).size).toBe(quiz.questions.length);
        for (const q of quiz.questions) {
          expect(q.choices[q.answer], q.id).toBeDefined();
          expect(new Set(q.choices).size, q.id).toBe(q.choices.length);
        }
        expect(quiz.passMark ?? 0).toBeLessThanOrEqual(quiz.questions.length);
      }
      const ids = (lesson.tryIt ?? []).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      const demo = lesson.demo;
      expect(generators.get(demo.generatorId), demo.generatorId).toBeDefined();
      if (demo.kind === 'solve') expect(solvers.get(demo.solverId), demo.solverId).toBeDefined();
    },
  );

  it('M3.1: every try-it can be done in its demo, with the breakpoints it suggests', async () => {
    const lesson = await load('m3-frontier-ring');
    const check = (id: string) => checkOf(lesson, id);
    const { maze, player, tracker, state } = solveRig(solveSpec(lesson));
    const solverId = solveSpec(lesson).solverId;

    // Nothing passes at step 0.
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    const past6 = makeSolveBreakpoint('frontier', { solverId, maze, tracker, count: 6 });
    expect(player.runUntil(past6.predicate)).not.toBeNull();
    expect(check('queue-past-six').check(state())).toBe(true);
    expect(check('queue-past-six').success(state())).toMatch(
      /^The queue holds 7 cells, from distance \d+ to \d+\.$/,
    );

    player.restart();
    let steps = 0;
    while (!check('two-rings').check(state()) && steps++ < 50) player.step();
    expect(check('two-rings').check(state())).toBe(true);

    const goal = makeSolveBreakpoint('goal', { solverId, maze, tracker, count: 0 });
    expect(player.runUntil(goal.predicate)).not.toBeNull();
    expect(check('reach-goal').check(state())).toBe(true);
    expect(check('reach-goal').success(state())).toMatch(/^BFS took the goal at distance \d+/);
    // One more step and the goal is no longer the step just taken.
    player.step();
    expect(check('reach-goal').check(state())).toBe(false);
  });

  it('M2.1: every try-it can be done with the generator breakpoints', async () => {
    const lesson = await load('m2-backtracker');
    const check = (id: string) => checkOf(lesson, id);
    const { grid, maze, player, tracker, state } = genRig(genSpec(lesson));
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    const backtrack = makeGenBreakpoint('backtrack', { grid, tracker, count: 0 });
    expect(player.runUntil(backtrack.predicate)).not.toBeNull();
    expect(check('first-backtrack').check(state())).toBe(true);
    expect(check('first-backtrack').success(state())).toMatch(
      /^It backed up from row \d+, column \d+; the stack holds \d+ cells, the current one on top\.$/,
    );

    // Backing out of a junction is a backtrack but not a new dead end.
    let junction = false;
    for (let i = 0; i < 100 && !junction; i++) {
      const next = makeGenBreakpoint('backtrack', { grid, tracker, count: 0 });
      expect(player.runUntil(next.predicate)).not.toBeNull();
      const s = state().lastStep;
      junction = s?.t === 'backtrack' && openNeighbors(maze, s.from).length > 1;
    }
    expect(junction).toBe(true);
    expect(check('stuck').check(state())).toBe(false);

    const stuck = makeGenBreakpoint('deadend', { grid, tracker, count: 0 });
    expect(player.runUntil(stuck.predicate)).not.toBeNull();
    expect(check('stuck').check(state())).toBe(true);

    player.restart();
    const deep = makeGenBreakpoint('stack', { grid, tracker, count: 20 });
    const hit = player.runUntil(deep.predicate);
    expect(deep.describe(hit)).toMatch(/^Stopped at step \d+: the stack holds 21 cells\.$/);
    expect(check('deep-stack').check(state())).toBe(true);

    const done = makeGenBreakpoint('done', { grid, tracker, count: 0 });
    expect(player.runUntil(done.predicate)).not.toBeNull();
    expect(check('complete').check(state())).toBe(true);
    expect(check('complete').success(state())).toBe(
      'The maze is complete: 70 cells joined by 69 passages, one fewer, as in every tree.',
    );
  });

  it('M2.2: every try-it can be done with the DFS breakpoints', async () => {
    const lesson = await load('m2-dfs-dives');
    const check = (id: string) => checkOf(lesson, id);
    const spec = solveSpec(lesson);
    const { maze, player, tracker, state } = solveRig(spec);
    const ctx = { solverId: spec.solverId, maze, tracker, count: 5 };
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    expect(player.runUntil(makeSolveBreakpoint('deadend', ctx).predicate)).not.toBeNull();
    expect(check('dead-end').check(state())).toBe(true);
    expect(check('dead-end').success(state())).toMatch(/^DFS hit a dead end at row \d+/);

    player.restart();
    expect(player.runUntil(makeSolveBreakpoint('frontier', ctx).predicate)).not.toBeNull();
    expect(check('stack-past-five').check(state())).toBe(true);

    expect(player.runUntil(makeSolveBreakpoint('goal', ctx).predicate)).not.toBeNull();
    expect(check('reach-goal').check(state())).toBe(true);
    expect(check('reach-goal').success(state())).toMatch(
      /^DFS reached the goal after expanding \d+ cells\.$/,
    );
  });

  it('M1.1: every try-it can be done by selecting cells and editing walls', async () => {
    const lesson = await load('m1-maze-is-graph');
    const check = (id: string) => checkOf(lesson, id);
    const { model, state, walls } = graphRig(graphSpec(lesson));
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    const m = model.getSnapshot().state;
    const cells = [...Array(cellCount(m.grid)).keys()];
    model.select(cells.find((c) => openNeighbors(m, c).length >= 3) ?? null);
    expect(check('junction').check(state())).toBe(true);
    expect(check('junction').success(state())).toMatch(
      /^Row \d+, column \d+ has degree [34]: [34] passages meet there\.$/,
    );
    model.select(cells.find((c) => openNeighbors(m, c).length === 1) ?? null);
    expect(check('dead-end').check(state())).toBe(true);
    expect(check('junction').check(state())).toBe(false);

    const [a, b] = walls()[0] ?? [0, 1];
    model.toggleWall(a, b);
    expect(check('loop').check(state())).toBe(true);
    expect(check('loop').success(state())).toBe(
      '1 loop: some cells now have two different routes between them.',
    );
    model.reset();
    const leaf = cells.find((c) => c !== m.start && openNeighbors(m, c).length === 1) ?? 0;
    model.toggleWall(leaf, openNeighbors(m, leaf)[0] ?? 0);
    expect(check('split').check(state())).toBe(true);
    expect(check('loop').check(state())).toBe(false);
  });

  it('M1.2: the cut maze can be joined back into one tree, then given one loop', async () => {
    const lesson = await load('m1-perfect-trees');
    const check = (id: string) => checkOf(lesson, id);
    const { model, state, walls } = graphRig(graphSpec(lesson));
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);
    expect(state().graph?.stats).toMatchObject({ cells: 35, passages: 32, pieces: 3, loops: 0 });

    /** A wall with a cut-off cell on exactly one side joins two pieces. */
    const joining = () => {
      const cut = new Set(cutOffCells(model.getSnapshot().state));
      const found = walls().find(([a, b]) => cut.has(a) !== cut.has(b));
      if (!found) throw new Error('no joining wall');
      return found;
    };
    model.toggleWall(...joining());
    expect(check('two-pieces').check(state())).toBe(true);
    expect(check('two-pieces').success(state())).toBe(
      'Two pieces left and still no loop: 33 passages for 35 cells.',
    );
    model.toggleWall(...joining());
    expect(check('tree').check(state())).toBe(true);
    expect(check('tree').success(state())).toBe(
      'A tree: 35 cells joined by 34 passages, one fewer.',
    );
    expect(check('one-more').check(state())).toBe(false);
    model.toggleWall(...(walls()[0] ?? [0, 1]));
    expect(check('one-more').check(state())).toBe(true);
    expect(check('tree').check(state())).toBe(false);
  });

  it('M3.2: the flood reaches the start, covers the maze, and the walk goes downhill', async () => {
    const lesson = await load('m3-distance-map');
    const check = (id: string) => checkOf(lesson, id);
    const spec = solveSpec(lesson);
    const { maze, player, tracker, state } = solveRig(spec);
    const ctx = { solverId: spec.solverId, maze, tracker, count: 0 };
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    expect(player.runUntil(makeSolveBreakpoint('goal', ctx).predicate)).not.toBeNull();
    expect(check('reach-start').check(state())).toBe(true);
    const d = solutionLength(maze);
    expect(check('reach-start').success(state())).toBe(
      `The flood reached the start at distance ${String(d)}: the shortest path has ${String(d)} moves.`,
    );
    expect(player.runUntil(makeSolveBreakpoint('path', ctx).predicate)).not.toBeNull();
    expect(check('map-complete').check(state())).toBe(true);
    expect(check('downhill').check(state())).toBe(false);
    player.runToEnd();
    expect(check('downhill').check(state())).toBe(true);
    expect(check('downhill').success(state())).toBe(
      `The walk took ${String(d)} moves, from ${String(d)} at the start down to 0 at the goal.`,
    );
  });

  it('M3.3: DFS finds a path first and a longer one; BFS finds the shortest', async () => {
    const lesson = await load('m3-dfs-or-bfs');
    const check = (id: string) => checkOf(lesson, id);
    const { model, state } = pairRig(pairSpec(lesson));
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);
    const next = () =>
      model.player.runUntil(pairBreakpointCatalogue(model).make('path', 0).predicate);

    expect(next()).not.toBeNull();
    expect(check('first-path').check(state())).toBe(true);
    expect(check('first-path').success(state())).toBe(
      'Depth-First Search found its path first, 26 moves long, after 75 steps.',
    );
    expect(check('both-paths').check(state())).toBe(false);
    expect(next()).not.toBeNull();
    expect(check('both-paths').check(state())).toBe(true);
    expect(check('both-paths').success(state())).toBe(
      'Breadth-First Search 16 moves, Depth-First Search 26 moves; the shortest possible is 16.',
    );
    // With both paths found, "first" cannot be read off the state any more.
    expect(check('first-path').check(state())).toBe(false);
  });

  it("M4.1: Prim's frontier passes 10, the tree reaches half, then the whole grid", async () => {
    const lesson = await load('m4-prim-grows');
    const check = (id: string) => checkOf(lesson, id);
    const { grid, player, tracker, state } = genRig(genSpec(lesson));
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    const wide = makeGenBreakpoint('frontier', { grid, tracker, count: 10 });
    expect(player.runUntil(wide.predicate)).not.toBeNull();
    expect(check('frontier-past-ten').check(state())).toBe(true);
    expect(check('frontier-past-ten').success(state())).toMatch(
      /^The frontier holds 1[1-4] cells around a tree of \d+\.$/,
    );
    let guard = 0;
    while (!check('half').check(state()) && guard++ < 500) player.step();
    expect(check('half').check(state())).toBe(true);
    const done = makeGenBreakpoint('done', { grid, tracker, count: 0 });
    expect(player.runUntil(done.predicate)).not.toBeNull();
    expect(check('complete').check(state())).toBe(true);
    expect(check('complete').success(state())).toMatch(
      /^All 70 cells are in the tree; the frontier was at most \d+ cells\.$/,
    );
  });

  it("M4.2: Kruskal's keeps a wall, gets down to 10 pieces, then one", async () => {
    const lesson = await load('m4-kruskal-joins');
    const check = (id: string) => checkOf(lesson, id);
    const { grid, player, tracker, state } = genRig(genSpec(lesson));
    for (const c of lesson.tryIt ?? []) expect(c.check(state()), c.id).toBe(false);

    expect(
      player.runUntil(makeGenBreakpoint('reject', { grid, tracker, count: 0 }).predicate),
    ).not.toBeNull();
    expect(check('first-kept').check(state())).toBe(true);
    expect(check('first-kept').success(state())).toMatch(
      /^The wall between row \d+, column \d+ and row \d+, column \d+ stays: they are already in one piece\.$/,
    );
    expect(
      player.runUntil(makeGenBreakpoint('pieces', { grid, tracker, count: 10 }).predicate),
    ).not.toBeNull();
    expect(check('ten-pieces').check(state())).toBe(true);
    expect(check('ten-pieces').success(state())).toBe('10 pieces left after 60 unions.');
    expect(
      player.runUntil(makeGenBreakpoint('done', { grid, tracker, count: 0 }).predicate),
    ).not.toBeNull();
    expect(check('complete').check(state())).toBe(true);
    expect(check('complete').success(state())).toMatch(
      /^One piece: 69 unions for 70 cells, and \d+ walls kept along the way\.$/,
    );
  });
});
