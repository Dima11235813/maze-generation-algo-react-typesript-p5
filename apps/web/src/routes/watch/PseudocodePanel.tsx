import { cn } from '@maze/ui';
import type { PseudocodeListing } from '../../content/pseudocode';

export interface PseudocodePanelProps {
  listing: PseudocodeListing;
  /** 0-based line currently executing, or null. */
  currentLine: number | null;
  hideHeading?: boolean;
}

/** Pseudo-code with the executing line highlighted (and exposed via aria-current). */
export function PseudocodePanel({
  listing,
  currentLine,
  hideHeading = false,
}: PseudocodePanelProps) {
  return (
    <section aria-labelledby="pseudocode-heading" className="flex flex-col gap-2">
      <h3
        id="pseudocode-heading"
        className={
          hideHeading ? 'sr-only' : 'text-xs font-semibold tracking-wide text-muted uppercase'
        }
      >
        Pseudo-code: {listing.title}
      </h3>
      <ol
        className="overflow-x-auto rounded-md border border-border bg-panel-2 p-2 font-mono text-xs leading-5"
        aria-label={`${listing.title} pseudo-code`}
      >
        {listing.lines.map((line, i) => {
          const active = i === currentLine;
          const indent = line.length - line.trimStart().length;
          return (
            <li
              key={i}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex gap-2 rounded px-1 whitespace-pre',
                active && 'bg-accent text-accent-fg',
              )}
            >
              <span className="w-5 shrink-0 text-right opacity-60 select-none" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                {' '.repeat(indent)}
                {line.trimStart()}
              </span>
              {active ? <span className="sr-only"> (executing)</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
