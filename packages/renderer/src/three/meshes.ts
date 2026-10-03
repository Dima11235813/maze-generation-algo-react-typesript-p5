/**
 * Instanced scene content for one maze: floor tiles, extruded walls, the stack-depth cube
 * projection (with mirror), the solve path strip and the start/goal markers.
 *
 * Everything is rebuilt from the live `MazeState` and trackers only when they advanced
 * (`tracker.steps`) or something was marked dirty (theme/options), never per render.
 */
import {
  Dir,
  cellCount,
  type GenerationTracker,
  type MazeState,
  type SolveTracker,
} from '@maze/core';
import * as THREE from 'three';
import { resolve } from '../color';
import {
  cellCenter,
  collectWallSegments,
  createSegmentBuffer,
  mazeExtent,
  segmentCapacity,
  segmentEndpoints,
  type Point2,
  type Segment2,
  type SegmentBuffer,
} from '../layout';
import { tileColor } from '../overlay';
import type { RGB, RenderOptions, RenderTheme } from '../types';

export interface MeshSyncContext {
  readonly theme: RenderTheme;
  readonly options: RenderOptions;
  readonly gen: GenerationTracker | null;
  readonly solve: SolveTracker | null;
  /** First-person mode hides the cube projection (legacy hid it in run mode). */
  readonly firstPerson: boolean;
}

/** Legacy cube footprint: cell minus 30 % padding. */
const CUBE_FOOTPRINT = 0.7;
const TILE_THICKNESS = 0.06;
const PATH_FOOTPRINT = 0.5;
const PATH_THICKNESS = 0.05;

const IDENTITY = new THREE.Quaternion();

export class MazeMeshes {
  private readonly group = new THREE.Group();
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly coneGeo = new THREE.ConeGeometry(0.5, 1, 16);
  private readonly discGeo = new THREE.CircleGeometry(0.5, 24);

