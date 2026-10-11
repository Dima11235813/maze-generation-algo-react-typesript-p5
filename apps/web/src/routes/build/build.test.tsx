import {
  Dir,
  decodeDocument,
  encodeDocument,
  hasWall,
  neighbor,
  passageCount,
  type MazeState,
} from '@maze/core';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { useLibrary } from '../../state/library';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories, type FakeRenderer } from '../../test/fakeRenderer';

function renderBuild(path = '/build') {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories, router };
}

const last = (f: { created: FakeRenderer[] }): FakeRenderer => f.created[f.created.length - 1]!;
const mazeOf = (f: { created: FakeRenderer[] }): MazeState => last(f).lastMaze as MazeState;

/** A closed inner wall (cell, direction) in the maze. */
function closedWall(state: MazeState): { cell: number; dir: Dir } {
  for (let cell = 0; cell < state.walls.length; cell++) {
    for (const dir of [Dir.E, Dir.S]) {
      if (neighbor(state.grid, cell, dir) >= 0 && hasWall(state.walls, cell, dir))
        return { cell, dir };
    }
  }
  throw new Error('no closed wall');
}

/** Simulates a tap the 2D renderer reports, `at` inside the cell. */
function tap(f: { created: FakeRenderer[] }, cell: number, fx: number, fy: number) {
  act(() => {
    last(f).events.onCellClick?.(cell, new MouseEvent('pointerup') as PointerEvent, { fx, fy });
  });
}

async function ready() {
  const result = renderBuild();
  await screen.findByRole('toolbar', { name: /build controls/i });
  await waitFor(() => expect(result.factories.created.length).toBeGreaterThan(0));
  await waitFor(() => expect(mazeOf(result.factories)).toBeTruthy());
  return result;
}

describe('/build', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    useLibrary.getState().clear();
  });

  it('starts from a valid generated maze in the 2D editor', async () => {
    const { factories } = await ready();
    expect(last(factories).kind).toBe('2d');
    expect(screen.getByText(/a perfect maze/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /walls tool/i })).toBeChecked();
    expect(
      screen.getByRole('img', { name: /maze being edited: 15 by 10 cells, valid/i }),
    ).toBeInTheDocument();
  });

  it('a tap near a wall toggles it; validation follows; undo and redo restore it', async () => {
    const user = userEvent.setup();
    const { factories } = await ready();
    const before = mazeOf(factories);
    const { cell, dir } = closedWall(before);
    tap(factories, cell, dir === Dir.E ? 0.95 : 0.5, dir === Dir.S ? 0.95 : 0.5);
    await waitFor(() => expect(passageCount(mazeOf(factories))).toBe(passageCount(before) + 1));
    expect(screen.getByText(/contains loops/i)).toBeInTheDocument();

    // A tap in the middle of a cell only moves the cursor.
    tap(factories, cell, 0.5, 0.5);
    expect(passageCount(mazeOf(factories))).toBe(passageCount(before) + 1);

    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    await waitFor(() =>
      expect(Array.from(mazeOf(factories).walls)).toEqual(Array.from(before.walls)),
    );
    expect(screen.getByText(/a perfect maze/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^redo$/i }));
    await waitFor(() => expect(passageCount(mazeOf(factories))).toBe(passageCount(before) + 1));
  });

  it('the keyboard cursor moves, toggles walls with Shift+arrow and places start and goal', async () => {
    const user = userEvent.setup();
    const { factories } = await ready();
    const status = screen.getByTestId('build-status');
    const start = mazeOf(factories).start;
    expect(status).toHaveTextContent(/cursor: row 1, column 1 \(start\)/i);
    await user.keyboard('{ArrowRight}');
    expect(status).toHaveTextContent(/cursor: row 1, column 2/i);
    const p = passageCount(mazeOf(factories));
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await waitFor(() => expect(passageCount(mazeOf(factories))).not.toBe(p));
    await user.keyboard('g');
    await waitFor(() => expect(mazeOf(factories).goal).toBe(start + 1));
    await user.keyboard('s');
    expect(screen.getByText(/start and goal are the same cell/i)).toBeInTheDocument();
    await user.keyboard('u');
    await waitFor(() => expect(screen.queryByText(/start and goal are the same cell/i)).toBeNull());
  });

  it('validation issues move the cursor to the problem; closing every wall is one undo', async () => {
    const user = userEvent.setup();
    const { factories } = await ready();
    await user.click(screen.getByRole('button', { name: /close every wall/i }));
    const issues = await screen.findByRole('list', { name: /validation issues/i });
    const goalIssue = within(issues).getByRole('button', { name: /goal cannot be reached/i });
    await user.click(goalIssue);
    const goal = mazeOf(factories).goal;
    const w = mazeOf(factories).grid.width;
    expect(screen.getByTestId('build-status')).toHaveTextContent(
      new RegExp(
        `row ${String(Math.floor(goal / w) + 1)}, column ${String((goal % w) + 1)} \\(goal\\)`,
        'i',
      ),
    );
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(await screen.findByText(/a perfect maze/i)).toBeInTheDocument();
  });

  // Three saves, each waiting out the thumbnail timeout in jsdom (no image decoding there).
  it(
    'saves to the library, reloads identically, saves over the item and as a copy',
    { timeout: 20_000 },
    async () => {
      const user = userEvent.setup();
      const { factories, router } = await ready();
      await user.click(screen.getByRole('radio', { name: /goal tool/i }));
      tap(factories, 3, 0.5, 0.5);
      await waitFor(() => expect(mazeOf(factories).goal).toBe(3));
      const edited = mazeOf(factories);

      await user.click(screen.getByRole('button', { name: /^save$/i }));
      const dialog = await screen.findByRole('dialog');
      const name = within(dialog).getByRole('textbox');
      await user.clear(name);
      await user.type(name, 'My edit');
      await user.click(within(dialog).getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(useLibrary.getState().items).toHaveLength(1), { timeout: 4_000 });
      const item = useLibrary.getState().items[0]!;
      expect(item.name).toBe('My edit');
      expect(router.state.location.search).toMatchObject({ item: item.id });
      const reloaded = decodeDocument(item.document);
      expect(Array.from(reloaded.walls)).toEqual(Array.from(edited.walls));
      expect(reloaded.goal).toBe(3);

      // Saving again updates the same item; "Save as a copy" adds one.
      tap(factories, 4, 0.5, 0.5);
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: /^save$/i }),
      );
      await waitFor(
        () => expect(decodeDocument(useLibrary.getState().items[0]!.document).goal).toBe(4),
        {
          timeout: 4_000,
        },
      );
      expect(useLibrary.getState().items).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: /save as a copy/i }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: /^save$/i }),
      );
      await waitFor(() => expect(useLibrary.getState().items).toHaveLength(2), { timeout: 4_000 });
    },
  );

  it('imports a maze from JSON and explains a bad file', async () => {
    const user = userEvent.setup();
    const { factories } = await ready();
    const doc = await encodeDocument(mazeOf(factories), { meta: { name: 'Imported one' } });
    const small = { ...doc };
    const input = screen.getByLabelText(/import a maze/i);
    await user.upload(
      input,
      new File([JSON.stringify(small)], 'maze.json', { type: 'application/json' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^save and share/i })).toHaveTextContent(
        /imported one/i,
      ),
    );

    await user.upload(input, new File(['{"hello": 1}'], 'nope.json', { type: 'application/json' }));
    // Shown next to the file field and announced in the live region.
    expect(
      (await screen.findAllByText(/could not import: this file is not a maze lab maze/i)).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
