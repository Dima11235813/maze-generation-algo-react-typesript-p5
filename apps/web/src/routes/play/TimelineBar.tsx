import type { StepPlayerSnapshot } from '@maze/player';
import { IconButton, Slider, Tooltip, TooltipContent, TooltipTrigger, cn } from '@maze/ui';
import { SkipBack } from 'lucide-react';

export interface TimelineBarProps {
  /** Snapshot of the player the timeline controls (generation or solve); null hides nothing but disables. */
  snapshot: StepPlayerSnapshot<unknown> | null;
  /** What the timeline is scrubbing, e.g. "Generation" or "Solve". */
  label: string;
  onSeek: (step: number) => void;
  onRestart: () => void;
  className?: string;
}

const fmt = (n: number): string => n.toLocaleString();

/**
 * Scrubber for a step player: drag to rewind or replay, restart button, and a step counter.
 * The furthest point reached is the right-hand end until the run has finished once; after that
 * the full length is known and the whole run can be scrubbed.
 */
export function TimelineBar({ snapshot, label, onSeek, onRestart, className }: TimelineBarProps) {
  const step = snapshot?.stepCount ?? 0;
  const known = snapshot?.total ?? null;
  const max = Math.max(1, known ?? snapshot?.highWater ?? 0);
  const totalText = known === null ? `${fmt(snapshot?.highWater ?? 0)}+` : fmt(known);
  const disabled = snapshot === null;
  return (
    <div
      role="group"
      aria-label={`${label} timeline`}
      className={cn(
        'flex items-center gap-2 border-t border-border bg-panel px-3 py-1.5',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            size="icon-sm"
            variant="ghost"
            aria-label={`Restart ${label.toLowerCase()}`}
            onClick={onRestart}
            disabled={disabled || step === 0}
          >
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>Back to the first step (Home)</TooltipContent>
      </Tooltip>
      <span className="hidden w-20 shrink-0 text-xs font-medium text-muted sm:inline">{label}</span>
      <Slider
        className="min-w-0 flex-1"
        label={`${label} position`}
        hideLabel
        value={Math.min(step, max)}
        min={0}
        max={max}
        step={1}
        disabled={disabled}
        valueText={`Step ${fmt(step)} of ${totalText}`}
        onValueChange={onSeek}
      />
      <span className="shrink-0 text-right text-xs tabular-nums text-muted" aria-hidden="true">
        {fmt(step)} / {totalText}
      </span>
    </div>
  );
}
