import { DIR_NAMES, describePosition, type MazeState } from '@maze/core';
import type { FirstPersonState } from '@maze/renderer';
import { Button, Kbd } from '@maze/ui';

export interface FirstPersonHudProps {
  state: MazeState;
  firstPerson: FirstPersonState;
  reachedGoal: boolean;
  onExit(): void;
}

/** Overlay shown in "Run Maze" mode (P-17): position, heading, key legend, goal state. */
export function FirstPersonHud({ state, firstPerson, reachedGoal, onExit }: FirstPersonHudProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
      {reachedGoal ? (
        <div role="status" className="pointer-events-auto rounded-md border border-accent bg-panel px-4 py-2 text-sm font-semibold shadow">
          You reached the goal!
        </div>
      ) : null}
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-md border border-border bg-panel/90 px-3 py-2 text-xs shadow backdrop-blur">
        <span className="font-medium">
          {describePosition(state.grid, firstPerson.cell)}, facing {DIR_NAMES[firstPerson.heading]}
          {firstPerson.peek ? ' (peeking)' : ''}
        </span>
        <span className="flex items-center gap-1 text-muted">
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
