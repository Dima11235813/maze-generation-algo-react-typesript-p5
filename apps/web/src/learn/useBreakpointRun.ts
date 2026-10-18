/**
 * "Run until ..." for a solve player: the chosen breakpoint, its N, and what happened last.
 * Running plays at the current speed and pauses on the matching step; the outcome is announced.
 */
import type { MazeState, SolveResult, SolveStep } from '@maze/core';
import type { StepPlayer } from '@maze/player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnnouncer } from '../app/useAnnouncer';
import {
  makeSolveBreakpoint,
  solveBreakpointsFor,
  type SolveBreakpoint,
  type SolveBreakpointChoice,
  type SolveBreakpointId,
} from './breakpoints';
import type { SolveStructureTracker } from './solveStructure';

/** A frontier size worth stopping at on lesson-sized mazes. */
const DEFAULT_COUNT = 8;

export interface BreakpointRun {
  readonly choices: readonly SolveBreakpointChoice[];
  readonly choice: SolveBreakpointId | null;
  readonly setChoice: (id: SolveBreakpointId) => void;
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

export function useBreakpointRun(opts: {
  player: StepPlayer<SolveStep, SolveResult> | null;
  maze: MazeState | null;
  solverId: string | null;
  tracker: () => SolveStructureTracker | null;
  running: boolean;
  done: boolean;
}): BreakpointRun {
  const { player, maze, solverId, tracker, running, done } = opts;
  const announce = useAnnouncer();
  const choices = useMemo(() => (solverId ? solveBreakpointsFor(solverId) : []), [solverId]);
  const [picked, setChoice] = useState<SolveBreakpointId | null>(null);
  const choice = choices.find((c) => c.id === picked)?.id ?? choices[0]?.id ?? null;
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [message, setMessage] = useState<string | null>(null);
  const armedRef = useRef<SolveBreakpoint | null>(null);

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

  const canRun = player !== null && maze !== null && choice !== null && !done;
  return {
    choices,
    choice,
    setChoice,
    count,
    setCount,
    needsCount: choice === 'frontier',
    canRun,
    running,
    run: () => {
      if (!player || !maze || !solverId || !choice || done) return;
      const bp = makeSolveBreakpoint(choice, { solverId, maze, tracker: tracker(), count });
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
