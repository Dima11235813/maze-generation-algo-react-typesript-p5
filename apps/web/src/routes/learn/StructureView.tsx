/**
 * The data structure of the running solver, chosen by `solveStructureFor`, plus the distance
 * map for solvers that settle distances. Shared by lesson pages and Watch (WI-06b).
 */
import { solvers, type Grid } from '@maze/core';
import type { SolveStructureState } from '../../learn/solveStructure';
import { DistanceView } from './DistanceView';
import { PriorityQueueView, type PriorityFlavour } from './PriorityQueueView';
import { QueueView } from './QueueView';
import { StackView } from './StackView';

function flavourOf(solverId: string): PriorityFlavour {
  if (solverId === 'dijkstra') return 'dijkstra';
  if (solverId === 'greedy-best-first') return 'greedy';
  return 'astar';
}

export interface StructureViewProps {
  grid: Grid | null;
  state: SolveStructureState | null;
}

export function StructureView({ grid, state }: StructureViewProps) {
  if (!grid || !state) return <p className="text-sm text-muted">Preparing the demo...</p>;
  const { structure, distances, solverId, origin } = state;
  const name = solvers.get(solverId)?.meta.name ?? solverId;
  return (
    <div className="flex flex-col gap-4">
      {structure.kind === 'queue' ? (
        <QueueView grid={grid} queue={structure.queue} origin={origin} />
      ) : structure.kind === 'stack' ? (
        <StackView grid={grid} stack={structure.stack} variant="dfs" />
      ) : structure.kind === 'priority' ? (
        <PriorityQueueView grid={grid} pq={structure.pq} flavour={flavourOf(solverId)} />
      ) : (
        <p className="text-sm text-muted">
          {name} keeps no queue, stack or heap of cells to visit: it decides each move from what it
          sees around it (and any marks it has left), so there is no frontier to show.
        </p>
      )}
      {distances ? (
        <section aria-label={`Distances from the ${origin}`} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Distances</h4>
          <DistanceView
            grid={grid}
            distances={distances}
            unit={solverId === 'bfs' || solverId === 'flood-fill' ? 'steps' : 'cost'}
            origin={origin}
          />
        </section>
      ) : null}
    </div>
  );
}
