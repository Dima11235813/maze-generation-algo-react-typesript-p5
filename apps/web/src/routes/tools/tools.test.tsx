import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../../app/router';
import { RendererFactoriesContext } from '../../maze/rendererFactories';
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

/** jsdom has no layout: give the maze area 800 x 600 and the floating widget 300 x 80. */
function fakeLayout() {
  const size = (el: HTMLElement, w: boolean): number =>
    el.dataset.variant === 'floating' ? (w ? 300 : 80) : w ? 800 : 600;
  const restore: Array<() => void> = [];
  for (const [prop, w] of [
    ['clientWidth', true],
    ['clientHeight', false],
    ['offsetWidth', true],
    ['offsetHeight', false],
  ] as const) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return size(this, w);
      },
    });
    restore.push(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
    });
  }
  return () => {
    restore.forEach((r) => {
      r();
    });
  };
}

async function finishedPlay(user: ReturnType<typeof userEvent.setup>) {
  const result = renderAt('/play');
  const toolbar = await screen.findByRole('toolbar', { name: /maze controls/i });
  await waitFor(() => expect(result.factories.created).toHaveLength(1));
  const run = within(toolbar).getByRole('button', { name: /run to end/i });
  await waitFor(() => expect(run).toBeEnabled());
  await user.click(run);
  return result;
}

describe('maze tools on a desktop layout', () => {
  let restoreLayout: () => void = () => undefined;
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    usePrefs.getState().set('mode', '2d');
    restoreLayout = fakeLayout();
  });
  afterEach(() => {
    restoreLayout();
  });

  it('floats over the maze with playback, solve, maze, camera and picture groups', async () => {
    const user = userEvent.setup();
    await finishedPlay(user);
    const tools = screen.getByRole('toolbar', { name: /^maze tools$/i });
    expect(tools).toHaveAttribute('data-variant', 'floating');
    for (const group of [/^playback$/i, /^solve$/i, /^maze$/i, /^camera$/i, /picture/i]) {
      expect(within(tools).getByRole('group', { name: group })).toBeInTheDocument();
    }
    // Docked bottom-right: 800 - 300 - 8 and 600 - 80 - 8.
    await waitFor(() => expect(tools.style.left).toBe('492px'));
    expect(tools.style.top).toBe('512px');

    // Actions drive the session: solve from the widget, then clear it.
    await user.click(
      within(tools).getByRole('button', { name: /^solve with breadth-first search/i }),
    );
    expect(
      await within(tools).findByRole('button', { name: /^clear solve$/i }),
    ).toBeInTheDocument();
    await user.click(within(tools).getByRole('button', { name: /^clear solve$/i }));
    expect(await within(tools).findByRole('button', { name: /^solve with/i })).toBeInTheDocument();
  });

  it('moves with the arrow keys on its grip, docks with Home and collapses to the grip', async () => {
    const user = userEvent.setup();
    await finishedPlay(user);
    const tools = screen.getByRole('toolbar', { name: /^maze tools$/i });
    const grip = within(tools).getByRole('button', { name: /move the maze tools/i });
    grip.focus();
    await user.keyboard('{Shift>}{ArrowLeft}{ArrowUp}{/Shift}');
    const moved = usePrefs.getState().toolsPos;
    expect(moved.x).toBeLessThan(1);
    expect(moved.y).toBeLessThan(1);
    await waitFor(() => expect(tools.style.left).toBe(`${String(492 - 64)}px`));
    await user.keyboard('{Home}');
    expect(usePrefs.getState().toolsPos).toEqual({ x: 1, y: 1 });

    await user.click(within(tools).getByRole('button', { name: /hide the maze tools/i }));
    expect(usePrefs.getState().toolsCollapsed).toBe(true);
    expect(within(tools).queryByRole('group', { name: /^playback$/i })).not.toBeInTheDocument();
    await user.click(within(tools).getByRole('button', { name: /show the maze tools/i }));
    expect(within(tools).getByRole('group', { name: /^playback$/i })).toBeInTheDocument();
  });

  it('every action has a tooltip with its name and shortcut', async () => {
    const user = userEvent.setup();
    await finishedPlay(user);
    const tools = screen.getByRole('toolbar', { name: /^maze tools$/i });
    await user.hover(within(tools).getByRole('button', { name: /^new maze$/i }));
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent(/new maze/i);
    expect(tip).toHaveTextContent('N');
  });
});

describe('maze tools on a phone layout', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
    // Every max-width query matches: the phone breakpoint.
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('max-width'),
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a row below the maze, never on top of it', async () => {
    renderAt('/play');
    await screen.findByRole('toolbar', { name: /maze controls/i });
    const tools = await screen.findByRole('toolbar', { name: /^maze tools$/i });
    expect(tools).toHaveAttribute('data-variant', 'row');
    expect(within(tools).queryByRole('button', { name: /move the maze tools/i })).toBeNull();
    // Not inside the canvas container: a sibling that follows it in the maze section.
    const canvas = screen.getByTestId('maze-canvas-host');
    expect(canvas.parentElement?.contains(tools)).toBe(false);
    expect(canvas.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
