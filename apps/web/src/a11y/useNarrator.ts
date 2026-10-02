/**
 * Binds a `@maze/player` Narrator to the current session: subscribes to the generation and
 * solve players, forwards session status messages, routes sentences to the live region (or to
 * the visible step log when it is open, so nothing is spoken twice) and exposes the log.
 */
import { createGrid, describeGenStep, describeSolveStep } from '@maze/core';
import { createNarrator, type Narrator, type NarratorLogEntry, type NarratorVerbosity } from '@maze/player';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Politeness } from '../app/Announcer';
import type { MazeSession, SessionSnapshot } from '../maze/session';

export interface UseNarratorOptions {
  session: MazeSession;
  snap: SessionSnapshot;
  verbosity: NarratorVerbosity;
  /** When true the step log region announces entries itself; the announcer stays quiet. */
  logIsLive: boolean;
  announce: (text: string, politeness?: Politeness) => void;
}

export interface NarratorBinding {
  narrator: Narrator;
  log: readonly NarratorLogEntry[];
}

const EMPTY_LOG: readonly NarratorLogEntry[] = [];

export function useNarrator({ session, snap, verbosity, logIsLive, announce }: UseNarratorOptions): NarratorBinding {
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const logIsLiveRef = useRef(logIsLive);
  logIsLiveRef.current = logIsLive;
  const verbosityRef = useRef(verbosity);
  verbosityRef.current = verbosity;

  // One narrator per maze: a new generation (or loaded document) resets the counters and log.
  const mazeKey = `${snap.width}x${snap.height}:${snap.seed}:${snap.sourceName ?? ''}`;
  const narrator = useMemo(() => {
    const grid = createGrid(Math.max(1, snap.width || 1), Math.max(1, snap.height || 1));
    return createNarrator({
      grid,
      describeGen: describeGenStep,
      describeSolve: describeSolveStep,
      announceMilestones: false,
      verbosity: verbosityRef.current,
      speak: (text, politeness) => {
        if (!logIsLiveRef.current) announceRef.current(text, politeness);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mazeKey]);

  useEffect(() => () => narrator.dispose(), [narrator]);

  useEffect(() => narrator.setVerbosity(verbosity), [narrator, verbosity]);

  // Generation steps + flush on pause/done.
  useEffect(() => {
    const player = snap.genPlayer;
    if (!player) return;
    const offSteps = player.subscribe((batch) => narrator.handleGenSteps(batch));
    const offChange = player.onChange(() => {
      const status = player.getStatus();
      if (status === 'paused' || status === 'done') narrator.flush();
    });
    return () => {
      offSteps();
      offChange();
    };
  }, [narrator, snap.genPlayer]);

  // Solve steps (counters reset per solver run).
  useEffect(() => {
    const player = snap.solvePlayer;
    if (!player) return;
    narrator.beginSolve();
    const offSteps = player.subscribe((batch) => narrator.handleSolveSteps(batch));
    const offChange = player.onChange(() => {
      const status = player.getStatus();
      if (status === 'paused' || status === 'done') narrator.flush();
    });
    return () => {
      offSteps();
      offChange();
    };
  }, [narrator, snap.solvePlayer]);

  // Session status messages are the app's milestones: spoken immediately and logged. When the
  // narrator is off they still reach the announcer directly (status must never go silent).
  useEffect(() => {
    if (snap.statusSeq === 0 || !snap.status) return;
    const assertive = /goal/i.test(snap.status);
    const politeness: Politeness = assertive ? 'assertive' : 'polite';
    if (verbosityRef.current === 'off') announceRef.current(snap.status, politeness);
    else narrator.say(snap.status, politeness, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.statusSeq]);

  const log = useSyncExternalStore(
    (cb) => narrator.onLog(cb),
    () => narrator.getLog(),
    () => EMPTY_LOG,
  );

  return { narrator, log };
}
