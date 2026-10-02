import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
import { usePrefs } from '../../state/prefs';
import { createFakeFactories } from '../../test/fakeRenderer';

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

describe('/play', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it('mounts the renderer for the preferred mode and starts generating', async () => {
    const { factories } = renderPlay();
    expect(await screen.findByRole('toolbar', { name: /maze controls/i })).toBeInTheDocument();

    await waitFor(() => expect(factories.created).toHaveLength(1));
    const renderer = factories.created[0]!;
    expect(renderer.kind).toBe('3d');
    expect(renderer.calls).toContain('mount');

    // The fake ResizeObserver reports 800x600, so generation auto-starts (legacy behaviour).
    await waitFor(() => expect(renderer.lastMaze).not.toBeNull());
    await waitFor(() => expect(renderer.lastGeneration).not.toBeNull());
    expect(screen.getByRole('img', { name: /maze canvas: 20 by 15 cells/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^generate$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^options$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^library$/i })).toBeInTheDocument();
  });

  it('switches to the 2D renderer from the view toggle', async () => {
    const user = userEvent.setup();
    const { factories } = renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await waitFor(() => expect(factories.created).toHaveLength(1));

    await user.click(screen.getByRole('radio', { name: /2d view/i }));
    await waitFor(() => expect(factories.created).toHaveLength(2));
    expect(factories.created[1]!.kind).toBe('2d');
    expect(factories.created[0]!.calls).toContain('destroy');
    expect(usePrefs.getState().mode).toBe('2d');
  });

  it('opens the options panel with its sliders, colour fields and accessibility section', async () => {
    const user = userEvent.setup();
    renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await user.click(screen.getByRole('button', { name: /^options$/i }));
    const dialog = await screen.findByRole('dialog', { name: /maze options/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /cell size/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /wall width/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^cell colour$/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /invert colours/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /show cube projection/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /screen-reader grid/i })).toBeChecked();
    expect(screen.getByRole('switch', { name: /show step log/i })).not.toBeChecked();
    expect(within(dialog).getByText(/^narration$/i)).toBeInTheDocument();
  });

  it('mirrors the maze in a screen-reader grid that follows the real maze size', async () => {
    const { factories } = renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await waitFor(() => expect(factories.created).toHaveLength(1));

    const grid = await screen.findByRole('grid', { name: /maze grid, 20 by 15/i });
    expect(grid).toHaveAttribute('aria-rowcount', '15');
    expect(grid).toHaveAttribute('aria-colcount', '20');
    // 300 cells is under the virtualisation threshold, so every cell is present.
    await waitFor(() => expect(within(grid).getAllByRole('gridcell')).toHaveLength(300));
    expect(within(grid).getAllByRole('gridcell')[0]).toHaveAccessibleName(/row 1, column 1/i);
    // The canvas keeps its own image role; the grid does not replace it.
    expect(screen.getByRole('img', { name: /maze canvas/i })).toBeInTheDocument();
    // The grid lives in a visually hidden container.
    expect(screen.getByTestId('a11y-grid-host')).toHaveClass('sr-only');
  });

  it('toggles the step log with L and routes narration into it', async () => {
    const user = userEvent.setup();
    renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await screen.findByRole('grid', { name: /maze grid/i });

    expect(screen.queryByTestId('step-log')).not.toBeInTheDocument();
    await user.keyboard('l');
    const log = await screen.findByTestId('step-log');
    expect(usePrefs.getState().showStepLog).toBe(true);
    expect(within(log).getByRole('log', { name: /narrated steps/i })).toBeInTheDocument();
    // Session status messages are logged as milestones.
    await waitFor(() =>
      expect(within(log).getByText(/generating a 20 by 15 maze/i)).toBeInTheDocument(),
    );
    expect(within(log).getByText(/^narration$/i)).toBeInTheDocument();

    await user.click(within(log).getByRole('button', { name: /^close$/i }));
    expect(screen.queryByTestId('step-log')).not.toBeInTheDocument();
    expect(usePrefs.getState().showStepLog).toBe(false);
  });

  it('G focuses the screen-reader grid and ? opens the shortcuts help', async () => {
    const user = userEvent.setup();
    renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    const grid = await screen.findByRole('grid', { name: /maze grid/i });
    await waitFor(() => expect(within(grid).getAllByRole('gridcell').length).toBeGreaterThan(0));

    await user.keyboard('g');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('role', 'gridcell'));
    expect(document.activeElement).toHaveAccessibleName(/row 1, column 1/i);
    // Arrow keys rove inside the grid without triggering page shortcuts.
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAccessibleName(/row 1, column 2/i);
    // Visible caption mirrors the focused cell for sighted keyboard users.
    expect(screen.getByText(/^grid:/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.keyboard('?');
    const help = await screen.findByRole('dialog', { name: /keyboard shortcuts/i });
    expect(within(help).getByText(/focus the screen-reader grid/i)).toBeInTheDocument();
  });

  it('hides the grid when the preference is off', async () => {
    usePrefs.getState().set('screenReaderGrid', false);
    renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
