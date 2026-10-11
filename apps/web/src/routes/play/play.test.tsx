import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
  it('collapses the toolbar on narrow screens and moves secondary controls into a sheet', async () => {
    const original = window.matchMedia;
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    });
    try {
      const user = userEvent.setup();
      renderPlay();
      const toolbar = await screen.findByRole('toolbar', { name: /maze controls/i });
      // Essentials stay in the bar; the library button is not rendered inline.
      expect(within(toolbar).getByRole('button', { name: /^generate$/i })).toBeInTheDocument();
      expect(within(toolbar).getByRole('button', { name: /^options$/i })).toBeInTheDocument();
      expect(within(toolbar).queryByRole('button', { name: /^library$/i })).not.toBeInTheDocument();
      await user.click(within(toolbar).getByRole('button', { name: /more controls/i }));
      const sheet = await screen.findByRole('dialog', { name: /maze controls/i });
      expect(within(sheet).getByRole('button', { name: /^library$/i })).toBeInTheDocument();
      expect(within(sheet).getByLabelText(/^seed$/i)).toBeInTheDocument();
      expect(within(sheet).getByRole('combobox', { name: /generator/i })).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
  it('rotates, tilts, zooms and resets the 3D view from the controls and the keyboard', async () => {
    const user = userEvent.setup();
    const { factories } = renderPlay();
    await screen.findByRole('toolbar', { name: /maze controls/i });
    await waitFor(() => expect(factories.created).toHaveLength(1));
    const renderer = factories.created[0]!;
    const controls = screen.getByRole('group', { name: /^camera$/i });

    await user.click(within(controls).getByRole('button', { name: /rotate clockwise/i }));
    await waitFor(() => expect(renderer.lastCamera?.yaw).toBeLessThan(0));
    await user.click(within(controls).getByRole('button', { name: /look from higher/i }));
    await waitFor(() => expect(renderer.lastCamera?.pitch).toBeGreaterThan(0));
    await user.click(within(controls).getByRole('button', { name: /zoom in/i }));
    await waitFor(() => expect(renderer.lastCamera?.zoom).toBeGreaterThan(1));

    await user.keyboard('0');
    await waitFor(() => expect(renderer.lastCamera).toMatchObject({ zoom: 1, yaw: 0, pitch: 0 }));
    await user.keyboard('[[');
    await waitFor(() => expect(renderer.lastCamera?.yaw).toBeGreaterThan(0));
    await user.keyboard('-');
    await waitFor(() => expect(renderer.lastCamera?.zoom).toBeLessThan(1));
  });

  it('rewinds a finished maze with Home, steps back, and scrubs with the timeline', async () => {
    const user = userEvent.setup();
    renderPlay();
    const toolbar = await screen.findByRole('toolbar', { name: /maze controls/i });
    await waitFor(() =>
      expect(within(toolbar).getByRole('button', { name: /run to end/i })).toBeEnabled(),
    );
    await user.click(within(toolbar).getByRole('button', { name: /run to end/i }));
    await waitFor(() => expect(screen.getByRole('img', { name: /complete/i })).toBeInTheDocument());

    const timeline = screen.getByRole('group', { name: /generation timeline/i });
    const scrubber = within(timeline).getByRole('slider', { name: /generation position/i });
    expect(scrubber).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/^Step [\d,]+ of [\d,]+$/),
    );

    await user.keyboard('{Home}');
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /generation in progress/i })).toBeInTheDocument(),
    );
    expect(scrubber).toHaveAttribute('aria-valuenow', '0');

    await user.keyboard('...');
    expect(scrubber).toHaveAttribute('aria-valuenow', '3');
    await user.click(within(toolbar).getByRole('button', { name: /^step back$/i }));
    expect(scrubber).toHaveAttribute('aria-valuenow', '2');
  });

  it('regenerates the same seed on the same grid after the canvas changed size', async () => {
    // A ResizeObserver the test can drive: 800x600 on observe, then whatever `resize` says.
    const observed: { cb: ResizeObserverCallback; target: Element }[] = [];
    const entry = (target: Element, width: number, height: number) =>
      ({ target, contentRect: { width, height } }) as unknown as ResizeObserverEntry;
    class DrivenResizeObserver {
      private readonly cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(target: Element): void {
        observed.push({ cb: this.cb, target });
        this.cb([entry(target, 800, 600)], this);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = DrivenResizeObserver;
    try {
      const user = userEvent.setup();
      const { factories } = renderPlay();
      const toolbar = await screen.findByRole('toolbar', { name: /maze controls/i });
      await screen.findByRole('img', { name: /maze canvas: 20 by 15 cells/i });
      const seed = screen.getByRole('textbox', { name: 'Seed' });
      const seedValue = (seed as HTMLInputElement).value;
      expect(seedValue).not.toBe('');
      const renderer = factories.created[0]!;
      const before = renderer.lastGeneration;

      // Half the canvas: the maze keeps its shape and offers a refit.
      act(() => {
        for (const o of observed) o.cb([entry(o.target, 400, 300)], {} as ResizeObserver);
      });
      expect(await screen.findByText(/the window changed size/i)).toBeInTheDocument();

      // Regenerate same seed rebuilds on the same 20 x 15 grid, not the refitted size.
      await user.click(within(toolbar).getByRole('button', { name: 'Regenerate same seed' }));
      await waitFor(() => expect(renderer.lastGeneration).not.toBe(before));
      expect(screen.getByRole('img', { name: /maze canvas: 20 by 15 cells/i })).toBeInTheDocument();
      expect(seed).toHaveValue(seedValue);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
