/**
 * A stack as a DOM list, top first (proj-mgmt/13 section 4.2): DFS's open cells, or the
 * recursive backtracker's path from the start to the current cell.
 */
import { describePosition, type Grid } from '@maze/core';
import { cn } from '@maze/ui';
import type { StackSnapshot } from '../../learn/stackModel';
import { shortCell } from './cellText';
import { Note, StatGrid } from './StructureParts';

const MAX_SHOWN = 24;

export interface StackViewProps {
  grid: Grid | null;
  stack: StackSnapshot | null;
  /** 'dfs': the top is expanded next. 'path': the stack is the way back to the start. */
  variant: 'dfs' | 'path';
}

export function StackView({ grid, stack, variant }: StackViewProps) {
  if (!grid || !stack) return <p className="text-sm text-muted">Preparing the demo...</p>;
  const topFirst = [...stack.cells].reverse();
  const shown = topFirst.slice(0, MAX_SHOWN);
  const hidden = topFirst.length - shown.length;
  const pushed = new Set(stack.justPushed);
  const topLabel = variant === 'dfs' ? 'Top, next to expand' : 'Top, the current cell';
  return (
    <div className="flex flex-col gap-3">
      <StatGrid
        stats={[
          ['On the stack', stack.cells.length],
          [variant === 'dfs' ? 'Expanded' : 'Backtracks', stack.pops],
          ['Deepest', stack.peak],
        ]}
      />
      <p className="text-sm">
        {stack.lastPopped !== null ? (
          <>
            Last taken from the top: <strong>{describePosition(grid, stack.lastPopped)}</strong>.
          </>
        ) : variant === 'dfs' ? (
          'Nothing expanded yet: the stack holds only the start cell.'
        ) : (
          'No backtracking yet.'
        )}
      </p>
      {stack.cells.length === 0 ? (
        <p className="text-sm text-muted">The stack is empty.</p>
      ) : (
        <ol
          aria-label="Stack, top first"
          className="flex flex-col gap-1 rounded-md border border-border bg-panel-2 p-2"
        >
          {shown.map((cell, i) => (
            <li
              key={`${String(cell)}-${String(i)}`}
              aria-label={`${i === 0 ? `${topLabel}: ` : ''}${describePosition(grid, cell)}${
                pushed.has(cell) ? ', just pushed' : ''
              }`}
              className={cn(
                'flex items-center gap-2 rounded border border-border bg-panel px-2 py-0.5 font-mono text-xs tabular-nums',
                i === 0 && 'ring-2 ring-accent',
                pushed.has(cell) && 'font-semibold',
              )}
            >
              {i === 0 ? (
                <span
                  className="text-[10px] font-semibold text-accent uppercase"
                  aria-hidden="true"
                >
                  top
                </span>
              ) : null}
              <span aria-hidden="true">{shortCell(grid, cell)}</span>
            </li>
          ))}
          {hidden > 0 ? <li className="px-2 text-xs text-muted">+{hidden} more below</li> : null}
        </ol>
      )}
      <Note>
        {variant === 'dfs'
          ? 'Last in, first out: new cells go on top and the top is expanded next, so DFS dives deep before it looks around.'
          : 'Each carve pushes the new cell; at a dead end the generator pops back to the last cell with an unvisited neighbour.'}
      </Note>
    </div>
  );
}
