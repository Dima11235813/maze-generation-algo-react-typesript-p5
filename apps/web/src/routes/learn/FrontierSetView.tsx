/**
 * Prim's frontier as a DOM list (proj-mgmt/13 section 4.2): the cells next to the tree, in the
 * order they joined the frontier. It is a bag, not a queue: Prim's takes a random one each round.
 */
import { describePosition, type Grid } from '@maze/core';
import { cn } from '@maze/ui';
import type { FrontierSetSnapshot } from '../../learn/frontierSetModel';
import { shortCell } from './cellText';
import { Note, StatGrid } from './StructureParts';

const MAX_SHOWN = 30;

export interface FrontierSetViewProps {
  grid: Grid | null;
  frontier: FrontierSetSnapshot | null;
}

export function FrontierSetView({ grid, frontier }: FrontierSetViewProps) {
  if (!grid || !frontier) return <p className="text-sm text-muted">Preparing the demo...</p>;
  const shown = frontier.cells.slice(0, MAX_SHOWN);
  const hidden = frontier.cells.length - shown.length;
  const added = new Set(frontier.justAdded);
  return (
    <div className="flex flex-col gap-3">
      <StatGrid
        stats={[
          ['In the tree', frontier.inTree],
          ['Frontier', frontier.cells.length],
          ['Largest', frontier.peak],
        ]}
      />
      <p className="text-sm">
        {frontier.lastTaken !== null ? (
          <>
            Last taken into the tree: <strong>{describePosition(grid, frontier.lastTaken)}</strong>
            {frontier.justAdded.length > 0
              ? `, which added ${String(frontier.justAdded.length)} new frontier cell${frontier.justAdded.length === 1 ? '' : 's'}.`
              : ', which added no new frontier cells.'}
          </>
        ) : frontier.inTree === 0 ? (
          'Nothing in the tree yet.'
        ) : (
          'The tree holds the start; its neighbours are the first frontier.'
        )}
      </p>
      {frontier.cells.length === 0 ? (
        <p className="text-sm text-muted">The frontier is empty.</p>
      ) : (
        <ul
          aria-label="Frontier cells"
          className="flex flex-wrap gap-1 rounded-md border border-border bg-panel-2 p-2"
        >
          {shown.map((cell) => (
            <li
              key={cell}
              aria-label={`${describePosition(grid, cell)}${added.has(cell) ? ', just added' : ''}`}
              className={cn(
                'rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-xs tabular-nums',
                added.has(cell) && 'font-semibold ring-1 ring-accent',
              )}
            >
              <span aria-hidden="true">{shortCell(grid, cell)}</span>
            </li>
          ))}
          {hidden > 0 ? <li className="px-1 text-xs text-muted">+{hidden} more</li> : null}
        </ul>
      )}
      <Note>
        Every round takes one random frontier cell into the tree, joined by one passage, and adds
        its neighbours that are in neither. The tree grows outwards from the start like a blob.
      </Note>
    </div>
  );
}
