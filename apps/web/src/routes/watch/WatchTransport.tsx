import { SPEED_PRESETS, type PlayerStatus } from '@maze/player';
import type { ViewMode } from '@maze/renderer';
import {
  Button,
  IconButton,
  Kbd,
  Separator,
  Slider,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import {
  Box,
  FastForward,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SkipForward,
  Square,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';

export interface WatchTransportProps {
  status: PlayerStatus | null;
  /** True once a solver is armed on a finished maze. */
  armed: boolean;
  onPlayToggle(): void;
  onStep(): void;
  onRunToEnd(): void;
  onReset(): void;
  speed: number;
  onSpeedChange(speed: number): void;
  mode: ViewMode;
  onModeChange(mode: ViewMode): void;
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

/** Media-style transport for the Watch page. */
export function WatchTransport(p: WatchTransportProps) {
  const playing = p.status === 'playing';
  const playable = p.armed && p.status !== null && p.status !== 'done';
  const speedIndex = speedToIndex(p.speed);
  return (
    <div
      role="toolbar"
      aria-label="Watch controls"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2"
    >
      <div role="group" aria-label="Playback" className="flex items-center gap-1.5">
        <Hint label={playing ? 'Pause' : 'Play'} keys="Space">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label={playing ? 'Pause' : 'Play'}
            aria-pressed={playing}
            onClick={p.onPlayToggle}
            disabled={!playable}
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </IconButton>
        </Hint>
        <Hint label="Step once" keys=".">
          <IconButton size="icon-sm" variant="outline" aria-label="Step once" onClick={p.onStep} disabled={!playable}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Run to end">
          <IconButton size="icon-sm" variant="outline" aria-label="Run to end" onClick={p.onRunToEnd} disabled={!playable}>
            <FastForward className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Reset the solver on this maze">
          <IconButton size="icon-sm" variant="outline" aria-label="Reset solver" onClick={p.onReset} disabled={!p.armed}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Slider
          className="w-40"
          label="Speed"
          hideLabel
          value={speedIndex}
          min={0}
          max={SPEED_PRESETS.length - 1}
          step={1}
          valueText={formatSpeed(p.speed)}
          onValueChange={(i) => p.onSpeedChange(indexToSpeed(i))}
        />
        <span className="w-24 text-xs tabular-nums text-muted" aria-hidden="true">
          {formatSpeed(p.speed)}
        </span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div role="group" aria-label="View" className="flex items-center gap-1.5">
        <ToggleGroup
          type="single"
          value={p.mode}
          aria-label="View mode"
          onValueChange={(v) => {
            if (v === '2d' || v === '3d') p.onModeChange(v);
          }}
        >
          <ToggleGroupItem value="2d" aria-label="2D view">
            <Square className="h-3.5 w-3.5" aria-hidden="true" /> 2D
          </ToggleGroupItem>
          <ToggleGroupItem value="3d" aria-label="3D view">
            <Box className="h-3.5 w-3.5" aria-hidden="true" /> 3D
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div role="group" aria-label="Maze" className="ml-auto flex items-center gap-1.5">
        <span className="font-mono text-xs text-muted" aria-label={`Seed ${p.seed}`}>
          {p.seed}
        </span>
        <Hint label="Same seed again">
          <IconButton size="icon-sm" variant="outline" aria-label="Regenerate same seed" onClick={p.onRegenerate}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="New maze with a fresh seed" keys="N">
          <Button size="sm" variant="secondary" onClick={p.onNewMaze}>
            <Shuffle className="h-4 w-4" aria-hidden="true" /> New maze
          </Button>
        </Hint>
      </div>
    </div>
  );
}
