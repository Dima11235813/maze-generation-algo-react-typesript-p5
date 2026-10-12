/**
 * Learn-mode content model (proj-mgmt/20-learn-mode.md, decision D-20).
 *
 * A lesson is a typed module: metadata in the curriculum (so the index never loads lesson
 * bodies) plus a lazily loaded `LessonContent` with the prose component and the demo it drives.
 */
import type { ComponentType } from 'react';

/** Which data-structure view the demo shows next to the maze. */
type StructureKind = 'queue';

export interface DemoSpec {
  readonly generatorId: string;
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly solverId: string;
  readonly structure: StructureKind;
}

interface ComplexityNote {
  readonly time: string;
  readonly space: string;
  /** Why each term is what it is, in a sentence or two. */
  readonly why: string;
}

/** The lazily loaded part of a lesson. */
export interface LessonContent {
  /** The concept prose (150-300 words, one idea). */
  readonly Body: ComponentType;
  readonly demo: DemoSpec;
  readonly complexity: ComplexityNote;
  /** Short prompts shown under the demo ("Pause when the queue is longest..."). */
  readonly tryThis?: readonly string[];
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