  private readonly tileMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
  });
  private readonly wallMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  private readonly cubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0,
  });
  private readonly pathMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  private readonly goalMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  private readonly startMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });

  private readonly tiles: THREE.InstancedMesh;
  private readonly walls: THREE.InstancedMesh;
  private readonly cubes: THREE.InstancedMesh;
  private readonly path: THREE.InstancedMesh;
  private readonly goal: THREE.Mesh;
  private readonly start: THREE.Mesh;

  private readonly segments: SegmentBuffer;
  /** Resolved tile colour per cell (0..1 floats), reused by the cube projection. */
  private readonly tileRgb: Float32Array;

  private readonly m = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private readonly pt: Point2 = { x: 0, y: 0 };
  private readonly seg: Segment2 = { x0: 0, y0: 0, x1: 0, y1: 0 };

  private dirty = true;
  private lastGenSteps = -2;
  private lastSolveSteps = -2;

  constructor(
    private readonly scene: THREE.Scene,
    readonly state: MazeState,
  ) {
    const n = cellCount(state.grid);
    this.tiles = new THREE.InstancedMesh(this.unitBox, this.tileMat, n);
    this.walls = new THREE.InstancedMesh(this.unitBox, this.wallMat, segmentCapacity(state.grid));
    this.cubes = new THREE.InstancedMesh(this.unitBox, this.cubeMat, n * 2);
    this.path = new THREE.InstancedMesh(this.unitBox, this.pathMat, n);
    for (const mesh of [this.tiles, this.walls, this.cubes, this.path]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
    }
    // Allocate per-instance colour buffers up front.
    this.tiles.setColorAt(0, this.color);
    this.cubes.setColorAt(0, this.color);

    this.goal = new THREE.Mesh(this.coneGeo, this.goalMat);
    this.start = new THREE.Mesh(this.discGeo, this.startMat);
    this.start.rotation.x = -Math.PI / 2;

    this.segments = createSegmentBuffer(state.grid);
    this.tileRgb = new Float32Array(n * 3);

    this.group.add(this.tiles, this.walls, this.cubes, this.path, this.goal, this.start);
    scene.add(this.group);
  }

  /** Shows or hides the whole maze (the Tree view fades it out). */
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Force a rebuild on the next `sync` (theme or options changed). */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * Refreshes instance data when trackers advanced or `markDirty()` was called.
   * Returns `true` when anything was rebuilt.
   */
  sync(ctx: MeshSyncContext): boolean {
    const genSteps = ctx.gen ? ctx.gen.steps : -1;
    const solveSteps = ctx.solve ? ctx.solve.steps : -1;
    if (!this.dirty && genSteps === this.lastGenSteps && solveSteps === this.lastSolveSteps) {
      return false;
    }
    const wallsChanged = this.dirty || genSteps !== this.lastGenSteps;

    this.updateTiles(ctx);
    if (wallsChanged) this.updateWalls(ctx);
    this.updateCubes(ctx);
    this.updatePath(ctx);
    this.updateMarkers(ctx);

    this.dirty = false;
    this.lastGenSteps = genSteps;
    this.lastSolveSteps = solveSteps;
    return true;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.tiles.dispose();
    this.walls.dispose();
    this.cubes.dispose();
    this.path.dispose();
    this.unitBox.dispose();
    this.coneGeo.dispose();
    this.discGeo.dispose();
    for (const mat of [
      this.tileMat,
      this.wallMat,
      this.cubeMat,
      this.pathMat,
      this.goalMat,
      this.startMat,
    ]) {
      mat.dispose();
    }
  }

  // ---- internals ---------------------------------------------------------------------------

  private setColor(target: THREE.Color, c: RGB): THREE.Color {
    return target.setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace);
  }

  private worldX(localX: number, cs: number): number {
    return localX - (this.state.grid.width * cs) / 2;
  }

  private worldZ(localY: number, cs: number): number {
    return localY - (this.state.grid.height * cs) / 2;
  }

  private updateTiles(ctx: MeshSyncContext): void {
    const { grid } = this.state;
    const cs = ctx.options.cellSize;
    const n = cellCount(grid);
    const gen = ctx.gen;
    const thickness = TILE_THICKNESS * cs;
    const rgbOut = this.tileRgb;
    let j = 0;
    this.scl.set(cs, thickness, cs);
    for (let cell = 0; cell < n; cell++) {
      const c = tileColor(ctx.theme, gen, ctx.solve, cell);
      rgbOut[cell * 3] = c.r / 255;
      rgbOut[cell * 3 + 1] = c.g / 255;
      rgbOut[cell * 3 + 2] = c.b / 255;
      if (gen && !gen.isSeen(cell)) continue;
      cellCenter(grid, cell, cs, this.pt);
      this.pos.set(this.worldX(this.pt.x, cs), -thickness / 2, this.worldZ(this.pt.y, cs));
      this.m.compose(this.pos, IDENTITY, this.scl);
      this.tiles.setMatrixAt(j, this.m);
      this.tiles.setColorAt(j, this.setColor(this.color, c));
      j++;
    }
    this.tiles.count = j;
    this.tiles.instanceMatrix.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  private updateWalls(ctx: MeshSyncContext): void {
    const { state } = this;
    const cs = ctx.options.cellSize;
    const gen = ctx.gen;
    const n = collectWallSegments(state, this.segments, gen ? (c) => gen.isSeen(c) : undefined);
    const height = Math.max(0.01, ctx.options.wallHeight * cs);
    const thickness = Math.max(1, ctx.options.wallWidth);
    const cells = this.segments.cells;
    const dirs = this.segments.dirs;
    for (let i = 0; i < n; i++) {
      const cell = cells[i] as number;
      const dir = dirs[i] as Dir;
      segmentEndpoints(state.grid, cell, dir, cs, this.seg);
      const horizontal = dir === Dir.N || dir === Dir.S;
      const mx = (this.seg.x0 + this.seg.x1) / 2;
      const my = (this.seg.y0 + this.seg.y1) / 2;
      this.pos.set(this.worldX(mx, cs), height / 2, this.worldZ(my, cs));
      if (horizontal) this.scl.set(cs + thickness, height, thickness);
      else this.scl.set(thickness, height, cs + thickness);
      this.m.compose(this.pos, IDENTITY, this.scl);
      this.walls.setMatrixAt(i, this.m);
    }
    this.walls.count = n;
    this.walls.instanceMatrix.needsUpdate = true;
    this.setColor(this.wallMat.color, resolve(ctx.theme, ctx.theme.wall));
  }

  private updateCubes(ctx: MeshSyncContext): void {
    const gen = ctx.gen;
    const { options } = ctx;
    const show =
      options.showProjection && options.mode === '3d' && gen !== null && !ctx.firstPerson;
    this.cubes.visible = show;
    if (!show || !gen) {
      this.cubes.count = 0;
      return;
    }
    const { grid } = this.state;
    const cs = options.cellSize;
    const n = cellCount(grid);
    const size = CUBE_FOOTPRINT * cs;
    const unit = options.projectionUnit * cs;
    const maxDepth = options.maxProjectionDepth;
    const rgb = this.tileRgb;
    let j = 0;
    this.scl.set(size, size, size);
    for (let cell = 0; cell < n; cell++) {
      if (!gen.isSeen(cell)) continue;
      const h = gen.projectionHeight(cell);
      if (h > maxDepth) continue;
      cellCenter(grid, cell, cs, this.pt);
      const x = this.worldX(this.pt.x, cs);
      const z = this.worldZ(this.pt.y, cs);
      const y = h * unit + size / 2;
      this.color.setRGB(
        rgb[cell * 3] ?? 0,
        rgb[cell * 3 + 1] ?? 0,
        rgb[cell * 3 + 2] ?? 0,
        THREE.SRGBColorSpace,
      );

      this.pos.set(x, y, z);
      this.m.compose(this.pos, IDENTITY, this.scl);
      this.cubes.setMatrixAt(j, this.m);
      this.cubes.setColorAt(j, this.color);
      j++;

      if (options.mirror) {
        this.pos.set(x, -y, z);
        this.m.compose(this.pos, IDENTITY, this.scl);
        this.cubes.setMatrixAt(j, this.m);
        this.cubes.setColorAt(j, this.color);
        j++;
      }
    }
    this.cubes.count = j;
    this.cubes.instanceMatrix.needsUpdate = true;
    if (this.cubes.instanceColor) this.cubes.instanceColor.needsUpdate = true;
  }

  private updatePath(ctx: MeshSyncContext): void {
    const path = ctx.solve?.path ?? null;
    if (!path || path.length === 0) {
      this.path.visible = false;
      this.path.count = 0;
      return;
    }
    const { grid } = this.state;
    const cs = ctx.options.cellSize;
    const foot = PATH_FOOTPRINT * cs;
    const thick = PATH_THICKNESS * cs;
    this.scl.set(foot, thick, foot);
    for (let i = 0; i < path.length; i++) {
      cellCenter(grid, path[i] as number, cs, this.pt);
      this.pos.set(this.worldX(this.pt.x, cs), thick / 2 + 0.01 * cs, this.worldZ(this.pt.y, cs));
      this.m.compose(this.pos, IDENTITY, this.scl);
      this.path.setMatrixAt(i, this.m);
    }
    this.path.count = path.length;
    this.path.visible = true;
    this.path.instanceMatrix.needsUpdate = true;
    this.setColor(this.pathMat.color, resolve(ctx.theme, ctx.theme.path));
  }

  private updateMarkers(ctx: MeshSyncContext): void {
    const { grid, start, goal } = this.state;
    const cs = ctx.options.cellSize;
    const gen = ctx.gen;
    const show = ctx.options.showStartGoal;
    const wallTop = Math.max(0.01, ctx.options.wallHeight * cs);

    this.goal.visible = show && (!gen || gen.isSeen(goal));
    if (this.goal.visible) {
      cellCenter(grid, goal, cs, this.pt);
      const coneH = 0.9 * cs;
      this.goal.position.set(
        this.worldX(this.pt.x, cs),
        wallTop + coneH / 2,
        this.worldZ(this.pt.y, cs),
      );
      this.goal.scale.set(0.5 * cs, coneH, 0.5 * cs);
      const g = resolve(ctx.theme, ctx.theme.goal);
      this.setColor(this.goalMat.color, g);
      this.setColor(this.goalMat.emissive, g).multiplyScalar(0.35);
    }

    this.start.visible = show && (!gen || gen.isSeen(start));
    if (this.start.visible) {
      cellCenter(grid, start, cs, this.pt);
      this.start.position.set(this.worldX(this.pt.x, cs), 0.02 * cs, this.worldZ(this.pt.y, cs));
      this.start.scale.set(0.6 * cs, 0.6 * cs, 1);
      this.setColor(this.startMat.color, resolve(ctx.theme, ctx.theme.start));
    }
  }

  /** World-space maze extent (for camera and lights). */
  extent(cs: number): { width: number; height: number } {
    return mazeExtent(this.state.grid, cs);
  }
}
