import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { CURRICULUM, locateLesson } from '../../content/learn/curriculum';
import type { Curriculum, LessonContent } from '../../content/learn/types';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { createLearnProgressStore, useLearnProgress } from '../../state/learnProgress';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';
import { LearnIndex } from './LearnIndex';

/** The index alone, in a minimal router (links need router context), with any curriculum. */
function renderIndexWith(curriculum: Curriculum) {
  const rootRoute = createRootRoute({ component: () => <LearnIndex curriculum={curriculum} /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router as unknown as ReturnType<typeof createAppRouter>} />);
}

function renderAt(path: string) {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const view = render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories, router, view };
}

const neverLoaded = (): Promise<LessonContent> => Promise.reject(new Error('not in this test'));

const FAKE: Curriculum = [
  {
    id: 'm1',
    number: 1,
    title: 'Fake basics',
    objectives: ['Know the fake thing'],
    prerequisites: [],
    lessons: [
      { id: 'm1-a', title: 'Lesson A', summary: 'First.', minutes: 5, load: neverLoaded },
      { id: 'm1-b', title: 'Lesson B', summary: 'Second.', minutes: 7, load: neverLoaded },
    ],
  },
  {
    id: 'm2',
    number: 2,
    title: 'A module added only in this test',
    objectives: ['Show up without any UI change'],
    prerequisites: ['m1'],
    lessons: [],
  },
];

