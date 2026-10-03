import { generators } from '@maze/core';
import type { CameraState, RenderOptions, RenderTheme } from '@maze/renderer';
import { useSyncExternalStore } from 'react';
import type { MazeSession } from '../../maze/session';
import { MazeCanvas, type HostSize } from '../play/MazeCanvas';

export interface CompareLaneProps {
  index: number;
  algoId: string;
  session: MazeSession;
  theme: RenderTheme;
  options: RenderOptions;
  camera: CameraState;
  onHostSize: (size: HostSize) => void;
}

/** One side-by-side lane: algorithm heading, 2D canvas and a status line. */
export function CompareLane({
  index,
  algoId,
  session,
  theme,
  options,
  camera,
  onHostSize,
}: CompareLaneProps) {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const name = generators.get(algoId)?.meta.name ?? algoId;
  const tracker = session.generation;
  const status =
    snap.phase === 'empty'
      ? 'waiting'
      : snap.phase === 'generating'
        ? `generating, ${tracker?.steps ?? 0} steps, depth ${tracker?.depth ?? 0}`
        : `complete, ${tracker?.steps ?? 0} steps`;
  return (
    <section
      aria-labelledby={`lane-${index}-heading`}
      data-testid="compare-lane"
      className="flex h-[60svh] min-h-[18rem] min-w-0 flex-col rounded-md border border-border bg-panel md:h-[46svh] 2xl:h-[56svh]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
        <h3 id={`lane-${index}-heading`} className="truncate text-sm font-medium">
          {name}
        </h3>
        <span className="text-xs text-muted">{status}</span>
      </header>
      <MazeCanvas
        session={session}
        mode="2d"
        theme={theme}
        options={options}
        camera={camera}
        firstPerson={null}
        maze={snap.state}
        generation={tracker}
        solve={null}
        label={`${name}: ${snap.width && snap.height ? `${snap.width} by ${snap.height} cells, ` : ''}${status}`}
        onHostSize={onHostSize}
      />
    </section>
  );
}
