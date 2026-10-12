/**
 * The BFS queue, rebuilt from solver steps alone (proj-mgmt/13 section 4.2, 20-learn-mode).
 *
 * BFS starts with its origin queued - the start, or the goal for flood fill - with no
 * `discover` step for it; every `discover` joins the
 * back and every `expand` takes the front. The model never looks inside the solver, so what the
 * learner sees is exactly what the steps say. It is folded incrementally from the player's step
 * batches and rebuilt from scratch on a rewind (the player replays from the start).
 */
import type { CellId, SolveStep } from '@maze/core';

export interface QueueEntry {
  readonly cell: CellId;
  /** Distance from the origin (the `g` carried by `discover`; 0 for the origin itself). */
  readonly depth: number | null;
}

export interface QueueSnapshot {
  /** Front first. */
  readonly entries: readonly QueueEntry[];
  /** The cell taken from the front by the latest `expand`, if any. */
  readonly lastExpanded: QueueEntry | null;
  /** The cells that joined the back in the latest batch. */
  readonly justAdded: readonly CellId[];
  readonly expanded: number;
  readonly peak: number;
  /** `expand` steps that did not take the front (0 for a true FIFO such as BFS). */
  readonly outOfOrder: number;
}

export class QueueModel {
  private queue: QueueEntry[] = [];
  private head = 0;
  private lastExpanded: QueueEntry | null = null;
  private justAdded: CellId[] = [];
  private expanded = 0;
  private peak = 0;
  private outOfOrder = 0;
  private readonly start: CellId;

  constructor(start: CellId) {
    this.start = start;
    this.reset();
  }

  /** Back to the state before the first step: only the start cell is queued. */
  reset(): void {
    this.queue = [{ cell: this.start, depth: 0 }];
    this.head = 0;
    this.lastExpanded = null;
    this.justAdded = [];
    this.expanded = 0;
    this.peak = 1;
    this.outOfOrder = 0;
  }

  /** Folds one batch of steps (as delivered by `StepPlayer.subscribe`). */
  applyBatch(steps: readonly SolveStep[]): void {
    this.justAdded = [];
    for (const s of steps) this.apply(s);
  }

  apply(step: SolveStep): void {
    switch (step.t) {
      case 'discover':
        this.queue.push({ cell: step.cell, depth: step.g ?? null });
        this.justAdded.push(step.cell);
        this.peak = Math.max(this.peak, this.queue.length - this.head);
        break;
      case 'expand': {
        this.expanded++;
        const front = this.queue[this.head];
        if (front?.cell === step.cell) {
          this.head++;
          this.lastExpanded = front;
        } else {
          // Not FIFO (another solver fed in by mistake): remove it wherever it is.
          this.outOfOrder++;
          const at = this.queue.findIndex((e, i) => i >= this.head && e.cell === step.cell);
          const entry = at >= 0 ? (this.queue.splice(at, 1)[0] ?? null) : null;
          this.lastExpanded = entry ?? { cell: step.cell, depth: step.g ?? null };
        }
        this.justAdded = this.justAdded.filter((c) => c !== step.cell);
        break;
      }
      default:
        break;
    }
    // Keep memory bounded on big mazes: drop the consumed prefix now and then.
    if (this.head > 1024 && this.head * 2 > this.queue.length) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
  }

  snapshot(): QueueSnapshot {
    return {
      entries: this.queue.slice(this.head),
      lastExpanded: this.lastExpanded,
      justAdded: [...this.justAdded],
      expanded: this.expanded,
      peak: this.peak,
      outOfOrder: this.outOfOrder,
    };
  }
}
