import {
  braid,
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
import { makeSolveBreakpoint, solveBreakpointsFor, type SolveBreakpointId } from './breakpoints';
import { SolveStructureTracker } from './solveStructure';

function maze(generatorId: string, seed: string, w: number, h: number): MazeState {
  return runToEnd(generators.require(generatorId).run(createGrid(w, h), createRng(seed), {}));
}

function braided(seed: string, w: number, h: number): MazeState {
  const base = maze('recursive-backtracker', seed, w, h);
  return runToEnd(braid.run(base, createRng(`${seed}-braid`), { percent: 60 }));
}

const MAZES: [string, MazeState][] = [
  ['prims 12x9', maze('prims', 'bp-1', 12, 9)],
  ['backtracker 14x10', maze('recursive-backtracker', 'bp-2', 14, 10)],
  ['braided 13x9', braided('bp-3', 13, 9)],
];

const ids = (solverId: string) => solveBreakpointsFor(solverId).map((c) => c.id);

/** A player like the app's, with the structure tracker folding its batches (as the hook does). */
function playerFor(solverId: string, m: MazeState) {
  const player = new StepPlayer<SolveStep, SolveResult>({
    source: () => solvers.require(solverId).run(m, {}),
    schedule: () => () => undefined,
  });
  const tracker = new SolveStructureTracker(solverId, m.start, m.goal, cellCount(m.grid));
  player.onReset(() => {
    tracker.reset();
  });
  player.subscribe((b) => {
    tracker.applyBatch(b);
  });
  return { player, tracker };
}

/** Brute force over the full step list: the step count just after the first match past `from`. */
function expected(
  id: SolveBreakpointId,
  solverId: string,
  m: MazeState,
  steps: readonly SolveStep[],
  from: number,
  count: number,
): number | null {
  const sizes = new SolveStructureTracker(solverId, m.start, m.goal, cellCount(m.grid));
  const target = solverId === 'flood-fill' ? m.start : m.goal;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as SolveStep;
    sizes.apply(s);
    if (i < from) continue;
    const hit =
      id === 'frontier'
        ? sizes.frontierSize() > count
        : id === 'goal'
          ? (s.t === 'expand' && s.cell === target) || (s.t === 'move' && s.to === target)
          : s.t === id;
    if (hit) return i + 1;
  }
  return null;
}

describe('solve breakpoints', () => {
  it('offers what each solver can actually hit', () => {
    expect(ids('bfs')).toEqual(['goal', 'frontier', 'path']);
    expect(ids('dfs')).toEqual(['deadend', 'goal', 'frontier', 'path']);
    expect(ids('wall-follower')).toEqual(['goal', 'path']);
    for (const id of solvers.ids) expect(ids(id).length, id).toBeGreaterThan(0);
    expect(solveBreakpointsFor('flood-fill').find((c) => c.id === 'goal')?.label).toBe(
      'it reaches the start',
    );
    expect(solveBreakpointsFor('dfs').find((c) => c.id === 'frontier')?.label).toBe(
      'the stack holds more than N cells',
    );
    expect(solveBreakpointsFor('no-such-solver')).toEqual([]);
  });

  for (const solverId of solvers.ids) {
    it(`${solverId}: every breakpoint stops exactly on its first match`, () => {
      for (const [name, m] of MAZES) {
        const steps = [...solvers.require(solverId).run(m, {})];
        for (const choice of solveBreakpointsFor(solverId)) {
          for (const from of [0, 7, Math.floor(steps.length / 2)]) {
            for (const count of choice.id === 'frontier' ? [2, 6] : [0]) {
              const { player, tracker } = playerFor(solverId, m);
              player.seek(from);
              const bp = makeSolveBreakpoint(choice.id, { solverId, maze: m, tracker, count });
              const hit = player.runUntil(bp.predicate);
              const want = expected(choice.id, solverId, m, steps, from, count);
              const where = `${name} ${choice.id} from ${String(from)} N=${String(count)}`;
              expect(hit?.index ?? null, where).toBe(want);
              expect(player.getSnapshot().stepCount, where).toBe(want ?? steps.length);
              expect(bp.describe(hit), where).toMatch(
                want ? /^Stopped at step \d+: / : /^Ran to the end: /,
              );
            }
          }
        }
      }
    });
  }

  it('says what it stopped on', () => {
    const m = MAZES[0]?.[1] as MazeState;
    const { player, tracker } = playerFor('bfs', m);
    const frontier = makeSolveBreakpoint('frontier', {
      solverId: 'bfs',
      maze: m,
      tracker,
      count: 3,
    });
    expect(frontier.describe(player.runUntil(frontier.predicate))).toMatch(
      /^Stopped at step \d+: the queue holds 4 cells\.$/,
    );
    const goal = makeSolveBreakpoint('goal', { solverId: 'bfs', maze: m, tracker, count: 3 });
    expect(goal.describe(player.runUntil(goal.predicate))).toMatch(
      /^Stopped at step \d+: it reached the goal at row \d+, column \d+\.$/,
    );
    expect(frontier.describe(null)).toBe('Ran to the end: the queue never held more than 3 cells.');
  });

  it('forking the tracker leaves the live structure alone', () => {
    const m = MAZES[1]?.[1] as MazeState;
    const { player, tracker } = playerFor('dfs', m);
    player.step(20);
    const before = tracker.snapshot();
    const fork = tracker.fork();
    expect(fork.snapshot()).toEqual(before);
    for (const s of [...solvers.require('dfs').run(m, {})].slice(20, 40)) fork.apply(s);
    expect(tracker.snapshot()).toEqual(before);
  });
});
