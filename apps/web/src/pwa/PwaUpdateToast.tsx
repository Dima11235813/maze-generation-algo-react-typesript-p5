import { Button } from '@maze/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { pwaStore } from './pwaStore';

const OFFLINE_READY_MS = 6000;

/**
 * Bottom-right status toast: "Update available" (Reload / Later) when a new service worker is
 * waiting, and a short "Ready to work offline" note after the first install.
 */
export function PwaUpdateToast() {
  const snap = useSyncExternalStore(pwaStore.subscribe, pwaStore.getSnapshot, pwaStore.getSnapshot);

  // The offline-ready note is informational; hide it by itself after a few seconds.
  useEffect(() => {
    if (!snap.offlineReady || snap.needRefresh) return;
    const id = setTimeout(() => {
      pwaStore.dismiss();
    }, OFFLINE_READY_MS);
    return () => {
      clearTimeout(id);
    };
  }, [snap.offlineReady, snap.needRefresh]);

  if (!snap.needRefresh && !snap.offlineReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed right-3 bottom-3 z-50 flex max-w-sm items-center gap-3 rounded-md border border-border bg-panel px-3 py-2 text-sm shadow-lg"
    >
      {snap.needRefresh ? (
        <>
          <span className="flex-1">A new version of Maze Lab is available.</span>
          <Button size="sm" onClick={() => void pwaStore.applyUpdate()}>
            Reload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              pwaStore.dismiss();
            }}
          >
            Later
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1">Maze Lab is ready to work offline.</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              pwaStore.dismiss();
            }}
          >
            Dismiss
          </Button>
        </>
      )}
    </div>
  );
}
