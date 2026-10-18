/** Owns a lesson's pair demo (two solvers in lockstep): the model, its player and breakpoints. */
import { useStepPlayer } from '@maze/player/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PairDemoSpec } from '../content/learn/types';
import { PairDemoModel, pairBreakpointCatalogue } from './pairDemo';
import { useBreakpointRun } from './useBreakpointRun';

/** A gentle default for reading along, as in the other lesson demos. */
const PAIR_DEFAULT_SPEED = 5;

export function usePairDemo(spec: PairDemoSpec) {
  const ref = useRef<PairDemoModel | null>(null);
  // The lesson view is keyed by lesson, so the spec never changes under one model.
  ref.current ??= new PairDemoModel(spec, { stepsPerSecond: PAIR_DEFAULT_SPEED });
  const model = ref.current;
  // Pausing (not disposing) on unmount keeps the model usable when StrictMode remounts.
  useEffect(
    () => () => {
      model.player.pause();
    },
    [model],
  );
  const playerSnap = useStepPlayer(model.player);
  const [speed, setSpeedState] = useState(PAIR_DEFAULT_SPEED);
  const setSpeed = useCallback(
    (s: number) => {
      setSpeedState(s);
      model.player.setSpeed(s);
    },
    [model],
  );
  const catalogue = useMemo(() => pairBreakpointCatalogue(model), [model]);
  const breakpoint = useBreakpointRun({
    player: model.player,
    catalogue,
    running: playerSnap?.breakpointArmed ?? false,
    done: playerSnap?.status === 'done',
  });
  // Re-read on every player snapshot; the model keeps one array per step count.
  const lanes = model.lanes();
  return { model, playerSnap, speed, setSpeed, breakpoint, lanes };
}
