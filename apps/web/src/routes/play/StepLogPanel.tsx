import type { NarratorLogEntry, NarratorVerbosity } from '@maze/player';
import { NARRATOR_VERBOSITIES } from '@maze/player';
import { Button, Kbd, ScrollArea, SimpleSelect } from '@maze/ui';
import { useEffect, useRef } from 'react';

export const VERBOSITY_LABELS: Record<NarratorVerbosity, string> = {
  off: 'Off',
  low: 'Milestones only',
  medium: 'Milestones and progress',
  high: 'Every step (rate limited)',
};

export const VERBOSITY_OPTIONS = NARRATOR_VERBOSITIES.map((v) => ({
  value: v,
  label: VERBOSITY_LABELS[v],
}));

export interface StepLogPanelProps {
  entries: readonly NarratorLogEntry[];
  verbosity: NarratorVerbosity;
  onVerbosityChange(v: NarratorVerbosity): void;
  onClose(): void;
  onClear(): void;
}

/**
 * Textual step log (S3.7, proj-mgmt/10 section 3). The list is a `role="log"` live region, so
 * while this panel is open the narrator does not also feed the hidden announcer.
 */
export function StepLogPanel({
  entries,
  verbosity,
  onVerbosityChange,
  onClose,
  onClear,
}: StepLogPanelProps) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Scroll only the log's own viewport; scrollIntoView would also scroll the page on phones.
    const end = endRef.current;
    const viewport = end?.closest('[data-radix-scroll-area-viewport]');
    if (viewport instanceof HTMLElement) viewport.scrollTop = viewport.scrollHeight;
  }, [entries.length]);

  return (
    <aside
      aria-labelledby="step-log-title"
      data-testid="step-log"
      className="flex h-72 min-h-0 shrink-0 flex-col rounded-lg border border-border bg-panel"
    >
      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5">
        <h2
          id="step-log-title"
          className="text-xs font-semibold tracking-wide text-muted uppercase"
        >
          Step log
        </h2>
        <div className="min-w-56">
          <SimpleSelect
            label="Narration"
            value={verbosity}
            onValueChange={onVerbosityChange}
            options={VERBOSITY_OPTIONS}
          />
        </div>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          <Kbd>L</Kbd> toggles
        </span>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={entries.length === 0}>
          Clear
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-2">
        <ol
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Narrated steps"
          className="flex flex-col gap-0.5 text-sm"
        >
          {entries.length === 0 ? (
            <li className="text-muted">Nothing narrated yet. Generate or solve a maze.</li>
          ) : (
            entries.map((e) => (
              <li key={e.id} className="flex gap-2 tabular-nums">
                <span className="w-14 shrink-0 text-right text-muted">{e.step}</span>
                <span>{e.text}</span>
              </li>
            ))
          )}
          <li ref={endRef} aria-hidden="true" className="h-px" />
        </ol>
      </ScrollArea>
    </aside>
  );
}
