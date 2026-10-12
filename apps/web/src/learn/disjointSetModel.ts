/**
 * Kruskal's disjoint sets, rebuilt from `union` steps (proj-mgmt/13 section 4.2).
 *
 * Every cell starts in its own set. The generator only emits `union` for edges whose ends are
 * in different sets (anything else would close a loop), so the model checks that too. Union by
 * size with path compression, like the real thing; the view shows components, not the forest.
 */
import type { CellId, GenStep } from '@maze/core';

export interface DisjointSetSnapshot {
  readonly cells: number;
  /** Number of separate components (cells - unions). */
  readonly sets: number;
  readonly unions: number;
  /** The largest components, biggest first: representative and size. */
  readonly largest: readonly { readonly root: CellId; readonly size: number }[];
  /** The latest union and the size of the merged component. */
  readonly lastUnion: { readonly a: CellId; readonly b: CellId; readonly size: number } | null;
  /** Unions whose ends were already connected (0 for Kruskal: those edges are skipped). */
  readonly redundant: number;
}

const SHOW_LARGEST = 6;

export class DisjointSetModel {
  private parent: Int32Array;
  private size: Int32Array;
  private sets: number;
  private unions = 0;
  private redundant = 0;
  private lastUnion: DisjointSetSnapshot['lastUnion'] = null;
  private readonly cells: number;

  constructor(cells: number) {
    this.cells = cells;
    this.parent = new Int32Array(cells);
    this.size = new Int32Array(cells);
    this.sets = cells;
    this.reset();
  }

  reset(): void {
    for (let i = 0; i < this.cells; i++) {
      this.parent[i] = i;
      this.size[i] = 1;
    }
    this.sets = this.cells;
    this.unions = 0;
    this.redundant = 0;
    this.lastUnion = null;
  }

  find(cell: CellId): CellId {
    let root = cell;
    while (this.parent[root] !== root) root = this.parent[root] as number;
    let c = cell;
    while (this.parent[c] !== root) {
      const next = this.parent[c] as number;
      this.parent[c] = root;
      c = next;
    }
    return root;
  }

  applyBatch(steps: readonly GenStep[]): void {
    for (const s of steps) this.apply(s);
  }

  apply(step: GenStep): void {
    if (step.t !== 'union') return;
    let ra = this.find(step.a);
    let rb = this.find(step.b);
    if (ra === rb) {
      this.redundant++;
      return;
    }
    if ((this.size[ra] as number) < (this.size[rb] as number)) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] = (this.size[ra] as number) + (this.size[rb] as number);
    this.sets--;
    this.unions++;
    this.lastUnion = { a: step.a, b: step.b, size: this.size[ra] as number };
  }

  snapshot(): DisjointSetSnapshot {
    const roots: { root: CellId; size: number }[] = [];
    for (let i = 0; i < this.cells; i++) {
      if (this.parent[i] === i && (this.size[i] as number) > 1) {
        roots.push({ root: i, size: this.size[i] as number });
      }
    }
    roots.sort((x, y) => y.size - x.size || x.root - y.root);
    return {
      cells: this.cells,
      sets: this.sets,
      unions: this.unions,
      largest: roots.slice(0, SHOW_LARGEST),
      lastUnion: this.lastUnion,
      redundant: this.redundant,
    };
  }
}
