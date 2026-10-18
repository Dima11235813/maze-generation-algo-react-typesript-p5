import {
  cellCount,
  createGrid,
  createRng,
  generators,
  openNeighbors,
  runToEnd,
  type GenStep,
  type Grid,
  type MazeState,
} from '@maze/core';
import { StepPlayer } from '@maze/player';
import { describe, expect, it } from 'vitest';
import { genBreakpointsFor, makeGenBreakpoint, type GenBreakpointId } from './genBreakpoints';
import { GenStructureTracker } from './genStructure';

const ids = (generatorId: string) => genBreakpointsFor(generatorId).map((c) => c.id);

const RUNS: [string, number, number, Record<string, unknown>][] = [
  ['gbp-1', 10, 7, {}],
  ['gbp-2', 13, 9, { start: 40 }],
  ['gbp-3', 6, 11, { start: 65 }],
];

/** A player like the app's, with the structure tracker folding its batches (as the hook does). */
function playerFor(generatorId: string, grid: Grid, seed: string, params: Record<string, unknown>) {
  const player = new StepPlayer<GenStep, MazeState>({
    source: () => generators.require(generatorId).run(grid, createRng(seed), params),
    schedule: () => () => undefined,
  });
  const tracker = new GenStructureTracker(generatorId, cellCount(grid));
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
  id: GenBreakpointId,
  steps: readonly GenStep[],
  from: number,
  count: number,
  cells: number,
): number | null {
  const sizes = new GenStructureTracker('recursive-backtracker', cells);
  // Prim's frontier and Kruskal's pieces, counted here without the models.
  const frontier = new Set<number>();
  let unions = 0;
  let carves = 0;
  let lastMove: GenStep | null = null;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as GenStep;
    sizes.apply(s);
    if (s.t === 'frontier') {
      for (const c of s.remove ?? []) frontier.delete(c);
      for (const c of s.add ?? []) frontier.add(c);
    }
    if (s.t === 'union') unions++;
    if (s.t === 'carve') carves++;
    const previous = lastMove;
    if (s.t !== 'visit') lastMove = s;
    if (i < from) continue;
    const hit =
      id === 'stack'
        ? sizes.stackSize() > count
        : id === 'frontier'
          ? frontier.size > count
          : id === 'pieces'
            ? cells - unions <= count
            : id === 'remaining'
              ? cells - 1 - carves <= count
              : id === 'erase'
                ? s.t === 'walk' && (s.erased?.length ?? 0) > 0
                : id === 'deadend'
                  ? s.t === 'backtrack' && previous?.t === 'carve'
                  : s.t === id;
    if (hit) return i + 1;
  }
  return null;
}

const COUNTS: Partial<Record<GenBreakpointId, readonly number[]>> = {
  stack: [5, 15],
  frontier: [4, 10],
  pieces: [30, 5],
  remaining: [30, 3],
};

