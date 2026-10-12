import type { MazeSession } from './session';

/** Runs generation to completion synchronously (bounded; each call advances up to 50k steps). */
export function drainGeneration(session: MazeSession): void {
  let guard = 0;
  while (session.getSnapshot().phase === 'generating' && guard++ < 1_000) session.runToEnd();
}
