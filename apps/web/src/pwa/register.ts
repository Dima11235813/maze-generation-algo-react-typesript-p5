/**
 * Service-worker registration (vite-plugin-pwa, `registerType: 'prompt'`).
 *
 * Only `main.tsx` imports this module: it pulls in the `virtual:pwa-register` module that
 * exists only when the PWA plugin runs (production build). Everything the UI needs lives in
 * `pwaStore.ts`, which has no such dependency.
 */
import { registerSW } from 'virtual:pwa-register';
import { pwaStore } from './pwaStore';

export function registerPwa(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // The dev server does not emit a worker (devOptions.enabled = false); skip the round trip.
  if (import.meta.env.DEV) return;

  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      pwaStore.setNeedRefresh();
    },
    onOfflineReady() {
      pwaStore.setOfflineReady();
    },
    onRegisterError(error: unknown) {
      pwaStore.setError(error instanceof Error ? error.message : String(error));
    },
  });
  pwaStore.attach(update);
}
