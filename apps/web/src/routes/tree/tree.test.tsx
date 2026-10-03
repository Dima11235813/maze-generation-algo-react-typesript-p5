import { createGrid, createRng, generators, runToEnd, treeify } from '@maze/core';
import type { RenderOptions } from '@maze/renderer';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { buildSegments, segmentLabel, segmentSubtreeCells } from '../../maze/treeView';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';

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

const lastOptions = (factories: ReturnType<typeof createFakeFactories>): RenderOptions =>
  factories.created[factories.created.length - 1]!.lastOptions;

describe('outline model', () => {
  it('splits the tree into corridors between forks that cover every cell once', () => {
    const state = runToEnd(
      generators.require('recursive-backtracker').run(createGrid(9, 7), createRng('outline'), {}),
    );
    const tree = treeify(state, { root: state.start, target: state.goal });
    const segments = buildSegments(tree, state.goal);
    const all = segments.flatMap((s) => s.cells).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 63 }, (_, i) => i));
    expect(segmentSubtreeCells(segments, 0)).toHaveLength(63);
    // Exactly one segment holds the goal and it is on the trunk.
    const goal = segments.filter((s) => s.containsGoal);
    expect(goal).toHaveLength(1);
    expect(goal[0]!.onTrunk).toBe(true);
    expect(segmentLabel(segments[0]!)).toMatch(/^Start: /);
    // Dead-end segments are leaves of the outline.
    for (const s of segments) expect(s.end === 'dead-end').toBe(s.children.length === 0);
  });
});

describe('Tree view on /play', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    usePrefs.getState().set('mode', '2d');
  });

  it('switches to the tree, shows its controls below the maze and an outline of the maze', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/play');
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await waitFor(() => expect(factories.created).toHaveLength(1));
    // Finish generating so the outline has a maze.
    const run = screen.getByRole('button', { name: /run to end/i });
    await waitFor(() => expect(run).toBeEnabled());
    await user.click(run);

    await user.click(screen.getByRole('radio', { name: /^tree view/i }));
    expect(usePrefs.getState().treeView).toBe(true);
    await waitFor(() =>
      expect(lastOptions(factories).tree).toMatchObject({ layout: 'tidy', morph: 1 }),
    );
    // The upright layout still uses the 2D renderer.
    expect(factories.created[factories.created.length - 1]!.kind).toBe('2d');

    const controls = screen.getByRole('toolbar', { name: /tree view controls/i });
    expect(within(controls).getByRole('radio', { name: /upright layout/i })).toBeChecked();
    expect(within(controls).getByRole('slider', { name: /maze to tree/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /shown as a tree/i })).toBeInTheDocument();

    const outline = await screen.findByRole('tree', { name: /maze as a tree/i });
    const root = within(outline).getByRole('treeitem', { name: /^Start: / });
    expect(root).toHaveAttribute('aria-level', '1');

    // Keyboard: the root starts open; Right moves into it, Down to the next item, Left back up.
    expect(root).toHaveAttribute('aria-expanded', 'true');
    root.focus();
    await user.keyboard('{ArrowRight}');
    const items = within(outline).getAllByRole('treeitem');
    expect(items.length).toBeGreaterThan(1);
    expect(items[1]).toHaveFocus();
    expect(items[1]).toHaveAttribute('aria-level', '2');
    await user.keyboard('{ArrowLeft}');
    expect(root).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(root).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{End}');
    expect(root).toHaveFocus();
    await waitFor(() => expect(lastOptions(factories).tree?.highlight?.length).toBeGreaterThan(0));
  });

  it('the 3D tree layout swaps to the three.js renderer and Y leaves the tree view', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/play');
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await waitFor(() => expect(factories.created).toHaveLength(1));

    await user.keyboard('y');
    expect(usePrefs.getState().treeView).toBe(true);
    const controls = await screen.findByRole('toolbar', { name: /tree view controls/i });
    await user.click(within(controls).getByRole('radio', { name: /3d tree layout/i }));
    await waitFor(() => expect(factories.created[factories.created.length - 1]!.kind).toBe('3d'));
    expect(lastOptions(factories).tree?.layout).toBe('3d');

    await user.keyboard('y');
    expect(usePrefs.getState().treeView).toBe(false);
    await waitFor(() => expect(factories.created[factories.created.length - 1]!.kind).toBe('2d'));
    expect(screen.queryByRole('toolbar', { name: /tree view controls/i })).not.toBeInTheDocument();
  });

  it('the morph slider and the pull button drive the renderer', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/play');
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await user.click(screen.getByRole('radio', { name: /^tree view/i }));
    const slider = await screen.findByRole('slider', { name: /maze to tree/i });
    slider.focus();
    await user.keyboard('{Home}');
    await waitFor(() => expect(lastOptions(factories).tree?.morph).toBe(0));
    const pullBefore = lastOptions(factories).tree?.pullKey ?? 0;
    await user.click(screen.getByRole('button', { name: /pull the tree out of the maze/i }));
    await waitFor(() => expect(lastOptions(factories).tree?.morph).toBe(1));
    expect(lastOptions(factories).tree?.pullKey).toBe(pullBefore + 1);
  });
});

describe('Tree view on /watch', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it('offers the tree next to 2D and 3D and keeps the solver overlay', async () => {
    const user = userEvent.setup();
    const { factories } = renderAt('/watch?seed=tree-watch');
    await screen.findByRole('toolbar', { name: /watch controls/i });
    await user.click(screen.getByRole('radio', { name: /^tree view/i }));
    await waitFor(() => expect(lastOptions(factories).tree?.layout).toBe('tidy'));
    expect(await screen.findByRole('tree', { name: /maze as a tree/i })).toBeInTheDocument();
    const run = await screen.findByRole('button', { name: /run to end/i });
    await waitFor(() => expect(run).toBeEnabled());
    await user.click(run);
    await waitFor(() =>
      expect(factories.created[factories.created.length - 1]!.lastSolve).not.toBeNull(),
    );
  });
});
