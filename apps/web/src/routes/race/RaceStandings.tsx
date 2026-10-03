import { compositeScores, type RaceResult } from '@maze/core';
import { cn } from '@maze/ui';
import { solverName, type LaneStanding } from '../../maze/race';
import { describeOutcome, winnerSentence } from './raceView';

const STATUS_TEXT: Record<LaneStanding['status'], string> = {
  running: 'Racing',
  goal: 'Finished',
  'no-path': 'No path',
  out: 'Stopped',
};

export interface RaceStandingsProps {
  standings: readonly LaneStanding[];
  /** Shortest possible path, to flag optimal paths. */
  solutionLength: number | null;
}

/** Live table: one row per racer, in lane order, updated every tick. */
export function RaceStandings({ standings, solutionLength }: RaceStandingsProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Live standings">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1 pr-2 font-medium">
              Racer
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              Status
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              Expanded
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Path
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.agentId} className="border-t border-border">
              <th scope="row" className="py-1 pr-2 text-left font-medium">
                {s.name}
              </th>
              <td className="py-1 pr-2">
                {STATUS_TEXT[s.status]}
                {s.finishedAtTick !== null ? (
                  <span className="text-xs text-muted"> (tick {s.finishedAtTick})</span>
                ) : null}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{s.expanded}</td>
              <td className="py-1 text-right tabular-nums">
                {s.pathLength === null ? '-' : `${s.pathLength} moves`}
                {s.pathLength !== null && s.pathLength === solutionLength ? (
                  <>
                    <span className="sr-only"> (optimal)</span>
                    <span aria-hidden="true" className="ml-1 text-xs text-accent">
                      ★
                    </span>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {solutionLength !== null ? (
        <p className="pt-2 text-xs text-muted">
          Shortest possible path: {solutionLength} moves. <span aria-hidden="true">★</span> marks an
          optimal path.
        </p>
      ) : null}
    </div>
  );
}

export interface RaceRankingProps {
  result: RaceResult;
  solutionLength: number | null;
}

/** Final ranking, best first, with the columns the scoring rule looked at. */
export function RaceRanking({ result, solutionLength }: RaceRankingProps) {
  const composite =
    result.config.scoring === 'composite'
      ? compositeScores(
          result.perAgent,
          result.ranking.filter(
            (id) => result.perAgent[id]?.reachedGoal && !result.perAgent[id]?.disqualified,
          ),
          { solutionLength },
        )
      : null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Final ranking">
        <caption className="pb-2 text-left text-sm font-medium">{winnerSentence(result)}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1 pr-2 font-medium">
              #
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              Racer
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              Result
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              Expanded
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {composite ? 'Score' : 'Path'}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.ranking.map((id, i) => {
            const r = result.perAgent[id];
            return (
              <tr key={id} className={cn('border-t border-border', i === 0 && 'font-semibold')}>
                <td className="py-1 pr-2 tabular-nums">{i + 1}</td>
                <th scope="row" className="py-1 pr-2 text-left font-medium">
                  {solverName(id)}
                </th>
                <td className="py-1 pr-2">{describeOutcome(result, id)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r?.expanded ?? '-'}</td>
                <td className="py-1 text-right tabular-nums">
                  {composite
                    ? composite[id] === undefined
                      ? '-'
                      : (composite[id] ?? 0).toFixed(2)
                    : r?.pathLength === null || r?.pathLength === undefined
                      ? '-'
                      : `${r.pathLength} moves`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {composite ? (
        <p className="pt-2 text-xs text-muted">
          Composite score, lower is better: half finish tick, three tenths cells expanded, one fifth
          path length, each relative to the best racer.
        </p>
      ) : null}
    </div>
  );
}
