import type { GenerationTracker, MazeState, SolveTracker } from '@maze/core';
import type { FirstPersonState, RenderOptions, RenderTheme } from '@maze/renderer';
import { createDomRenderer, type DomRenderer, type DomRendererEvents } from '@maze/renderer/dom';
import { useEffect, useRef, useState } from 'react';
import type { MazeSession } from '../../maze/session';

export interface A11yGridHostProps {
  session: MazeSession;
  theme: RenderTheme;
  options: RenderOptions;
  firstPerson: FirstPersonState | null;
  maze: MazeState | null;
  generation: GenerationTracker | null;
  solve: SolveTracker | null;
  /** Fired when the user asks (`I`) for the focused cell to be read out. */
  onDescribe?(text: string): void;
  onRenderer?(renderer: DomRenderer | null): void;
}

/**
 * Mounts the accessible DOM grid (S3.4) next to the visual canvas. The grid itself is visually
 * hidden; while it has keyboard focus a small visible caption mirrors the focused cell so
 * sighted keyboard users never lose track of focus (WCAG 2.4.7).
 */
export function A11yGridHost({
  session,
  theme,
  options,
  firstPerson,
  maze,
  generation,
  solve,
  onDescribe,
  onRenderer,
}: A11yGridHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<DomRenderer | null>(null);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);
  const latest = useRef({ onDescribe });
  latest.current = { onDescribe };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const events: DomRendererEvents = {
      onCellFocus: (cell, reason) => {
        const label =
          host.querySelector(`[role="gridcell"][data-cell="${cell}"]`)?.getAttribute('aria-label') ?? null;
        setFocusedLabel(label);
        if (reason === 'describe' && label) latest.current.onDescribe?.(label);
      },
    };
    const r = createDomRenderer({ theme, options, events });
    r.mount(host);
    setRenderer(r);
    return () => {
      r.destroy();
      setRenderer(null);
    };
    // Theme/options carry no semantics for this adapter; create once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onRenderer?.(renderer);
  }, [renderer, onRenderer]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setMaze(maze);
    renderer.setGeneration(generation);
    renderer.setSolve(solve);
    renderer.setFirstPerson(firstPerson);
    renderer.requestRender();
  }, [renderer, maze, generation, solve, firstPerson]);

  // Mirror live steps without going through the session's single render callback (the canvas
  // owns that); the adapter throttles itself.
  const snap = session.getSnapshot();
  useEffect(() => {
    if (!renderer) return;
    const offs: Array<() => void> = [];
    if (snap.genPlayer) offs.push(snap.genPlayer.subscribe(() => renderer.requestRender()));
    if (snap.solvePlayer) offs.push(snap.solvePlayer.subscribe(() => renderer.requestRender()));
    return () => offs.forEach((off) => off());
  }, [renderer, snap.genPlayer, snap.solvePlayer]);

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.dataset['cell'] !== undefined) {
      setFocusedLabel(target.getAttribute('aria-label'));
    }
  };
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusedLabel(null);
  };

  return (
    <div className="relative" onFocus={onFocus} onBlur={onBlur} data-testid="a11y-grid-wrapper">
      <div ref={hostRef} className="sr-only" data-testid="a11y-grid-host" />
      {focusedLabel ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-1/2 z-10 max-w-[90vw] -translate-x-1/2 rounded-md border border-accent bg-panel/95 px-3 py-1.5 text-xs shadow"
        >
          <span className="font-semibold">Grid: </span>
          {focusedLabel}
        </div>
      ) : null}
    </div>
  );
}
