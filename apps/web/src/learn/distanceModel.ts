/**
 * The distance map: each expanded cell's `g` (steps or cost from the start), rebuilt from
 * `expand` steps (proj-mgmt/13 section 4.2). For BFS and flood fill this is the ring number;
 * for Dijkstra and A* the settled cost.
 */
import type { CellId, SolveStep } from '@maze/core';

export interface DistanceSnapshot {
  /** Distance per cell; -1 where not settled yet. */
  readonly dist: Int32Array;
  readonly settled: number;
  readonly max: number;
  readonly last: CellId | null;
}

export class DistanceModel {
  private dist: Int32Array;
  private settled = 0;
  private max = 0;
  private last: CellId | null = null;

  constructor(cells: number) {
    this.dist = new Int32Array(cells).fill(-1);
  }

  reset(): void {
    this.dist.fill(-1);
    this.settled = 0;
    this.max = 0;
    this.last = null;
  }

  applyBatch(steps: readonly SolveStep[]): void {
    for (const s of steps) this.apply(s);
  }

  apply(step: SolveStep): void {
    if (step.t !== 'expand' || step.g === undefined) return;
    if (this.dist[step.cell] === -1) this.settled++;
    this.dist[step.cell] = step.g;
    this.max = Math.max(this.max, step.g);
    this.last = step.cell;
  }

  /** A copy, so React sees a new value and later folds never mutate a rendered snapshot. */
  snapshot(): DistanceSnapshot {
    return { dist: this.dist.slice(), settled: this.settled, max: this.max, last: this.last };
  }
}
