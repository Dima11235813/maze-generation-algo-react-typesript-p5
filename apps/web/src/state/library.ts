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
  /** The player's saved runs through this maze (Run Maze as a game), newest first. */
  runs?: SavedRun[];
}

/** A finished run, stored as its moves so it can be replayed exactly. */
export interface SavedRun {
  id: string;
  /** ISO-8601. */
  at: string;
  /** Encoded moves (`encodeRun`), e.g. "FFRFL" or "EESSW". */
  moves: string;
  view: '3d' | '2d';
  timeMs: number;
  moveCount: number;
  optimalMoves: number | null;
  hints: number;
  undos: number;
}

/** Best run: fewest moves, then fastest. */
export function bestRun(runs: readonly SavedRun[] | undefined): SavedRun | null {
  if (!runs || runs.length === 0) return null;
  return [...runs].sort((a, b) => a.moveCount - b.moveCount || a.timeMs - b.timeMs)[0] ?? null;
}

export interface LibraryState {
  items: LibraryItem[];
  add(input: { name: string; document: MazeDocument; thumbnail?: string }): LibraryItem;
  /** Saves a run with its maze: added to the item holding the same maze, or a new item. */
  addRun(input: {
    name: string;
    document: MazeDocument;
    thumbnail?: string;
    run: Omit<SavedRun, 'id' | 'at'>;
  }): LibraryItem;
  /**
   * Replaces an item's maze (Build editor "Save"). Saved runs belonged to the old maze, so they
   * are dropped. Returns the updated item, or null when the id is unknown.
   */
  replace(
    id: string,
    input: { name: string; document: MazeDocument; thumbnail?: string },
  ): LibraryItem | null;
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
        addRun: ({ name, document, thumbnail, run }) => {
          const saved: SavedRun = { ...run, id: newId(), at: new Date().toISOString() };
          const existing = get().items.find((i) => i.document.id === document.id);
          if (existing) {
            const updated: LibraryItem = {
              ...existing,
              runs: [saved, ...(existing.runs ?? [])].slice(0, 50),
            };
            set({ items: get().items.map((i) => (i.id === existing.id ? updated : i)) });
            return updated;
          }
          const item: LibraryItem = {
            id: newId(),
            name: name.trim() || 'Untitled maze',
            createdAt: new Date().toISOString(),
            document,
            ...(thumbnail ? { thumbnail } : {}),
            runs: [saved],
          };
          set({ items: [item, ...get().items].slice(0, LIBRARY_MAX_ITEMS) });
          return item;
        },
        replace: (id, { name, document, thumbnail }) => {
          const existing = get().items.find((i) => i.id === id);
          if (!existing) return null;
          const updated: LibraryItem = {
            id,
            name: name.trim() || existing.name,
            createdAt: existing.createdAt,
            document,
            ...(thumbnail ? { thumbnail } : {}),
          };
          set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
          return updated;
        },
        remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
        rename: (id, name) =>
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, name: name.trim() || i.name } : i,
            ),
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

export const useLibrary = createLibraryStore(
  typeof localStorage !== 'undefined' ? localStorage : undefined,
);

/**
 * Downscales a PNG data URL to `width` px using an offscreen canvas. Resolves `undefined`
 * where canvas is unavailable (tests, SSR) so callers can simply omit the thumbnail.
 */
const THUMBNAIL_TIMEOUT_MS = 1500;

export function makeThumbnail(dataUrl: string, width = 160): Promise<string | undefined> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    // Never let a stalled image hold up a save: give up on the thumbnail after a moment.
    const timer = setTimeout(() => {
      resolve(undefined);
    }, THUMBNAIL_TIMEOUT_MS);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = width / Math.max(1, img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(undefined);
    };
    img.src = dataUrl;
  });
}
