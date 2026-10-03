// @vitest-environment jsdom
import {
  GenerationTracker,
  SolveTracker,
  cellCount,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  recursiveBacktracker,
  runToEnd,
  type MazeState,
} from '@maze/core';
import { legacyTheme } from '../src/color';
import {
  VIRTUALIZE_ABOVE_CELLS,
  WINDOW_ROWS,
  createDomRenderer,
  type DomRenderer,
  type DomRendererEvents,
} from '../src/dom';
import type { RenderOptions } from '../src/types';

/** 3x3 perfect maze whose single corridor snakes 0-1-2-5-4-3-6-7-8 (proj-mgmt/02 fixture). */
function threeByThree(): MazeState {
  return createMazeState(
    createGrid(3, 3),
    Uint8Array.from([0xd, 0x5, 0x3, 0x9, 0x5, 0x6, 0xc, 0x5, 0x7]),
    0,
    8,
  );
}

const options: RenderOptions = {
  cellSize: 20,
  wallWidth: 1,
  mode: '2d',
  showProjection: false,
  mirror: false,
  maxProjectionDepth: 10,
  projectionUnit: 1 / 6,
  wallHeight: 0.5,
  showGrid: false,
  showStartGoal: true,
  reducedMotion: true,
};

function mountRenderer(events: DomRendererEvents = {}): { r: DomRenderer; host: HTMLElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const r = createDomRenderer({ theme: legacyTheme, options, events });
  r.mount(host);
  return { r, host };
}

const cells = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[role="gridcell"]'));
const name = (host: HTMLElement, cell: number) =>
  host.querySelector(`[role="gridcell"][data-cell="${cell}"]`)?.getAttribute('aria-label') ?? '';

afterEach(() => {
  document.body.replaceChildren();
});

