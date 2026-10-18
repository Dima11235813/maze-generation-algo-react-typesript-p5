/**
 * Drives a lesson's demo (proj-mgmt/20-learn-mode.md section 4): owns a `MazeSession`, builds the
 * demo maze synchronously from its fixed spec, arms the solver paused, and folds the solver's
 * steps into the pseudo-code line and its data structure (`useSolveStructure`). A rewind resets both, because
 * the player replays from the start, so step back and seek stay exact.
 */
import type { SolveStep } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pseudocodeFor } from '../content/pseudocode';
import type { DemoSpec } from '../content/learn/types';
import { drainGeneration } from '../maze/drain';
import { MazeSession } from '../maze/session';
import { useBreakpointRun } from './useBreakpointRun';
import { useSolveStructure } from './useSolveStructure';

/** A gentle default for reading along; the learner can change it. */
const LESSON_DEFAULT_SPEED = 5;
/** Any value works: the renderers fit the maze to the canvas. */
const DEMO_CELL_SIZE = 24;

export function useLessonDemo(demo: DemoSpec) {
  const sessionRef = useRef<MazeSession | null>(null);
  sessionRef.current ??= new MazeSession({ speed: LESSON_DEFAULT_SPEED });
  const session = sessionRef.current;
  useEffect(() => {
    return () => {
      session.dispose();
    };
  }, [session]);

  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const playerSnap = useStepPlayer(snap.solvePlayer);
  const [speed, setSpeedState] = useState(LESSON_DEFAULT_SPEED);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  /** The latest step taken (try-it checks read it); null at step 0. */
  const [lastStep, setLastStep] = useState<SolveStep | null>(null);

  const { generatorId, seed, width, height, solverId } = demo;

  // Build the demo maze once per spec (seeded, so always the same maze).
  useEffect(() => {
    session.generate({
      width,
      height,
      cellSize: DEMO_CELL_SIZE,
      seed,
      generatorId,
      autoplay: false,
    });
    drainGeneration(session);
  }, [session, generatorId, seed, width, height]);

  // Arm the solver (paused) whenever the maze is ready and nothing is armed.
  useEffect(() => {
    if (snap.phase === 'ready' && !snap.solvePlayer) session.startSolve(solverId, false);
  }, [session, snap.phase, snap.solvePlayer, solverId]);

  // Follow the executing pseudo-code line; a rewind clears it (the player replays from 0).
  useEffect(() => {
    const player = snap.solvePlayer;
    if (!player) return;
    const listing = pseudocodeFor(solverId);
    setCurrentLine(null);
    setLastStep(null);
    const offReset = player.onReset(() => {
      setCurrentLine(null);
      setLastStep(null);
    });
    const offSteps = player.subscribe((batch: readonly SolveStep[]) => {
      const last = batch[batch.length - 1];
      if (last) {
        setCurrentLine(listing.stepToLine(last));
        setLastStep(last);
      }
    });
    return () => {
      offReset();
      offSteps();
    };
  }, [snap.solvePlayer, solverId]);

  const structure = useSolveStructure(snap.solvePlayer, snap.state, solverId);
  const armed = snap.phase === 'ready' && snap.solvePlayer !== null;
  const breakpoint = useBreakpointRun({
    player: armed ? snap.solvePlayer : null,
    maze: snap.state,
    solverId,
    tracker: structure.tracker,
    running: playerSnap?.breakpointArmed ?? false,
    done: playerSnap?.status === 'done',
  });

  const setSpeed = useCallback(
    (s: number) => {
      setSpeedState(s);
      session.setSpeed(s);
    },
    [session],
  );

  return {
    session,
    snap,
    playerSnap,
    armed,
    structure: structure.state,
    breakpoint,
    lastStep,
    currentLine,
    listing: pseudocodeFor(solverId),
    speed,
    setSpeed,
  };
}
