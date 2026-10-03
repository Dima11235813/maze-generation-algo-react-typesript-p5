import { SPEED_PRESETS, type PlayerStatus } from '@maze/player';
import {
  IconButton,
  Kbd,
  Label,
  Separator,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import { Dices, FastForward, Link2, Pause, Play, SkipForward, StepBack } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';

export interface RaceToolbarProps {
  status: PlayerStatus | null;
  canStepBack: boolean;
  onPlayToggle: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onRunToEnd: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  seed: string;
  onSeedChange: (seed: string) => void;
  onRandomSeed: () => void;
  onCopyLink: () => void;
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

/** Shared transport for every lane plus the seed that fixes the maze. */
export function RaceToolbar(p: RaceToolbarProps) {
  const playing = p.status === 'playing';
  const playable = p.status !== null && p.status !== 'done';
  return (
    <div
      role="toolbar"
      aria-label="Race controls"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-2 py-1.5 sm:px-3 sm:py-2"
    >
      <div
        role="group"
        aria-label="Playback"
        className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto"
      >
        <Hint label="Step back one tick" keys=",">
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
        <Hint label={playing ? 'Pause the race' : 'Start the race'} keys="Space">
          <IconButton
            size="icon-sm"
            variant={playing ? 'outline' : 'default'}
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
        <Hint label="Advance every racer one step" keys=".">
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
        <Hint label="Run the race to the finish" keys="End">
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
        <Slider
          className="min-w-0 flex-1 sm:w-40 sm:flex-none"
          label="Speed"
          hideLabel
          value={speedToIndex(p.speed)}
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

      <div role="group" aria-label="Seed" className="ml-auto flex items-center gap-1.5">
        <Label htmlFor="race-seed" className="text-xs text-muted">
          Seed
        </Label>
        <input
          id="race-seed"
          className="h-8 w-28 rounded-md border border-border bg-panel px-2 font-mono text-xs sm:w-32"
          defaultValue={p.seed}
          key={p.seed}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = e.currentTarget.value.trim();
              if (v) p.onSeedChange(v);
            }
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== p.seed) p.onSeedChange(v);
          }}
        />
        <Hint label="New maze with a random seed" keys="N">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Random seed"
            onClick={p.onRandomSeed}
          >
            <Dices className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Copy a link to this exact race">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Copy race link"
            onClick={p.onCopyLink}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
      </div>
    </div>
  );
}
