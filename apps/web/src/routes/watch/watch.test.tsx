import { solvers } from '@maze/core';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';

function renderWatch(path = '/watch?seed=watch-test') {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories, router };
}

describe('/watch', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it('lists every solver from the registry and arms the default one on a finished maze', async () => {
    const { factories } = renderWatch();
    await screen.findByRole('toolbar', { name: /watch controls/i });
    const picker = screen.getByRole('group', { name: /solver/i });
    const radios = within(picker).getAllByRole('radio');
    expect(radios).toHaveLength(solvers.all.length);
    expect(within(picker).getByRole('radio', { name: /^breadth-first search/i })).toBeChecked();

    await waitFor(() => expect(factories.created).toHaveLength(1));
    expect(factories.created[0]!.kind).toBe('2d');
    // Generation is drained synchronously, so the canvas label reports a complete maze.
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /maze canvas: 20 by 15 cells/i })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('toolbar', { name: /watch controls/i })).getByRole('button', {
          name: /^play$/i,
        }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole('log', { name: /solver steps/i })).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: /breadth-first search pseudo-code/i }),
    ).toBeInTheDocument();
  });

  it('runs BFS to completion, shows the path length and highlights pseudo-code', async () => {
    const user = userEvent.setup();
    renderWatch();
    await screen.findByRole('toolbar', { name: /watch controls/i });
    const run = within(await screen.findByRole('toolbar', { name: /watch controls/i })).getByRole(
      'button',
      { name: /run to end/i },
    );
    await waitFor(() => expect(run).toBeEnabled());
    await user.click(run);

    const stats = screen.getByLabelText(/solver statistics/i);
    await waitFor(() =>
      expect(within(stats).getAllByText(/\d+ moves/).length).toBeGreaterThanOrEqual(2),
    );
    // Path length equals the shortest solution reported for the maze.
    const pathCell = within(stats).getAllByText(/\d+ moves/);
    expect(pathCell.length).toBeGreaterThanOrEqual(2);
    expect(pathCell[0]!.textContent).toBe(pathCell[pathCell.length - 1]!.textContent);

    const log = screen.getByRole('log', { name: /solver steps/i });
    expect(within(log).getAllByRole('listitem').length).toBeGreaterThan(1);
    expect(within(log).getByText(/path found with \d+ moves/i)).toBeInTheDocument();
    // After 'done' no line is current; the status is announced.
    expect(screen.getByRole('status')).toHaveTextContent(/solved with breadth-first search/i);
    // Solver-relative metrics: BFS is optimal, so its path is 1.00x the shortest.
    expect(within(stats).getByText('1.00x')).toBeInTheDocument();
    expect(within(stats).getByText(/^\d+%$/)).toBeInTheDocument();
  });

  it('shows the solver parameters and re-arms the solve when one changes', async () => {
    const user = userEvent.setup();
    usePrefs.getState().set('solverId', 'random-mouse');
    renderWatch();
    const toolbar = await screen.findByRole('toolbar', { name: /watch controls/i });
    const params = screen.getByRole('region', { name: /random mouse parameters/i });
    const step = within(toolbar).getByRole('button', { name: /step once/i });
    await waitFor(() => expect(step).toBeEnabled());
    await user.click(step);
    const log = screen.getByRole('log', { name: /solver steps/i });
    await waitFor(() => expect(within(log).getAllByRole('listitem').length).toBeGreaterThan(0));

    await user.click(within(params).getByRole('switch'));
    expect(usePrefs.getState().algoParams['random-mouse']).toEqual({ noBacktrack: false });
    // The new parameters re-arm the solve from step 0, so the log starts over.
    await waitFor(() => expect(within(log).getByText(/no steps yet/i)).toBeInTheDocument());
    await waitFor(() => expect(step).toBeEnabled());
    expect(within(toolbar).getByRole('button', { name: /step back/i })).toBeDisabled();
  });

  it('switches solver, re-arms it and filters the log by verbosity', async () => {
    const user = userEvent.setup();
    renderWatch();
    await screen.findByRole('toolbar', { name: /watch controls/i });
    const picker = screen.getByRole('group', { name: /solver/i });
    await waitFor(() =>
      expect(
        within(screen.getByRole('toolbar', { name: /watch controls/i })).getByRole('button', {
          name: /^play$/i,
        }),
      ).toBeEnabled(),
    );

    await user.click(within(picker).getByRole('radio', { name: /depth-first/i }));
    expect(usePrefs.getState().solverId).toBe('dfs');
    expect(
      await screen.findByRole('list', { name: /depth-first search pseudo-code/i }),
    ).toBeInTheDocument();

    const step = within(screen.getByRole('toolbar', { name: /watch controls/i })).getByRole(
      'button',
      { name: /step once/i },
    );
    await waitFor(() => expect(step).toBeEnabled());
    await user.click(step);
    await user.click(step);
    const log = screen.getByRole('log', { name: /solver steps/i });
    await waitFor(() =>
      expect(within(log).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2),
    );
    const current = screen
      .getByRole('list', { name: /pseudo-code/i })
      .querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();

    await user.click(screen.getByRole('radio', { name: /expansions only/i }));
    const coarse = within(log).getAllByRole('listitem');
    expect(coarse.length).toBeLessThanOrEqual(2);
  });
});
