/**
 * The Learn index: every module of the curriculum with its lessons and the learner's local
 * progress. Everything here derives from the curriculum data (20-learn-mode.md); modules
 * without lessons show as planned.
 */
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { CURRICULUM, moduleTitle } from '../../content/learn/curriculum';
import type { Curriculum } from '../../content/learn/types';
import { lessonStatus, useLearnProgress, type LessonStatus } from '../../state/learnProgress';

const STATUS_TEXT: Record<LessonStatus, string> = {
  new: 'not started',
  started: 'started',
  done: 'done',
};

function StatusIcon({ status }: { status: LessonStatus }) {
  const cls = 'h-4 w-4 shrink-0';
  if (status === 'done')
    return <CheckCircle2 className={`${cls} text-accent`} aria-hidden="true" />;
  if (status === 'started')
    return <CircleDot className={`${cls} text-accent`} aria-hidden="true" />;
  return <Circle className={`${cls} text-muted`} aria-hidden="true" />;
}

export interface LearnIndexProps {
  /** Injected in tests; the app uses the real curriculum. */
  curriculum?: Curriculum;
}

export function LearnIndex({ curriculum = CURRICULUM }: LearnIndexProps) {
  const progress = useLearnProgress((s) => s.lessons);
  const lessons = curriculum.flatMap((m) => m.lessons);
  const done = lessons.filter((l) => lessonStatus(progress[l.id]) === 'done').length;
  const firstOpen = lessons.find((l) => lessonStatus(progress[l.id]) !== 'done') ?? lessons[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Learn</h1>
          <p className="max-w-2xl text-muted">
            Twelve modules from grids and graphs to heuristics and complexity. Every lesson is built
            around a live demo you can step through, with the pseudo-code and the data structures
            beside it.
          </p>
          <p className="text-sm" aria-live="polite">
            {lessons.length === 0
              ? 'Lessons are on the way.'
              : `${String(done)} of ${String(lessons.length)} lessons done.`}
            {firstOpen ? (
              <>
                {' '}
                <Link
                  to="/learn/$lessonId"
                  params={{ lessonId: firstOpen.id }}
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  {done === 0 ? 'Start' : 'Continue'} with &ldquo;{firstOpen.title}&rdquo;
                </Link>
              </>
            ) : null}
          </p>
        </header>

        <ol className="flex flex-col gap-3" aria-label="Modules">
          {curriculum.map((m) => (
            <li key={m.id}>
              <section
                aria-labelledby={`module-${m.id}`}
                className={
                  m.lessons.length > 0
                    ? 'rounded-lg border border-border bg-panel p-4'
                    : 'rounded-lg border border-dashed border-border p-4'
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id={`module-${m.id}`} className="text-base font-semibold">
                    {moduleTitle(m)}
                  </h2>
                  {m.lessons.length === 0 ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
                      planned
                    </span>
                  ) : null}
                </div>
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm text-muted">
                  {m.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                {m.lessons.length > 0 ? (
                  <ol className="mt-3 flex flex-col gap-1" aria-label={`${moduleTitle(m)} lessons`}>
                    {m.lessons.map((l) => {
                      const status = lessonStatus(progress[l.id]);
                      return (
                        <li key={l.id}>
                          <Link
                            to="/learn/$lessonId"
                            params={{ lessonId: l.id }}
                            className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-2"
                          >
                            <StatusIcon status={status} />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="font-medium">{l.title}</span>
                              <span className="text-xs text-muted">{l.summary}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted">
                              {l.minutes} min
                              <span className="sr-only">, {STATUS_TEXT[status]}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </section>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
