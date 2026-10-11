/**
 * Drives a lesson's demo (proj-mgmt/20-learn-mode.md section 4): owns a `MazeSession`, builds the
 * demo maze synchronously from its fixed spec, arms the solver paused, and folds the solver's
 * steps into the pseudo-code line and the data-structure model. A rewind resets both, because
 * the player replays from the start, so step back and seek stay exact.
 */
import type { SolveStep } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pseudocodeFor } from '../content/pseudocode';
import type { DemoSpec } from '../content/learn/types';
import { drainGeneration } from '../maze/drain';
import { MazeSession } from '../maze/session';
import { QueueModel, type QueueSnapshot } from './queueModel';

/** A gentle default for reading along; the learner can change it. */
export const LESSON_DEFAULT_SPEED = 5;
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
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);

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

  // Fold steps into the pseudo-code line and the queue; a rewind starts both over.
  useEffect(() => {
    const player = snap.solvePlayer;
    const maze = snap.state;
    if (!player || !maze) return;
    const listing = pseudocodeFor(solverId);
    const model = new QueueModel(maze.start);
    setQueue(model.snapshot());
    setCurrentLine(null);
    const offReset = player.onReset(() => {
      model.reset();
      setQueue(model.snapshot());
      setCurrentLine(null);
    });
    const offSteps = player.subscribe((batch: readonly SolveStep[]) => {
      model.applyBatch(batch);
      setQueue(model.snapshot());
      const last = batch[batch.length - 1];
      if (last) setCurrentLine(listing.stepToLine(last));
    });
    return () => {
      offReset();
      offSteps();
    };
  }, [snap.solvePlayer, snap.state, solverId]);

  const setSpeed = useCallback(
    (s: number) => {
      setSpeedState(s);
      session.setSpeed(s);
    },
    [session],
  );

  const armed = snap.phase === 'ready' && snap.solvePlayer !== null;
  return {
    session,
    snap,
    playerSnap,
    armed,
    queue,
    currentLine,
    listing: pseudocodeFor(solverId),
    speed,
    setSpeed,
  };
}
