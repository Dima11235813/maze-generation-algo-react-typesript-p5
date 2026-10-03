import { cn } from '@maze/ui';
import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

const STORAGE_PREFIX = 'maze-lab:section:';

function readStored(id: string): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + id);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

function writeStored(id: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, open ? '1' : '0');
  } catch {
    /* storage unavailable: the choice just is not remembered */
  }
}

export interface SectionProps {
  /** Stable id; the open/closed choice is remembered per id. */
  id: string;
  title: string;
  /** Short text shown next to the title, useful when collapsed (e.g. the selected solver). */
  summary?: ReactNode;
  /** Used when the user has not chosen yet (callers pick it per breakpoint). */
  defaultOpen?: boolean;
  /** Extra controls in the header (they do not toggle the section). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * A titled card that expands and collapses. The header is a real button with aria-expanded, the
 * body is removed from the accessibility tree while collapsed, and the choice persists locally.
 */
export function Section({
  id,
  title,
  summary,
  defaultOpen = true,
  actions,
  children,
  className,
  bodyClassName,
}: SectionProps) {
  const [open, setOpen] = useState(() => readStored(id) ?? defaultOpen);
  const bodyId = useId();
  const toggle = () => {
    setOpen((o) => {
      writeStored(id, !o);
      return !o;
    });
  };
  return (
    <section
      data-section={id}
      className={cn(
        'relative flex min-w-0 flex-col rounded-lg border border-border bg-panel',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={toggle}
            className="flex min-h-10 w-full items-center gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted transition-transform',
                !open && '-rotate-90',
              )}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              {title}
            </span>
            {summary ? <span className="min-w-0 truncate text-sm text-fg">{summary}</span> : null}
          </button>
        </h2>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div id={bodyId} hidden={!open} className={cn('min-w-0 px-3 pb-3', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
