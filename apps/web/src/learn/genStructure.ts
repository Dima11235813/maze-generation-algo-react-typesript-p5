/**
 * Which data structure a generator keeps, and one tracker that folds a generation's steps into
 * it (proj-mgmt/20-learn-mode.md, WI-06d/e): the recursive backtracker's path stack, Prim's
 * frontier, Kruskal's disjoint sets, the random walk of Aldous-Broder and Wilson's. Used by
 * generator demos in lessons; rebuilt from steps only, like the solver structures, so a rewind
 * resets it and replays exactly.
 */
import type { CellId, GenStep } from '@maze/core';
import { DisjointSetModel, type DisjointSetSnapshot } from './disjointSetModel';
import { FrontierSetModel, type FrontierSetSnapshot } from './frontierSetModel';
import { BacktrackerStackModel, type StackSnapshot } from './stackModel';
import { WalkModel, type WalkSnapshot } from './walkModel';

export type GenStructureKind = 'stack' | 'frontier' | 'sets' | 'walk' | 'none';

const KIND: Readonly<Record<string, GenStructureKind>> = {
  'recursive-backtracker': 'stack',
  prims: 'frontier',
  kruskals: 'sets',
  'aldous-broder': 'walk',
  wilsons: 'walk',
};

export function genStructureFor(generatorId: string): GenStructureKind {
  return KIND[generatorId] ?? 'none';
}

export function genStructureTitle(kind: GenStructureKind): string {
  switch (kind) {
    case 'stack':
      return 'Stack';
    case 'frontier':
      return 'Frontier';
    case 'sets':
      return 'Disjoint sets';
    case 'walk':
      return 'Random walk';
    case 'none':
      return 'Data structure';
  }
}

type GenStructureSnapshot =
  | { readonly kind: 'stack'; readonly stack: StackSnapshot }
  | { readonly kind: 'frontier'; readonly frontier: FrontierSetSnapshot }
  | { readonly kind: 'sets'; readonly sets: DisjointSetSnapshot }
  | { readonly kind: 'walk'; readonly walk: WalkSnapshot }
  | { readonly kind: 'none' };

export interface GenStructureState {
  readonly generatorId: string;
  readonly structure: GenStructureSnapshot;
}

type Model = BacktrackerStackModel | FrontierSetModel | DisjointSetModel | WalkModel | null;

export class GenStructureTracker {
  private readonly model: Model;
  private readonly generatorId: string;
  private readonly cells: number;
  /** Steps folded since the last reset, so `fork` can rebuild the same state. */
  private history: GenStep[] = [];

  constructor(generatorId: string, cells: number) {
    this.generatorId = generatorId;
    this.cells = cells;
    const kind = genStructureFor(generatorId);
    this.model =
      kind === 'stack'
        ? new BacktrackerStackModel()
        : kind === 'frontier'
          ? new FrontierSetModel()
          : kind === 'sets'
            ? new DisjointSetModel(cells)
            : kind === 'walk'
              ? new WalkModel(cells)
              : null;
  }

  reset(): void {
    this.model?.reset();
    this.history = [];
  }

  applyBatch(steps: readonly GenStep[]): void {
    this.model?.applyBatch(steps);
    for (const s of steps) this.history.push(s);
  }

  /** Folds one step (breakpoints test each step as it comes). */
  apply(step: GenStep): void {
    this.applyBatch([step]);
  }

  /** Cells on the stack now; 0 for generators without one. */
  stackSize(): number {
    return this.model instanceof BacktrackerStackModel ? this.model.size : 0;
  }

  /** Cells in Prim's frontier now; 0 for generators without one. */
  frontierSize(): number {
    return this.model instanceof FrontierSetModel ? this.model.size : 0;
  }

  /** Separate pieces (Kruskal's components) now; 0 for generators without disjoint sets. */
  pieces(): number {
    return this.model instanceof DisjointSetModel ? this.model.pieces : 0;
  }

  /** Cells outside the random walk's tree; 0 for generators without one. */
  remaining(): number {
    return this.model instanceof WalkModel ? this.model.remaining : 0;
  }

  /** The latest step that was not a `visit` (a carve, a backtrack, ...), if any. */
  lastMove(): GenStep | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const s = this.history[i];
      if (s && s.t !== 'visit') return s;
    }
    return null;
  }

  /** An independent copy at the same position, for a breakpoint to fold ahead on its own. */
  fork(): GenStructureTracker {
    const copy = new GenStructureTracker(this.generatorId, this.cells);
    copy.applyBatch(this.history);
    return copy;
  }

  snapshot(): GenStructureState {
    const m = this.model;
    const structure: GenStructureSnapshot =
      m instanceof BacktrackerStackModel
        ? { kind: 'stack', stack: m.snapshot() }
        : m instanceof FrontierSetModel
          ? { kind: 'frontier', frontier: m.snapshot() }
          : m instanceof DisjointSetModel
            ? { kind: 'sets', sets: m.snapshot() }
            : m instanceof WalkModel
              ? { kind: 'walk', walk: m.snapshot() }
              : { kind: 'none' };
    return { generatorId: this.generatorId, structure };
  }
}

/** The stack's cells, top first (the current cell first); empty for generators without one. */
export function genStackCells(state: GenStructureState): readonly CellId[] {
  return state.structure.kind === 'stack' ? [...state.structure.stack.cells].reverse() : [];
}
