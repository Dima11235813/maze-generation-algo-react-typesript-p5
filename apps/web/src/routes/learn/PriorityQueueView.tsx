/**
 * The open set of Dijkstra, A* and greedy best-first as a list sorted by key (proj-mgmt/13
 * section 4.2): the smallest key is expanded next. Keys are printed, so nothing relies on colour.
 */
import { describePosition, type Grid } from '@maze/core';
import { cn } from '@maze/ui';
import type { PriorityEntry, PriorityQueueSnapshot } from '../../learn/priorityQueueModel';
import { shortCell } from './cellText';
import { Note, StatGrid } from './StructureParts';

const MAX_SHOWN = 24;

/** How the key reads for each solver. */
export type PriorityFlavour = 'dijkstra' | 'astar' | 'greedy';

function keyText(e: PriorityEntry, flavour: PriorityFlavour): string {
  switch (flavour) {
    case 'dijkstra':
      return `g ${String(e.key)}`;
    case 'astar':
      return e.g !== null && e.f !== null
        ? `f ${String(e.f)} = g ${String(e.g)} + h ${String(e.f - e.g)}`
        : `f ${String(e.key)}`;
    case 'greedy':
      return `h ${String(e.key)}`;
  }
}

const NOTE: Record<PriorityFlavour, string> = {
  dijkstra:
    'Always the cheapest known cell first (smallest g, the cost from the start). When a cheaper way to an open cell turns up, its g is lowered: that is a relaxation.',
  astar:
    'Smallest f first, where f = g (cost so far) + h (estimated cost to the goal). A good estimate keeps A* heading for the goal; an estimate that never overshoots keeps it optimal.',
  greedy:
    'Smallest h first: only the estimated distance to the goal counts, not the cost so far. Fast when the estimate is right, but it can be lured down long detours.',
};

export interface PriorityQueueViewProps {
  grid: Grid | null;
  pq: PriorityQueueSnapshot | null;
  flavour: PriorityFlavour;
}

export function PriorityQueueView({ grid, pq, flavour }: PriorityQueueViewProps) {
  if (!grid || !pq) return <p className="text-sm text-muted">Preparing the demo...</p>;
  const shown = pq.entries.slice(0, MAX_SHOWN);
  const hidden = pq.entries.length - shown.length;
  const relaxed = new Set(pq.justRelaxed);
  const added = new Set(pq.justAdded);
  const last = pq.lastExpanded;
  return (
    <div className="flex flex-col gap-3">
      <StatGrid
        stats={[
          ['Open', pq.entries.length],
          ['Expanded', pq.expanded],
          [
            flavour === 'greedy' ? 'Largest' : 'Relaxed',
            flavour === 'greedy' ? pq.peak : pq.relaxations,
          ],
        ]}
      />
      <p className="text-sm">
        {last ? (
          <>
            Last taken (smallest key): <strong>{describePosition(grid, last.cell)}</strong>,{' '}
            {keyText(last, flavour)}.
          </>
        ) : (
          'Nothing expanded yet: only the start cell is open.'
        )}
      </p>
      {pq.entries.length === 0 ? (
        <p className="text-sm text-muted">The open set is empty.</p>
      ) : (
        <ol
          aria-label="Priority queue, smallest key first"
          className="flex flex-col gap-1 rounded-md border border-border bg-panel-2 p-2"
        >
          {shown.map((e, i) => (
            <li
              key={e.cell}
              aria-label={`${i === 0 ? 'Smallest, next to expand: ' : ''}${describePosition(grid, e.cell)}, ${keyText(e, flavour)}${
                relaxed.has(e.cell) ? ', just relaxed' : added.has(e.cell) ? ', just added' : ''
              }`}
              className={cn(
                'flex items-center gap-2 rounded border border-border bg-panel px-2 py-0.5 font-mono text-xs tabular-nums',
                i === 0 && 'ring-2 ring-accent',
                (relaxed.has(e.cell) || added.has(e.cell)) && 'font-semibold',
              )}
            >
              {i === 0 ? (
                <span
                  className="text-[10px] font-semibold text-accent uppercase"
                  aria-hidden="true"
                >
                  min
                </span>
              ) : null}
              <span aria-hidden="true">{shortCell(grid, e.cell)}</span>
              <span className="ml-auto" aria-hidden="true">
                {keyText(e, flavour)}
                {relaxed.has(e.cell) ? ' (relaxed)' : ''}
              </span>
            </li>
          ))}
          {hidden > 0 ? (
            <li className="px-2 text-xs text-muted">+{hidden} more with larger keys</li>
          ) : null}
        </ol>
      )}
      <Note>{NOTE[flavour]}</Note>
    </div>
  );
}
