/**
 * Trackers fold a step stream into the per-cell state renderers need. They are the bridge
 * between "algorithm as data" and "what the user sees", and they reproduce the legacy
 * visuals (visit-count colouring, stack-depth cube heights) from steps alone.
 */
import { NO_CELL, cellCount, type CellId, type Grid } from './grid';
import type { GenStep, SolveStats, SolveStep } from './steps';

export class GenerationTracker {
  /** Times a cell has been the current cell (legacy `Cell.visited`). */
  readonly visitCount: Uint16Array;
  /** DFS depth when the cell was first visited; -1 until seen (legacy `stackSubractorFromColor`). */
  readonly depthAtVisit: Int32Array;
  current: CellId = NO_CELL;
  /** Current stack depth (number of carves minus backtracks). */
  depth = 0;
  maxDepth = 0;
  seenCount = 0;
  visits = 0;
  carves = 0;
  backtracks = 0;
  steps = 0;
  done = false;

  constructor(readonly grid: Grid) {
    const n = cellCount(grid);
    this.visitCount = new Uint16Array(n);
    this.depthAtVisit = new Int32Array(n).fill(-1);
  }

  apply(step: GenStep): void {
    this.steps++;
    switch (step.t) {
      case 'visit': {
        const c = step.cell;
        this.current = c;
        this.visits++;
        const count = this.visitCount[c] ?? 0;
        if (count < 0xffff) this.visitCount[c] = count + 1;
        if (this.depthAtVisit[c] === -1) {
          this.depthAtVisit[c] = this.depth;
          this.seenCount++;
        }
        break;
      }
      case 'carve':
        this.carves++;
        this.depth++;
        if (this.depth > this.maxDepth) this.maxDepth = this.depth;
        break;
      case 'backtrack':
        this.backtracks++;
        this.depth = Math.max(0, this.depth - 1);
        break;
      case 'done':
        this.done = true;
        break;
      case 'frontier':
      case 'union':
      case 'walk':
      case 'divide':
      case 'rotate':
        // Other generator families: mark touched cells as seen so they render.
        for (const c of touchedCells(step)) {
          if (this.depthAtVisit[c] === -1) {
            this.depthAtVisit[c] = this.depth;
            this.seenCount++;
          }
          if ((this.visitCount[c] ?? 0) === 0) this.visitCount[c] = 1;
        }
        break;
    }
  }

  applyAll(steps: Iterable<GenStep>): void {
    for (const s of steps) this.apply(s);
  }

  /** Has the cell ever been visited (legacy: only visited cells are drawn)? */
  isSeen(cell: CellId): boolean {
    return (this.depthAtVisit[cell] ?? -1) >= 0;
  }

  /**
   * Height of the legacy "cube projection" for a cell, in depth units:
   * `|current depth - depth at first visit|`. Cells visited long ago rise as the walk moves
   * away from them and sink back as it returns - the up/down history of the backtracker.
   */
  projectionHeight(cell: CellId): number {
    const d = this.depthAtVisit[cell] ?? -1;
    return d < 0 ? 0 : Math.abs(this.depth - d);
  }

  reset(): void {
    this.visitCount.fill(0);
    this.depthAtVisit.fill(-1);
    this.current = NO_CELL;
    this.depth = 0;
    this.maxDepth = 0;
    this.seenCount = 0;
    this.visits = 0;
    this.carves = 0;
    this.backtracks = 0;
    this.steps = 0;
    this.done = false;
  }
}

function touchedCells(step: GenStep): readonly CellId[] {
  switch (step.t) {
    case 'frontier':
      return step.add ?? [];
    case 'union':
      return [step.a, step.b];
    case 'walk':
      return [step.cell];
    case 'divide':
      return step.cells;
    case 'rotate':
      return [step.oldRoot, step.newRoot];
    default:
      return [];
  }
}

export const CellMark = { Unseen: 0, Frontier: 1, Expanded: 2, DeadEnd: 3 } as const;
export type CellMark = (typeof CellMark)[keyof typeof CellMark];

export class SolveTracker {
  /** Per-cell mark: unseen / frontier (discovered) / expanded / dead end. */
  readonly marks: Uint8Array;
  /** Best known g-cost per cell, -1 unknown. */
  readonly cost: Int32Array;
  current: CellId = NO_CELL;
  path: CellId[] | null = null;
  expanded = 0;
  discovered = 0;
  steps = 0;
  done = false;
  failed = false;
  stats: SolveStats | null = null;

  constructor(readonly grid: Grid) {
    const n = cellCount(grid);
    this.marks = new Uint8Array(n);
    this.cost = new Int32Array(n).fill(-1);
  }

  apply(step: SolveStep): void {
    this.steps++;
    switch (step.t) {
      case 'expand':
        this.current = step.cell;
        this.marks[step.cell] = CellMark.Expanded;
        this.expanded++;
        if (step.g !== undefined) this.cost[step.cell] = step.g;
        break;
      case 'discover':
        this.marks[step.cell] = CellMark.Frontier;
        this.discovered++;
        if (step.g !== undefined) this.cost[step.cell] = step.g;
        break;
      case 'relax':
        this.cost[step.cell] = step.newG;
        break;
      case 'deadend':
        this.marks[step.cell] = CellMark.DeadEnd;
        break;
      case 'mark':
        break;
      case 'move':
        this.current = step.to;
        this.marks[step.to] = CellMark.Expanded;
        break;
      case 'path':
        this.path = [...step.cells];
        break;
      case 'fail':
        this.failed = true;
        break;
      case 'done':
        this.done = true;
        this.stats = step.stats;
        break;
    }
  }

  applyAll(steps: Iterable<SolveStep>): void {
    for (const s of steps) this.apply(s);
  }

  reset(): void {
    this.marks.fill(0);
    this.cost.fill(-1);
    this.current = NO_CELL;
    this.path = null;
    this.expanded = 0;
    this.discovered = 0;
    this.steps = 0;
    this.done = false;
    this.failed = false;
    this.stats = null;
  }
}
