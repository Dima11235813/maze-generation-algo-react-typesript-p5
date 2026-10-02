/**
 * Narrator: turns step batches into a small number of spoken sentences (S3.7, D-17).
 *
 * Steps arrive far faster than anyone can listen, so the narrator (1) speaks milestones
 * immediately, (2) summarises progress about once a second at medium verbosity, (3) at high
 * verbosity speaks individual step sentences but rate-limits them, coalescing whatever was
 * skipped into "...and N more steps", and (4) keeps a ring buffer of what it said for a
 * visible step log. Sentence text comes from injected describers so this module stays free of
 * UI and locale concerns.
 */
import type { GenStep, Grid, SolveStep } from '@maze/core';

export type NarratorVerbosity = 'off' | 'low' | 'medium' | 'high';
export const NARRATOR_VERBOSITIES: readonly NarratorVerbosity[] = ['off', 'low', 'medium', 'high'];

export type Politeness = 'polite' | 'assertive';

export interface NarratorLogEntry {
  /** Monotonic id (never reused, survives ring-buffer eviction). */
  readonly id: number;
  /** Algorithm step count when the sentence was produced (gen + solve steps seen so far). */
  readonly step: number;
  readonly text: string;
  readonly kind: 'gen' | 'solve' | 'info';
}

export interface NarratorOptions {
  readonly grid: Grid;
  /** Cells in the maze; used for "visited X of N" summaries. Defaults to grid area. */
  readonly totalCells?: number;
  readonly describeGen: (grid: Grid, step: GenStep) => string;
  readonly describeSolve: (grid: Grid, step: SolveStep) => string;
  readonly speak: (text: string, politeness: Politeness) => void;
  readonly verbosity?: NarratorVerbosity;
  /** Upper bound on spoken sentences per second (milestones are exempt). Default 3. */
  readonly maxPerSecond?: number;
  /** Progress summary interval at medium verbosity. Default 1000 ms. */
  readonly progressIntervalMs?: number;
  /** Ring-buffer size for the step log. Default 200. */
  readonly logCapacity?: number;
  /** Backtracks between "backtracked N times" summaries at low verbosity. Default 25. */
  readonly backtrackSummaryEvery?: number;
  /**
   * Speak built-in milestones (generation complete, path found, no path). Default true. Apps
   * that already announce richer status messages set this to false and forward them with
   * `say(text, politeness, true)`, so nothing is announced twice.
   */
  readonly announceMilestones?: boolean;
  readonly now?: () => number;
}

export interface Narrator {
  handleGenSteps(batch: readonly GenStep[]): void;
  handleSolveSteps(batch: readonly SolveStep[]): void;
  /** Speak and log an application message (rate-limited unless `immediate`). */
  say(text: string, politeness?: Politeness, immediate?: boolean): void;
  setVerbosity(v: NarratorVerbosity): void;
  getVerbosity(): NarratorVerbosity;
  /** Speak anything pending right now (e.g. when playback pauses). */
  flush(): void;
  /** Reset solve counters before a new solver runs on the same maze. */
  beginSolve(): void;
  getLog(): readonly NarratorLogEntry[];
  clearLog(): void;
  /** Fires after the log changes; returns an unsubscribe function. */
  onLog(listener: () => void): () => void;
  dispose(): void;
}

interface Pending {
  text: () => string;
  kind: NarratorLogEntry['kind'];
  politeness: Politeness;
  /** Sentences skipped since the last spoken one (excluding the pending one). */
  skipped: number;
}

export function createNarrator(opts: NarratorOptions): Narrator {
  return new NarratorImpl(opts);
}

class NarratorImpl implements Narrator {
  private readonly grid: Grid;
  private readonly totalCells: number;
  private readonly describeGen: NarratorOptions['describeGen'];
  private readonly describeSolve: NarratorOptions['describeSolve'];
  private readonly speakFn: NarratorOptions['speak'];
  private readonly minGapMs: number;
  private readonly progressIntervalMs: number;
  private readonly logCapacity: number;
  private readonly backtrackEvery: number;
  private readonly announceMilestones: boolean;
  private readonly now: () => number;

  private verbosity: NarratorVerbosity;
  private disposed = false;

