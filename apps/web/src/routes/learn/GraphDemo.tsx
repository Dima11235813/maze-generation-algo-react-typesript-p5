/**
 * The M1 graph demo: a small maze the learner edits. Tap near a wall to open or close it, tap
 * the middle of a cell to select it; on the keyboard the arrows move the selection and
 * Shift+arrow toggles that wall. The edit row below the maze (never on it) toggles the selected
 * cell's four walls, undoes and starts over; every edit is announced with the new graph counts.
 */
import {
  DIR_NAMES,
  DIRS,
  NO_CELL,
  describePosition,
  dirBetween,
  hasWall,
  nearestWall,
  neighbor,
  type CellId,
  type Dir,
} from '@maze/core';
import { Button, Kbd, Tooltip, TooltipContent, TooltipTrigger } from '@maze/ui';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAnnouncer } from '../../app/useAnnouncer';
import { useBreakpoint } from '../../layout/breakpoints';
import { graphStats, graphSummary } from '../../learn/graphDemo';
import type { useGraphDemo } from '../../learn/useGraphDemo';
import { dirForArrow } from '../../maze/build';
import { MazeCanvas } from '../play/MazeCanvas';
import { useDemoCanvas } from './useDemoCanvas';

const noop = (): void => undefined;
/** Any value works: the renderers fit the maze to the canvas. */
const CELL = 24;

const ARROWS: Readonly<Record<Dir, typeof ArrowUp>> = {
  0: ArrowUp,
  1: ArrowRight,
  2: ArrowDown,
  3: ArrowLeft,
};
const KEYS: Readonly<Record<Dir, string>> = {
  0: 'Shift+Up',
  1: 'Shift+Right',
  2: 'Shift+Down',
  3: 'Shift+Left',
};

function Hint({ label, keys, children }: { label: string; keys?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        {label}
        {keys ? <Kbd>{keys}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function GraphDemo({ demo }: { demo: ReturnType<typeof useGraphDemo> }) {
  const { model, snap } = demo;
  const { state, selected, stats } = snap;
  const { grid } = state;
  const announce = useAnnouncer();
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';
  const { theme, options, camera } = useDemoCanvas(grid.height, CELL);

  /** Opens or closes a wall and says what changed, with the new counts. */
  const toggle = useCallback(
    (a: CellId, b: CellId) => {
      const dir = dirBetween(grid, a, b);
      const opening = dir !== undefined && hasWall(model.getSnapshot().state.walls, a, dir);
      model.toggleWall(a, b);
      const after = graphStats(model.getSnapshot().state);
      announce(
        `${opening ? 'Opened' : 'Closed'} the wall between ${describePosition(grid, a)} and ${describePosition(grid, b)}: ${graphSummary(after)}.`,
      );
    },
    [model, announce, grid],
  );

  const toggleSide = useCallback(
    (dir: Dir) => {
      const cell = model.getSnapshot().selected;
      if (cell === null) {
        announce('Select a cell first.');
        return;
      }
      const b = neighbor(grid, cell, dir);
      if (b === NO_CELL) {
        announce('That is the outer wall of the maze.');
        return;
      }
      toggle(cell, b);
    },
    [model, grid, announce, toggle],
  );

  const onCellClick = useCallback(
    (cell: CellId | null, at?: { fx: number; fy: number }) => {
      if (cell === null) return;
      const wall = at ? nearestWall(grid, cell, at.fx, at.fy) : null;
      model.select(cell);
      if (wall) toggle(wall.a, wall.b);
      else announce(`Selected ${describePosition(grid, cell)}.`);
    },
    [model, grid, toggle, announce],
  );

  // Keys work while the canvas has focus, so they never fight the quiz's radio groups.
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onKey = (e: KeyboardEvent) => {
      const dir = dirForArrow(e.key);
      if (dir !== undefined) {
        e.preventDefault();
        if (e.shiftKey) {
          toggleSide(dir);
        } else {
          const cell = model.moveSelection(dir);
          announce(`Selected ${describePosition(grid, cell)}.`);
        }
      } else if (e.key === 'u' || e.key === 'U') {
        model.undo();
        announce(`Undone: ${graphSummary(model.getSnapshot().stats)}.`);
      }
    };
    host.addEventListener('keydown', onKey);
    return () => {
      host.removeEventListener('keydown', onKey);
    };
  }, [model, grid, announce, toggleSide]);

  const label = `Graph demo: ${String(grid.width)} by ${String(grid.height)} cells, ${graphSummary(stats)}${
    selected === null ? '' : `, ${describePosition(grid, selected)} selected`
  }`;

  return (
    <>
      <div ref={hostRef} className="relative flex min-h-0 flex-1 flex-col">
        <MazeCanvas
          session={model}
          mode="2d"
          theme={theme}
          options={options}
          camera={camera}
          firstPerson={null}
          maze={state}
          generation={null}
          solve={model.overlay.tracker}
          label={label}
          onHostSize={noop}
          onCellClick={onCellClick}
          // Taps edit the maze, so the canvas does not scroll the page on touch screens.
          pageScroll={false}
        />
      </div>
      <div
        role="group"
        aria-label="Edit the maze"
        className="flex flex-wrap items-center gap-2 border-t border-border bg-panel px-3 py-2"
      >
        <span className="text-xs text-muted" aria-hidden="true">
          Walls:
        </span>
        {DIRS.map((d) => {
          const Icon = ARROWS[d];
          const edge = selected === null || neighbor(grid, selected, d) === NO_CELL;
          const standing = selected !== null && hasWall(state.walls, selected, d);
          const name = `${capital(DIR_NAMES[d])} wall`;
          return (
            <Hint
              key={d}
              label={standing ? `Open the ${DIR_NAMES[d]} wall` : `Close the ${DIR_NAMES[d]} wall`}
              keys={KEYS[d]}
            >
              <Button
                size="sm"
                variant="outline"
                aria-label={name}
                aria-pressed={standing}
                disabled={edge}
                className="w-11 px-0"
                onClick={() => {
                  toggleSide(d);
                }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Hint>
          );
        })}
        <span className="ml-auto flex gap-2">
          <Hint label="Undo the last edit" keys="U">
            <Button
              size="sm"
              variant="ghost"
              disabled={!snap.canUndo}
              onClick={() => {
                model.undo();
                announce(`Undone: ${graphSummary(model.getSnapshot().stats)}.`);
              }}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
            </Button>
          </Hint>
          <Hint label="Back to the starting maze">
            <Button
              size="sm"
              variant="ghost"
              disabled={snap.edits === 0 && selected === null}
              onClick={() => {
                model.reset();
                announce(`Back to the starting maze: ${graphSummary(model.getSnapshot().stats)}.`);
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Start over
            </Button>
          </Hint>
        </span>
        <p className="w-full text-xs text-muted">
          {selected === null
            ? 'Select a cell to toggle its walls here. '
            : `${capital(describePosition(grid, selected))} selected. `}
          {touchLayout
            ? 'Tap near a wall to open or close it; tap the middle of a cell to select it.'
            : 'Click near a wall to toggle it. On the maze: arrows select, Shift+arrow toggles, U undoes.'}
        </p>
      </div>
    </>
  );
}
