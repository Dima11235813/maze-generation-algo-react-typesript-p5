/**
 * Two solvers side by side on one maze (M3 "DFS or BFS?"): a canvas per solver, then one
 * playback row, the breakpoint row, the speed slider and the timeline below both (never on the
 * mazes). Both advance in lockstep, one step each per tick.
 */
import { SPEED_PRESETS } from '@maze/player';
import { Slider } from '@maze/ui';
import { RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { useBreakpoint } from '../../layout/breakpoints';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';
import type { PairLane } from '../../learn/pairDemo';
import type { usePairDemo } from '../../learn/usePairDemo';
import { MazeCanvas } from '../play/MazeCanvas';
import { TimelineBar } from '../play/TimelineBar';
import { playbackActions } from '../tools/actions';
import { MazeTools, type ToolGroup } from '../tools/MazeTools';
import { BreakpointBar } from './BreakpointBar';
import { useDemoCanvas } from './useDemoCanvas';

const noop = (): void => undefined;
/** Any value works: the renderers fit the maze to the canvas. */
const CELL = 24;

function laneText(lane: PairLane): string {
  const path = lane.pathMoves === null ? 'no path yet' : `path ${String(lane.pathMoves)} moves`;
  return `${String(lane.expanded)} expanded, ${path}`;
}

export function PairDemo({ demo }: { demo: ReturnType<typeof usePairDemo> }) {
  const { model, playerSnap, lanes, speed, setSpeed } = demo;
  const { player, maze } = model;
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';
  const { theme, options, camera } = useDemoCanvas(maze.grid.height, CELL);
  const sinks = useMemo(() => model.solverIds.map((_, i) => model.renderSink(i)), [model]);
  const status = playerSnap?.status ?? null;
  const stepCount = playerSnap?.stepCount ?? 0;

  const groups: ToolGroup[] = [
    {
      id: 'playback',
      label: 'Playback',
      actions: [
        ...playbackActions({
          status,
          armed: true,
          canStepBack: stepCount > 0,
          onToggle: () => {
            player.toggle();
          },
          onStepBack: () => {
            player.stepBack();
          },
          onStep: () => {
            player.step();
          },
          onRunToEnd: () => {
            player.runToEnd();
          },
        }),
        {
          id: 'restart',
          label: 'Restart the demo',
          keys: 'Home',
          icon: RotateCcw,
          onPress: () => {
            player.restart();
          },
          disabled: stepCount === 0,
        },
      ],
    },
  ];

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-border">
        {lanes.map((lane, i) => (
          <figure key={lane.solverId} className="relative m-0 flex min-h-0 flex-col bg-panel">
            <figcaption className="flex flex-col px-2 py-1 text-xs">
              <span className="font-medium">{lane.name}</span>
              <span className="text-muted tabular-nums">{laneText(lane)}</span>
            </figcaption>
            <div className="relative flex min-h-48 flex-1 flex-col">
              <MazeCanvas
                session={sinks[i] ?? { setRenderRequest: noop }}
                mode="2d"
                theme={theme}
                options={options}
                camera={camera}
                firstPerson={null}
                maze={maze}
                generation={null}
                solve={model.trackers[i] ?? null}
                label={`${lane.name}: ${String(maze.grid.width)} by ${String(maze.grid.height)} cells, ${laneText(lane)}`}
                onHostSize={noop}
                pageScroll={touchLayout}
              />
            </div>
          </figure>
        ))}
      </div>
      <MazeTools variant="row" groups={groups} />
      <BreakpointBar run={demo.breakpoint} />
      <div className="flex items-center gap-3 border-t border-border bg-panel px-3 py-2">
        <Slider
          className="min-w-0 flex-1"
          label="Demo speed"
          hideLabel
          value={speedToIndex(speed)}
          min={0}
          max={SPEED_PRESETS.length - 1}
          step={1}
          valueText={formatSpeed(speed)}
          onValueChange={(i) => {
            setSpeed(indexToSpeed(i));
          }}
        />
        <span
          className="w-24 shrink-0 text-right text-xs text-muted tabular-nums"
          aria-hidden="true"
        >
          {formatSpeed(speed)}
        </span>
      </div>
      <TimelineBar
        snapshot={playerSnap}
        label="Demo"
        onSeek={(n) => {
          player.pause();
          player.seek(n);
        }}
        onRestart={() => {
          player.restart();
        }}
      />
    </>
  );
}
