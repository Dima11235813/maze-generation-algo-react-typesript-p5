import {
  cellCount,
  createGrid,
  createRng,
  generators,
  runToEnd,
  solvers,
  type GenStep,
  type MazeState,
  type SolveStep,
} from '@maze/core';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { DisjointSetModel } from '../../learn/disjointSetModel';
import { SolveStructureTracker } from '../../learn/solveStructure';
import { BacktrackerStackModel } from '../../learn/stackModel';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';
import { DisjointSetView } from './DisjointSetView';
import { StackView } from './StackView';
import { StructureView } from './StructureView';

function maze(): MazeState {
  return runToEnd(generators.require('prims').run(createGrid(10, 8), createRng('views'), {}));
}

/** The tracker state after the first `n` steps of a solve. */
function stateAfter(solverId: string, m: MazeState, n: number) {
  const steps: SolveStep[] = [...solvers.require(solverId).run(m, {})];
  const tracker = new SolveStructureTracker(solverId, m.start, m.goal, cellCount(m.grid));
  tracker.applyBatch(steps.slice(0, n));
  return tracker.snapshot();
}

describe('data-structure views', () => {
  it('DFS shows a stack with the top marked as next to expand', () => {
    const m = maze();
    render(<StructureView grid={m.grid} state={stateAfter('dfs', m, 6)} />);
    const list = screen.getByRole('list', { name: 'Stack, top first' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveAccessibleName(/^Top, next to expand/);
    expect(screen.queryByRole('region', { name: /distances/i })).not.toBeInTheDocument();
  });

  it('A* shows f = g + h, smallest first, plus the distance map', () => {
    const m = maze();
    render(<StructureView grid={m.grid} state={stateAfter('astar', m, 8)} />);
    const list = screen.getByRole('list', { name: 'Priority queue, smallest key first' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveAccessibleName(/^Smallest, next to expand: .*f \d+ = g \d+ \+ h \d+/);
    expect(screen.getByRole('region', { name: 'Distances from the start' })).toHaveTextContent(
      /settled/,
    );
  });

  it('Dijkstra keys by g and greedy by h', () => {
    const m = maze();
    const { unmount } = render(
      <StructureView grid={m.grid} state={stateAfter('dijkstra', m, 5)} />,
    );
    expect(screen.getAllByText(/^g \d+$/).length).toBeGreaterThan(0);
    unmount();
    render(<StructureView grid={m.grid} state={stateAfter('greedy-best-first', m, 5)} />);
    expect(screen.getAllByText(/^h \d+$/).length).toBeGreaterThan(0);
  });

  it('flood fill floods from the goal', () => {
    const m = maze();
    render(<StructureView grid={m.grid} state={stateAfter('flood-fill', m, 0)} />);
    expect(screen.getByText(/the queue holds only the goal cell/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Distances from the goal' })).toBeInTheDocument();
  });

  it('explains solvers without a frontier', () => {
    const m = maze();
    render(<StructureView grid={m.grid} state={stateAfter('wall-follower', m, 3)} />);
    expect(screen.getByText(/keeps no queue, stack or heap/)).toBeInTheDocument();
  });

  it('shows the backtracker path stack and Kruskal components for generator lessons', () => {
    const grid = createGrid(8, 6);
    const backSteps: GenStep[] = [
      ...generators.require('recursive-backtracker').run(grid, createRng('v-1'), {}),
    ];
    const stack = new BacktrackerStackModel();
    stack.applyBatch(backSteps.slice(0, 20));
    const { unmount } = render(<StackView grid={grid} stack={stack.snapshot()} variant="path" />);
    expect(
      within(screen.getByRole('list', { name: 'Stack, top first' })).getAllByRole('listitem')[0],
    ).toHaveAccessibleName(/^Top, the current cell/);
    unmount();

    const kSteps: GenStep[] = [...generators.require('kruskals').run(grid, createRng('v-2'), {})];
    const sets = new DisjointSetModel(cellCount(grid));
    sets.applyBatch(kSteps);
    render(<DisjointSetView grid={grid} sets={sets.snapshot()} />);
    expect(screen.getByText(/Last union joined/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Largest components' })).getByText('48 cells'),
    ).toBeInTheDocument();
  });
});

describe('Watch data-structure section', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it('follows the selected solver: a queue for BFS, a stack after switching to DFS', async () => {
    const user = userEvent.setup();
    const factories = createFakeFactories();
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ['/watch?seed=structures'] }),
    );
    render(
      <RendererFactoriesContext.Provider value={factories}>
        <RouterProvider router={router} />
      </RendererFactoriesContext.Provider>,
    );
    const transport = await screen.findByRole('toolbar', { name: /watch controls/i });
    expect(await screen.findByRole('list', { name: 'Queue, front first' })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(transport).getByRole('button', { name: /step once/i })).toBeEnabled(),
    );
    await user.click(within(transport).getByRole('button', { name: /step once/i }));
    await waitFor(() => expect(screen.getByText(/Last taken from the front:/)).toBeInTheDocument());

    const picker = screen.getByRole('group', { name: /solver/i });
    await user.click(within(picker).getByRole('radio', { name: /^depth-first search/i }));
    expect(await screen.findByRole('list', { name: 'Stack, top first' })).toBeInTheDocument();
  });
});
