/**
 * Engine benchmarks (backlog S2.9; budgets in proj-mgmt/03 section 12).
 *
 *   pnpm --filter @maze/core bench
 *
 * Two layers:
 * 1. A throughput table (steps per second) printed once when the file loads, measured with
 *    `performance.now()` over a fixed amount of work, with SOFT targets that only warn
 *    (machine variance must never fail CI).
 * 2. Vitest 5 benchmarks (`bench` is a test-context fixture; `bench.compare` runs a group
 *    and prints the latency/throughput table) for ops/sec trend tracking.
 */
import { describe, test } from 'vitest';
import {
  GenerationTracker,
  bfs,
  cellCount,
  collect,
  createGrid,
  createRng,
  encodeDocumentSync,
  recursiveBacktracker,
  runToEnd,
  type GenStep,
  type MazeState,
} from '../src';

const SEED = 'bench-2026';

function makeMaze(side: number): MazeState {
  return runToEnd(recursiveBacktracker.run(createGrid(side, side), createRng(SEED)));
}

/** Median wall time (ms) of `fn` over `rounds` rounds after one warm-up. */
function measureMs(fn: () => void, rounds = 5): number {
  fn();
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? 0;
}

interface Row {
  benchmark: string;
  work: string;
  ms: number;
  throughput: string;
  softTarget: string;
  status: 'ok' | 'below target';
}

function row(
  benchmark: string,
  units: number,
  unitName: string,
  ms: number,
  softPerSecond: number,
): Row {
  const perSecond = ms > 0 ? (units / ms) * 1000 : Number.POSITIVE_INFINITY;
  return {
    benchmark,
    work: `${units.toLocaleString()} ${unitName}`,
    ms: +ms.toFixed(2),
    throughput: `${Math.round(perSecond).toLocaleString()} ${unitName}/s`,
    softTarget: `${softPerSecond.toLocaleString()} ${unitName}/s`,
    status: perSecond >= softPerSecond ? 'ok' : 'below target',
  };
}

// ---- throughput table (runs once at load) ----------------------------------------------------
{
  const rows: Row[] = [];

  const grid100 = createGrid(100, 100);
  const gen100 = collect(recursiveBacktracker.run(grid100, createRng(SEED)));
  rows.push(
    row(
      'recursive backtracker 100x100',
      gen100.steps.length,
      'steps',
      measureMs(() => runToEnd(recursiveBacktracker.run(grid100, createRng(SEED)))),
      1_000_000,
    ),
  );

  const grid500 = createGrid(500, 500);
  const gen500Steps = 4 * cellCount(grid500) - 3; // visit+carve+backtrack per cell, roughly
  rows.push(
    row(
      'recursive backtracker 500x500',
      gen500Steps,
      'steps',
      measureMs(() => runToEnd(recursiveBacktracker.run(grid500, createRng(SEED))), 3),
      1_000_000,
    ),
  );

  const maze500 = makeMaze(500);
  const bfsSteps = collect(bfs.run(maze500)).steps.length;
  rows.push(
    row('bfs 500x500', bfsSteps, 'steps', measureMs(() => runToEnd(bfs.run(maze500)), 3), 1_000_000),
  );

  const steps100: GenStep[] = gen100.steps;
  rows.push(
    row(
      'GenerationTracker.apply 100x100',
      steps100.length,
      'steps',
      measureMs(() => {
        const t = new GenerationTracker(grid100);
        for (const s of steps100) t.apply(s);
      }),
      5_000_000,
    ),
  );

  rows.push(
    row(
      'encodeDocumentSync 500x500',
      cellCount(grid500),
      'cells',
      measureMs(() => encodeDocumentSync(maze500)),
      5_000_000,
    ),
  );

  console.table(rows);
  const slow = rows.filter((r) => r.status !== 'ok');
  if (slow.length > 0) {
    console.warn(
      `[bench] ${slow.length} benchmark(s) below the soft target on this machine: ${slow
        .map((r) => r.benchmark)
        .join(', ')}`,
    );
  }
}

// ---- vitest benchmarks (ops/sec trend) --------------------------------------------------------
const RUN = { time: 300, iterations: 3, warmupTime: 50, warmupIterations: 1 } as const;

describe('generation', () => {
  const g100 = createGrid(100, 100);
  const g500 = createGrid(500, 500);
  test('recursive backtracker', async ({ bench }) => {
    await bench.compare(
      bench('recursive backtracker 100x100', () => {
        runToEnd(recursiveBacktracker.run(g100, createRng(SEED)));
      }),
      bench('recursive backtracker 500x500', () => {
        runToEnd(recursiveBacktracker.run(g500, createRng(SEED)));
      }),
      RUN,
    );
  });
});

describe('solving', () => {
  const maze = makeMaze(500);
  test('bfs', async ({ bench }) => {
    await bench('bfs 500x500', () => {
      runToEnd(bfs.run(maze));
    }).run(RUN);
  });
});

describe('trackers and serialization', () => {
  const grid = createGrid(100, 100);
  const steps = collect(recursiveBacktracker.run(grid, createRng(SEED))).steps;
  const maze = makeMaze(500);
  test('tracker and document', async ({ bench }) => {
    await bench.compare(
      bench('GenerationTracker.applyAll 100x100', () => {
        new GenerationTracker(grid).applyAll(steps);
      }),
      bench('encodeDocumentSync 500x500', () => {
        encodeDocumentSync(maze);
      }),
      RUN,
    );
  });
});
