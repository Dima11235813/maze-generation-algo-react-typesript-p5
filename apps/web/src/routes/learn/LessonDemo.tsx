/**
 * The lesson's live demo: the maze in 2D with the solver overlay (or the generator carving it),
 * the playback row below it (never on the maze), a speed slider and the timeline for seeking
 * and restarting.
 */
import { SPEED_PRESETS } from '@maze/player';
import { Slider } from '@maze/ui';
import { RotateCcw } from 'lucide-react';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';
import type { useLessonDemo } from '../../learn/useLessonDemo';
import { MazeCanvas } from '../play/MazeCanvas';
import { TimelineBar } from '../play/TimelineBar';
import { playbackActions } from '../tools/actions';
import { MazeTools, type ToolGroup } from '../tools/MazeTools';
import { BreakpointBar } from './BreakpointBar';
import { useDemoCanvas } from './useDemoCanvas';

const noop = (): void => undefined;

export interface LessonDemoProps {
  demo: ReturnType<typeof useLessonDemo>;
  /** The solver or generator the demo runs. */
  algorithmName: string;
  pageScroll: boolean;
}

export function LessonDemo({ demo, algorithmName, pageScroll }: LessonDemoProps) {
  const { session, snap, playerSnap, armed, generating, speed, setSpeed } = demo;
  const { theme, options, camera } = useDemoCanvas(snap.height || 1, snap.cellSize);

  const status = playerSnap?.status ?? null;
  const groups: ToolGroup[] = [
    {
      id: 'playback',
      label: 'Playback',
      actions: [
        ...playbackActions({
          status,
          armed,
          canStepBack: armed && (playerSnap?.stepCount ?? 0) > 0,
          onToggle: () => {
            session.toggle();
          },
          onStepBack: () => {
            session.stepBack();
          },
          onStep: () => {
            session.step();
          },
          onRunToEnd: () => {
            session.runToEnd();
          },
        }),
        {
          id: 'restart',
          label: 'Restart the demo',
          keys: 'Home',
          icon: RotateCcw,
          onPress: () => {
            session.restart();
          },
          disabled: !armed || (playerSnap?.stepCount ?? 0) === 0,
        },
      ],
    },
  ];

  const label =
    snap.phase === 'empty'
      ? 'Demo maze, preparing'
      : `Demo maze: ${String(snap.width)} by ${String(snap.height)} cells, ${algorithmName} ${status ?? 'ready'}`;

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <MazeCanvas
          session={session}
          mode="2d"
          theme={theme}
          options={options}
          camera={camera}
          firstPerson={null}
          maze={snap.state}
          generation={generating ? session.generation : null}
          solve={generating ? null : session.solveTracker}
          label={label}
          onHostSize={noop}
          pageScroll={pageScroll}
        />
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
        snapshot={armed ? playerSnap : null}
        label="Demo"
        onSeek={(n) => {
          session.seek(n);
        }}
        onRestart={() => {
          session.restart();
        }}
      />
    </>
  );
}
