/**
 * The priority queue of Dijkstra, A* and greedy best-first, rebuilt from steps
 * (proj-mgmt/13 section 4.2).
 *
 * One entry per open cell with its best key, which is the textbook "decrease-key" view: the
 * solvers themselves push a fresh heap entry on `relax` and skip stale ones silently (lazy
 * deletion), so stale entries never show up in steps and need no modelling. Keys:
 * - Dijkstra: `g` (cost so far);
 * - A*: `f = g + h` (`discover` carries `f`; `relax` lowers `g`, so `f` drops by the same amount);
 * - greedy best-first: `f = h` (its `discover` carries the heuristic as `f`).
 */
import type { CellId, SolveStep } from '@maze/core';

export type PriorityKey = 'g' | 'f';

export interface PriorityEntry {
  readonly cell: CellId;
  readonly g: number | null;
  /** `f` for A* and greedy; null for Dijkstra. */
  readonly f: number | null;
  /** The ordering key (g for Dijkstra, f otherwise). */
  readonly key: number;
}

export interface PriorityQueueSnapshot {
  readonly keyName: PriorityKey;
  /** Sorted by key (smallest first), ties in insertion order like the solvers' heaps. */
  readonly entries: readonly PriorityEntry[];
  readonly lastExpanded: PriorityEntry | null;
  /** Cells whose key was lowered (relaxed) in the latest batch. */
  readonly justRelaxed: readonly CellId[];
  readonly justAdded: readonly CellId[];
  readonly expanded: number;
  readonly relaxations: number;
  readonly peak: number;
  /** Expansions of a cell whose key was not the smallest (0 for these solvers). */
  readonly notMinimum: number;
}

interface Live {
  g: number | null;
  f: number | null;
  key: number;
  seq: number;
}

export class PriorityQueueModel {
  private open = new Map<CellId, Live>();
  private seq = 0;
  private lastExpanded: PriorityEntry | null = null;
  private justRelaxed: CellId[] = [];
  private justAdded: CellId[] = [];
  private expanded = 0;
  private relaxations = 0;
  private peak = 1;
  private notMinimum = 0;
  private readonly start: CellId;
  private readonly keyName: PriorityKey;

  constructor(start: CellId, keyName: PriorityKey) {
    this.start = start;
    this.keyName = keyName;
    this.reset();
  }

  reset(): void {
    // The start cell is open before the first step, with key 0 (its h is unknown until expanded).
    this.open = new Map([[this.start, { g: 0, f: null, key: 0, seq: 0 }]]);
    this.seq = 1;
    this.lastExpanded = null;
    this.justRelaxed = [];
    this.justAdded = [];
    this.expanded = 0;
    this.relaxations = 0;
    this.peak = 1;
    this.notMinimum = 0;
  }

  applyBatch(steps: readonly SolveStep[]): void {
    this.justRelaxed = [];
    this.justAdded = [];
    for (const s of steps) this.apply(s);
  }

  apply(step: SolveStep): void {
    switch (step.t) {
      case 'discover': {
        const g = step.g ?? null;
        const f = step.f ?? null;
        const key = this.keyName === 'g' ? (g ?? 0) : (f ?? 0);
        this.open.set(step.cell, { g, f, key, seq: this.seq++ });
        this.justAdded.push(step.cell);
        this.peak = Math.max(this.peak, this.open.size);
        break;
      }
      case 'relax': {
        const prev = this.open.get(step.cell);
        const delta = step.newG - step.oldG;
        const f = prev?.f != null ? prev.f + delta : null;
        const key = this.keyName === 'g' ? step.newG : (f ?? step.newG);
        // A relaxed cell re-enters the heap behind equal keys, like the solvers' fresh push.
        this.open.set(step.cell, { g: step.newG, f, key, seq: this.seq++ });
        this.relaxations++;
        this.justRelaxed.push(step.cell);
        break;
      }
      case 'expand': {
        this.expanded++;
        const live = this.open.get(step.cell);
        const min = this.minimumKey();
        if (live && min !== null && live.key > min) this.notMinimum++;
        // The expand step knows the final values; prefer them over the model's.
        const g = step.g ?? live?.g ?? null;
        const f = step.f ?? live?.f ?? null;
        this.lastExpanded = {
          cell: step.cell,
          g,
          f,
          key: live?.key ?? (this.keyName === 'g' ? (g ?? 0) : (f ?? 0)),
        };
        this.open.delete(step.cell);
        this.justAdded = this.justAdded.filter((c) => c !== step.cell);
        break;
      }
      default:
        break;
    }
  }

  private minimumKey(): number | null {
    let min: number | null = null;
    for (const e of this.open.values()) if (min === null || e.key < min) min = e.key;
    return min;
  }

  snapshot(): PriorityQueueSnapshot {
    const entries = [...this.open.entries()]
      .sort(([, a], [, b]) => (a.key !== b.key ? a.key - b.key : a.seq - b.seq))
      .map(([cell, e]) => ({ cell, g: e.g, f: e.f, key: e.key }));
    return {
      keyName: this.keyName,
      entries,
      lastExpanded: this.lastExpanded,
      justRelaxed: [...this.justRelaxed],
      justAdded: [...this.justAdded],
      expanded: this.expanded,
      relaxations: this.relaxations,
      peak: this.peak,
      notMinimum: this.notMinimum,
    };
  }
}
