/**
 * Folds a solve player's step batches into the solver's data structure and distance map; a
 * rewind (the player replays from the start) resets both, so step back and seek stay exact.
 */
import { cellCount, type MazeState, type SolveResult, type SolveStep } from '@maze/core';
import type { StepPlayer } from '@maze/player';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SolveStructureTracker, type SolveStructureState } from './solveStructure';

export interface SolveStructureLive {
  readonly state: SolveStructureState | null;
  /** The live tracker (breakpoints fork it); null before a solve is armed. */
  readonly tracker: () => SolveStructureTracker | null;
}

export function useSolveStructure(
  player: StepPlayer<SolveStep, SolveResult> | null,
  maze: MazeState | null,
  solverId: string | null,
): SolveStructureLive {
  const [state, setState] = useState<SolveStructureState | null>(null);
  const trackerRef = useRef<SolveStructureTracker | null>(null);
  useEffect(() => {
    if (!player || !maze || !solverId) {
      trackerRef.current = null;
      setState(null);
      return;
    }
    const tracker = new SolveStructureTracker(
      solverId,
      maze.start,
      maze.goal,
      cellCount(maze.grid),
    );
    trackerRef.current = tracker;
    setState(tracker.snapshot());
    const offReset = player.onReset(() => {
      tracker.reset();
      setState(tracker.snapshot());
    });
    const offSteps = player.subscribe((batch) => {
      tracker.applyBatch(batch);
      setState(tracker.snapshot());
    });
    return () => {
      offReset();
      offSteps();
      if (trackerRef.current === tracker) trackerRef.current = null;
    };
  }, [player, maze, solverId]);
  const getTracker = useCallback(() => trackerRef.current, []);
  return { state, tracker: getTracker };
}
