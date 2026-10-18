/**
 * The random walk of Aldous-Broder and Wilson's (proj-mgmt/13 section 7, M5), rebuilt from
 * steps: how far the walk has gone, how many cells the tree holds (the start plus one per carve)
 * and, for Wilson's, the loops erased. `waited` counts walk steps since the tree last grew,
 * which shows Aldous-Broder's slow finish: the last few cells take most of the walking.
 */
import type { CellId, GenStep } from '@maze/core';

export interface WalkSnapshot {
  readonly cells: number;
  readonly inTree: number;
  readonly walkSteps: number;
  /** Loops erased (Wilson's) and the cells they removed from the walk. */
  readonly erasures: number;
  readonly erasedCells: number;
  /** The cells the latest erasure removed. */
  readonly lastErased: readonly CellId[];
  /** Walk steps since the tree last grew, and the longest such wait so far. */
  readonly waited: number;
  readonly longestWait: number;
}

export class WalkModel {
  private readonly cells: number;
  private inTree = 0;
  private walkSteps = 0;
  private erasures = 0;
  private erasedCells = 0;
  private lastErased: CellId[] = [];
  private waited = 0;
  private longestWait = 0;

  constructor(cells: number) {
    this.cells = cells;
  }

  /** Cells not in the tree yet. */
  get remaining(): number {
    return this.cells - this.inTree;
  }

  reset(): void {
    this.inTree = 0;
    this.walkSteps = 0;
    this.erasures = 0;
    this.erasedCells = 0;
    this.lastErased = [];
    this.waited = 0;
    this.longestWait = 0;
  }

  applyBatch(steps: readonly GenStep[]): void {
    for (const s of steps) this.apply(s);
  }

  apply(step: GenStep): void {
    switch (step.t) {
      case 'visit':
        // Both start with the one cell that seeds the tree.
        if (this.inTree === 0) this.inTree = 1;
        break;
      case 'walk':
        this.walkSteps++;
        this.waited++;
        this.longestWait = Math.max(this.longestWait, this.waited);
        if (step.erased && step.erased.length > 0) {
          this.erasures++;
          this.erasedCells += step.erased.length;
          this.lastErased = [...step.erased];
        }
        break;
      case 'carve':
        this.inTree++;
        this.waited = 0;
        break;
      default:
        break;
    }
  }

  snapshot(): WalkSnapshot {
    return {
      cells: this.cells,
      inTree: this.inTree,
      walkSteps: this.walkSteps,
      erasures: this.erasures,
      erasedCells: this.erasedCells,
      lastErased: [...this.lastErased],
      waited: this.waited,
      longestWait: this.longestWait,
    };
  }
}
