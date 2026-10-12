/**
 * The BFS queue as a real DOM list (proj-mgmt/13 section 4.2): front first, the head marked as
 * the next cell to expand, each entry with its distance from the start. Two neighbouring
 * distances alternate in tint so the "ring" is visible without relying on colour alone (the
 * distance is printed too).
 */
import { describePosition, type Grid } from '@maze/core';
import { cn } from '@maze/ui';
import type { QueueSnapshot } from '../../learn/queueModel';
import { shortCell } from './cellText';

/** Longer queues show their front and a count: the head is what matters for reading along. */
const MAX_SHOWN = 24;

export interface QueueViewProps {
  grid: Grid | null;
  queue: QueueSnapshot | null;
  /** Where the flood starts: the start cell, or the goal (flood fill). */
  origin?: 'start' | 'goal';
}

export function QueueView({ grid, queue, origin = 'start' }: QueueViewProps) {
  if (!grid || !queue) return <p className="text-sm text-muted">Preparing the demo...</p>;
  const shown = queue.entries.slice(0, MAX_SHOWN);
  const hidden = queue.entries.length - shown.length;
  const added = new Set(queue.justAdded);
  const last = queue.lastExpanded;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-panel-2 p-2">
          <dt className="text-muted">In queue</dt>
          <dd className="text-base font-semibold tabular-nums">{queue.entries.length}</dd>
        </div>
        <div className="rounded-md bg-panel-2 p-2">
          <dt className="text-muted">Expanded</dt>
          <dd className="text-base font-semibold tabular-nums">{queue.expanded}</dd>
        </div>
        <div className="rounded-md bg-panel-2 p-2">
          <dt className="text-muted">Longest</dt>
          <dd className="text-base font-semibold tabular-nums">{queue.peak}</dd>
        </div>
      </dl>
      <p className="text-sm" aria-live="off">
        {last ? (
          <>
            Last taken from the front: <strong>{describePosition(grid, last.cell)}</strong>
            {last.depth !== null ? `, distance ${String(last.depth)}` : ''}.
          </>
        ) : (
          `Nothing expanded yet: the queue holds only the ${origin} cell.`
        )}
      </p>
      {queue.entries.length === 0 ? (
        <p className="text-sm text-muted">The queue is empty.</p>
      ) : (
        <ol
          aria-label="Queue, front first"
          className="flex flex-wrap gap-1.5 rounded-md border border-border bg-panel-2 p-2"
        >
          {shown.map((e, i) => {
            const ring = (e.depth ?? 0) % 2 === 0;
            return (
              <li
                key={`${String(e.cell)}-${String(i)}`}
                aria-label={`${i === 0 ? 'Front, next to expand: ' : ''}${describePosition(grid, e.cell)}${
                  e.depth !== null ? `, distance ${String(e.depth)}` : ''
                }${added.has(e.cell) ? ', just added' : ''}`}
                className={cn(
                  'flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums',
                  ring ? 'border-border bg-panel' : 'border-accent/40 bg-accent/10',
                  i === 0 && 'ring-2 ring-accent',
                  added.has(e.cell) && 'font-semibold',
                )}
              >
                {i === 0 ? (
                  <span
                    className="text-[10px] font-semibold text-accent uppercase"
                    aria-hidden="true"
                  >
                    next
                  </span>
                ) : null}
                <span aria-hidden="true">{shortCell(grid, e.cell)}</span>
                {e.depth !== null ? (
                  <span className="rounded bg-fg/10 px-1" aria-hidden="true">
                    d{e.depth}
                  </span>
                ) : null}
              </li>
            );
          })}
          {hidden > 0 ? (
            <li className="self-center px-1 text-xs text-muted">+{hidden} more at the back</li>
          ) : null}
        </ol>
      )}
      <p className="text-xs text-muted">
        New cells join at the back; the front is expanded next. Cells are shown as (row, column),
        with d = distance from the {origin}.
      </p>
    </div>
  );
}
