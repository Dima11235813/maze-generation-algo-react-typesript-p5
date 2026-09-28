import { formatDuration, solvers } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import type { ReactNode } from 'react';
import type { MazeSession, SessionSnapshot } from '../../maze/session';

export interface MetricsPanelProps {
  session: MazeSession;
  snap: SessionSnapshot;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-[5.5rem] flex-col leading-tight">
      <dt className="text-[10px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Live generation/solve metrics (P-22) with correct mm:ss formatting (P-27). */
export function MetricsPanel({ session, snap }: MetricsPanelProps) {
  const gen = useStepPlayer(snap.genPlayer);
  const solve = useStepPlayer(snap.solvePlayer);
  const tracker = session.generation;
  const solveTracker = session.solveTracker;
  const m = snap.metrics;

  const rate = gen && gen.elapsedMs > 0 ? Math.round((gen.stepCount / gen.elapsedMs) * 1000) : 0;

  return (
    <dl
      aria-label="Maze metrics"
      className="flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-border bg-panel px-3 py-2"
    >
      <Stat label="Grid" value={snap.width && snap.height ? `${snap.width} x ${snap.height}` : '-'} />
      <Stat label="Cells" value={snap.width * snap.height || '-'} />
      {tracker ? (
        <>
          <Stat label="Steps" value={gen?.stepCount ?? 0} />
          <Stat label="Carves" value={tracker.carves} />
          <Stat label="Backtracks" value={tracker.backtracks} />
          <Stat label="Depth / max" value={`${tracker.depth} / ${tracker.maxDepth}`} />
          <Stat label="Elapsed" value={formatDuration(gen?.elapsedMs ?? 0)} />
          <Stat label="Rate" value={gen?.status === 'playing' ? `${rate} steps/s` : rate ? `${rate} avg` : '-'} />
        </>
      ) : null}
      {m ? (
        <>
          <Stat label="Dead ends" value={`${m.deadEnds} (${Math.round(m.deadEndRatio * 100)}%)`} />
          <Stat label="Solution" value={m.solutionLength === null ? 'none' : `${m.solutionLength} moves`} />
          <Stat label="Diameter" value={m.diameter} />
          <Stat label="Junctions" value={m.junctions} />
        </>
      ) : null}
      {solveTracker && solve ? (
        <>
          <Stat label="Solver" value={snap.solverId ? (solvers.get(snap.solverId)?.meta.name ?? snap.solverId) : '-'} />
          <Stat label="Expanded" value={solveTracker.expanded} />
          <Stat label="Discovered" value={solveTracker.discovered} />
          <Stat
            label="Path"
            value={
              snap.solveResult
                ? snap.solveResult.path
                  ? `${snap.solveResult.path.length - 1} moves`
                  : 'none'
                : solve.status === 'playing'
                  ? 'searching'
                  : '-'
            }
          />
        </>
      ) : null}
    </dl>
  );
}
