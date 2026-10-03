import { SPEED_PRESETS, type PlayerStatus } from '@maze/player';
import {
  Button,
  IconButton,
  Kbd,
  Separator,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import {
  FastForward,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SkipForward,
  StepBack,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';
import type { ViewChoice } from '../../maze/treeView';
import { ViewModeToggle } from '../tree/ViewModeToggle';

export interface WatchTransportProps {
  status: PlayerStatus | null;
  /** True once a solver is armed on a finished maze. */
  armed: boolean;
  onPlayToggle(): void;
  onStep(): void;
  onStepBack(): void;
  canStepBack: boolean;
  onRunToEnd(): void;
  onReset(): void;
  speed: number;
  onSpeedChange(speed: number): void;
  view: ViewChoice;
  onViewChange(view: ViewChoice): void;
  onNewMaze(): void;
  onRegenerate(): void;
  seed: string;
}

function Hint({ label, keys, children }: { label: string; keys?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {keys ? <Kbd>{keys}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Media-style transport for the Watch page; collapses gracefully on phones. */
export function WatchTransport(p: WatchTransportProps) {
  const playing = p.status === 'playing';
  const playable = p.armed && p.status !== null && p.status !== 'done';
  const speedIndex = speedToIndex(p.speed);
  return (
    <div
      role="toolbar"
      aria-label="Watch controls"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-2 py-1.5 sm:px-3 sm:py-2"
    >
      <div
        role="group"
        aria-label="Playback"
        className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto"
      >
        <Hint label="Step back" keys=",">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Step back"
            onClick={p.onStepBack}
            disabled={!p.canStepBack}
          >
            <StepBack className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label={playing ? 'Pause' : 'Play'} keys="Space">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label={playing ? 'Pause' : 'Play'}
            aria-pressed={playing}
            onClick={p.onPlayToggle}
            disabled={!playable}
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </IconButton>
        </Hint>
        <Hint label="Step once" keys=".">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Step once"
            onClick={p.onStep}
            disabled={!playable}
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Run to end">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Run to end"
            onClick={p.onRunToEnd}
            disabled={!playable}
          >
            <FastForward className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Reset the solver on this maze">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Reset solver"
            onClick={p.onReset}
            disabled={!p.armed}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Slider
          className="min-w-0 flex-1 sm:w-40 sm:flex-none"
          label="Speed"
          hideLabel
          value={speedIndex}
          min={0}
          max={SPEED_PRESETS.length - 1}
          step={1}
          valueText={formatSpeed(p.speed)}
          onValueChange={(i) => {
            p.onSpeedChange(indexToSpeed(i));
          }}
        />
        <span className="w-16 shrink-0 text-xs tabular-nums text-muted sm:w-24" aria-hidden="true">
          {formatSpeed(p.speed)}
        </span>
      </div>

      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      <div role="group" aria-label="View" className="flex items-center gap-1.5">
        <ViewModeToggle value={p.view} onChange={p.onViewChange} />
      </div>

      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      <div role="group" aria-label="Maze" className="ml-auto flex items-center gap-1.5">
        <span
          className="hidden font-mono text-xs text-muted md:inline"
          aria-label={`Seed ${p.seed}`}
        >
          {p.seed}
        </span>
        <Hint label="Same seed again">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Regenerate same seed"
            onClick={p.onRegenerate}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="New maze with a fresh seed" keys="N">
          <Button size="sm" variant="secondary" onClick={p.onNewMaze} aria-label="New maze">
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden min-[420px]:inline">New maze</span>
          </Button>
        </Hint>
      </div>
    </div>
  );
}
