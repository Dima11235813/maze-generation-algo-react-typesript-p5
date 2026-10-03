/**
 * Instanced meshes for the 3D Tree view: branches as cylinders that thicken towards the root,
 * joints as spheres, the solver's path and the outline selection as overlays, loop passages as
 * dashed lines, and start/goal/current markers.
 *
 * Positions blend the flat maze (each cell's centre on the floor) with the botanical tree laid
 * out by `TreeScene`, so the morph lifts the maze's passages off the floor into a tree.
 */
import {
  NO_CELL,
  colOf,
  rowOf,
  type CellId,
  type GenerationTracker,
  type MazeState,
  type SolveTracker,
} from '@maze/core';
import * as THREE from 'three';
import { resolve } from '../color';
import { mazeExtent } from '../layout';
import { smoothstep, treeNodeColor, type TreeScene } from '../tree';
import type { RGB, RenderOptions, RenderTheme } from '../types';

export interface TreeMeshSyncContext {
  readonly theme: RenderTheme;
  readonly options: RenderOptions;
  readonly gen: GenerationTracker | null;
  readonly solve: SolveTracker | null;
  readonly scene: TreeScene;
}

/** Tree height as a fraction of the maze's larger side. */
export const TREE_HEIGHT_FACTOR = 0.9;

const UP = new THREE.Vector3(0, 1, 0);