  // counters
  private genSteps = 0;
  private carves = 0;
  private backtracks = 0;
  private depth = 0;
  private lastBacktrackSummary = 0;
  private genDone = false;
  private solveSteps = 0;
  private expanded = 0;
  private discovered = 0;
  private solveDone = false;
  private activityKind: NarratorLogEntry['kind'] = 'gen';
  private stepsSinceProgress = 0;

  // rate limiting
  private lastSpokeAt = -Infinity;
  private pending: Pending | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;

  // log
  private log: NarratorLogEntry[] = [];
  private logSeq = 0;
  private readonly logListeners = new Set<() => void>();

  constructor(opts: NarratorOptions) {
    this.grid = opts.grid;
    this.totalCells = opts.totalCells ?? opts.grid.width * opts.grid.height;
    this.describeGen = opts.describeGen;
    this.describeSolve = opts.describeSolve;
    this.speakFn = opts.speak;
    this.minGapMs = 1000 / Math.max(0.1, opts.maxPerSecond ?? 3);
    this.progressIntervalMs = opts.progressIntervalMs ?? 1000;
    this.logCapacity = Math.max(1, opts.logCapacity ?? 200);
    this.backtrackEvery = Math.max(1, opts.backtrackSummaryEvery ?? 25);
    this.announceMilestones = opts.announceMilestones ?? true;
    this.now = opts.now ?? (() => Date.now());
    this.verbosity = opts.verbosity ?? 'medium';
  }

  // ---- public -------------------------------------------------------------------------------

  handleGenSteps(batch: readonly GenStep[]): void {
    if (this.disposed) return;
    this.activityKind = 'gen';
    for (const step of batch) {
      this.genSteps++;
      this.stepsSinceProgress++;
      switch (step.t) {
        case 'carve':
          this.carves++;
          this.depth++;
          break;
        case 'backtrack':
          this.backtracks++;
          this.depth = Math.max(0, this.depth - 1);
          if (
            this.verbosity !== 'off' &&
            this.verbosity !== 'high' &&
            this.backtracks - this.lastBacktrackSummary >= this.backtrackEvery
          ) {
            this.lastBacktrackSummary = this.backtracks;
            const n = this.backtracks;
            this.enqueue(() => `Backtracked ${n} times so far.`, 'gen', 'polite');
          }
          break;
        case 'done':
          this.genDone = true;
          this.milestone(
            `Maze generation complete: ${this.carves + 1} cells, ${this.backtracks} backtracks.`,
            'gen',
          );
          break;
        default:
          break;
      }
      if (this.verbosity === 'high' && step.t !== 'done') {
        const s = step;
        this.enqueue(() => this.describeGen(this.grid, s), 'gen', 'polite');
      }
    }
    if (!this.genDone) this.ensureProgressTimer();
  }

  handleSolveSteps(batch: readonly SolveStep[]): void {
    if (this.disposed) return;
    this.activityKind = 'solve';
    for (const step of batch) {
      this.solveSteps++;
      this.stepsSinceProgress++;
      switch (step.t) {
        case 'expand':
        case 'move':
          this.expanded++;
          break;
        case 'discover':
          this.discovered++;
          break;
        case 'path':
          this.milestone(
            `Path found with ${step.cells.length - 1} moves after exploring ${this.expanded} cells.`,
            'solve',
          );
          break;
        case 'fail':
          this.milestone('No path exists.', 'solve');
          break;
        case 'done':
          this.solveDone = true;
          break;
        default:
          break;
      }
      if (this.verbosity === 'high' && step.t !== 'done' && step.t !== 'path' && step.t !== 'fail') {
        const s = step;
        this.enqueue(() => this.describeSolve(this.grid, s), 'solve', 'polite');
      }
    }
    if (!this.solveDone) this.ensureProgressTimer();
  }

  say(text: string, politeness: Politeness = 'polite', immediate = false): void {
    if (this.disposed) return;
    if (immediate) this.milestone(text, 'info', politeness);
    else this.enqueue(() => text, 'info', politeness);
  }

  setVerbosity(v: NarratorVerbosity): void {
    if (v === this.verbosity) return;
    this.verbosity = v;
    this.dropPending();
    if (v === 'off' || v === 'low' || v === 'high') this.stopProgressTimer();
  }

