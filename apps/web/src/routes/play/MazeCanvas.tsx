import type { GenerationTracker, MazeState, SolveTracker } from '@maze/core';
import type {
  CameraState,
  FirstPersonState,
  RenderOptions,
  RenderTheme,
  Renderer,
  RendererEvents,
  ViewMode,
} from '@maze/renderer';
import { cn } from '@maze/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRendererFactories } from '../../maze/rendererFactories';
import type { MazeSession } from '../../maze/session';

export interface HostSize {
  width: number;
  height: number;
}

export interface MazeCanvasProps {
  session: MazeSession;
  mode: ViewMode;
  theme: RenderTheme;
  options: RenderOptions;
  camera: CameraState;
  firstPerson: FirstPersonState | null;
  maze: MazeState | null;
  generation: GenerationTracker | null;
  solve: SolveTracker | null;
  /** Accessible name for the canvas region. */
  label: string;
  onHostSize: (size: HostSize) => void;
  onCameraChange?: (camera: CameraState) => void;
  onCellClick?: (cell: number | null) => void;
  onRenderer?: (renderer: Renderer | null) => void;
  className?: string;
}

/**
 * Owns the renderer lifecycle: creates the adapter for `mode` (lazy chunk for three.js),
 * mounts it in the host, pushes every input through the port, and re-fits on resize without
 * touching the maze (P-13).
 */
export function MazeCanvas({
  session,
  mode,
  theme,
  options,
  camera,
  firstPerson,
  maze,
  generation,
  solve,
  label,
  onHostSize,
  onCameraChange,
  onCellClick,
  onRenderer,
  className,
}: MazeCanvasProps) {
  const factories = useRendererFactories();
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latest inputs for renderer creation and for stable event delegation.
  const latest = useRef({ theme, options, camera, onCameraChange, onCellClick, mode });
  latest.current = { theme, options, camera, onCameraChange, onCellClick, mode };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let created: Renderer | null = null;
    const events: RendererEvents = {
      onCameraChange: (c) => latest.current.onCameraChange?.(c),
      onCellClick: (cell) => latest.current.onCellClick?.(cell),
    };
    const load = mode === '3d' ? factories.create3d() : factories.create2d();
    load
      .then((factory) => {
        if (cancelled) return;
        created = factory({
          theme: latest.current.theme,
          options: latest.current.options,
          camera: latest.current.camera,
          events,
        });
        created.mount(host);
        setRenderer(created);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      created?.destroy();
      setRenderer(null);
    };
  }, [mode, factories]);

  useEffect(() => {
    onRenderer?.(renderer);
    session.setRenderRequest(() => renderer?.requestRender());
    return () => session.setRenderRequest(() => undefined);
  }, [renderer, session, onRenderer]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setTheme(theme);
    renderer.requestRender();
  }, [renderer, theme]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setOptions(options);
    renderer.requestRender();
  }, [renderer, options]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setCamera(camera);
    renderer.requestRender();
  }, [renderer, camera]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setFirstPerson(firstPerson);
    renderer.requestRender();
  }, [renderer, firstPerson]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setMaze(maze);
    renderer.setGeneration(generation);
    renderer.setSolve(solve);
    renderer.requestRender();
  }, [renderer, maze, generation, solve]);

  // Size tracking: report to the page (grid sizing) and re-fit the renderer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const report = (width: number, height: number) => {
      if (width > 0 && height > 0) onHostSize({ width, height });
    };
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) report(rect.width, rect.height);
      renderer?.resize();
      renderer?.requestRender();
    });
    ro.observe(host);
    report(host.clientWidth, host.clientHeight);
    return () => ro.disconnect();
  }, [renderer, onHostSize]);

  // Pointer position (normalised) for follow-pointer parallax and the mouse-following light.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!renderer) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      renderer.setPointer({ x, y });
      if (latest.current.camera.followPointer || latest.current.mode === '3d') {
        renderer.requestRender();
      }
    },
    [renderer],
  );

  const onPointerLeave = useCallback(() => {
    renderer?.setPointer(null);
    renderer?.requestRender();
  }, [renderer]);

  return (
    <div
      ref={hostRef}
      data-testid="maze-canvas-host"
      role="img"
      aria-label={label}
      tabIndex={0}
      className={cn('relative min-h-0 flex-1 touch-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', className)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {error ? (
        <div role="alert" className="absolute inset-x-0 top-0 m-3 rounded-md border border-danger bg-panel p-3 text-sm">
          The {mode.toUpperCase()} renderer could not be loaded: {error}
        </div>
      ) : null}
    </div>
  );
}
