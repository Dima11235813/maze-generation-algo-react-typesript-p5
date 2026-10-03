import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { runRaceToEnd, solverName } from '../../maze/race';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';
import { bestColumns } from './raceView';

const URL =
  '/race?seed=rtl-race&agents=bfs,dfs,astar&scoring=first-to-goal&size=12&gen=recursive-backtracker';

function renderRace(path = URL) {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories, router };
}

describe('/race', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it('mounts one renderer per racer and ranks them after run to end', async () => {
    const user = userEvent.setup();
    const { factories } = renderRace();
    await screen.findByRole('toolbar', { name: /race controls/i });

    await waitFor(() => expect(screen.getAllByTestId('race-lane')).toHaveLength(3));
    await waitFor(() => expect(factories.created).toHaveLength(3));
    expect(factories.created.every((r) => r.kind === '2d')).toBe(true);
    for (const name of ['Breadth-First Search', 'Depth-First Search']) {
      expect(screen.getByRole('region', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    // Every lane renderer shows the same maze and its own solve overlay.
    await waitFor(() => expect(factories.created.every((r) => r.lastMaze !== null)).toBe(true));
    const solves = new Set(factories.created.map((r) => r.lastSolve));
    expect(solves.size).toBe(3);

    expect(screen.queryByRole('table', { name: /final ranking/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run to end/i }));

    const ranking = await screen.findByRole('table', { name: /final ranking/i });
    const expected = runRaceToEnd({
      seed: 'rtl-race',
      generatorId: 'recursive-backtracker',
      agents: ['bfs', 'dfs', 'astar'],
      scoring: 'first-to-goal',
      size: 12,
    });
    const rows = within(ranking).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(
      expected.ranking.map(solverName),
    );
    const winner = solverName(expected.ranking[0]!);
    expect(within(ranking).getByText((t) => t.startsWith(`Winner: ${winner}`))).toBeInTheDocument();
    expect(screen.getByTestId('race-status')).toHaveTextContent(`Winner: ${winner}`);
    // The winning lane's name ends in "(winner)" (jsdom drops the space before the hidden text).
    expect(
      screen.getByRole('region', { name: (n) => n.startsWith(winner) && n.endsWith('(winner)') }),
    ).toBeInTheDocument();
  });

  it('steps back and restarts through the shared transport', async () => {
    const user = userEvent.setup();
    renderRace();
    const step = await screen.findByRole('button', { name: /step once/i });
    await waitFor(() => expect(step).toBeEnabled());
    await user.click(step);
    await user.click(step);
    const standings = screen.getByRole('table', { name: /live standings/i });
    expect(screen.getByTestId('race-status')).toHaveTextContent('Tick 2');
    await user.click(screen.getByRole('button', { name: /step back/i }));
    expect(screen.getByTestId('race-status')).toHaveTextContent('Tick 1');
    expect(within(standings).getAllByText('Racing')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /restart race/i }));
    expect(screen.getByTestId('race-status')).toHaveTextContent(/start line/);
  });

  it('keeps between two and four racers and puts the choice in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderRace('/race?seed=pick&agents=bfs,astar');
    const racers = await screen.findByRole('group', { name: /racers/i });
    const bfs = within(racers).getByRole('checkbox', { name: /^breadth-first search/i });
    const astar = within(racers).getByRole('checkbox', { name: /^a\* search/i });
    expect(bfs).toBeChecked();
    // Two racers is the minimum: neither can be removed.
    expect(bfs).toBeDisabled();
    expect(astar).toBeDisabled();

    await user.click(within(racers).getByRole('checkbox', { name: /^depth-first search/i }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ agents: 'bfs,astar,dfs' }),
    );
    await waitFor(() => expect(screen.getAllByTestId('race-lane')).toHaveLength(3));
    expect(router.state.location.search).toMatchObject({
      seed: 'pick',
      scoring: 'first-to-goal',
      size: '20',
    });
  });
});

describe('bestColumns', () => {
  it('stacks two lanes on a tall phone stage and sets them side by side on a wide one', () => {
    expect(bestColumns(2, 380, 560)).toBe(1);
    expect(bestColumns(2, 900, 500)).toBe(2);
  });

  it('does not flip on a near tie (phone stage losing a few pixels of height)', () => {
    expect(bestColumns(2, 372, 450)).toBe(1);
    expect(bestColumns(2, 372, 430)).toBe(1);
  });

  it('makes a 2 x 2 grid for four lanes unless the stage is very wide', () => {
    expect(bestColumns(4, 380, 560)).toBe(2);
    expect(bestColumns(4, 900, 800)).toBe(2);
    expect(bestColumns(4, 1800, 400)).toBe(4);
  });
});