export class TreeMeshes {
  private readonly group = new THREE.Group();
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 10, 8);
  private readonly branchMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0,
  });
  private readonly pathMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  private readonly highlightMat = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
  });
  private readonly markerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0,
  });
  private readonly loopMat = new THREE.LineDashedMaterial({
    dashSize: 1,
    gapSize: 1,
    transparent: true,
    opacity: 0.5,
  });

  private readonly branches: THREE.InstancedMesh;
  private readonly joints: THREE.InstancedMesh;
  private readonly pathMesh: THREE.InstancedMesh;
  private readonly highlightMesh: THREE.InstancedMesh;
  private readonly markers: THREE.InstancedMesh;
  private readonly loops: THREE.LineSegments;
  private readonly loopPositions: Float32Array;

  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private radius: Float32Array;

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly d = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly color = new THREE.Color();

  constructor(
    private readonly scene3: THREE.Scene,
    readonly state: MazeState,
  ) {
    const n = state.grid.width * state.grid.height;
    this.branches = new THREE.InstancedMesh(this.cylinder, this.branchMat, Math.max(1, n));
    this.joints = new THREE.InstancedMesh(this.sphere, this.branchMat, Math.max(1, n));
    this.pathMesh = new THREE.InstancedMesh(this.cylinder, this.pathMat, Math.max(1, n));
    this.highlightMesh = new THREE.InstancedMesh(this.cylinder, this.highlightMat, Math.max(1, n));
    this.markers = new THREE.InstancedMesh(this.sphere, this.markerMat, 4);
    for (const mesh of [
      this.branches,
      this.joints,
      this.pathMesh,
      this.highlightMesh,
      this.markers,
    ]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
    }
    this.branches.setColorAt(0, this.color);
    this.joints.setColorAt(0, this.color);
    this.markers.setColorAt(0, this.color);

    // Every passage of a full grid could close a loop: 2n edges at most, 2 points each.
    this.loopPositions = new Float32Array(Math.max(1, 2 * n) * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.loopPositions, 3));
    geo.setDrawRange(0, 0);
    this.loops = new THREE.LineSegments(geo, this.loopMat);
    this.loops.frustumCulled = false;

    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.radius = new Float32Array(n);

    this.group.add(
      this.branches,
      this.joints,
      this.pathMesh,
      this.highlightMesh,
      this.markers,
      this.loops,
    );
    scene3.add(this.group);
  }

  /** World size of the grown tree (height) for camera fitting. */
  static treeHeight(state: MazeState, cellSize: number): number {
    const { width, height } = mazeExtent(state.grid, cellSize);
    return Math.max(width, height) * TREE_HEIGHT_FACTOR;
  }

  private setColor(target: THREE.Color, theme: RenderTheme, c: RGB): THREE.Color {
    const r = resolve(theme, c);
    return target.setRGB(r.r / 255, r.g / 255, r.b / 255, THREE.SRGBColorSpace);
  }

  /** Writes a cylinder from point i to point j with radius r into `mesh` at index k. */
  private segment(mesh: THREE.InstancedMesh, k: number, i: number, j: number, r: number): void {
    this.a.set(this.px[i] as number, this.py[i] as number, this.pz[i]);
    this.b.set(this.px[j] as number, this.py[j] as number, this.pz[j]);
    this.d.subVectors(this.b, this.a);
    const len = this.d.length();
    if (len < 1e-6) {
      this.s.set(0, 0, 0);
      this.m.compose(this.a, this.q.identity(), this.s);
    } else {
      this.q.setFromUnitVectors(UP, this.d.divideScalar(len));
      this.a.add(this.b).multiplyScalar(0.5);
      this.s.set(r, len, r);
      this.m.compose(this.a, this.q, this.s);
    }
    mesh.setMatrixAt(k, this.m);
  }

  private ball(mesh: THREE.InstancedMesh, k: number, i: number, r: number): void {
    this.a.set(this.px[i] as number, this.py[i] as number, this.pz[i]);
    this.s.set(r, r, r);
    this.m.compose(this.a, this.q.identity(), this.s);
    mesh.setMatrixAt(k, this.m);
  }

  sync(ctx: TreeMeshSyncContext): void {
    const { scene, theme, gen, solve } = ctx;
    const tree = scene.tree;
    const state = this.state;
    if (!tree) {
      for (const mesh of [
        this.branches,
        this.joints,
        this.pathMesh,
        this.highlightMesh,
        this.markers,
      ]) {
        mesh.count = 0;
      }
      this.loops.geometry.setDrawRange(0, 0);
      return;
    }
    const cs = ctx.options.cellSize;
    const { width, height } = mazeExtent(state.grid, cs);
    const treeH = Math.max(width, height) * TREE_HEIGHT_FACTOR;
    const t = smoothstep(scene.morph);
    const grid = state.grid;

    // Blended positions.
    for (let i = 0; i < tree.count; i++) {
      const c = tree.order[i] as CellId;
      const gx = (colOf(grid, c) + 0.5) * cs - width / 2;
      const gz = (rowOf(grid, c) + 0.5) * cs - height / 2;
      const gy = cs * 0.15;
      const tx = (scene.x[c] as number) * treeH;
      const ty = (scene.y[c] as number) * treeH - treeH / 2;
      const tz = (scene.z[c] as number) * treeH;
      this.px[c] = gx + (tx - gx) * t;
      this.py[c] = gy + (ty - gy) * t;
      this.pz[c] = gz + (tz - gz) * t;
    }

    // Radii: like the maze's passages when flat; in the tree, from the spacing of its rows.
    const flatBase = cs * 0.14;
    const treeBase = Math.min(
      treeH * 0.02,
      Math.max(treeH * 0.002, (treeH / Math.max(1, tree.height)) * 0.16),
    );
    const base = flatBase + (treeBase - flatBase) * t;
    const total = Math.max(1, tree.count);

    let k = 0;
    let j = 0;
    for (let i = 0; i < tree.count; i++) {
      const c = tree.order[i] as CellId;
      const r = base * (0.5 + 2.2 * Math.sqrt((tree.subtreeSize[c] as number) / total));
      this.radius[c] = r;
      this.setColor(this.color, theme, treeNodeColor(theme, c, gen, solve));
      const p = tree.parent[c] as number;
      if (p >= 0) {
        this.segment(this.branches, k, p, c, r);
        this.branches.setColorAt(k, this.color);
        k++;
      }
      this.ball(this.joints, j, c, r);
      this.joints.setColorAt(j, this.color);
      j++;
    }
    this.branches.count = k;
    this.joints.count = j;
    this.branches.instanceMatrix.needsUpdate = true;
    this.joints.instanceMatrix.needsUpdate = true;
    if (this.branches.instanceColor) this.branches.instanceColor.needsUpdate = true;
    if (this.joints.instanceColor) this.joints.instanceColor.needsUpdate = true;

    // Solver path.
    this.setColor(this.pathMat.color, theme, theme.path);
    const path = solve?.path;
    let pk = 0;
    if (path) {
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i] as CellId;
        const b = path[i + 1] as CellId;
        if (tree.included[a] !== 1 || tree.included[b] !== 1) continue;
        this.segment(
          this.pathMesh,
          pk++,
          a,
          b,
          Math.max(this.radius[a] as number, this.radius[b] as number) * 1.25 + base * 0.4,
        );
      }
    }
    this.pathMesh.count = pk;
    this.pathMesh.instanceMatrix.needsUpdate = true;

    // Outline selection.
    this.setColor(this.highlightMat.color, theme, theme.current);
    const highlight = ctx.options.tree?.highlight;
    let hk = 0;
    if (highlight && highlight.length > 0) {
      const set = new Set(highlight);
      for (const c of highlight) {
        const p = tree.parent[c] as number;
        if (p >= 0 && set.has(p))
          this.segment(this.highlightMesh, hk++, p, c, (this.radius[c] as number) * 1.8 + base);
      }
    }
    this.highlightMesh.count = hk;
    this.highlightMesh.instanceMatrix.needsUpdate = true;

    // Markers: start, goal, generator head, solver head.
    let mk = 0;
    const mark = (cell: CellId, color: RGB, scale: number): void => {
      if (cell === NO_CELL || tree.included[cell] !== 1) return;
      this.ball(this.markers, mk, cell, base * scale);
      this.markers.setColorAt(mk, this.setColor(this.color, theme, color));
      mk++;
    };
    if (ctx.options.showStartGoal) {
      mark(state.start, theme.start, 2.6);
      mark(state.goal, theme.goal, 2.6);
    }
    if (gen && !gen.done) mark(gen.current, theme.current, 2.4);
    if (solve && !solve.done) mark(solve.current, theme.path, 2.2);
    this.markers.count = mk;
    this.markers.instanceMatrix.needsUpdate = true;
    if (this.markers.instanceColor) this.markers.instanceColor.needsUpdate = true;

    // Loop passages.
    const lp = this.loopPositions;
    let w = 0;
    const max = lp.length;
    for (let i = 0; i < tree.loopEdges.length && w + 6 <= max; i += 2) {
      const a = tree.loopEdges[i] as CellId;
      const b = tree.loopEdges[i + 1] as CellId;
      lp[w++] = this.px[a] as number;
      lp[w++] = this.py[a] as number;
      lp[w++] = this.pz[a] as number;
      lp[w++] = this.px[b] as number;
      lp[w++] = this.py[b] as number;
      lp[w++] = this.pz[b] as number;
    }
    const geo = this.loops.geometry;
    geo.setDrawRange(0, w / 3);
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.loops.computeLineDistances();
    this.loopMat.dashSize = cs * 0.25;
    this.loopMat.gapSize = cs * 0.25;
    this.setColor(this.loopMat.color, theme, theme.wall);
  }

  dispose(): void {
    this.scene3.remove(this.group);
    for (const mesh of [
      this.branches,
      this.joints,
      this.pathMesh,
      this.highlightMesh,
      this.markers,
    ]) {
      mesh.dispose();
    }
    this.loops.geometry.dispose();
    this.cylinder.dispose();
    this.sphere.dispose();
    for (const mat of [
      this.branchMat,
      this.pathMat,
      this.highlightMat,
      this.markerMat,
      this.loopMat,
    ]) {
      mat.dispose();
    }
  }
}
