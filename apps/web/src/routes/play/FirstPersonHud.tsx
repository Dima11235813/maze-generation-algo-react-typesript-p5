import { DIR_NAMES, describePosition, type MazeState } from '@maze/core';
import type { FirstPersonState } from '@maze/renderer';
import { Button, Kbd, cn } from '@maze/ui';
import { ArrowDown, ArrowUp, Eye, RotateCcw, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FirstPersonHudProps {
  state: MazeState;
  firstPerson: FirstPersonState;
  reachedGoal: boolean;
  onExit(): void;
  /** Touch controls (shown on coarse pointers / narrow screens). */
  showPad?: boolean;
  onForward?(): void;
  onBackward?(): void;
  onTurnLeft?(): void;
  onTurnRight?(): void;
  onPeekChange?(peek: boolean): void;
}

function PadButton({
  label,
  onPress,
  children,
  className,
}: {
  label: string;
  onPress?: (() => void) | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-md border border-border bg-panel/90 text-fg shadow backdrop-blur active:bg-accent active:text-accent-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Overlay shown in "Run Maze" mode (P-17): position, heading, key legend, goal state, touch pad. */
export function FirstPersonHud({
  state,
  firstPerson,
  reachedGoal,
  onExit,
  showPad = false,
  onForward,
  onBackward,
  onTurnLeft,
  onTurnRight,
  onPeekChange,
}: FirstPersonHudProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {reachedGoal ? (
        <div role="status" className="pointer-events-auto rounded-md border border-accent bg-panel px-4 py-2 text-sm font-semibold shadow">
          You reached the goal!
        </div>
      ) : null}

      {showPad ? (
        <div role="group" aria-label="Movement controls" className="pointer-events-auto flex items-end gap-6">
          <div className="grid grid-cols-3 gap-1.5">
            <span aria-hidden="true" />
            <PadButton label="Move forward" onPress={onForward}>
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </PadButton>
            <span aria-hidden="true" />
            <PadButton label="Turn left" onPress={onTurnLeft}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </PadButton>
            <PadButton label="Move backward" onPress={onBackward}>
              <ArrowDown className="h-5 w-5" aria-hidden="true" />
            </PadButton>
            <PadButton label="Turn right" onPress={onTurnRight}>
              <RotateCw className="h-5 w-5" aria-hidden="true" />
            </PadButton>
          </div>
          <button
            type="button"
            aria-label="Peek over the walls (hold)"
            aria-pressed={firstPerson.peek}
            className={cn(
              'inline-flex h-12 w-14 items-center justify-center rounded-md border border-border bg-panel/90 text-fg shadow backdrop-blur',
              firstPerson.peek && 'bg-accent text-accent-fg',
            )}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onPeekChange?.(true);
            }}
            onPointerUp={() => onPeekChange?.(false)}
            onPointerCancel={() => onPeekChange?.(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPeekChange?.(!firstPerson.peek);
              }
            }}
          >
            <Eye className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-3 rounded-md border border-border bg-panel/90 px-3 py-2 text-xs shadow backdrop-blur">
        <span className="font-medium">
          {describePosition(state.grid, firstPerson.cell)}, facing {DIR_NAMES[firstPerson.heading]}
          {firstPerson.peek ? ' (peeking)' : ''}
        </span>
        <span className={cn('items-center gap-1 text-muted', showPad ? 'hidden sm:flex' : 'flex')}>
          <Kbd>W</Kbd>
          <Kbd>S</Kbd> move <Kbd>A</Kbd>
          <Kbd>D</Kbd> turn <Kbd>P</Kbd> peek <Kbd>Esc</Kbd> exit
        </span>
        <Button size="sm" variant="outline" onClick={onExit}>
          Exit maze
        </Button>
      </div>
    </div>
  );
}
