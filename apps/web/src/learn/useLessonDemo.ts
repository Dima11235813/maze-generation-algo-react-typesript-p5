/**
 * Drives a lesson's demo (proj-mgmt/20-learn-mode.md section 4): owns a `MazeSession` and builds
 * the demo maze from its fixed spec. A solve demo finishes the maze at once and arms the solver
 * paused; a generate demo arms the generator paused, so the maze is carved step by step. Either
 * way the player's steps fold into the pseudo-code line and the data structure, and a rewind
 * resets both (the player replays from the start), so step back and seek stay exact.
 */
import type { Step } from '@maze/core';
import type { StepPlayer } from '@maze/player';
import { useStepPlayer } from '@maze/player/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { genPseudocodeFor } from '../content/genPseudocode';
import type { DemoSpec } from '../content/learn/types';
import { pseudocodeFor, type PseudocodeListing } from '../content/pseudocode';
import { drainGeneration } from '../maze/drain';
import { MazeSession } from '../maze/session';
import { solveBreakpointCatalogue } from './breakpoints';
import { genBreakpointCatalogue } from './genBreakpoints';
import { useBreakpointRun } from './useBreakpointRun';
import { useGenStructure } from './useGenStructure';
import { useSolveStructure } from './useSolveStructure';

/** A gentle default for reading along; the learner can change it. */
const LESSON_DEFAULT_SPEED = 5;
/** Any value works: the renderers fit the maze to the canvas. */
const DEMO_CELL_SIZE = 24;

/** Follows the executing pseudo-code line and the latest step; a rewind clears both. */
function useFollowSteps<S extends Step, R>(
  player: StepPlayer<S, R> | null,
  listing: PseudocodeListing<S>,
) {
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  /** The latest step taken (try-it checks read it); null at step 0. */
  const [lastStep, setLastStep] = useState<S | null>(null);
  useEffect(() => {
    setCurrentLine(null);
    setLastStep(null);
    if (!player) return;
    const offReset = player.onReset(() => {
      setCurrentLine(null);
      setLastStep(null);
    });
    const offSteps = player.subscribe((batch: readonly S[]) => {
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
  }, [player, listing]);
  return { currentLine, lastStep };
}

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
  const [speed, setSpeedState] = useState(LESSON_DEFAULT_SPEED);

  const { kind, generatorId, seed, width, height } = demo;
  const solverId = demo.kind === 'solve' ? demo.solverId : null;
  const generating = kind === 'generate';

  // Build the demo maze once per spec (seeded, so always the same maze). A solve demo needs it
  // finished; a generate demo plays it.
  useEffect(() => {
    session.generate({
      width,
      height,
      cellSize: DEMO_CELL_SIZE,
      seed,
      generatorId,
      autoplay: false,
    });
    if (kind === 'solve') drainGeneration(session);
  }, [session, kind, generatorId, seed, width, height]);

  // Arm the solver (paused) whenever the maze is ready and nothing is armed.
  useEffect(() => {
    if (solverId && snap.phase === 'ready' && !snap.solvePlayer) {
      session.startSolve(solverId, false);
    }
  }, [session, snap.phase, snap.solvePlayer, solverId]);

  const genPlayer = generating ? snap.genPlayer : null;
  const solvePlayer = solverId ? snap.solvePlayer : null;
  const player = genPlayer ?? solvePlayer;
  const playerSnap = useStepPlayer(player);

  const genListing = useMemo(() => genPseudocodeFor(generatorId), [generatorId]);
  const solveListing = useMemo(() => pseudocodeFor(solverId), [solverId]);
  const genFollow = useFollowSteps(genPlayer, genListing);
  const solveFollow = useFollowSteps(solvePlayer, solveListing);
  const follow = generating ? genFollow : solveFollow;

  const structure = useSolveStructure(solvePlayer, snap.state, solverId);
  const genStructure = useGenStructure(genPlayer, snap.state?.grid ?? null, generatorId);
  const armed = generating ? genPlayer !== null : snap.phase === 'ready' && solvePlayer !== null;

  // A generating maze is a new object once finished, but keeps its grid: the catalogue needs that.
  const grid = generating && armed ? (snap.state?.grid ?? null) : null;
  const solveMaze = solverId && armed ? snap.state : null;
  const genCatalogue = useMemo(
    () => (grid ? genBreakpointCatalogue(generatorId, grid, genStructure.tracker) : null),
    [grid, generatorId, genStructure.tracker],
  );
  const solveCatalogue = useMemo(
    () =>
      solverId && solveMaze
        ? solveBreakpointCatalogue(solverId, solveMaze, structure.tracker)
        : null,
    [solverId, solveMaze, structure.tracker],
  );
  const running = playerSnap?.breakpointArmed ?? false;
  const done = playerSnap?.status === 'done';
  const genRun = useBreakpointRun({
    player: armed ? genPlayer : null,
    catalogue: genCatalogue,
    running,
    done,
  });
  const solveRun = useBreakpointRun({
    player: armed ? solvePlayer : null,
    catalogue: solveCatalogue,
    running,
    done,
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
    generating,
    structure: structure.state,
    genStructure: genStructure.state,
    breakpoint: generating ? genRun : solveRun,
    lastStep: follow.lastStep,
    currentLine: follow.currentLine,
    listing: generating ? genListing : solveListing,
    speed,
    setSpeed,
  };
}
