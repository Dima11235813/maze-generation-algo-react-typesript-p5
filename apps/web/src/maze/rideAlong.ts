/**
 * Ride along (WI-10): a first-person camera that follows the solver. While the solver runs the
 * pose comes from the session's `RideAlongTracker` (rebuilt exactly on rewind); once it has
 * finished, the camera walks the found path from start to goal.
 */
import { pathPoses, type CellId, type Grid, type RidePose } from '@maze/core';
import type { PlayerStatus } from '@maze/player';
import type { FirstPersonState } from '@maze/renderer';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MazeSession } from './session';

type RidePhase = 'off' | 'start' | 'walking' | 'searching' | 'replaying' | 'arrived' | 'no-path';

export interface RideAlongOptions {
  readonly session: MazeSession;
  readonly enabled: boolean;
  readonly status: PlayerStatus | null;
  /** Re-read the session's pose whenever the player advanced. */
  readonly stepCount: number;
  readonly grid: Grid | null;
  /** The solver's path once it has finished (null while running or when it failed). */
  readonly path: readonly CellId[] | null;
  readonly solverName: string;
  readonly reducedMotion: boolean;
  readonly announce: (text: string) => void;
}

export interface RideAlongView {
  readonly firstPerson: FirstPersonState | null;
  readonly phase: RidePhase;
  readonly statusText: string;
}

/** Cells per second for the final walk along the solution. */
const REPLAY_RATE = 6;

function toFirstPerson(p: RidePose): FirstPersonState {
  // Gliding over the walls uses the raised "peek" camera so it never passes through a wall.
  return { cell: p.cell, heading: p.heading, peek: p.glide };
}

export function useRideAlong(o: RideAlongOptions): RideAlongView {
  const finished = o.enabled && o.status === 'done';
  const poses = useMemo(
    () => (finished && o.grid && o.path ? pathPoses(o.grid, o.path) : null),
    [finished, o.grid, o.path],
  );
  const [replayIndex, setReplayIndex] = useState(0);

  // Walk the solution once the solver is done; restart whenever that changes.
  useEffect(() => {
    if (!poses || poses.length === 0) {
      setReplayIndex(0);
      return;
    }
    if (o.reducedMotion) {
      setReplayIndex(poses.length - 1);
      return;
    }
    setReplayIndex(0);
    const id = setInterval(() => {
      setReplayIndex((i) => {
        if (i >= poses.length - 1) {
          clearInterval(id);
          return i;
        }
        return i + 1;
      });
    }, 1000 / REPLAY_RATE);
    return () => {
      clearInterval(id);
    };
  }, [poses, o.reducedMotion]);

  let phase: RidePhase = 'off';
  let pose: RidePose | null = null;
  let statusText = '';
  if (o.enabled) {
    if (finished && !o.path) {
      pose = o.session.ridePose;
      phase = 'no-path';
      statusText = `${o.solverName} found no path.`;
    } else if (poses && poses.length > 0) {
      const i = Math.min(replayIndex, poses.length - 1);
      pose = poses[i] ?? null;
      const arrived = i === poses.length - 1;
      phase = arrived ? 'arrived' : 'replaying';
      statusText = arrived
        ? `At the goal: the solution is ${String(poses.length - 1)} moves.`
        : `Walking the solution: cell ${String(i + 1)} of ${String(poses.length)}.`;
    } else {
      pose = o.session.ridePose;
      const mode = pose?.mode ?? 'start';
      phase = mode;
      statusText =
        mode === 'start'
          ? `Riding along with ${o.solverName}: at the start.`
          : mode === 'walking'
            ? `${o.solverName} is walking (step ${String(o.stepCount)}).`
            : `${o.solverName} is searching${pose?.glide ? ', gliding over the walls to the next cell' : ''} (step ${String(o.stepCount)}).`;
    }
  }

  // Announce phase changes only (never every step).
  const lastPhase = useRef<RidePhase>('off');
  const { announce, solverName } = o;
  useEffect(() => {
    if (phase === lastPhase.current) return;
    lastPhase.current = phase;
    const said: Partial<Record<RidePhase, string>> = {
      start: `Riding along with ${solverName}. Press play to start.`,
      walking: `${solverName} walks the maze.`,
      searching: `${solverName} searches the maze; the camera glides over the walls between cells.`,
      replaying: 'Solver finished. Walking the solution from start to goal.',
      arrived: 'Reached the goal.',
      'no-path': `${solverName} found no path.`,
    };
    const text = said[phase];
    if (text) announce(text);
  }, [phase, announce, solverName]);

  return { firstPerson: pose ? toFirstPerson(pose) : null, phase, statusText };
}
