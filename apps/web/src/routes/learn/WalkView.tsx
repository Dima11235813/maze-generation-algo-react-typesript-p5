/**
 * The random walk of Aldous-Broder and Wilson's (M5): how far it has walked, how much of the
 * maze is in the tree, how long it has waited for a new cell, and (Wilson's) the loops erased.
 */
import type { WalkSnapshot } from '../../learn/walkModel';
import { Note, StatGrid } from './StructureParts';

export interface WalkViewProps {
  walk: WalkSnapshot;
  /** Wilson's erases loops; Aldous-Broder never does. */
  loopErasing: boolean;
}

export function WalkView({ walk, loopErasing }: WalkViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <StatGrid
        stats={[
          ['In the tree', `${String(walk.inTree)} / ${String(walk.cells)}`],
          ['Walk steps', walk.walkSteps],
          ['Longest wait', walk.longestWait],
          ...(loopErasing ? ([['Loops erased', walk.erasures]] as const) : []),
        ]}
      />
      <p className="text-sm" data-testid="walk-summary">
        {walk.walkSteps === 0
          ? 'The walk has not started: the tree holds only the start.'
          : `The walk has taken ${String(walk.walkSteps)} steps, the last ${String(walk.waited)} since the tree grew.`}
        {loopErasing && walk.lastErased.length > 0
          ? ` The last erasure removed ${String(walk.lastErased.length)} cell${walk.lastErased.length === 1 ? '' : 's'} (${String(walk.erasedCells)} in all).`
          : ''}
      </p>
      <Note>
        {loopErasing
          ? 'Each walk starts outside the tree and wanders until it touches it; whenever it crosses its own path, the loop is erased. What is left is carved in, so every walk adds a branch.'
          : 'The walk wanders at random over the whole grid and carves only where it enters a cell for the first time. Most later steps cross cells already in the tree, so the last few cells take the longest.'}
      </Note>
    </div>
  );
}
