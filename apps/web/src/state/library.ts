/**
 * Local maze library (parity item P-19 "Save", redesigned): saved `MazeDocument`s for guests.
 * Signed-in sync arrives with the API in Phase 4.
 */
import type { MazeDocument } from '@maze/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface LibraryItem {
  id: string;
  name: string;
  /** ISO-8601. */
  createdAt: string;
  document: MazeDocument;
  /** Small PNG data URL (~160 px wide). */
  thumbnail?: string;
}

export interface LibraryState {
  items: LibraryItem[];
  add(input: { name: string; document: MazeDocument; thumbnail?: string }): LibraryItem;
  remove(id: string): void;
  rename(id: string, name: string): void;
  clear(): void;
}

export const LIBRARY_STORAGE_KEY = 'maze-lab:library';
export const LIBRARY_VERSION = 1;
export const LIBRARY_MAX_ITEMS = 200;

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLibraryStore(storage?: Storage) {
  return create<LibraryState>()(
    persist(
      (set, get) => ({
        items: [],
        add: ({ name, document, thumbnail }) => {
          const item: LibraryItem = {
            id: newId(),
            name: name.trim() || 'Untitled maze',
            createdAt: new Date().toISOString(),
            document,
            ...(thumbnail ? { thumbnail } : {}),
          };
          set({ items: [item, ...get().items].slice(0, LIBRARY_MAX_ITEMS) });
          return item;
        },
        remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
        rename: (id, name) =>
          set({
            items: get().items.map((i) => (i.id === id ? { ...i, name: name.trim() || i.name } : i)),
          }),
        clear: () => set({ items: [] }),
      }),
      {
        name: LIBRARY_STORAGE_KEY,
        version: LIBRARY_VERSION,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (s) => ({ items: s.items }),
      },
    ),
  );
}

export const useLibrary = createLibraryStore(typeof localStorage !== 'undefined' ? localStorage : undefined);

/**
 * Downscales a PNG data URL to `width` px using an offscreen canvas. Resolves `undefined`
 * where canvas is unavailable (tests, SSR) so callers can simply omit the thumbnail.
 */
export function makeThumbnail(dataUrl: string, width = 160): Promise<string | undefined> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = width / Math.max(1, img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}
