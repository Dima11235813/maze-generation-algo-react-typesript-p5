import { generators, postprocessors, solvers } from '@maze/core';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';
import { describeParam } from './AlgorithmCard';
import { bestLanes } from './CompareMetricsTable';

function renderAt(path: string) {
  const factories = createFakeFactories();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <RendererFactoriesContext.Provider value={factories}>
      <RouterProvider router={router} />
    </RendererFactoriesContext.Provider>,
  );
  return { factories, router };
}

describe('/explore catalogue', () => {
  it('renders one card per registry entry', async () => {
    renderAt('/explore');
    await screen.findByRole('heading', { name: /^explore$/i });
    const cards = screen.getAllByTestId('algorithm-card');
    expect(cards).toHaveLength(generators.all.length + solvers.all.length + postprocessors.all.length);
    expect(cards.filter((c) => c.dataset['family'] === 'generator')).toHaveLength(generators.all.length);
    expect(cards.filter((c) => c.dataset['family'] === 'solver')).toHaveLength(solvers.all.length);
    for (const g of generators.all) expect(screen.getByText(g.meta.name)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open compare mode/i })).toHaveAttribute('href', expect.stringContaining('/explore/compare'));
  });

  it('describes parameters of every kind', () => {
    expect(describeParam({ key: 'n', label: 'Size', kind: 'int', min: 1, max: 9, default: 3 })).toBe('Size: 1..9 (default 3)');
    expect(describeParam({ key: 'b', label: 'Braid', kind: 'bool', default: true })).toBe('Braid: on | off (default on)');
    expect(
      describeParam({
        key: 'm',
        label: 'Mode',
        kind: 'enum',
        options: [
          { value: 'newest', label: 'Newest' },
          { value: 'random', label: 'Random' },
        ],
        default: 'random',
      }),
    ).toBe('Mode: Newest | Random (default Random)');
    expect(describeParam({ key: 's', label: 'Start', kind: 'int', min: 0, max: Number.MAX_SAFE_INTEGER, default: 0 })).toBe(
      'Start: 0..any (default 0)',
    );
  });
});

describe('/explore/compare', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it('mounts one lane per algorithm, runs all lanes to the end and fills the metrics table', async () => {
    const user = userEvent.setup();
    const first = generators.ids[0]!;
    const second = generators.ids[1] ?? first;
    const { factories } = renderAt(`/explore/compare?seed=cmp-seed&algos=${first},${second}`);
    await screen.findByRole('toolbar', { name: /compare controls/i });
    await waitFor(() => expect(screen.getAllByTestId('compare-lane')).toHaveLength(2));
    await waitFor(() => expect(factories.created).toHaveLength(2));
    expect(factories.created.every((r) => r.kind === '2d')).toBe(true);

    const run = screen.getByRole('button', { name: /run to end/i });
    await waitFor(() => expect(run).toBeEnabled());
    await user.click(run);

    const table = screen.getByTestId('compare-metrics');
    await waitFor(() => {
      const rows = within(table).getAllByTestId('compare-row');
      expect(rows).toHaveLength(2);
      for (const row of rows) expect(within(row).queryByText('generating')).toBeNull();
    });
    const rows = within(table).getAllByTestId('compare-row');
    expect(within(rows[0]!).getByText(/\d+ moves/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^play$/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/all generators finished/i);
    expect(screen.getByRole('checkbox', { name: generators.get(first)!.meta.name })).toBeChecked();
  });

  it('bestLanes highlights only when lanes differ', () => {
    expect(bestLanes([3, 5, 4], 'min')).toEqual(new Set([0]));
    expect(bestLanes([3, 5, 5], 'max')).toEqual(new Set([1, 2]));
    expect(bestLanes([4, 4], 'min')).toEqual(new Set());
    expect(bestLanes([4], 'min')).toEqual(new Set());
    expect(bestLanes([null, 2, 9], 'max')).toEqual(new Set([2]));
  });
});
