/**
 * Try-it checks (proj-mgmt/13 section 11): tasks done in the demo, verified live by a predicate
 * over the demo's state and remembered in local progress. Each success is spoken once; checks
 * met by the same moment share one message.
 */
import { CheckCircle2, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DemoState, TryItCheck } from '../../content/learn/types';

export interface TryItListProps {
  checks: readonly TryItCheck[];
  demo: DemoState;
  done: readonly string[];
  onDone: (checkId: string) => void;
}

export function TryItList({ checks, demo, done, onDone }: TryItListProps) {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    const passed = checks.filter((c) => !done.includes(c.id) && c.check(demo));
    if (passed.length === 0) return;
    for (const c of passed) onDone(c.id);
    setLatest(`Try it done. ${passed.map((c) => c.success(demo)).join(' ')}`);
  }, [checks, demo, done, onDone]);

  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Try it" className="flex flex-col gap-2">
        {checks.map((c) => {
          const isDone = done.includes(c.id);
          return (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              {isDone ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span>
                  <span className="sr-only">{isDone ? 'Done: ' : 'To do: '}</span>
                  {c.prompt}
                </span>
                {c.hint && !isDone ? (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer select-none">Hint</summary>
                    <p className="mt-1">{c.hint}</p>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" className="text-xs font-medium text-accent empty:hidden">
        {latest}
      </p>
    </div>
  );
}
