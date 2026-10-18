/**
 * Stacks rebuilt from steps (proj-mgmt/13 section 4.2).
 *
 * - DFS (solver): the start cell is on the stack before the first step; every `discover` is
 *   pushed and every `expand` pops the top.
 * - Recursive backtracker (generator): the stack is the path from the start to the current cell;
 *   every `carve` pushes the new cell and every `backtrack` pops back to the previous one.
 *
 * Both fold incrementally from the player's step batches and are rebuilt on a rewind.
 */
import type { CellId, GenStep, SolveStep } from '@maze/core';

export interface StackSnapshot {
  /** Bottom first; the last entry is the top. */
  readonly cells: readonly CellId[];
  /** The cell the latest pop removed (DFS: the cell being expanded), if any. */
  readonly lastPopped: CellId | null;
  /** The cells pushed in the latest batch. */
  readonly justPushed: readonly CellId[];
  readonly pushes: number;
  readonly pops: number;
  readonly peak: number;
  /** Pops that did not take the top (0 for a true LIFO). */
  readonly outOfOrder: number;
}

class StackCore {
  protected cells: CellId[] = [];
  protected lastPopped: CellId | null = null;
  protected justPushed: CellId[] = [];
  protected pushes = 0;
  protected pops = 0;
  protected peak = 0;
  protected outOfOrder = 0;

  /** Cells on the stack now. */
  get size(): number {
    return this.cells.length;
  }

  protected clear(initial: readonly CellId[]): void {
    this.cells = [...initial];
    this.lastPopped = null;
    this.justPushed = [];
    this.pushes = 0;
    this.pops = 0;
    this.peak = initial.length;
    this.outOfOrder = 0;
  }

  protected push(cell: CellId): void {
    this.cells.push(cell);
    this.justPushed.push(cell);
    this.pushes++;
    this.peak = Math.max(this.peak, this.cells.length);
  }

  protected pop(cell: CellId): void {
    this.pops++;
    if (this.cells[this.cells.length - 1] === cell) {
      this.cells.pop();
    } else {
      this.outOfOrder++;
      const at = this.cells.lastIndexOf(cell);
      if (at >= 0) this.cells.splice(at, 1);
    }
    this.lastPopped = cell;
    this.justPushed = this.justPushed.filter((c) => c !== cell);
  }

  snapshot(): StackSnapshot {
    return {
      cells: [...this.cells],
      lastPopped: this.lastPopped,
      justPushed: [...this.justPushed],
      pushes: this.pushes,
      pops: this.pops,
      peak: this.peak,
      outOfOrder: this.outOfOrder,
    };
  }
}

/** The DFS solver's stack. */
export class DfsStackModel extends StackCore {
  private readonly start: CellId;

  constructor(start: CellId) {
    super();
    this.start = start;
    this.reset();
  }

  reset(): void {
    this.clear([this.start]);
  }

  applyBatch(steps: readonly SolveStep[]): void {
    this.justPushed = [];
    for (const s of steps) this.apply(s);
  }

  apply(step: SolveStep): void {
    if (step.t === 'discover') this.push(step.cell);
    else if (step.t === 'expand') this.pop(step.cell);
  }
}

/** The recursive backtracker's stack: the path from the start to the current cell. */
export class BacktrackerStackModel extends StackCore {
  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear([]);
  }

  applyBatch(steps: readonly GenStep[]): void {
    this.justPushed = [];
    for (const s of steps) this.apply(s);
  }

  apply(step: GenStep): void {
    switch (step.t) {
      case 'visit':
        // The very first visit is the start cell: the bottom of the stack.
        if (this.cells.length === 0) this.push(step.cell);
        break;
      case 'carve':
        this.push(step.to);
        break;
      case 'backtrack':
        this.pop(step.from);
        break;
      default:
        break;
    }
  }
}
