/**
 * "Run until ..." for a step player: the chosen breakpoint, its N, and what happened last.
 * Running plays at the current speed and pauses on the matching step; the outcome is announced.
 * The breakpoints come from a catalogue (solver runs: `solveBreakpointCatalogue`; generator
 * runs: `genBreakpointCatalogue`), so the same row serves both.
 */
import type { BreakHit, StepPlayer, StepPredicate } from '@maze/player';
import { useEffect, useRef, useState } from 'react';
import { useAnnouncer } from '../app/useAnnouncer';

/** A frontier size worth stopping at on lesson-sized mazes. */
const DEFAULT_COUNT = 8;

export interface BreakpointChoice {
  readonly id: string;
  /** Completes "Run until ..."; an `N` in it stands for the count. */
  readonly label: string;
}

export interface Breakpoint<S> {
  readonly predicate: StepPredicate<S>;
  /** What the learner hears when the run stops (or ends without a match). */
  describe(hit: BreakHit<S> | null): string;
}

/** The breakpoints one algorithm on one maze offers. */
export interface BreakpointCatalogue<S> {
  readonly choices: readonly BreakpointChoice[];
  /** Whether the breakpoint needs N. */
  needsCount(id: string): boolean;
  /** A breakpoint starting from the player's current position. */
  make(id: string, count: number): Breakpoint<S>;
}

export interface BreakpointRun {
  readonly choices: readonly BreakpointChoice[];
  readonly choice: string | null;
  readonly setChoice: (id: string) => void;
  readonly count: number;
  readonly setCount: (n: number) => void;
  /** Whether the chosen breakpoint needs N. */
  readonly needsCount: boolean;
  readonly canRun: boolean;
  readonly running: boolean;
  readonly run: () => void;
  readonly stop: () => void;
  /** The outcome of the last run, until the next one starts. */
  readonly message: string | null;
}

export function useBreakpointRun<S, R>(opts: {
  player: StepPlayer<S, R> | null;
  catalogue: BreakpointCatalogue<S> | null;
  running: boolean;
  done: boolean;
}): BreakpointRun {
  const { player, catalogue, running, done } = opts;
  const announce = useAnnouncer();
  const choices = catalogue?.choices ?? [];
  const [picked, setChoice] = useState<string | null>(null);
  const choice = choices.find((c) => c.id === picked)?.id ?? choices[0]?.id ?? null;
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [message, setMessage] = useState<string | null>(null);
  const armedRef = useRef<Breakpoint<S> | null>(null);

  useEffect(() => {
    setMessage(null);
    armedRef.current = null;
    if (!player) return;
    return player.onBreak((hit) => {
      const bp = armedRef.current;
      armedRef.current = null;
      if (!bp) return;
      const text = bp.describe(hit);
      setMessage(text);
      announce(text);
    });
  }, [player, announce]);

  const canRun = player !== null && catalogue !== null && choice !== null && !done;
  return {
    choices,
    choice,
    setChoice,
    count,
    setCount,
    needsCount: choice !== null && (catalogue?.needsCount(choice) ?? false),
    canRun,
    running,
    run: () => {
      if (!player || !catalogue || !choice || done) return;
      const bp = catalogue.make(choice, count);
      armedRef.current = bp;
      setMessage(null);
      player.playUntil(bp.predicate);
    },
    stop: () => {
      armedRef.current = null;
      player?.pause();
    },
    message,
  };
}
