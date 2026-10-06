import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories, type FakeRenderer } from '../../test/fakeRenderer';

function renderAt(path: string) {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories };
}

const last = (f: { created: FakeRenderer[] }): FakeRenderer => f.created[f.created.length - 1]!;
type Pose = { cell: number; heading: number; peek: boolean } | null;
const pose = (f: { created: FakeRenderer[] }): Pose => last(f).lastFirstPerson as Pose;

function selectSolver(name: RegExp) {
  return async (user: ReturnType<typeof userEvent.setup>) => {
    const picker = screen.getByRole('group', { name: /^solver$/i });
    await user.click(within(picker).getByRole('radio', { name }));
  };
}

describe('Ride along on /watch', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    usePrefs.getState().set('reducedMotion', 'on');
  });

  it('follows a walking solver in first person, steps back exactly and stops on Escape', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/watch?seed=ride-walk');
    const transport = await screen.findByRole('toolbar', { name: /watch controls/i });
    await selectSolver(/^wall follower/i)(user);
    await waitFor(() =>
      expect(within(transport).getByRole('button', { name: /^play$/i })).toBeEnabled(),
    );

    const tools = screen.getByRole('toolbar', { name: /^maze tools$/i });
    await user.click(within(tools).getByRole('button', { name: /ride along with the solver/i }));
    // First person needs the 3D renderer; the camera stands at the start.
    await waitFor(() => expect(last(factories).kind).toBe('3d'));
    await waitFor(() => expect(pose(factories)).not.toBeNull());
    const start = pose(factories)!;
    expect(start.peek).toBe(false);
    expect(screen.getByTestId('ride-along-bar')).toHaveTextContent(/at the start/i);
    // Camera buttons are hidden in first person.
    expect(within(tools).queryByRole('group', { name: /^camera$/i })).toBeNull();

    const step = within(transport).getByRole('button', { name: /step once/i });
    for (let i = 0; i < 6; i++) await user.click(step);
    await waitFor(() => expect(pose(factories)!.cell).not.toBe(start.cell));
    const after6 = pose(factories)!;
    expect(after6.peek).toBe(false);
    expect(screen.getByTestId('ride-along-bar')).toHaveTextContent(/walking/i);

    await user.click(step);
    await user.click(within(transport).getByRole('button', { name: /step back/i }));
    await waitFor(() => expect(pose(factories)).toEqual(after6));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('ride-along-bar')).toBeNull());
    await waitFor(() => expect(last(factories).kind).toBe('2d'));
  });

  it('glides over the walls with a search solver, then walks the solution to the goal', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/watch?seed=ride-search');
    const transport = await screen.findByRole('toolbar', { name: /watch controls/i });
    await waitFor(() =>
      expect(within(transport).getByRole('button', { name: /^play$/i })).toBeEnabled(),
    );
    await user.keyboard('r');
    await waitFor(() => expect(pose(factories)).not.toBeNull());

    // BFS jumps between cells that are not neighbours: some step must glide (raised camera).
    const step = within(transport).getByRole('button', { name: /step once/i });
    let glided = false;
    for (let i = 0; i < 40 && !glided; i++) {
      await user.click(step);
      glided = pose(factories)?.peek === true;
    }
    expect(glided).toBe(true);

    // Run to the end: with reduced motion the camera goes straight to the goal of the solution.
    await user.click(within(transport).getByRole('button', { name: /run to end/i }));
    await waitFor(() =>
      expect(screen.getByTestId('ride-along-bar')).toHaveTextContent(/at the goal/i),
    );
    const maze = last(factories).lastMaze as { goal: number };
    expect(pose(factories)!.cell).toBe(maze.goal);
    expect(pose(factories)!.peek).toBe(false);
  });
});

describe('Ride along on /play', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    usePrefs.getState().set('mode', '2d');
  });

  it('is offered once a solve runs and ends with the solve', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/play');
    const toolbar = await screen.findByRole('toolbar', { name: /maze controls/i });
    const run = within(toolbar).getByRole('button', { name: /run to end/i });
    await waitFor(() => expect(run).toBeEnabled());
    await user.click(run);
    const tools = screen.getByRole('toolbar', { name: /^maze tools$/i });
    expect(within(tools).queryByRole('button', { name: /ride along/i })).toBeNull();

    await act(async () => {
      await user.click(within(tools).getByRole('button', { name: /^solve with/i }));
    });
    await user.click(
      await within(tools).findByRole('button', { name: /ride along with the solver/i }),
    );
    await waitFor(() => expect(last(factories).kind).toBe('3d'));
    await waitFor(() => expect(pose(factories)).not.toBeNull());
    expect(screen.getByRole('img', { name: /riding along with the solver/i })).toBeInTheDocument();

    await user.click(within(tools).getByRole('button', { name: /^clear solve$/i }));
    await waitFor(() => expect(screen.queryByTestId('ride-along-bar')).toBeNull());
  });
});
