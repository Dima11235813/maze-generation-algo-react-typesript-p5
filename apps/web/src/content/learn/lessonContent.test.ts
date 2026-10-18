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
import { SolveStructureTracker } from '../../learn/solveStructure';
import { CURRICULUM } from './curriculum';
import type {
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
  });
  return { grid, maze, player, tracker, state };
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
});
