import { createGrid, describeGenStep, describeSolveStep, type GenStep, type SolveStep } from '@maze/core';
import { createNarrator, type NarratorVerbosity, type Politeness } from '../src';

const grid = createGrid(10, 10);

function setup(verbosity: NarratorVerbosity, extra: Partial<Parameters<typeof createNarrator>[0]> = {}) {
  const spoken: Array<[string, Politeness]> = [];
  const narrator = createNarrator({
    grid,
    describeGen: describeGenStep,
    describeSolve: describeSolveStep,
    speak: (text, politeness) => spoken.push([text, politeness]),
    verbosity,
    maxPerSecond: 4, // 250 ms gap
    ...extra,
  });
  return { narrator, spoken, texts: () => spoken.map(([t]) => t) };
}

const visit = (cell: number): GenStep => ({ t: 'visit', cell });
const carve = (from: number, to: number): GenStep => ({ t: 'carve', from, to });
const back = (from: number, to: number): GenStep => ({ t: 'backtrack', from, to });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('narrator verbosity', () => {
  it('off speaks nothing and logs nothing', () => {
    const { narrator, spoken } = setup('off');
    narrator.handleGenSteps([visit(0), carve(0, 1), { t: 'done' }]);
    narrator.handleSolveSteps([{ t: 'path', cells: [0, 1] }]);
    narrator.say('hello');
    vi.advanceTimersByTime(5000);
    expect(spoken).toEqual([]);
    expect(narrator.getLog()).toEqual([]);
  });

  it('low speaks only milestones and periodic backtrack summaries', () => {
    const { narrator, texts } = setup('low', { backtrackSummaryEvery: 10 });
    const steps: GenStep[] = [];
    for (let i = 0; i < 12; i++) steps.push(visit(i), carve(i, i + 1));
    for (let i = 12; i > 0; i--) steps.push(visit(i), back(i, i - 1));
    steps.push({ t: 'done' });
    narrator.handleGenSteps(steps);
    vi.advanceTimersByTime(5000);
    expect(texts()).toEqual([
      'Backtracked 10 times so far.',
      'Maze generation complete: 13 cells, 12 backtracks.',
    ]);
    // No per-step chatter and no progress summaries at low verbosity.
    narrator.handleSolveSteps([
      { t: 'expand', cell: 0, g: 0 },
      { t: 'discover', cell: 1, from: 0, g: 1 },
      { t: 'expand', cell: 1, g: 1 },
      { t: 'path', cells: [0, 1] },
      { t: 'done', stats: { expanded: 2, discovered: 2, frontierPeak: 1, pathLength: 1, optimal: true, steps: 5 } },
    ]);
    vi.advanceTimersByTime(5000);
    expect(texts().at(-1)).toBe('Path found with 1 moves after exploring 2 cells.');
    expect(texts()).toHaveLength(3);
  });

  it('medium adds a progress summary about once a second while steps flow', () => {
    const { narrator, texts } = setup('medium', { progressIntervalMs: 1000 });
    narrator.handleGenSteps([visit(0), carve(0, 1), visit(1), carve(1, 2), visit(2)]);
    expect(texts()).toEqual([]);
    vi.advanceTimersByTime(999);
    expect(texts()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(texts()).toEqual(['Visited 3 of 100 cells, depth 2.']);
    // Idle: no further summaries until more steps arrive.
    vi.advanceTimersByTime(3000);
    expect(texts()).toHaveLength(1);
    narrator.handleGenSteps([carve(2, 3), visit(3)]);
    vi.advanceTimersByTime(1000);
    expect(texts()).toEqual(['Visited 3 of 100 cells, depth 2.', 'Visited 4 of 100 cells, depth 3.']);
    // Solve progress uses explored/frontier wording.
    narrator.handleGenSteps([{ t: 'done' }]);
    narrator.handleSolveSteps([
      { t: 'expand', cell: 0, g: 0 },
      { t: 'discover', cell: 1, from: 0, g: 1 },
      { t: 'discover', cell: 10, from: 0, g: 1 },
    ]);
    vi.advanceTimersByTime(1000);
    expect(texts().at(-1)).toBe('Explored 1 cells, 2 on the frontier.');
  });

  it('high speaks individual steps but rate-limits and coalesces the rest', () => {
    const { narrator, texts } = setup('high');
    const steps: GenStep[] = [visit(0)];
    for (let i = 0; i < 20; i++) steps.push(carve(i, i + 1), visit(i + 1));
    narrator.handleGenSteps(steps);
    // The first sentence goes out immediately; everything else waits for the gap.
    expect(texts()).toEqual(['Visiting row 1, column 1.']);
    vi.advanceTimersByTime(249);
    expect(texts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(texts()).toHaveLength(2);
    expect(texts()[1]).toBe('Visiting row 3, column 1. ...and 39 more steps.');
    // Nothing more pending.
    vi.advanceTimersByTime(2000);
    expect(texts()).toHaveLength(2);
    // Steady stream: at most maxPerSecond sentences per second.
    const t0 = texts().length;
    for (let s = 0; s < 40; s++) {
      narrator.handleGenSteps([visit(s % 100)]);
      vi.advanceTimersByTime(25);
    }
    vi.advanceTimersByTime(250);
    expect(texts().length - t0).toBeLessThanOrEqual(5);
    expect(texts().length - t0).toBeGreaterThanOrEqual(4);
  });
});

describe('narrator mechanics', () => {
  it('milestones bypass the rate limit and drop pending chatter', () => {
    const { narrator, spoken } = setup('high');
    narrator.handleGenSteps([visit(0), visit(1), visit(2)]);
    expect(spoken).toHaveLength(1);
    narrator.handleGenSteps([{ t: 'done' }]);
    expect(spoken).toHaveLength(2);
    expect(spoken[1]?.[0]).toBe('Maze generation complete: 1 cells, 0 backtracks.');
    vi.advanceTimersByTime(1000);
    expect(spoken).toHaveLength(2); // pending visit was dropped, not spoken later
  });

  it('flush speaks whatever is pending right away', () => {
    const { narrator, texts } = setup('high');
    narrator.handleGenSteps([visit(0), visit(1)]);
    expect(texts()).toHaveLength(1);
    narrator.flush();
    expect(texts()).toEqual(['Visiting row 1, column 1.', 'Visiting row 1, column 2.']);
    narrator.flush(); // no-op when nothing is pending
    expect(texts()).toHaveLength(2);
  });

  it('say() supports immediate and assertive messages', () => {
    const { narrator, spoken } = setup('low');
    narrator.say('Reached the goal!', 'assertive', true);
    narrator.say('Saved.', 'polite');
    expect(spoken).toEqual([['Reached the goal!', 'assertive']]);
    vi.advanceTimersByTime(250);
    expect(spoken).toEqual([
      ['Reached the goal!', 'assertive'],
      ['Saved.', 'polite'],
    ]);
  });

  it('setVerbosity(off) drops pending sentences; log notifies listeners and is bounded', () => {
    const { narrator, texts } = setup('high', { logCapacity: 5 });
    let notified = 0;
    const off = narrator.onLog(() => notified++);
    narrator.handleGenSteps([visit(0), visit(1)]);
    narrator.setVerbosity('off');
    vi.advanceTimersByTime(1000);
    expect(texts()).toHaveLength(1);
    narrator.setVerbosity('low');
    for (let i = 0; i < 8; i++) narrator.say(`m${i}`, 'polite', true);
    const log = narrator.getLog();
    expect(log).toHaveLength(5);
    expect(log.map((e) => e.text)).toEqual(['m3', 'm4', 'm5', 'm6', 'm7']);
    expect(log[0]?.id).toBeLessThan(log[4]?.id ?? 0);
    expect(log[0]?.step).toBe(2);
    expect(notified).toBe(9);
    off();
    narrator.clearLog();
    expect(narrator.getLog()).toEqual([]);
    expect(notified).toBe(9);
    narrator.dispose();
    narrator.say('after dispose', 'polite', true);
    expect(texts()).toHaveLength(9);
  });

  it('solve steps describe failures', () => {
    const { narrator, texts } = setup('low');
    const steps: SolveStep[] = [{ t: 'expand', cell: 0 }, { t: 'fail' }];
    narrator.handleSolveSteps(steps);
    expect(texts()).toEqual(['No path exists.']);
  });
});
