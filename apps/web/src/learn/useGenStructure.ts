/**
 * Folds a generation player's step batches into the generator's data structure; a rewind (the
 * player replays from the start) resets it, so step back and seek stay exact.
 */
import { cellCount, type GenStep, type Grid, type MazeState } from '@maze/core';
import type { StepPlayer } from '@maze/player';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GenStructureTracker, type GenStructureState } from './genStructure';

export interface GenStructureLive {
  readonly state: GenStructureState | null;
  /** The live tracker (breakpoints fork it); null before generation starts. */
  readonly tracker: () => GenStructureTracker | null;
}

export function useGenStructure(
  player: StepPlayer<GenStep, MazeState> | null,
  grid: Grid | null,
  generatorId: string,
): GenStructureLive {
  const [state, setState] = useState<GenStructureState | null>(null);
  const trackerRef = useRef<GenStructureTracker | null>(null);
  const cells = grid ? cellCount(grid) : 0;
  useEffect(() => {
    if (!player || cells === 0) {
      trackerRef.current = null;
      setState(null);
      return;
    }
    const tracker = new GenStructureTracker(generatorId, cells);
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
  }, [player, cells, generatorId]);
  const getTracker = useCallback(() => trackerRef.current, []);
  return { state, tracker: getTracker };
}