describe('generator breakpoints', () => {
  it('offers what each generator can actually hit', () => {
    expect(ids('recursive-backtracker')).toEqual(['backtrack', 'deadend', 'stack', 'done']);
    expect(ids('prims')).toEqual(['frontier', 'done']);
    expect(ids('kruskals')).toEqual(['union', 'reject', 'pieces', 'done']);
    expect(ids('aldous-broder')).toEqual(['carve', 'remaining', 'done']);
    expect(ids('wilsons')).toEqual(['erase', 'carve', 'remaining', 'done']);
    expect(ids('binary-tree')).toEqual(['done']);
    for (const id of generators.ids) expect(ids(id), id).toContain('done');
    expect(genBreakpointsFor('recursive-backtracker').find((c) => c.id === 'stack')?.label).toBe(
      'the stack holds more than N cells',
    );
    expect(genBreakpointsFor('no-such-generator')).toEqual([]);
  });

  it.each(['recursive-backtracker', 'prims', 'kruskals', 'aldous-broder', 'wilsons'])(
    '%s: every breakpoint stops exactly on its first match',
    (generatorId) => {
      for (const [seed, w, h, rawParams] of RUNS) {
        const grid = createGrid(w, h);
        const params = generatorId === 'recursive-backtracker' ? rawParams : {};
        const steps = [...generators.require(generatorId).run(grid, createRng(seed), params)];
        for (const choice of genBreakpointsFor(generatorId)) {
          const id = choice.id as GenBreakpointId;
          for (const from of [0, 9, Math.floor(steps.length / 2)]) {
            for (const count of COUNTS[id] ?? [0]) {
              const { player, tracker } = playerFor(generatorId, grid, seed, params);
              player.seek(from);
              const bp = makeGenBreakpoint(id, { grid, tracker, count });
              const hit = player.runUntil(bp.predicate);
              const want = expected(id, steps, from, count, cellCount(grid));
              const where = `${generatorId} ${seed} ${id} from ${String(from)} N=${String(count)}`;
              expect(hit?.index ?? null, where).toBe(want);
              expect(player.getSnapshot().stepCount, where).toBe(want ?? steps.length);
              expect(bp.describe(hit), where).toMatch(
                want ? /^Stopped at step \d+: / : /^Ran to the end: /,
              );
            }
          }
        }
      }
    },
  );

  it('"stuck in a new dead end" finds every dead end of the finished maze but the start', () => {
    for (const [seed, w, h, params] of RUNS) {
      const grid = createGrid(w, h);
      const { player, tracker } = playerFor('recursive-backtracker', grid, seed, params);
      const stuckAt = new Set<number>();
      for (;;) {
        const hit = player.runUntil(
          makeGenBreakpoint('deadend', { grid, tracker, count: 0 }).predicate,
        );
        if (!hit) break;
        if (hit.step.t === 'backtrack') stuckAt.add(hit.step.from);
      }
      const finished = runToEnd(
        generators.require('recursive-backtracker').run(grid, createRng(seed), params),
      );
      const deadEnds = new Set<number>();
      for (let c = 0; c < cellCount(grid); c++) {
        if (c !== finished.start && openNeighbors(finished, c).length === 1) deadEnds.add(c);
      }
      expect(stuckAt, seed).toEqual(deadEnds);
    }
  });

  it('says what it stopped on', () => {
    const grid = createGrid(10, 7);
    const { player, tracker } = playerFor('recursive-backtracker', grid, 'gbp-1', {});
    const back = makeGenBreakpoint('backtrack', { grid, tracker, count: 0 });
    expect(back.describe(player.runUntil(back.predicate))).toMatch(
      /^Stopped at step \d+: it backs up from row \d+, column \d+ to row \d+, column \d+, \d+ cells left on the stack\.$/,
    );
    const stuck = makeGenBreakpoint('deadend', { grid, tracker, count: 0 });
    expect(stuck.describe(player.runUntil(stuck.predicate))).toMatch(
      /^Stopped at step \d+: stuck at row \d+, column \d+, a new dead end, so it backs up to row \d+, column \d+\.$/,
    );
    const stack = makeGenBreakpoint('stack', { grid, tracker, count: 900 });
    expect(stack.describe(player.runUntil(stack.predicate))).toBe(
      'Ran to the end: the stack never held more than 900 cells.',
    );
    expect(player.getStatus()).toBe('done');
  });

  it('forking the tracker leaves the live structure alone', () => {
    const grid = createGrid(10, 7);
    const { player, tracker } = playerFor('recursive-backtracker', grid, 'gbp-1', {});
    player.step(30);
    const before = tracker.snapshot();
    const fork = tracker.fork();
    expect(fork.snapshot()).toEqual(before);
    expect(fork.lastMove()).toEqual(tracker.lastMove());
    const steps = [
      ...generators.require('recursive-backtracker').run(grid, createRng('gbp-1'), {}),
    ];
    for (const s of steps.slice(30, 60)) fork.apply(s);
    expect(tracker.snapshot()).toEqual(before);
  });

  it('says what Kruskal and Prim stopped on', () => {
    const grid = createGrid(10, 7);
    const k = playerFor('kruskals', grid, 'gbp-1', {});
    const union = makeGenBreakpoint('union', { grid, tracker: k.tracker, count: 0 });
    expect(union.describe(k.player.runUntil(union.predicate))).toMatch(
      /^Stopped at step 1: row \d+, column \d+ and row \d+, column \d+ were in different pieces, so they are joined; 69 pieces left\.$/,
    );
    const kept = makeGenBreakpoint('reject', { grid, tracker: k.tracker, count: 0 });
    expect(kept.describe(k.player.runUntil(kept.predicate))).toMatch(
      /^Stopped at step \d+: the wall between row \d+, column \d+ and row \d+, column \d+ stays: they are already in one piece\.$/,
    );
    const ten = makeGenBreakpoint('pieces', { grid, tracker: k.tracker, count: 10 });
    expect(ten.describe(k.player.runUntil(ten.predicate))).toMatch(
      /^Stopped at step \d+: 10 pieces are left\.$/,
    );
    const p = playerFor('prims', grid, 'gbp-1', {});
    const wide = makeGenBreakpoint('frontier', { grid, tracker: p.tracker, count: 8 });
    expect(wide.describe(p.player.runUntil(wide.predicate))).toMatch(
      /^Stopped at step \d+: the frontier holds 9 cells\.$/,
    );
  });
});
