import { dirBetween, hintCells, initialPose, type MazeState } from '@maze/core';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { useLibrary } from '../../state/library';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories, type FakeRenderer } from '../../test/fakeRenderer';

function renderPlay() {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/play'] }));
  render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories };
}

const last = (f: { created: FakeRenderer[] }): FakeRenderer => f.created[f.created.length - 1]!;

const KEYS = ['{ArrowUp}', '{ArrowRight}', '{ArrowDown}', '{ArrowLeft}'] as const;

/** Arrow keys that walk the shortest way from the start to the goal. */
function keysToGoal(state: MazeState): string {
  const from = initialPose(state).cell;
  const cells = [from, ...hintCells(state, from, 100_000)];
  let out = '';
  for (let i = 0; i + 1 < cells.length; i++)
    out += KEYS[dirBetween(state.grid, cells[i]!, cells[i + 1]!)!];
  return out;
}

async function readyMaze(user: ReturnType<typeof userEvent.setup>) {
  const result = renderPlay();
  const toolbar = await screen.findByRole('toolbar', { name: /maze controls/i });
  await waitFor(() => expect(result.factories.created).toHaveLength(1));
  // At full speed generation may already be over (then "Run to end" stays disabled).
  const run = within(toolbar).getByRole('button', { name: /run to end/i });
  if (!(run as HTMLButtonElement).disabled) await user.click(run);
  await waitFor(() =>
    expect(screen.getByRole('img', { name: /maze canvas: .* complete/i })).toBeInTheDocument(),
  );
  return result;
}

describe('Run Maze as a game', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    usePrefs.getState().patch({ mode: '2d', speed: 100_000 });
    useLibrary.getState().clear();
  });

  it(
    'walks the maze from above with the keyboard, undoes, hints, finishes and saves the run',
    { timeout: 20_000 },
    async () => {
      const user = userEvent.setup();
      const { factories } = await readyMaze(user);
      const maze = last(factories).lastMaze as MazeState;

      await user.keyboard('k');
      const bar = await screen.findByTestId('run-bar');
      expect(last(factories).kind).toBe('2d');
      expect(within(bar).getByTestId('run-moves')).toHaveTextContent('0');
      expect(within(bar).getByText(/shortest \d+/)).toBeInTheDocument();

      // Hint: the next cells of the shortest way are drawn as a path.
      await user.keyboard('h');
      await waitFor(() =>
        expect(
          (last(factories).lastSolve as { path: number[] | null } | null)?.path?.length,
        ).toBeGreaterThan(1),
      );

      const keys = keysToGoal(maze);
      const first = keys.slice(0, keys.indexOf('}') + 1);
      await user.keyboard(first);
      expect(within(bar).getByTestId('run-moves')).toHaveTextContent('1');
      await user.keyboard('u');
      expect(within(bar).getByTestId('run-moves')).toHaveTextContent('0');
      await user.keyboard('U'); // redo
      expect(within(bar).getByTestId('run-moves')).toHaveTextContent('1');

      await user.keyboard(keys.slice(first.length));
      const summary = await screen.findByTestId('run-summary');
      expect(summary).toHaveTextContent(/Goal! .* moves \(shortest \d+\), 100% efficient/);
      // Reaching the goal is a milestone: it is announced assertively.
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/You reached the goal in/),
      );

      await user.click(within(summary).getByRole('button', { name: /save run/i }));
      await waitFor(() => expect(useLibrary.getState().items).toHaveLength(1), { timeout: 4_000 });
      const item = useLibrary.getState().items[0]!;
      expect(item.runs).toHaveLength(1);
      expect(item.runs![0]).toMatchObject({ view: '2d', undos: 1, hints: 1 });
    },
  );

  it('replays the best saved run from the library', { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    const { factories } = await readyMaze(user);
    const maze = last(factories).lastMaze as MazeState;
    await user.keyboard('k');
    await user.keyboard(keysToGoal(maze));
    const summary = await screen.findByTestId('run-summary');
    await user.click(within(summary).getByRole('button', { name: /save run/i }));
    await waitFor(() => expect(useLibrary.getState().items).toHaveLength(1), { timeout: 4_000 });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('run-bar')).toBeNull());

    const toolbar = screen.getByRole('toolbar', { name: /maze controls/i });
    await user.click(within(toolbar).getByRole('button', { name: /^library$/i }));
    const sheet = await screen.findByRole('dialog', { name: /library/i });
    expect(within(sheet).getByText(/1 run · best \d+ moves/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: /replay the best run/i }));

    const bar = await screen.findByTestId('run-bar');
    expect(within(bar).getByText(/replaying a saved run/i)).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: /^stop$/i }));
    await waitFor(() => expect(within(bar).queryByText(/replaying a saved run/i)).toBeNull());
  });

  describe('on a touch screen', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('max-width') || query.includes('coarse'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }));
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows a D-pad below the maze in the 2D walk and it moves the player', async () => {
      const user = userEvent.setup();
      const { factories } = await readyMaze(user);
      const maze = last(factories).lastMaze as MazeState;
      const tools = screen.getByRole('toolbar', { name: /^maze tools$/i });
      await user.click(within(tools).getByRole('button', { name: /walk the maze from above/i }));
      const bar = await screen.findByTestId('run-bar');
      const pad = within(bar).getByRole('group', { name: /movement controls/i });
      const first = keysToGoal(maze).slice(0, keysToGoal(maze).indexOf('}') + 1);
      const label = {
        '{ArrowUp}': /move up/i,
        '{ArrowRight}': /move right/i,
        '{ArrowDown}': /move down/i,
        '{ArrowLeft}': /move left/i,
      }[first]!;
      await user.click(within(pad).getByRole('button', { name: label }));
      expect(within(bar).getByTestId('run-moves')).toHaveTextContent('1');
    });
  });
});
