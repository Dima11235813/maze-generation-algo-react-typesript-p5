/**
 * Local (guest) Learn progress (proj-mgmt/20-learn-mode.md): when each lesson was first opened
 * and completed, its quiz record, and which try-it checks are done. A passed quiz completes a
 * lesson (WI-06c); lessons without a quiz are completed with a button.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const LEARN_STORAGE_KEY = 'maze-lab:learn';

interface QuizRecord {
  /** Most correct answers in one attempt. */
  readonly best: number;
  readonly total: number;
  readonly attempts: number;
}

export interface LessonProgress {
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly quiz?: QuizRecord;
  /** Ids of the try-it checks done. */
  readonly tryIts?: readonly string[];
}

export interface LearnProgressState {
  lessons: Readonly<Record<string, LessonProgress>>;
  /** Records the first visit (later visits keep the original time). */
  start: (lessonId: string) => void;
  complete: (lessonId: string) => void;
  /** Marks a completed lesson as not done again (quiz and try-it records stay). */
  reopen: (lessonId: string) => void;
  /** Records a checked quiz attempt; a pass completes the lesson. */
  recordQuiz: (lessonId: string, correct: number, total: number, passed: boolean) => void;
  completeTryIt: (lessonId: string, checkId: string) => void;
  clear: () => void;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function sanitizeQuiz(v: unknown): QuizRecord | undefined {
  if (!isRecord(v) || !isCount(v.best) || !isCount(v.total) || !isCount(v.attempts)) return;
  return { best: Math.min(v.best, v.total), total: v.total, attempts: v.attempts };
}

/** Keeps well-formed entries from untrusted storage. */
function sanitize(raw: unknown): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isRecord(v) || typeof v.startedAt !== 'string') continue;
    const quiz = sanitizeQuiz(v.quiz);
    const tryIts = Array.isArray(v.tryIts)
      ? v.tryIts.filter((x): x is string => typeof x === 'string')
      : [];
    out[id] = {
      startedAt: v.startedAt,
      ...(typeof v.completedAt === 'string' ? { completedAt: v.completedAt } : {}),
      ...(quiz ? { quiz } : {}),
      ...(tryIts.length > 0 ? { tryIts } : {}),
    };
  }
  return out;
}

export function createLearnProgressStore(storage?: Storage) {
  return create<LearnProgressState>()(
    persist(
      (set, get) => {
        /** The lesson's entry (started now if it never was), changed by `patch`. */
        const update = (id: string, patch: (p: LessonProgress) => LessonProgress) => {
          const prev = get().lessons[id] ?? { startedAt: new Date().toISOString() };
          set({ lessons: { ...get().lessons, [id]: patch(prev) } });
        };
        return {
          lessons: {},
          start: (id) => {
            if (get().lessons[id]) return;
            update(id, (p) => p);
          },
          complete: (id) => {
            update(id, (p) => ({ ...p, completedAt: new Date().toISOString() }));
          },
          reopen: (id) => {
            if (!get().lessons[id]) return;
            update(id, ({ completedAt: _done, ...rest }) => rest);
          },
          recordQuiz: (id, correct, total, passed) => {
            update(id, (p) => ({
              ...p,
              ...(passed && !p.completedAt ? { completedAt: new Date().toISOString() } : {}),
              quiz: {
                best: Math.max(p.quiz?.best ?? 0, correct),
                total,
                attempts: (p.quiz?.attempts ?? 0) + 1,
              },
            }));
          },
          completeTryIt: (id, checkId) => {
            if (get().lessons[id]?.tryIts?.includes(checkId)) return;
            update(id, (p) => ({ ...p, tryIts: [...(p.tryIts ?? []), checkId] }));
          },
          clear: () => {
            set({ lessons: {} });
          },
        };
      },
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
