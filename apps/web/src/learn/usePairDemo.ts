/**
 * Owns a lesson's pair demo (two solvers in lockstep): the model, its player and breakpoints.
 * A tunable lane (M7) changes its solver parameters through `setLaneParam`; each change builds a
 * new model, so both searches restart on the same maze with the new settings.
 */
import { useStepPlayer } from '@maze/player/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PairDemoSpec } from '../content/learn/types';
import { PairDemoModel, pairBreakpointCatalogue, type LaneParams } from './pairDemo';
import { useBreakpointRun } from './useBreakpointRun';

/** A gentle default for reading along, as in the other lesson demos. */
const PAIR_DEFAULT_SPEED = 5;

export function usePairDemo(spec: PairDemoSpec) {
  const [params, setParams] = useState<readonly LaneParams[]>(() =>
    spec.solverIds.map((_, i) => spec.solverParams?.[i] ?? {}),
  );
  const [speed, setSpeedState] = useState(PAIR_DEFAULT_SPEED);
  const ref = useRef<{ params: readonly LaneParams[]; model: PairDemoModel } | null>(null);
  // The lesson view is keyed by lesson, so only the tuned parameters change under one hook.
  if (ref.current?.params !== params) {
    ref.current = {
      params,
      model: new PairDemoModel({ ...spec, solverParams: params }, { stepsPerSecond: speed }),
    };
  }
  const model = ref.current.model;
  // Pausing (not disposing) on unmount keeps the model usable when StrictMode remounts.
  useEffect(
    () => () => {
      model.player.pause();
    },
    [model],
  );
  const playerSnap = useStepPlayer(model.player);
  const setSpeed = useCallback(
    (s: number) => {
      setSpeedState(s);
      model.player.setSpeed(s);
    },
    [model],
  );
  const setLaneParam = useCallback((lane: number, key: string, value: unknown) => {
    setParams((prev) => prev.map((p, i) => (i === lane ? { ...p, [key]: value } : p)));
  }, []);
  const catalogue = useMemo(() => pairBreakpointCatalogue(model), [model]);
  const breakpoint = useBreakpointRun({
    player: model.player,
    catalogue,
    running: playerSnap?.breakpointArmed ?? false,
    done: playerSnap?.status === 'done',
  });
  // Re-read on every player snapshot; the model keeps one array per step count.
  const lanes = model.lanes();
  return { model, playerSnap, speed, setSpeed, breakpoint, lanes, params, setLaneParam };
}
