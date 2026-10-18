/**
 * Prim's frontier, rebuilt from steps (proj-mgmt/13 section 4.2): the cells next to the tree
 * that are not in it yet. `frontier` steps add and remove cells; `visit` steps count the cells
 * that have joined the tree. Unlike a stack or queue it is a bag: Prim's takes a random cell.
 */
import type { CellId, GenStep } from '@maze/core';

export interface FrontierSetSnapshot {
  /** The frontier in the order the cells joined it. */
  readonly cells: readonly CellId[];
  /** Cells in the tree so far. */
  readonly inTree: number;
  /** The cell the latest round took out of the frontier (and added to the tree). */
  readonly lastTaken: CellId | null;
  /** The cells the latest round added. */
  readonly justAdded: readonly CellId[];
  readonly peak: number;
}

export class FrontierSetModel {
  private cells = new Set<CellId>();
  private inTree = 0;
  private lastTaken: CellId | null = null;
  private justAdded: CellId[] = [];
  private peak = 0;

  get size(): number {
    return this.cells.size;
  }

  reset(): void {
    this.cells = new Set();
    this.inTree = 0;
    this.lastTaken = null;
    this.justAdded = [];
    this.peak = 0;
  }

  applyBatch(steps: readonly GenStep[]): void {
    for (const s of steps) this.apply(s);
  }

  apply(step: GenStep): void {
    if (step.t === 'visit') {
      this.inTree++;
      return;
    }
    if (step.t !== 'frontier') return;
    for (const c of step.remove ?? []) {
      this.cells.delete(c);
      this.lastTaken = c;
    }
    this.justAdded = [...(step.add ?? [])];
    for (const c of this.justAdded) this.cells.add(c);
    this.peak = Math.max(this.peak, this.cells.size);
  }

  snapshot(): FrontierSetSnapshot {
    return {
      cells: [...this.cells],
      inTree: this.inTree,
      lastTaken: this.lastTaken,
      justAdded: [...this.justAdded],
      peak: this.peak,
    };
  }
}