describe('dom renderer: structure', () => {
  it('renders the 3x3 fixture as an ARIA grid with 9 described cells', () => {
    const { r, host } = mountRenderer();
    r.setMaze(threeByThree());
    r.flush();

    const grid = host.querySelector('[role="grid"]')!;
    expect(grid.getAttribute('aria-label')).toBe('Maze grid, 3 by 3');
    expect(grid.getAttribute('aria-rowcount')).toBe('3');
    expect(grid.getAttribute('aria-colcount')).toBe('3');
    expect(host.querySelectorAll('[role="row"]')).toHaveLength(3);
    expect(cells(host)).toHaveLength(9);
    expect(name(host, 0)).toBe('Row 1, column 1. Dead end, open to the east. Start.');
    expect(name(host, 1)).toBe('Row 1, column 2. Open to the east and west.');
    expect(name(host, 8)).toBe('Row 3, column 3. Dead end, open to the west. Goal.');
    // Exactly one roving tab stop, on the start cell by default.
    const stops = cells(host).filter((c) => c.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.dataset.cell).toBe('0');
    expect(r.toDataURL()).toBe('');
    r.destroy();
    expect(host.children).toHaveLength(0);
  });

  it('describes an empty renderer and recovers when a maze arrives', () => {
    const { r, host } = mountRenderer();
    expect(host.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe(
      'Maze grid, empty',
    );
    r.setMaze(threeByThree());
    r.flush();
    expect(cells(host)).toHaveLength(9);
    r.setMaze(null);
    r.flush();
    expect(cells(host)).toHaveLength(0);
  });

  it('adds generation state: unvisited, visit counts and the current cell', () => {
    const { r, host } = mountRenderer();
    const maze = threeByThree();
    const tracker = new GenerationTracker(maze.grid);
    tracker.applyAll([
      { t: 'visit', cell: 0 },
      { t: 'carve', from: 0, to: 1 },
      { t: 'visit', cell: 1 },
    ]);
    r.setMaze(maze);
    r.setGeneration(tracker);
    r.flush();
    expect(name(host, 0)).toContain('Visited 1 time.');
    expect(name(host, 0)).not.toContain('Current cell');
    expect(name(host, 1)).toContain('Visited 1 time. Current cell.');
    expect(name(host, 2)).toContain('Not yet visited.');
    expect(host.querySelector('[aria-current="location"]')?.getAttribute('data-cell')).toBe('1');
    expect(Array.from(host.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Go to start',
      'Go to goal',
      'Go to the current cell',
    ]);
  });

  it('adds solver marks, the path and the first-person player', () => {
    const { r, host } = mountRenderer();
    const maze = threeByThree();
    const solve = new SolveTracker(maze.grid);
    solve.applyAll([
      { t: 'expand', cell: 0, g: 0 },
      { t: 'discover', cell: 1, from: 0, g: 1 },
      { t: 'deadend', cell: 3 },
      { t: 'path', cells: [0, 1, 2] },
    ]);
    r.setMaze(maze);
    r.setSolve(solve);
    r.setFirstPerson({ cell: 5, heading: 2, peek: true });
    r.flush();
    expect(name(host, 0)).toContain('Explored.');
    expect(name(host, 0)).toContain('On the solution path.');
    expect(name(host, 1)).toContain('Frontier.');
    expect(name(host, 3)).toContain('Dead end for the solver.');
    expect(name(host, 5)).toContain('Player here, facing south, peeking.');
    expect(host.querySelector('[aria-current="location"]')?.getAttribute('data-cell')).toBe('5');
    // Entering first-person moves the roving tab stop to the player.
    expect(cells(host).find((c) => c.tabIndex === 0)?.dataset.cell).toBe('5');
  });
});

describe('dom renderer: keyboard', () => {
  function key(host: HTMLElement, key: string, init: KeyboardEventInit = {}) {
    const grid = host.querySelector('[role="grid"]')!;
    const target = document.activeElement ?? grid;
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
  }

  it('roves focus with arrows, Home/End and Ctrl+Home, and reports moves', () => {
    const moves: Array<[number, string]> = [];
    const { r, host } = mountRenderer({
      onCellFocus: (cell, reason) => moves.push([cell, reason]),
    });
    r.setMaze(threeByThree());
    r.flush();
    r.focusCell(0);
    expect(document.activeElement?.getAttribute('data-cell')).toBe('0');

    key(host, 'ArrowRight');
    expect(r.getFocusedCell()).toBe(1);
    expect(document.activeElement?.getAttribute('data-cell')).toBe('1');
    key(host, 'ArrowDown');
    expect(r.getFocusedCell()).toBe(4);
    key(host, 'ArrowLeft');
    expect(r.getFocusedCell()).toBe(3);
    key(host, 'ArrowUp');
    expect(r.getFocusedCell()).toBe(0);
    key(host, 'ArrowUp'); // clamps at the edge, no event
    expect(r.getFocusedCell()).toBe(0);
    key(host, 'End');
    expect(r.getFocusedCell()).toBe(2);
    key(host, 'Home');
    expect(r.getFocusedCell()).toBe(0);
    key(host, 'End', { ctrlKey: true });
    expect(r.getFocusedCell()).toBe(8);
    key(host, 'Home', { ctrlKey: true });
    expect(r.getFocusedCell()).toBe(0);
    key(host, 'I');
    expect(moves.at(-1)).toEqual([0, 'describe']);
    expect(moves.filter(([, why]) => why === 'move').map(([c]) => c)).toEqual([
      0, 1, 4, 3, 0, 2, 0, 8, 0,
    ]);
    // Exactly one tab stop at all times.
    expect(cells(host).filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('jump buttons move focus to start/goal', () => {
    const { r, host } = mountRenderer();
    r.setMaze(threeByThree());
    r.flush();
    const goal = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent === 'Go to goal',
    )!;
    goal.click();
    expect(r.getFocusedCell()).toBe(8);
    expect(document.activeElement?.getAttribute('data-cell')).toBe('8');
  });
});

describe('dom renderer: virtualisation and throttling', () => {
  it('renders only a window of rows for large mazes and follows focus with PageDown', () => {
    const grid = createGrid(60, 60);
    const state = runToEnd(recursiveBacktracker.run(grid, createRng('a11y')));
    expect(cellCount(grid)).toBeGreaterThan(VIRTUALIZE_ABOVE_CELLS);
    const { r, host } = mountRenderer();
    r.setMaze(state);
    r.flush();

    expect(host.querySelectorAll('[role="row"]')).toHaveLength(WINDOW_ROWS);
    expect(cells(host)).toHaveLength(WINDOW_ROWS * 60);
    const summary = host.querySelector('p')!;
    expect(summary.textContent).toMatch(/Showing rows 1 to 15 of 60/);
    expect(host.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).toBe('60');

    r.focusCell(0);
    const grd = host.querySelector('[role="grid"]')!;
    const press = (k: string) =>
      (document.activeElement ?? grd).dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      );
    press('PageDown');
    press('PageDown');
    press('PageDown'); // row 45
    expect(r.getFocusedCell()).toBe(45 * 60);
    expect(summary.textContent).toMatch(/Showing rows 39 to 53 of 60/);
    expect(document.activeElement?.getAttribute('data-cell')).toBe(String(45 * 60));
    expect(host.querySelectorAll('[role="row"]')).toHaveLength(WINDOW_ROWS);
  });

  it('small mazes are never virtualised', () => {
    const grid = createGrid(20, 20);
    const state = createMazeState(grid, createWalls(grid), 0, 399);
    const { r, host } = mountRenderer();
    r.setMaze(state);
    r.flush();
    expect(cells(host)).toHaveLength(400);
  });

  it('coalesces bursts of requestRender into throttled refreshes', () => {
    vi.useFakeTimers();
    try {
      const { r, host } = mountRenderer();
      const maze = threeByThree();
      const tracker = new GenerationTracker(maze.grid);
      r.setMaze(maze);
      r.setGeneration(tracker);
      r.flush(); // refresh now; the throttle window starts here

      tracker.apply({ t: 'visit', cell: 0 });
      for (let i = 0; i < 50; i++) r.requestRender();
      // Inside the 200 ms window nothing is rebuilt yet.
      vi.advanceTimersByTime(50);
      expect(name(host, 0)).toContain('Not yet visited.');
      // After the window one refresh happens and reflects the latest tracker state.
      tracker.apply({ t: 'carve', from: 0, to: 1 });
      tracker.apply({ t: 'visit', cell: 1 });
      vi.advanceTimersByTime(200);
      expect(name(host, 0)).toContain('Visited 1 time.');
      expect(name(host, 1)).toContain('Current cell.');
    } finally {
      vi.useRealTimers();
    }
  });
});
