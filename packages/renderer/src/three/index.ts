/**
 * three.js adapter: the legacy WEBGL look (extruded walls, stack-depth cube projection with
 * mirror, light rig, view rotation, follow-mouse parallax, wheel zoom and the first-person
 * "Run Maze" camera) implemented behind the `Renderer` port with plain three.js.
 */
import type { GenerationTracker, MazeState, SolveTracker } from '@maze/core';
import * as THREE from 'three';
import { resolve } from '../color';
import { cellAt, cellCenter, clampZoom, headingYaw, mazeExtent, wheelZoomFactor, type Point2 } from '../layout';
import type {
  CameraState,
  FirstPersonState,
  PointerState,
  RenderOptions,
  RenderTheme,
  Renderer,
  RendererEvents,
  RendererFactoryOptions,
} from '../types';
import { LightRig } from './lights';
import { MazeMeshes } from './meshes';
import { CameraRig } from './rig';

const DEFAULT_CAMERA: CameraState = { preset: 'tilt', followPointer: false, zoom: 1 };
const CLICK_SLOP_PX = 6;
/** Eye height as a fraction of the cell size: below the walls, or above them when peeking. */
const EYE_HEIGHT = 0.3;
const PEEK_HEIGHT = 0.9;
/** Slight downward look while peeking so the maze, not the horizon, fills the view. */
const PEEK_PITCH = -0.35;

export function createThreeRenderer(opts: RendererFactoryOptions): Renderer {
  return new ThreeRenderer(opts);
}

class ThreeRenderer implements Renderer {
  readonly kind = '3d' as const;

  private host: HTMLElement | null = null;
  private gl: THREE.WebGLRenderer | null = null;
  private observer: ResizeObserver | null = null;
  private rafId: number | null = null;
  private lastFrameTime = 0;

  private readonly scene = new THREE.Scene();
  private readonly background = new THREE.Color();
  private readonly rig = new CameraRig();
  private lights: LightRig | null = null;
  private meshes: MazeMeshes | null = null;

  private maze: MazeState | null = null;
  private gen: GenerationTracker | null = null;
  private solve: SolveTracker | null = null;
  private theme: RenderTheme;
  private options: RenderOptions;
  private camera: CameraState;
  private fp: FirstPersonState | null = null;
  private pointer: PointerState | null = null;
  private events: RendererEvents;

  private readonly raycaster = new THREE.Raycaster();
  private readonly floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private readonly pt: Point2 = { x: 0, y: 0 };
  private downX = 0;
  private downY = 0;

  constructor(opts: RendererFactoryOptions) {
    this.theme = opts.theme;
    this.options = opts.options;
    this.camera = opts.camera ?? DEFAULT_CAMERA;
    this.events = opts.events ?? {};
    this.scene.background = this.background;
    this.applyBackground();
    this.scene.add(this.rig.camera);
  }

  // ---- Renderer port ------------------------------------------------------------------------

