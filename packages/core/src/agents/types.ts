/**
 * Race mode types (proj-mgmt/02 section 2.7 and 9). An Agent is a solver plus a budget;
 * a Race runs agents on the same maze in lockstep, one step per agent per tick.
 */
import type { MazeDocument } from '../document';
import type { MazeSolver } from '../solvers/types';
import type { SolveStats, SolveStep } from '../steps';

export interface Agent {
  /** Unique within a race, e.g. 'bfs', 'astar:manhattan'. */
  readonly id: string;
  readonly solver: MazeSolver<Record<string, unknown>>;
  readonly params: Record<string, unknown>;
  readonly budget: { readonly maxSteps: number; readonly maxMs?: number };
  /** `rng.fork(label)` gives each randomised agent its own deterministic stream. */
  readonly rngLabel: string;
}

export type RaceScoring = 'first-to-goal' | 'fewest-expanded' | 'composite';

export interface RaceConfig {
  readonly document: MazeDocument;
  /** 2..4 agents in v1. */
  readonly agents: readonly Agent[];
  readonly lockstep: true;
  readonly scoring: RaceScoring;
  /** Seed used for `fork()` per agent; defaults to the document provenance seed. */
  readonly seed?: string;
}

/** One entry per agent, `null` once that agent has finished or been disqualified. */
export interface RaceTick {
  readonly tick: number;
  readonly steps: ReadonlyArray<SolveStep | null>;
}

export interface RaceAgentResult extends SolveStats {
  readonly finishedAtTick: number | null;
  readonly reachedGoal: boolean;
  readonly disqualified?: string;
}

export interface RaceResult {
  readonly config: RaceConfig;
  /** Agent ids, best first. */
  readonly ranking: readonly string[];
  readonly perAgent: Readonly<Record<string, RaceAgentResult>>;
  readonly ticks: number;
}
