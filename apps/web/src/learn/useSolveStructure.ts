/**
 * Folds a solve player's step batches into the solver's data structure and distance map; a
 * rewind (the player replays from the start) resets both, so step back and seek stay exact.
 */
import { cellCount, type MazeState, type SolveResult, type SolveStep } from '@maze/core';
import type { StepPlayer } from '@maze/player';
import { useEffect, useState } from 'react';
import { SolveStructureTracker, type SolveStructureState } from './solveStructure';

export function useSolveStructure(
  player: StepPlayer<SolveStep, SolveResult> | null,
  maze: MazeState | null,
  solverId: string | null,
): SolveStructureState | null {
  const [state, setState] = useState<SolveStructureState | null>(null);
  useEffect(() => {
    if (!player || !maze || !solverId) {
      setState(null);
      return;
    }
    const tracker = new SolveStructureTracker(
      solverId,
      maze.start,
      maze.goal,
      cellCount(maze.grid),
    );
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
    };
  }, [player, maze, solverId]);
  return state;
}
