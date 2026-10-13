/**
 * Which data structure each solver keeps, and one tracker that folds a solve's steps into it
 * plus the distance map (proj-mgmt/20-learn-mode.md, WI-06b). Used by lesson demos and Watch.
 */
import type { CellId, SolveStep } from '@maze/core';
import { DistanceModel, type DistanceSnapshot } from './distanceModel';
import { PriorityQueueModel, type PriorityQueueSnapshot } from './priorityQueueModel';
import { QueueModel, type QueueSnapshot } from './queueModel';
import { DfsStackModel, type StackSnapshot } from './stackModel';

export type SolveStructureKind = 'queue' | 'stack' | 'priority' | 'none';

const KIND: Readonly<Record<string, SolveStructureKind>> = {
  bfs: 'queue',
  'flood-fill': 'queue',
  dfs: 'stack',
  dijkstra: 'priority',
  astar: 'priority',
  'greedy-best-first': 'priority',
};

/** Flood fill floods from the goal (then walks downhill from the start). */
const FROM_GOAL = new Set(['flood-fill']);

/** Solvers whose `expand` carries a settled distance (BFS rings, Dijkstra/A* costs). */
const DISTANCES = new Set(['bfs', 'flood-fill', 'dijkstra', 'astar']);

export function solveStructureFor(solverId: string): SolveStructureKind {
  return KIND[solverId] ?? 'none';
}

export function structureTitle(kind: SolveStructureKind): string {
  switch (kind) {
    case 'queue':
      return 'Queue';
    case 'stack':
      return 'Stack';
    case 'priority':
      return 'Priority queue';
    case 'none':
      return 'Data structure';
  }
}

type SolveStructureSnapshot =
  | { readonly kind: 'queue'; readonly queue: QueueSnapshot }
  | { readonly kind: 'stack'; readonly stack: StackSnapshot }
  | { readonly kind: 'priority'; readonly pq: PriorityQueueSnapshot }
  | { readonly kind: 'none' };

export interface SolveStructureState {
  readonly solverId: string;
  /** Where the frontier starts and distances count from. */
  readonly origin: 'start' | 'goal';
  readonly structure: SolveStructureSnapshot;
  /** Null for solvers whose steps carry no settled distance. */
  readonly distances: DistanceSnapshot | null;
}

type Model = QueueModel | DfsStackModel | PriorityQueueModel | null;

export class SolveStructureTracker {
  private readonly model: Model;
  private readonly distances: DistanceModel | null;
  private readonly solverId: string;
  private readonly origin: 'start' | 'goal';

  constructor(solverId: string, start: CellId, goal: CellId, cells: number) {
    this.solverId = solverId;
    this.origin = FROM_GOAL.has(solverId) ? 'goal' : 'start';
    const kind = solveStructureFor(solverId);
    this.model =
      kind === 'queue'
        ? new QueueModel(this.origin === 'goal' ? goal : start)
        : kind === 'stack'
          ? new DfsStackModel(start)
          : kind === 'priority'
            ? new PriorityQueueModel(start, solverId === 'dijkstra' ? 'g' : 'f')
            : null;
    this.distances = DISTANCES.has(solverId) ? new DistanceModel(cells) : null;
  }

  reset(): void {
    this.model?.reset();
    this.distances?.reset();
  }

  applyBatch(steps: readonly SolveStep[]): void {
    this.model?.applyBatch(steps);
    this.distances?.applyBatch(steps);
  }

  snapshot(): SolveStructureState {
    const m = this.model;
    const structure: SolveStructureSnapshot =
      m instanceof QueueModel
        ? { kind: 'queue', queue: m.snapshot() }
        : m instanceof DfsStackModel
          ? { kind: 'stack', stack: m.snapshot() }
          : m instanceof PriorityQueueModel
            ? { kind: 'priority', pq: m.snapshot() }
            : { kind: 'none' };
    return {
      solverId: this.solverId,
      origin: this.origin,
      structure,
      distances: this.distances?.snapshot() ?? null,
    };
  }
}
