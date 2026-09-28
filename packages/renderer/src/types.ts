/**
 * The Renderer port (ADR-004). Adapters (`canvas2d`, `three`) implement this interface;
 * the app never touches a canvas or a three.js object directly.
 *
 * Renderers read live tracker objects from `@maze/core`: the app applies steps to the
 * trackers, then calls `requestRender()`. No per-step copying of overlays.
 */
import type { CellId, Dir, GenerationTracker, MazeState, SolveTracker } from '@maze/core';

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface RenderTheme {
  readonly background: RGB;
  /** Base cell colour; the legacy visit-count/depth maths derives from it (see color.ts). */
  readonly cell: RGB;
  /** Wall colour as drawn (the legacy app inverted the picker value; we store what is seen). */
  readonly wall: RGB;
  /** Highlight for the generator's current cell. */
  readonly current: RGB;
  readonly start: RGB;
  readonly goal: RGB;
  readonly solveFrontier: RGB;
  readonly solveExpanded: RGB;
  readonly solveDeadEnd: RGB;
  readonly path: RGB;
  /** First-person avatar / camera marker in 2D. */
  readonly player: RGB;
  /** Legacy "inverse colours" toggle: applied once, to every colour, at draw time. */
  readonly invert: boolean;
}

export type ViewMode = '2d' | '3d';

export interface RenderOptions {
  /** Pixel size of one cell at zoom 1 (2D) / world unit scale (3D). */
  readonly cellSize: number;
  /** Wall thickness in pixels (2D) or world units (3D). */
  readonly wallWidth: number;
  readonly mode: ViewMode;
  /** Legacy "show generator cube projection" (P-04). 3D only. */
  readonly showProjection: boolean;
  /** Legacy "show 3D mirror": projection mirrored below the floor (P-05). */
  readonly mirror: boolean;
  /**
   * Cull cubes taller than this many depth units (P-06). Legacy default was
   * `rows * cellSize / 10` pixels with `cellSize / 6` per unit, i.e. ~0.6 * rows units.
   */
  readonly maxProjectionDepth: number;
  /** Height of one projection depth unit in cell-size fractions. Legacy: 1/6. */
  readonly projectionUnit: number;
  /** Wall extrusion height in cell-size fractions. Legacy: 1/2. */
  readonly wallHeight: number;
  readonly showGrid: boolean;
  readonly showStartGoal: boolean;
  /** Disables parallax, mouse-following light and eased camera moves. */
  readonly reducedMotion: boolean;
}

export type CameraPreset = 'top' | 'tilt' | 'isometric' | 'low' | 'front';
export const CAMERA_PRESETS: readonly CameraPreset[] = ['top', 'tilt', 'isometric', 'low', 'front'];

export interface CameraState {
  readonly preset: CameraPreset;
  /** Legacy "follow mouse" (P-15): the view tilts/pans with the pointer while enabled. */
  readonly followPointer: boolean;
  /** Dolly factor; 1 = fit the whole maze. Adjusted by wheel/pinch inside the renderer (P-14). */
  readonly zoom: number;
}

/** First-person "Run Maze" mode (P-17). Cell-snapped; the renderer eases between cells. */
export interface FirstPersonState {
  readonly cell: CellId;
  readonly heading: Dir;
  /** Legacy `P` key: raise the camera to peek over walls. */
  readonly peek: boolean;
}

/** Pointer position normalised to [-1, 1] on both axes, relative to the canvas. */
export interface PointerState {
  readonly x: number;
  readonly y: number;
}

/** Events a renderer reports back to the app (interaction happens on the canvas). */
export interface RendererEvents {
  onCameraChange?(camera: CameraState): void;
  /** Cell under the pointer on click/tap, or null when outside the maze. */
  onCellClick?(cell: CellId | null, event: PointerEvent): void;
  onPointerMove?(pointer: PointerState | null): void;
}

export interface Renderer {
  readonly kind: ViewMode;
  /** Attach to a host element; the renderer creates and sizes its own canvas. */
  mount(host: HTMLElement): void;
  setMaze(state: MazeState | null): void;
  setGeneration(tracker: GenerationTracker | null): void;
  setSolve(tracker: SolveTracker | null): void;
  setTheme(theme: RenderTheme): void;
  setOptions(options: RenderOptions): void;
  setCamera(camera: CameraState): void;
  setFirstPerson(state: FirstPersonState | null): void;
  setPointer(pointer: PointerState | null): void;
  setEvents(events: RendererEvents): void;
  /** Re-read host size (call from a ResizeObserver). Never regenerates the maze (P-13). */
  resize(): void;
  /** Coalesced: many calls per frame produce one draw. */
  requestRender(): void;
  /** Export the current frame as a PNG data URL (used by Save/Export). */
  toDataURL(): string;
  destroy(): void;
}

export interface RendererFactoryOptions {
  readonly theme: RenderTheme;
  readonly options: RenderOptions;
  readonly camera?: CameraState;
  readonly events?: RendererEvents;
}

export type RendererFactory = (opts: RendererFactoryOptions) => Renderer;
