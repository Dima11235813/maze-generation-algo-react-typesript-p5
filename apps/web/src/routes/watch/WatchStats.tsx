import { formatDuration, solverRelativeMetrics, type SolveTracker } from '@maze/core';
import type { StepPlayerSnapshot } from '@maze/player';
import type { ReactNode } from 'react';
import type { SessionSnapshot } from '../../maze/session';
import { optimalText } from '../../maze/statsText';

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col leading-tight">
      <dt className="text-[10px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export interface WatchStatsProps {
  snap: SessionSnapshot;
  tracker: SolveTracker | null;
  player: StepPlayerSnapshot<unknown> | null;
  hideHeading?: boolean;
}

function percent(ratio: number): string {
  return `${String(Math.round(ratio * 100))}%`;
}

/** "1.00x" (optimal) or "1.35x"; null ratio -> "-". */
function times(ratio: number | null): string {
  return ratio === null ? '-' : `${ratio.toFixed(2)}x`;
}

/**
 * Live solver statistics (expanded, discovered, frontier peak, path length, elapsed) plus the
 * solver-relative metrics: share of the maze explored and path length against the shortest.
 */
export function WatchStats({ snap, tracker, player, hideHeading = false }: WatchStatsProps) {
  const result = snap.solveResult;
  const stats = result?.stats ?? null;
  const cells = snap.metrics?.cells ?? snap.width * snap.height;
  const relative = stats && snap.metrics ? solverRelativeMetrics(stats, snap.metrics) : null;
  // While running, the explored share follows the tracker; the final value comes from the stats.
  const exploredRatio =
    relative?.expandedRatio ?? (cells > 0 ? (tracker?.expanded ?? 0) / cells : 0);
  return (
    <section aria-labelledby="stats-heading" className="flex flex-col gap-2">
      <h3
        id="stats-heading"
        className={
          hideHeading ? 'sr-only' : 'text-xs font-semibold tracking-wide text-muted uppercase'
        }
      >
        Statistics
      </h3>
      <dl aria-label="Solver statistics" className="grid grid-cols-3 gap-x-3 gap-y-2">
        <Stat label="Expanded" value={tracker?.expanded ?? 0} />
        <Stat label="Discovered" value={tracker?.discovered ?? 0} />
        <Stat label="Frontier peak" value={stats ? stats.frontierPeak : '-'} />
        <Stat
          label="Path length"
          value={
            result
              ? result.path
                ? `${result.path.length - 1} moves`
                : 'no path'
              : player?.status === 'playing'
                ? 'searching'
                : '-'
          }
        />
        <Stat label="Steps" value={player?.stepCount ?? 0} />
        <Stat label="Elapsed" value={formatDuration(player?.elapsedMs ?? 0)} />
        <Stat
          label="Optimal"
          value={stats ? optimalText(stats.optimal, relative?.optimalityRatio ?? null) : '-'}
        />
        <Stat
          label="Maze"
          value={snap.width && snap.height ? `${snap.width} x ${snap.height}` : '-'}
        />
        <Stat
          label="Shortest"
          value={
            snap.metrics
              ? snap.metrics.solutionLength === null
                ? 'none'
                : `${snap.metrics.solutionLength} moves`
              : '-'
          }
        />
        <Stat label="Explored" value={tracker || relative ? percent(exploredRatio) : '-'} />
        <Stat label="Vs shortest" value={relative ? times(relative.optimalityRatio) : '-'} />
      </dl>
    </section>
  );
}
