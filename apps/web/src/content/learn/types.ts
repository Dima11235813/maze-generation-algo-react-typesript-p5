/**
 * Learn-mode content model (proj-mgmt/20-learn-mode.md, decision D-20).
 *
 * A lesson is a typed module: metadata in the curriculum (so the index never loads lesson
 * bodies) plus a lazily loaded `LessonContent` with the prose component and the demo it drives.
 */
import type { CellId, MazeState, Step } from '@maze/core';
import type { PlayerStatus } from '@maze/player';
import type { ComponentType } from 'react';
import type { GenStructureState } from '../../learn/genStructure';
import type { GraphStats } from '../../learn/graphDemo';
import type { PairLane } from '../../learn/pairDemo';
import type { SolveStructureState } from '../../learn/solveStructure';

interface DemoMaze {
  readonly generatorId: string;
  readonly seed: string;
  readonly width: number;
  readonly height: number;
}

/** A solver run on a finished maze; its data structure follows from the solver. */
export interface SolveDemoSpec extends DemoMaze {
  readonly kind: 'solve';
  readonly solverId: string;
}

/** The generator itself, step by step; its data structure follows from the generator. */
export interface GenerateDemoSpec extends DemoMaze {
  readonly kind: 'generate';
}

/** A small maze the learner edits by hand, read as a graph; no algorithm runs (M1). */
export interface GraphDemoSpec extends DemoMaze {
  readonly kind: 'graph';
  /** Passages closed after generating, so the maze starts in `cut + 1` pieces. */
  readonly cut?: number;
}

/** Two solvers side by side on one braided maze, in lockstep (M3 "DFS or BFS?"). */
export interface PairDemoSpec extends DemoMaze {
  readonly kind: 'pair';
  /** Percent of dead ends braided away, which adds loops. */
  readonly braid: number;
  readonly solverIds: readonly [string, string];
}

type DemoSpec = SolveDemoSpec | GenerateDemoSpec | GraphDemoSpec | PairDemoSpec;

/** The demos a step player drives. */
export type PlayerDemoSpec = SolveDemoSpec | GenerateDemoSpec;

/** What a graph demo shows: its stats and the selected cell. */
interface GraphDemoView {
  readonly stats: GraphStats;
  readonly selected: CellId | null;
  /** Passages of the selected cell. */
  readonly degree: number | null;
  /** Walls opened or closed so far (undo takes one back). */
  readonly edits: number;
}

interface ComplexityNote {
  readonly time: string;
  readonly space: string;
  /** Why each term is what it is, in a sentence or two. */
  readonly why: string;
}

/** One multiple-choice question; `answer` is the index of the right choice. */
interface QuizQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly answer: number;
  /** Why the right answer is right, shown after checking. */
  readonly explain: string;
}

export interface QuizSpec {
  readonly questions: readonly QuizQuestion[];
  /** Correct answers needed to pass; all of them by default. Passing completes the lesson. */
  readonly passMark?: number;
}

/** What a try-it check can see of the demo: the player, the latest step and the structure. */
export interface DemoState {
  readonly status: PlayerStatus | null;
  readonly stepCount: number;
  /** A solver step in solve demos, a generator step in generate demos. */
  readonly lastStep: Step | null;
  /** The maze as it stands (while generating, the walls carved so far). */
  readonly maze: MazeState | null;
  /** Solve demos: the solver's frontier and distances. */
  readonly structure: SolveStructureState | null;
  /** Generate demos: the generator's stack or sets. */
  readonly genStructure: GenStructureState | null;
  /** Graph demos: the stats and the selection. */
  readonly graph: GraphDemoView | null;
  /** Pair demos: each lane's progress and the shortest path's length. */
  readonly pair: {
    readonly lanes: readonly PairLane[];
    readonly shortest: number | null;
  } | null;
}

/** A task done in the demo, verified live by a predicate over its state (13 section 11). */
export interface TryItCheck {
  readonly id: string;
  readonly prompt: string;
  readonly hint?: string;
  /** Said when the check passes: a full sentence ("The goal is expanded at distance 14."). */
  readonly success: (demo: DemoState) => string;
  readonly check: (demo: DemoState) => boolean;
}

/** The lazily loaded part of a lesson. */
export interface LessonContent {
  /** The concept prose (150-300 words, one idea). */
  readonly Body: ComponentType;
  readonly demo: DemoSpec;
  readonly complexity: ComplexityNote;
  /** Tasks in the demo that are checked live and remembered. */
  readonly tryIt?: readonly TryItCheck[];
  /** Open prompts with no check ("Where in the maze are those cells?"). */
  readonly tryThis?: readonly string[];
  /** Passing it completes the lesson; lessons without one have a "Mark as done" button. */
  readonly quiz?: QuizSpec;
}

export interface LessonInfo {
  /** Route id: module prefix + slug, e.g. `m3-frontier-ring`. */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly minutes: number;
  readonly load: () => Promise<LessonContent>;
}

export interface ModuleInfo {
  /** `m1` .. `m12`. */
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly objectives: readonly string[];
  /** Module ids to take first. */
  readonly prerequisites: readonly string[];
  /** Empty while the module is planned. */
  readonly lessons: readonly LessonInfo[];
}

export type Curriculum = readonly ModuleInfo[];
