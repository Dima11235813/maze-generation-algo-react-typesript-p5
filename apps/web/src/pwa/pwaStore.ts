/**
 * Tiny external store for service-worker state. It has no dependency on the `virtual:`
 * module so components (and their tests) can import it without the PWA plugin being active;
 * `register.ts` feeds it from the real registration.
 */

export interface PwaSnapshot {
  /** A new service worker is installed and waiting; reloading activates it. */
  readonly needRefresh: boolean;
  /** First install finished; the app now works offline. */
  readonly offlineReady: boolean;
  /** Registration failed (unsupported browser, insecure origin, ...). */
  readonly error: string | null;
}

type Listener = () => void;
type UpdateFn = (reloadPage?: boolean) => Promise<void>;

const INITIAL: PwaSnapshot = { needRefresh: false, offlineReady: false, error: null };

let snapshot: PwaSnapshot = INITIAL;
let updateFn: UpdateFn | null = null;
const listeners = new Set<Listener>();

function set(partial: Partial<PwaSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  for (const l of listeners) l();
}

export const pwaStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): PwaSnapshot {
    return snapshot;
  },
  /** Called by register.ts once `registerSW` has returned its update function. */
  attach(update: UpdateFn): void {
    updateFn = update;
  },
  setNeedRefresh(): void {
    set({ needRefresh: true });
  },
  setOfflineReady(): void {
    set({ offlineReady: true });
  },
  setError(message: string): void {
    set({ error: message });
  },
  /** Activate the waiting worker and reload. */
  async applyUpdate(): Promise<void> {
    set({ needRefresh: false });
    if (updateFn) await updateFn(true);
  },
  /** Hide the prompt until the next update arrives. */
  dismiss(): void {
    set({ needRefresh: false, offlineReady: false });
  },
  /** Test helper. */
  reset(): void {
    snapshot = INITIAL;
    updateFn = null;
    for (const l of listeners) l();
  },
};