  mount(host: HTMLElement): void {
    if (this.host) this.detach();
    this.host = host;
    let gl: THREE.WebGLRenderer;
    try {
      gl = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      throw new Error('WebGL is not available; fall back to the 2D renderer', { cause: err });
    }
    gl.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    const canvas = gl.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Maze, 3D view');
    host.appendChild(canvas);
    this.gl = gl;

    this.lights = new LightRig(this.scene, this.rig.camera);
    this.lights.setFirstPerson(this.fp !== null);

    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(host);
    }
    this.buildMeshes();
    this.resize();
  }

  setMaze(state: MazeState | null): void {
    this.maze = state;
    this.buildMeshes();
    this.updateCameraTarget();
    this.requestRender();
  }

  setGeneration(tracker: GenerationTracker | null): void {
    this.gen = tracker;
    this.meshes?.markDirty();
    this.requestRender();
  }

  setSolve(tracker: SolveTracker | null): void {
    this.solve = tracker;
    this.meshes?.markDirty();
    this.requestRender();
  }

  setTheme(theme: RenderTheme): void {
    this.theme = theme;
    this.applyBackground();
    this.meshes?.markDirty();
    this.requestRender();
  }

  setOptions(options: RenderOptions): void {
    const rebuild = options.cellSize !== this.options.cellSize;
    this.options = options;
    if (rebuild) this.buildMeshes();
    else this.meshes?.markDirty();
    this.updateCameraTarget();
    this.requestRender();
  }

  setCamera(camera: CameraState): void {
    this.camera = { ...camera, zoom: clampZoom(camera.zoom) };
    this.updateCameraTarget();
    this.requestRender();
  }

  setFirstPerson(state: FirstPersonState | null): void {
    const modeChanged = (state === null) !== (this.fp === null);
    this.fp = state;
    if (modeChanged) {
      this.lights?.setFirstPerson(state !== null);
      this.meshes?.markDirty();
    }
    this.updateCameraTarget();
    this.requestRender();
  }

  setPointer(pointer: PointerState | null): void {
    this.pointer = pointer;
    this.updatePointerLight();
    if (this.camera.followPointer && !this.fp) this.updateCameraTarget();
    this.requestRender();
  }

  setEvents(events: RendererEvents): void {
    this.events = events;
  }

  resize(): void {
    const { host, gl } = this;
    if (!host || !gl) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    gl.setSize(w, h, false);
    this.rig.setAspect(w / h);
    this.updateCameraTarget();
    this.requestRender();
  }

  requestRender(): void {
    if (this.rafId !== null || !this.gl) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  toDataURL(): string {
    const gl = this.gl;
    if (!gl) return '';
    this.rig.update(0, true);
    this.syncMeshes();
    gl.render(this.scene, this.rig.camera);
    return gl.domElement.toDataURL('image/png');
  }

  destroy(): void {
    this.detach();
    this.maze = null;
    this.gen = null;
    this.solve = null;
  }

  // ---- frame loop ---------------------------------------------------------------------------

  private readonly frame = (time: number): void => {
    this.rafId = null;
    const gl = this.gl;
    if (!gl) return;
    const dt = this.lastFrameTime > 0 ? Math.min(100, time - this.lastFrameTime) : 16;
    this.lastFrameTime = time;

    const animating = this.rig.update(dt, this.options.reducedMotion);
    this.syncMeshes();
    gl.render(this.scene, this.rig.camera);

    if (animating) this.requestRender();
    else this.lastFrameTime = 0;
  };

  private syncMeshes(): void {
    this.meshes?.sync({
      theme: this.theme,
      options: this.options,
      gen: this.gen,
      solve: this.solve,
      firstPerson: this.fp !== null,
    });
  }

  // ---- scene management ---------------------------------------------------------------------

  private applyBackground(): void {
    const bg = resolve(this.theme, this.theme.background);
    this.background.setRGB(bg.r / 255, bg.g / 255, bg.b / 255, THREE.SRGBColorSpace);
  }

  private buildMeshes(): void {
    this.meshes?.dispose();
    this.meshes = null;
    if (!this.maze || !this.gl) return;
    this.meshes = new MazeMeshes(this.scene, this.maze);
    const cs = this.options.cellSize;
    const { width, height } = mazeExtent(this.maze.grid, cs);
    this.rig.setExtent(width, height, cs, cs * this.options.wallHeight);
    this.lights?.fit(width, height, cs);
  }

  private updateCameraTarget(): void {
    const maze = this.maze;
    if (!maze) return;
    const cs = this.options.cellSize;
    const { width, height } = mazeExtent(maze.grid, cs);
    const fp = this.fp;
    if (fp) {
      cellCenter(maze.grid, fp.cell, cs, this.pt);
      this.rig.firstPerson(
        this.pt.x - width / 2,
        this.pt.y - height / 2,
        (fp.peek ? PEEK_HEIGHT : EYE_HEIGHT) * cs,
        headingYaw(fp.heading),
        fp.peek ? PEEK_PITCH : 0,
      );
    } else {
      const parallax =
        this.camera.followPointer && !this.options.reducedMotion ? this.pointer : null;
      this.rig.orbit(this.camera.preset, this.camera.zoom, parallax);
    }
  }

  private updatePointerLight(): void {
    if (!this.lights) return;
    if (!this.pointer || this.options.reducedMotion || this.fp) {
      this.lights.setPointerWorld(null);
      return;
    }
    this.lights.setPointerWorld(this.pointerToFloor(this.pointer));
  }

  /** World point on the floor plane under a screen-normalised pointer, or null. */
  private pointerToFloor(p: PointerState): THREE.Vector3 | null {
    this.ndc.set(p.x, -p.y);
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
    return this.raycaster.ray.intersectPlane(this.floor, this.hit);
  }

  // ---- interaction --------------------------------------------------------------------------

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (this.fp) return;
    const zoom = clampZoom(this.camera.zoom * wheelZoomFactor(e.deltaY));
    if (zoom === this.camera.zoom) return;
    this.camera = { ...this.camera, zoom };
    this.events.onCameraChange?.(this.camera);
    this.updateCameraTarget();
    this.requestRender();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.normalizePointer(e);
    this.setPointer(p);
    this.events.onPointerMove?.(p);
  };

  private readonly onPointerLeave = (): void => {
    this.setPointer(null);
    this.events.onPointerMove?.(null);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > CLICK_SLOP_PX) return;
    const maze = this.maze;
    if (!maze) {
      this.events.onCellClick?.(null, e);
      return;
    }
    const point = this.pointerToFloor(this.normalizePointer(e));
    if (!point) {
      this.events.onCellClick?.(null, e);
      return;
    }
    const cs = this.options.cellSize;
    const { width, height } = mazeExtent(maze.grid, cs);
    const cell = cellAt(maze.grid, point.x + width / 2, point.z + height / 2, cs);
    this.events.onCellClick?.(cell, e);
  };

  /** Pointer position normalised to [-1, 1]; x grows right, y grows down (screen-like). */
  private normalizePointer(e: PointerEvent): PointerState {
    const rect = this.gl?.domElement.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
    };
  }

  private detach(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastFrameTime = 0;
    this.observer?.disconnect();
    this.observer = null;
    this.meshes?.dispose();
    this.meshes = null;
    this.lights?.dispose();
    this.lights = null;
    const gl = this.gl;
    if (gl) {
      const canvas = gl.domElement;
      canvas.removeEventListener('wheel', this.onWheel);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerleave', this.onPointerLeave);
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      gl.dispose();
      canvas.remove();
    }
    this.gl = null;
    this.host = null;
  }
}
