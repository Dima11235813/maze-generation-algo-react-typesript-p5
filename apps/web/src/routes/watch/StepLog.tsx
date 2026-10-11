import type { SolveStep } from '@maze/core';
import { ToggleGroup, ToggleGroupItem } from '@maze/ui';
import { useEffect, useRef } from 'react';

export type LogVerbosity = 'all' | 'expansions';

export interface LogEntry {
  readonly seq: number;
  readonly kind: SolveStep['t'];
  readonly text: string;
}

export const LOG_LIMIT = 200;

/** Step kinds shown at the "expansions only" verbosity. */
const COARSE: ReadonlySet<SolveStep['t']> = new Set([
  'expand',
  'deadend',
  'path',
  'fail',
  'done',
  'move',
]);

function isCoarse(kind: SolveStep['t']): boolean {
  return COARSE.has(kind);
}

export interface StepLogProps {
  entries: readonly LogEntry[];
  verbosity: LogVerbosity;
  hideHeading?: boolean;
  onVerbosityChange: (v: LogVerbosity) => void;
}

/** Textual log of the last steps (a11y alternative to the canvas overlay). */
export function StepLog({
  entries,
  verbosity,
  onVerbosityChange,
  hideHeading = false,
}: StepLogProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const visible = verbosity === 'all' ? entries : entries.filter((e) => isCoarse(e.kind));

  // Keep the newest entry in view.
  const lastSeq = visible[visible.length - 1]?.seq;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, lastSeq]);

  return (
    <section aria-labelledby="steplog-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="steplog-heading"
          className={
            hideHeading ? 'sr-only' : 'text-xs font-semibold tracking-wide text-muted uppercase'
          }
        >
          Step log
        </h3>
        <ToggleGroup
          type="single"
          value={verbosity}
          aria-label="Step log verbosity"
          onValueChange={(v) => {
            if (v === 'all' || v === 'expansions') onVerbosityChange(v);
          }}
        >
          <ToggleGroupItem value="all" aria-label="All steps">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="expansions" aria-label="Expansions only">
            Expansions
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ol
        ref={listRef}
        role="log"
        aria-live="off"
        aria-label="Solver steps, newest last"
        className="max-h-48 overflow-y-auto rounded-md border border-border bg-panel-2 p-2 text-xs leading-5"
      >
        {visible.length === 0 ? (
          <li className="text-muted">No steps yet. Press Play or Step.</li>
        ) : (
          visible.map((e) => (
            <li key={e.seq} className="flex gap-2">
              <span
                className="w-10 shrink-0 text-right font-mono tabular-nums text-muted"
                aria-hidden="true"
              >
                {e.seq}
              </span>
              <span>{e.text}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
