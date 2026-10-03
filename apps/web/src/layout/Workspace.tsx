import { cn } from '@maze/ui';
import type { ReactNode } from 'react';

export interface WorkspaceProps {
  /** The maze area (canvas, overlays, timeline). Never collapses. */
  stage: ReactNode;
  /** Optional column left of the maze on wide screens (e.g. algorithm picker). */
  left?: ReactNode;
  /** Sections right of the maze on desktop; below it on tablets and phones. */
  side?: ReactNode;
  /** Accessible name of the maze region. */
  stageLabel: string;
  className?: string;
}

/**
 * Responsive page frame shared by Play and Watch.
 *
 * - Phone: one column that scrolls as a whole; the maze takes most of the viewport height and
 *   the sections below expand and collapse.
 * - Tablet (md): maze full width on top, sections flow into a two-column grid underneath.
 * - Desktop (lg): maze fills the height; one scrolling side column (left sections on top).
 * - Wide (xl): when `left` is given it gets its own column, so there are three.
 */
export function Workspace({ stage, left, side, stageLabel, className }: WorkspaceProps) {
  const hasLeft = left !== undefined && left !== null && left !== false;
  return (
    <div
      className={cn(
        // `relative` contains visually hidden (absolutely positioned) text inside the scroller.
        'relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-3',
        'md:grid md:grid-cols-2 md:content-start md:items-start',
        'lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:content-stretch lg:items-stretch lg:overflow-hidden',
        hasLeft
          ? 'lg:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(20rem,24rem)] xl:grid-rows-[minmax(0,1fr)]'
          : 'lg:grid-rows-[minmax(0,1fr)]',
        className,
      )}
    >
      <section
        aria-label={stageLabel}
        className={cn(
          'relative flex h-[68svh] min-h-[18rem] shrink-0 flex-col overflow-hidden rounded-lg border border-border',
          'md:col-span-2 md:h-[58svh]',
          'lg:col-span-1 lg:col-start-1 lg:h-auto lg:min-h-0',
          hasLeft ? 'lg:row-span-2 xl:col-start-2 xl:row-span-1' : 'lg:row-span-1',
        )}
      >
        {stage}
      </section>
      {hasLeft ? (
        <div
          className={cn(
            'flex flex-col gap-3 md:contents',
            'lg:col-start-2 lg:row-start-1 lg:flex lg:max-h-[45svh] lg:overflow-y-auto',
            'xl:col-start-1 xl:row-start-1 xl:max-h-none xl:min-h-0',
          )}
        >
          {left}
        </div>
      ) : null}
      {side ? (
        <div
          className={cn(
            'flex flex-col gap-3 md:contents',
            'lg:col-start-2 lg:flex lg:min-h-0 lg:overflow-y-auto',
            hasLeft ? 'lg:row-start-2 xl:col-start-3 xl:row-start-1' : 'lg:row-start-1',
          )}
        >
          {side}
        </div>
      ) : null}
    </div>
  );
}