describe('Learn', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    useLearnProgress.getState().clear();
  });

  it('builds the index from the curriculum data, so a new module needs no UI change', async () => {
    renderIndexWith(FAKE);
    const modules = await screen.findByRole('list', { name: 'Modules' });
    expect(
      within(modules)
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(['M1 Fake basics', 'M2 A module added only in this test']);
    expect(within(modules).getByText('planned')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lesson B/ })).toHaveAttribute('href', '/learn/m1-b');
    expect(screen.getByText('0 of 2 lessons done.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start with/ })).toHaveAttribute('href', '/learn/m1-a');
  });

  it('lists the real curriculum at /learn', async () => {
    renderAt('/learn');
    const modules = await screen.findByRole('list', { name: 'Modules' }, { timeout: 10_000 });
    expect(within(modules).getAllByRole('heading', { level: 2 })).toHaveLength(CURRICULUM.length);
    expect(within(modules).getAllByText('planned').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Start with/ })).toHaveAttribute(
      'href',
      '/learn/m3-frontier-ring',
    );
  });

  it('locates lessons with neighbours across modules', () => {
    expect(locateLesson('m1-b', FAKE)?.previous?.id).toBe('m1-a');
    expect(locateLesson('m1-a', FAKE)?.next?.id).toBe('m1-b');
    expect(locateLesson('m1-b', FAKE)?.next).toBeNull();
    expect(locateLesson('nope', FAKE)).toBeNull();
    expect(locateLesson('m3-frontier-ring')?.module.id).toBe('m3');
  });

  it('teaches with a live demo: the queue follows the steps forward and back', async () => {
    const user = userEvent.setup();
    renderAt('/learn/m3-frontier-ring');
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'The frontier is a ring' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'M3 BFS & shortest paths',
    );
    const queue = await screen.findByRole('list', { name: 'Queue, front first' });
    expect(within(queue).getAllByRole('listitem')).toHaveLength(1);
    expect(
      within(queue).getByRole('listitem', { name: /^Front, next to expand: row 1/ }),
    ).toBeInTheDocument();

    const tools = screen.getByRole('toolbar', { name: 'Maze tools' });
    await waitFor(() =>
      expect(within(tools).getByRole('button', { name: /step once/i })).toBeEnabled(),
    );
    await user.click(within(tools).getByRole('button', { name: /step once/i }));
    await waitFor(() =>
      expect(screen.getByText(/Last taken from the front:/)).toHaveTextContent('row 1'),
    );
    // The pseudo-code follows: one line is the executing one.
    const code = screen.getByRole('list', { name: /pseudo-code/i });
    expect(within(code).getByText('(executing)')).toBeInTheDocument();

    await user.click(within(tools).getByRole('button', { name: /run to end/i }));
    await waitFor(() =>
      expect(screen.getByText(/Last taken from the front:/)).not.toHaveTextContent(
        /row 1, column 1\b/,
      ),
    );
    // Back to the start: the queue holds only the start cell again.
    await user.click(within(tools).getByRole('button', { name: /restart the demo/i }));
    await waitFor(() => expect(screen.getByText(/Nothing expanded yet/)).toBeInTheDocument());
    expect(
      within(screen.getByRole('list', { name: 'Queue, front first' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });

  it('completes a lesson when its quiz is passed and shows it in the index', async () => {
    const user = userEvent.setup();
    const { view } = renderAt('/learn/m3-frontier-ring');
    await screen.findByRole(
      'heading',
      { level: 1, name: 'The frontier is a ring' },
      { timeout: 10_000 },
    );
    expect(useLearnProgress.getState().lessons['m3-frontier-ring']?.startedAt).toBeTruthy();
    // A lesson with a quiz has no "Mark as done" button: the quiz completes it.
    expect(screen.queryByRole('button', { name: 'Mark as done' })).not.toBeInTheDocument();
    expect(screen.getByText('Pass the quiz to finish')).toBeInTheDocument();
    const quiz = screen.getByRole('form', { name: 'Quiz' });
    for (const answer of [
      'The one at the front of the queue: the earliest found',
      'At most two: some distance d and d + 1',
      'It reaches every cell at its smallest distance first, the goal included',
      'O(V + E)',
    ]) {
      await user.click(within(quiz).getByRole('radio', { name: answer }));
    }
    await user.click(within(quiz).getByRole('button', { name: 'Check answers' }));
    expect(within(quiz).getByRole('status')).toHaveTextContent(
      '4 of 4 correct. Passed: this lesson is complete.',
    );
    expect(useLearnProgress.getState().lessons['m3-frontier-ring']).toMatchObject({
      completedAt: expect.any(String),
      quiz: { best: 4, total: 4, attempts: 1 },
    });
    expect(screen.getByRole('button', { name: /lesson done/i })).toBeInTheDocument();
    view.unmount();

    renderAt('/learn');
    expect(await screen.findByText('1 of 1 lessons done.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /The frontier is a ring.*done/ })).toBeInTheDocument();
  });

  it('runs the demo until a breakpoint and ticks the try-it that asks for it', async () => {
    const user = userEvent.setup();
    renderAt('/learn/m3-frontier-ring');
    const run = await screen.findByRole(
      'button',
      { name: 'Run until it reaches the goal' },
      { timeout: 10_000 },
    );
    await waitFor(() => expect(run).toBeEnabled());
    // Full speed, so the run takes a frame or two.
    screen.getByRole('slider', { name: 'Demo speed' }).focus();
    await user.keyboard('{End}');
    await user.click(run);
    expect(await screen.findByTestId('breakpoint-message')).toHaveTextContent(
      /^Stopped at step \d+: it reached the goal at row \d+, column \d+\.$/,
    );
    const tryIt = screen.getByRole('list', { name: 'Try it' });
    await waitFor(() =>
      expect(useLearnProgress.getState().lessons['m3-frontier-ring']?.tryIts).toContain(
        'reach-goal',
      ),
    );
    expect(
      within(tryIt).getByText(/take(s)? the goal from the front/).parentElement,
    ).toHaveTextContent(/^Done: /);
    expect(
      screen
        .getAllByRole('status')
        .some((s) => /Try it done\..*BFS took the goal/.test(s.textContent ?? '')),
    ).toBe(true);
  });

  it('shows a friendly page for an unknown lesson', async () => {
    renderAt('/learn/no-such-lesson');
    expect(await screen.findByRole('heading', { name: 'Lesson not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all lessons' })).toBeInTheDocument();
  });

  it('keeps only well-formed progress from storage', () => {
    localStorage.setItem(
      'maze-lab:learn',
      JSON.stringify({
        state: {
          lessons: {
            ok: { startedAt: '2026-10-11T00:00:00Z', completedAt: '2026-10-11T00:05:00Z' },
            started: { startedAt: '2026-10-11T00:00:00Z' },
            broken: { completedAt: 5 },
            junk: 'x',
          },
        },
        version: 1,
      }),
    );
    const store = createLearnProgressStore(localStorage);
    expect(Object.keys(store.getState().lessons).sort()).toEqual(['ok', 'started']);
    store.getState().start('ok');
    expect(store.getState().lessons.ok?.startedAt).toBe('2026-10-11T00:00:00Z');
    store.getState().reopen('ok');
    expect(store.getState().lessons.ok?.completedAt).toBeUndefined();
  });
});
