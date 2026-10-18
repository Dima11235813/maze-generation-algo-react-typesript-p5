/** The pair demo's scoreboard: cells expanded and path length per solver, against the shortest. */
import type { PairLane } from '../../learn/pairDemo';
import { Note } from './StructureParts';

export interface PairStatsViewProps {
  lanes: readonly PairLane[];
  shortest: number | null;
}

export function PairStatsView({ lanes, shortest }: PairStatsViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">Each search so far</caption>
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="py-1 font-medium">
              Search
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Expanded
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Path
            </th>
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.solverId} className="border-t border-border">
              <th scope="row" className="py-1 font-medium">
                {lane.name}
              </th>
              <td className="py-1 text-right">{lane.expanded}</td>
              <td className="py-1 text-right">
                {lane.pathMoves === null ? (
                  <span className="text-muted">not yet</span>
                ) : (
                  <>
                    {lane.pathMoves} moves
                    {shortest !== null && lane.pathMoves > shortest ? (
                      <span className="text-muted"> (+{lane.pathMoves - shortest})</span>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm">
        {shortest === null
          ? 'The goal cannot be reached on this maze.'
          : `The shortest possible path is ${String(shortest)} moves.`}
      </p>
      <Note>
        Both searches take one step per tick, so the step count is a fair clock. This maze has
        loops, so there is more than one way to the goal.
      </Note>
    </div>
  );
}
