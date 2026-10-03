import { solvers } from '@maze/core';
import { cn } from '@maze/ui';
import { useId } from 'react';

export interface SolverPickerProps {
  value: string;
  onChange(id: string): void;
  disabled?: boolean;
  /** The surrounding Section already shows a visible title. */
  hideHeading?: boolean;
}

/** Radio list of every solver in the registry with its tags and summary. */
export function SolverPicker({
  value,
  onChange,
  disabled,
  hideHeading = false,
}: SolverPickerProps) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend
        className={
          hideHeading ? 'sr-only' : 'text-xs font-semibold tracking-wide text-muted uppercase'
        }
      >
        Solver
      </legend>
      <ul className="flex flex-col gap-1.5" role="list">
        {solvers.all.map((s) => {
          const id = `${name}-${s.meta.id}`;
          const selected = s.meta.id === value;
          return (
            <li key={s.meta.id}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 text-sm transition-colors',
                  selected ? 'border-accent bg-panel-2' : 'border-border hover:bg-panel-2',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    id={id}
                    type="radio"
                    name={name}
                    value={s.meta.id}
                    checked={selected}
                    onChange={() => { onChange(s.meta.id); }}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  <span className="font-medium">{s.meta.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">
                    {s.meta.complexity.time}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1" aria-label="Tags">
                  {s.meta.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </span>
                <span className="text-xs text-muted">{s.meta.summary}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
