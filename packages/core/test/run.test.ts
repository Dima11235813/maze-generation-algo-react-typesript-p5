import fc from 'fast-check';
import {
  RUN_MOVES,
  createGrid,
  createRng,
  decodeRun,
  encodeRun,
  generators,
  hintCells,
  initialPose,
  recordMove,
  redoRun,
  replayRun,
  runCells,
  runToEnd,
  seekRun,
  shortestPath,
  solutionLength,
  startRun,
  summarizeRun,
  undoRun,
  dirBetween,
  hasWall,
  type MazeState,
  type RunMove,
  type RunState,
} from '../src';

const gridArb = fc.record({
  width: fc.integer({ min: 2, max: 10 }),
  height: fc.integer({ min: 2, max: 10 }),
});
const movesArb = fc.array(fc.constantFrom(...RUN_MOVES), { maxLength: 80 });

function maze(width: number, height: number, seed: string): MazeState {
  return runToEnd(
    generators.require('recursive-backtracker').run(createGrid(width, height), createRng(seed), {}),
  );
}

function play(state: MazeState, moves: readonly RunMove[]): RunState {
  let run = startRun(state);
  for (const m of moves) run = recordMove(state, run, m);
  return run;
}

describe('run model', () => {
  it('only walks through open passages and counts steps, not turns', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), movesArb, ({ width, height }, seed, moves) => {
        const state = maze(width, height, seed);
        let run = startRun(state);
        for (const m of moves) {
          const next = recordMove(state, run, m);
          if (next !== run && next.pose.cell !== run.pose.cell) {
            const d = dirBetween(state.grid, run.pose.cell, next.pose.cell);
            expect(d).toBeDefined();
            expect(hasWall(state.walls, run.pose.cell, d!)).toBe(false);
            expect(next.moves).toBe(run.moves + 1);
          }
          run = next;
        }
        expect(run.cursor).toBe(run.history.length);
        expect(run.moves + run.turns).toBe(run.history.length);
      }),
      { numRuns: 60 },
    );
  });

  it('replaying the history gives the same run (saved runs and rewinds are exact)', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), movesArb, ({ width, height }, seed, moves) => {
        const state = maze(width, height, seed);
        const run = play(state, moves);
        expect(replayRun(state, run.history)).toEqual(run);
        expect(replayRun(state, decodeRun(encodeRun(run)))).toEqual(run);
      }),
      { numRuns: 60 },
    );
  });

  it('undo then redo returns to the same run; a new move after undo drops the redo tail', () => {
    fc.assert(
      fc.property(
        gridArb,
        fc.string(),
        movesArb,
        fc.integer({ min: 0, max: 20 }),
        ({ width, height }, seed, moves, k) => {
          const state = maze(width, height, seed);
          const run = play(state, moves);
          const back = undoRun(state, run, k);
          expect(back.cursor).toBe(Math.max(0, run.cursor - k));
          expect(back.history).toEqual(run.history);
          expect(redoRun(state, back, k)).toEqual(run);
          // Rewinding to any point equals playing only that prefix.
          const prefix = play(state, run.history.slice(0, back.cursor));
          expect(back.pose).toEqual(prefix.pose);
          expect(back.moves).toBe(prefix.moves);
          const branched = recordMove(state, back, 'L');
          expect(branched.history.length).toBe(back.cursor + 1);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('following the shortest path finishes with a perfect efficiency', () => {
    fc.assert(
      fc.property(gridArb, fc.string(), ({ width, height }, seed) => {
        const state = maze(width, height, seed);
        const path = shortestPath(state, state.start, state.goal)!;
        const compass: RunMove[] = [];
        for (let i = 0; i + 1 < path.length; i++) {
          compass.push(
            (['N', 'E', 'S', 'W'] as const)[dirBetween(state.grid, path[i]!, path[i + 1]!)!],
          );
        }
        const run = play(state, compass);
        expect(run.finished).toBe(state.start === state.goal || run.pose.cell === state.goal);
        expect(run.moves).toBe(solutionLength(state));
        const summary = summarizeRun(state, run, { timeMs: 1234, hints: 0, undos: 0 });
        if (run.moves > 0) expect(summary.efficiency).toBe(1);
        expect(runCells(state, run.history)).toEqual(path);
      }),
      { numRuns: 40 },
    );
  });

  it('hints are the next cells of the shortest path from where you stand', () => {
    const state = maze(8, 6, 'hint');
    const pose = initialPose(state);
    const path = shortestPath(state, pose.cell, state.goal)!;
    expect(hintCells(state, pose.cell, 4)).toEqual(path.slice(1, 5));
    expect(hintCells(state, state.goal, 3)).toEqual([]);
  });

  it('rejects text that is not a run and clamps seeks', () => {
    expect(() => decodeRun('FFX')).toThrow(SyntaxError);
    const state = maze(5, 5, 'seek');
    const run = play(state, ['F', 'F', 'R', 'F']);
    expect(seekRun(state, run, 99).cursor).toBe(run.history.length);
    expect(seekRun(state, run, -3).cursor).toBe(0);
  });
});
