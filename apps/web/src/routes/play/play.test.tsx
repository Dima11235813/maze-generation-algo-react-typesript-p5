import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('opens the options panel with its sliders and colour fields', async () => {
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
  });
});
