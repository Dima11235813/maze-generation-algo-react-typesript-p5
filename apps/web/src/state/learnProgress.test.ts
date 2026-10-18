import { beforeEach, describe, expect, it } from 'vitest';
import { createLearnProgressStore, lessonStatus } from './learnProgress';

describe('Learn progress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a passed quiz completes the lesson; a failed one only counts the attempt', () => {
    const store = createLearnProgressStore(localStorage);
    const s = () => store.getState();
    s().start('l1');
    s().recordQuiz('l1', 2, 4, false);
    expect(lessonStatus(s().lessons.l1)).toBe('started');
    expect(s().lessons.l1?.quiz).toEqual({ best: 2, total: 4, attempts: 1 });
    s().recordQuiz('l1', 4, 4, true);
    expect(lessonStatus(s().lessons.l1)).toBe('done');
    const doneAt = s().lessons.l1?.completedAt;
    // A worse retry keeps the best score and the original completion time.
    s().recordQuiz('l1', 3, 4, true);
    expect(s().lessons.l1?.quiz).toEqual({ best: 4, total: 4, attempts: 3 });
    expect(s().lessons.l1?.completedAt).toBe(doneAt);
    // Reopening keeps the quiz record.
    s().reopen('l1');
    expect(lessonStatus(s().lessons.l1)).toBe('started');
    expect(s().lessons.l1?.quiz?.best).toBe(4);
  });

  it('records each try-it check once, even before the lesson was started', () => {
    const store = createLearnProgressStore(localStorage);
    const s = () => store.getState();
    s().completeTryIt('l2', 'a');
    s().completeTryIt('l2', 'a');
    s().completeTryIt('l2', 'b');
    expect(s().lessons.l2?.tryIts).toEqual(['a', 'b']);
    expect(s().lessons.l2?.startedAt).toBeTruthy();
  });

  it('survives a reload and drops malformed quiz and try-it records', () => {
    const store = createLearnProgressStore(localStorage);
    store.getState().recordQuiz('l3', 3, 4, true);
    store.getState().completeTryIt('l3', 'x');
    const reloaded = createLearnProgressStore(localStorage);
    expect(reloaded.getState().lessons.l3).toMatchObject({
      quiz: { best: 3, total: 4, attempts: 1 },
      tryIts: ['x'],
    });

    localStorage.setItem(
      'maze-lab:learn',
      JSON.stringify({
        state: {
          lessons: {
            bad: {
              startedAt: '2026-10-18T00:00:00Z',
              quiz: { best: -1, total: 4, attempts: 1 },
              tryIts: ['ok', 7, null],
            },
            capped: { startedAt: '2026-10-18T00:00:00Z', quiz: { best: 9, total: 4, attempts: 2 } },
          },
        },
        version: 1,
      }),
    );
    const cleaned = createLearnProgressStore(localStorage).getState().lessons;
    expect(cleaned.bad).toEqual({ startedAt: '2026-10-18T00:00:00Z', tryIts: ['ok'] });
    expect(cleaned.capped?.quiz).toEqual({ best: 4, total: 4, attempts: 2 });
  });
});
