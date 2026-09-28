import { useSyncExternalStore } from 'react';
import type { StepPlayerSnapshot } from './StepPlayer';

/**
 * The minimal surface the hook needs. Accepting this instead of `StepPlayer<S, R>` lets callers
 * pass a union of players with different step/result types (e.g. "whichever player is active").
 * The result type is erased on purpose; read the typed result from the player itself.
 */
export interface PlayerLike {
  onChange(listener: () => void): () => void;
  getSnapshot(): StepPlayerSnapshot<unknown>;
}

/** Subscribes a component to a player's status/speed/step count/elapsed time. */
export function useStepPlayer(player: PlayerLike | null): StepPlayerSnapshot<unknown> | null {
  return useSyncExternalStore(
    (cb) => (player ? player.onChange(cb) : () => undefined),
    () => (player ? player.getSnapshot() : null),
    () => (player ? player.getSnapshot() : null),
  );
}
