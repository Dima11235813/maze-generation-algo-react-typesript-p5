/**
 * Local (guest) Learn progress (proj-mgmt/20-learn-mode.md): when each lesson was first opened
 * and when it was completed. Completion is a button until quizzes land (WI-06c).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const LEARN_STORAGE_KEY = 'maze-lab:learn';

export interface LessonProgress {
  readonly startedAt: string;
  readonly completedAt?: string;
}

export interface LearnProgressState {
  lessons: Readonly<Record<string, LessonProgress>>;
  /** Records the first visit (later visits keep the original time). */
  start: (lessonId: string) => void;
  complete: (lessonId: string) => void;
  /** Marks a completed lesson as not done again. */
  reopen: (lessonId: string) => void;
  clear: () => void;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keeps well-formed entries from untrusted storage. */
function sanitize(raw: unknown): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isRecord(v) || typeof v.startedAt !== 'string') continue;
    out[id] =
      typeof v.completedAt === 'string'
        ? { startedAt: v.startedAt, completedAt: v.completedAt }
        : { startedAt: v.startedAt };
  }
  return out;
}

export function createLearnProgressStore(storage?: Storage) {
  return create<LearnProgressState>()(
    persist(
      (set, get) => ({
        lessons: {},
        start: (id) => {
          if (get().lessons[id]) return;
          set({ lessons: { ...get().lessons, [id]: { startedAt: new Date().toISOString() } } });
        },
        complete: (id) => {
          const prev = get().lessons[id];
          const now = new Date().toISOString();
          set({
            lessons: {
              ...get().lessons,
              [id]: { startedAt: prev?.startedAt ?? now, completedAt: now },
            },
          });
        },
        reopen: (id) => {
          const prev = get().lessons[id];
          if (!prev) return;
          set({ lessons: { ...get().lessons, [id]: { startedAt: prev.startedAt } } });
        },
        clear: () => {
          set({ lessons: {} });
        },
      }),
      {
        name: LEARN_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (s) => ({ lessons: s.lessons }),
        merge: (persisted, current) => ({
          ...current,
          lessons: sanitize(isRecord(persisted) ? persisted.lessons : undefined),
        }),
      },
    ),
  );
}

export const useLearnProgress = createLearnProgressStore(
  typeof localStorage !== 'undefined' ? localStorage : undefined,
);

export type LessonStatus = 'new' | 'started' | 'done';

export function lessonStatus(p: LessonProgress | undefined): LessonStatus {
  if (!p) return 'new';
  return p.completedAt ? 'done' : 'started';
}
