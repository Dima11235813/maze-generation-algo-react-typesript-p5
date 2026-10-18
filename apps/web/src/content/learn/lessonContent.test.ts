import {
  cellCount,
  createGrid,
  createRng,
  generators,
  runToEnd,
  solvers,
  type MazeState,
  type SolveResult,
  type SolveStep,
} from '@maze/core';
import { StepPlayer } from '@maze/player';
import { describe, expect, it } from 'vitest';
import { makeSolveBreakpoint } from '../../learn/breakpoints';
import { SolveStructureTracker } from '../../learn/solveStructure';
import { CURRICULUM } from './curriculum';
import type { DemoSpec, DemoState, LessonContent } from './types';

const LESSONS = CURRICULUM.flatMap((m) => m.lessons);

/** The lesson's demo outside React: its maze, a paused BFS player and the live structure. */
function demoRig(spec: DemoSpec) {
  const maze: MazeState = runToEnd(
    generators
      .require(spec.generatorId)
      .run(createGrid(spec.width, spec.height), createRng(spec.seed), {}),
  );
  const player = new StepPlayer<SolveStep, SolveResult>({
    source: () => solvers.require(spec.solverId).run(maze, {}),
    schedule: () => () => undefined,
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
  });
  return { maze, player, tracker, state };
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
    },
  );

  it('M3.1: every try-it can be done in its demo, with the breakpoints it suggests', async () => {
    const info = LESSONS.find((l) => l.id === 'm3-frontier-ring');
    const lesson = await info?.load();
    if (!lesson?.tryIt) throw new Error('the pilot lesson has try-it checks');
    const check = (id: string) => {
      const c = lesson.tryIt?.find((t) => t.id === id);
      if (!c) throw new Error(id);
      return c;
    };
    const { maze, player, tracker, state } = demoRig(lesson.demo);
    const solverId = lesson.demo.solverId;

    // Nothing passes at step 0.
    for (const c of lesson.tryIt) expect(c.check(state()), c.id).toBe(false);

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
});
