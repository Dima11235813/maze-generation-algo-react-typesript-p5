import type { MazeState, SolveTracker } from '@maze/core';
import type { CameraState, RenderOptions, RenderTheme } from '@maze/renderer';
import { cn } from '@maze/ui';
import { Trophy } from 'lucide-react';
import type { LaneStanding } from '../../maze/race';
import { MazeCanvas, type RenderRequestSink } from '../play/MazeCanvas';

export interface RaceLaneProps {
  standing: LaneStanding;
  sink: RenderRequestSink;
  maze: MazeState;
  tracker: SolveTracker;
  theme: RenderTheme;
  options: RenderOptions;
  camera: CameraState;
  /** Final rank (1-based) once the race is over. */
  rank: number | null;
  /** Let vertical swipes over the lane scroll the page (touch layouts). */
  pageScroll: boolean;
}

/** Race mazes have a fixed size (it is part of the URL), so lane sizes do not matter. */
const ignoreSize = (): void => undefined;

export function laneStatusText(s: LaneStanding): string {
  switch (s.status) {
    case 'goal':
      return `reached the goal at tick ${s.finishedAtTick ?? '?'}, path ${s.pathLength ?? '?'} moves`;
    case 'no-path':
      return `finished without a path at tick ${s.finishedAtTick ?? '?'}`;
    case 'out':
      return `stopped at tick ${s.finishedAtTick ?? '?'}`;
    case 'running':
    default:
      return s.steps === 0 ? 'on the start line' : `racing, ${s.expanded} cells expanded`;
  }
}

/** Compact status for narrow lanes (phones, four lanes on a tablet). */
export function laneStatusShort(s: LaneStanding): string {
  switch (s.status) {
    case 'goal':
      return `Goal at tick ${s.finishedAtTick ?? '?'} · ${s.pathLength ?? '?'} moves`;
    case 'no-path':
      return `No path · tick ${s.finishedAtTick ?? '?'}`;
    case 'out':
      return `Stopped · tick ${s.finishedAtTick ?? '?'}`;
    case 'running':
    default:
      return s.steps === 0 ? 'Ready' : `${s.expanded} expanded`;
  }
}

/** One racer: name, live status and a 2D canvas with that agent's search overlay. */
export function RaceLane({
  standing,
  sink,
  maze,
  tracker,
  theme,
  options,
  camera,
  rank,
  pageScroll,
}: RaceLaneProps) {
  const headingId = `race-lane-${standing.index}-heading`;
  const status = laneStatusText(standing);
  const winner = rank === 1;
  return (
    <section
      aria-labelledby={headingId}
      data-testid="race-lane"
      className={cn(
        '@container flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border bg-panel',
        winner ? 'border-accent ring-1 ring-accent' : 'border-border',
      )}
    >
      <header className="flex min-h-8 flex-wrap items-center gap-x-2 border-b border-border px-2 py-1">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 @[30rem]:basis-0">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[11px] font-semibold tabular-nums"
            aria-hidden="true"
          >
            {rank ?? standing.index + 1}
          </span>
          <h3 id={headingId} className="min-w-0 truncate text-sm font-medium">
            {standing.name}
            {winner ? <span className="sr-only"> (winner)</span> : null}
          </h3>
          {winner ? <Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
        </div>
        {/* Narrow lanes put a short status on its own line; wide ones keep it beside the name. */}
        <span className="w-full truncate text-xs text-muted @[30rem]:hidden" aria-hidden="true">
          {laneStatusShort(standing)}
        </span>
        <span
          className="hidden max-w-[60%] truncate text-xs text-muted @[30rem]:inline"
          aria-hidden="true"
        >
          {status}
        </span>
      </header>
      <MazeCanvas
        session={sink}
        mode="2d"
        theme={theme}
        options={options}
        camera={camera}
        firstPerson={null}
        maze={maze}
        generation={null}
        solve={tracker}
        label={`${standing.name} lane: ${maze.grid.width} by ${maze.grid.height} cells, ${status}`}
        onHostSize={ignoreSize}
        className="min-h-[9rem]"
        pageScroll={pageScroll}
      />
    </section>
  );
}
