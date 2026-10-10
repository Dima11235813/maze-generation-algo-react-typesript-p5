import { formatDuration, type RunMove, type RunState, type RunSummary } from '@maze/core';
import {
  Button,
  IconButton,
  Kbd,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@maze/ui';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Lightbulb,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export interface RunBarProps {
  run: RunState;
  view: '3d' | '2d';
  /** Session clock times (ms) and the clock itself, for the running timer. */
  startedAt: number | null;
  finishedAt: number | null;
  clock: () => number;
  optimalMoves: number | null;
  hints: number;
  undos: number;
  summary: RunSummary | null;
  /** A saved run is replaying (controls are read-only). */
  replaying: boolean;
  /** Show the on-screen D-pad (touch layouts, 2D view). */
  showPad: boolean;
  onMove: (m: RunMove) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSeek: (cursor: number) => void;
  onHint: () => void;
  onRestart: () => void;
  onExit: () => void;
  onSave: () => void;
  onStopReplay: () => void;
}

function Hint({ label, keys, children }: { label: string; keys?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        {label}
        {keys ? <Kbd>{keys}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function Tool({
  label,
  keys,
  icon: Icon,
  onPress,
  disabled,
}: {
  label: string;
  keys?: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Hint label={label} {...(keys ? { keys } : {})}>
      <IconButton
        size="icon"
        variant="ghost"
        aria-label={label}
        onClick={onPress}
        disabled={disabled ?? false}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </Hint>
  );
}

/** Ticking elapsed time while the run is under way. */
function useElapsed(
  startedAt: number | null,
  finishedAt: number | null,
  clock: () => number,
): number {
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return;
    const id = setInterval(() => {
      setNow(clock());
    }, 250);
    return () => {
      clearInterval(id);
    };
  }, [startedAt, finishedAt, clock]);
  if (startedAt === null) return 0;
  return Math.max(0, (finishedAt ?? Math.max(now, startedAt)) - startedAt);
}

const PAD: ReadonlyArray<{ m: RunMove; label: string; icon: LucideIcon; area: string }> = [
  { m: 'N', label: 'Move up (north)', icon: ArrowUp, area: 'col-start-2 row-start-1' },
  { m: 'W', label: 'Move left (west)', icon: ArrowLeft, area: 'col-start-1 row-start-2' },
  { m: 'S', label: 'Move down (south)', icon: ArrowDown, area: 'col-start-2 row-start-2' },
  { m: 'E', label: 'Move right (east)', icon: ArrowRight, area: 'col-start-3 row-start-2' },
];

/**
 * The game around Run Maze, in a row below the maze (never over it): time, moves against the
 * shortest route, undo/redo and a scrubber over your own moves, a hint, and the finish summary.
 */
export function RunBar(p: RunBarProps) {
  const elapsed = useElapsed(p.startedAt, p.finishedAt, p.clock);
  const { run } = p;
  const locked = p.replaying;
  return (
    <section
      aria-label="Run"
      data-testid="run-bar"
      className="flex flex-col gap-2 border-t border-border bg-panel px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="text-muted">Time </span>
          <span className="font-mono tabular-nums" data-testid="run-time">
            {formatDuration(elapsed)}
          </span>
        </span>
        <span>
          <span className="text-muted">Moves </span>
          <span className="tabular-nums" data-testid="run-moves">
            {run.moves}
          </span>
          {p.optimalMoves !== null ? (
            <span className="text-muted"> / shortest {p.optimalMoves}</span>
          ) : null}
        </span>
        {p.hints > 0 ? <span className="text-muted">Hints {p.hints}</span> : null}
        {p.undos > 0 ? <span className="text-muted">Undos {p.undos}</span> : null}
        <span className="ml-auto flex items-center gap-0.5">
          <Tool
            label="Undo your last move"
            keys="U"
            icon={Undo2}
            onPress={p.onUndo}
            disabled={locked || run.cursor === 0}
          />
          <Tool
            label="Redo"
            keys="Shift+U"
            icon={Redo2}
            onPress={p.onRedo}
            disabled={locked || run.cursor >= run.history.length}
          />
          <Tool
            label="Hint: show the next cells of the shortest way"
            keys="H"
            icon={Lightbulb}
            onPress={p.onHint}
            disabled={locked || run.finished}
          />
          <Tool label="Start again" icon={RotateCcw} onPress={p.onRestart} disabled={locked} />
          <Tool label="Leave the maze" keys="Esc" icon={X} onPress={p.onExit} />
        </span>
      </div>

      {run.history.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-muted">Your moves</span>
          <Slider
            className="min-w-0 flex-1"
            label="Your moves"
            hideLabel
            value={run.cursor}
            min={0}
            max={Math.max(1, run.history.length)}
            step={1}
            disabled={locked}
            valueText={`Move ${String(run.cursor)} of ${String(run.history.length)}`}
            onValueChange={p.onSeek}
          />
          <span className="shrink-0 text-xs tabular-nums text-muted" aria-hidden="true">
            {run.cursor} / {run.history.length}
          </span>
        </div>
      ) : null}

      {p.showPad && p.view === '2d' && !locked ? (
        <div
          role="group"
          aria-label="Movement controls"
          className="grid w-max grid-cols-3 grid-rows-2 gap-1.5 self-center"
        >
          {PAD.map(({ m, label, icon: Icon, area }) => (
            <button
              key={m}
              type="button"
              aria-label={label}
              onClick={() => {
                p.onMove(m);
              }}
              className={cn(
                'inline-flex h-12 w-12 items-center justify-center rounded-md border border-border bg-panel-2 text-fg active:bg-accent active:text-accent-fg',
                area,
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {p.replaying ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1">
            Replaying a saved run: move {run.cursor} of {run.history.length}…
          </span>
          <Button size="sm" variant="secondary" onClick={p.onStopReplay}>
            <Square className="h-4 w-4" aria-hidden="true" /> Stop
          </Button>
        </div>
      ) : null}

      {p.summary && !p.replaying ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-accent bg-panel-2 px-3 py-2 text-sm"
          data-testid="run-summary"
        >
          <span className="min-w-0 flex-1 font-medium">
            Goal! {formatDuration(p.summary.timeMs)}, {p.summary.moves} moves
            {p.summary.optimalMoves !== null ? ` (shortest ${String(p.summary.optimalMoves)})` : ''}
            {p.summary.efficiency !== null
              ? `, ${String(Math.round(p.summary.efficiency * 100))}% efficient`
              : ''}
          </span>
          <Button size="sm" onClick={p.onSave}>
            <Save className="h-4 w-4" aria-hidden="true" /> Save run
          </Button>
          <Button size="sm" variant="secondary" onClick={p.onRestart}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Play again
          </Button>
        </div>
      ) : null}
    </section>
  );
}