  getVerbosity(): NarratorVerbosity {
    return this.verbosity;
  }

  flush(): void {
    if (this.pending) this.speakPending();
  }

  beginSolve(): void {
    this.solveSteps = 0;
    this.expanded = 0;
    this.discovered = 0;
    this.solveDone = false;
    this.activityKind = 'solve';
    this.stepsSinceProgress = 0;
  }

  getLog(): readonly NarratorLogEntry[] {
    return this.log;
  }

  clearLog(): void {
    if (this.log.length === 0) return;
    this.log = [];
    this.emitLog();
  }

  onLog(listener: () => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.dropPending();
    this.stopProgressTimer();
    this.logListeners.clear();
  }

  // ---- internals ----------------------------------------------------------------------------

  private get currentStep(): number {
    return this.genSteps + this.solveSteps;
  }

  /** Spoken right away regardless of verbosity (except off) and of the rate limit. */
  private milestone(text: string, kind: NarratorLogEntry['kind'], politeness: Politeness = 'polite'): void {
    if (this.verbosity === 'off') return;
    this.dropPending();
    if (kind !== 'info' && !this.announceMilestones) return;
    this.speakNow(text, kind, politeness);
  }

  /** Rate-limited path used by everything that is not a milestone. */
  private enqueue(text: () => string, kind: NarratorLogEntry['kind'], politeness: Politeness): void {
    if (this.verbosity === 'off') return;
    const since = this.now() - this.lastSpokeAt;
    if (!this.pending && since >= this.minGapMs) {
      this.speakNow(text(), kind, politeness);
      return;
    }
    if (this.pending) {
      this.pending = { text, kind, politeness, skipped: this.pending.skipped + 1 };
    } else {
      this.pending = { text, kind, politeness, skipped: 0 };
    }
    if (this.pendingTimer === null) {
      const wait = Math.max(0, this.minGapMs - since);
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.speakPending();
      }, wait);
    }
  }

  private speakPending(): void {
    const p = this.pending;
    this.dropPending();
    if (!p) return;
    const suffix = p.skipped > 0 ? ` ...and ${p.skipped} more ${p.skipped === 1 ? 'step' : 'steps'}.` : '';
    this.speakNow(p.text() + suffix, p.kind, p.politeness);
  }

  private dropPending(): void {
    this.pending = null;
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private speakNow(text: string, kind: NarratorLogEntry['kind'], politeness: Politeness): void {
    this.lastSpokeAt = this.now();
    this.pushLog(text, kind);
    this.speakFn(text, politeness);
  }

  private pushLog(text: string, kind: NarratorLogEntry['kind']): void {
    this.logSeq++;
    const entry: NarratorLogEntry = { id: this.logSeq, step: this.currentStep, text, kind };
    // Copy-on-write so React consumers can compare identities cheaply.
    const next = this.log.length >= this.logCapacity ? this.log.slice(1) : this.log.slice();
    next.push(entry);
    this.log = next;
    this.emitLog();
  }

  private emitLog(): void {
    for (const l of this.logListeners) l();
  }

  private ensureProgressTimer(): void {
    if (this.verbosity !== 'medium' || this.progressTimer !== null) return;
    this.progressTimer = setTimeout(() => {
      this.progressTimer = null;
      this.progressTick();
    }, this.progressIntervalMs);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer !== null) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
    this.stepsSinceProgress = 0;
  }

  private progressTick(): void {
    if (this.disposed || this.verbosity !== 'medium') return;
    if (this.stepsSinceProgress === 0) return; // idle: stop until steps resume
    this.stepsSinceProgress = 0;
    if (this.activityKind === 'solve') {
      if (!this.solveDone) {
        const frontier = Math.max(0, this.discovered + 1 - this.expanded);
        this.enqueue(
          () => `Explored ${this.expanded} cells, ${frontier} on the frontier.`,
          'solve',
          'polite',
        );
      }
    } else if (!this.genDone) {
      const visited = Math.min(this.totalCells, this.carves + 1);
      this.enqueue(
        () => `Visited ${visited} of ${this.totalCells} cells, depth ${this.depth}.`,
        'gen',
        'polite',
      );
    }
    this.ensureProgressTimer();
  }
}
