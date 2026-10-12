/**
 * A Learn lesson (proj-mgmt/13 section 4, 20-learn-mode): concept prose, a live demo with the
 * transport below the maze, pseudo-code synced to the steps, the data-structure view and a
 * complexity callout, with previous/next lessons and local progress.
 */
import { solvers } from '@maze/core';
import { Button } from '@maze/ui';
import { Link, useParams } from '@tanstack/react-router';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RouteLoading } from '../../app/RouteLoading';
import { locateLesson, moduleTitle, type LessonLocation } from '../../content/learn/curriculum';
import type { LessonContent } from '../../content/learn/types';
import { useBreakpoint } from '../../layout/breakpoints';
import { Section } from '../../layout/Section';
import { Workspace } from '../../layout/Workspace';
import { solveStructureFor, structureTitle } from '../../learn/solveStructure';
import { useLessonDemo } from '../../learn/useLessonDemo';
import { lessonStatus, useLearnProgress } from '../../state/learnProgress';
import { PseudocodePanel } from '../watch/PseudocodePanel';
import { LessonDemo } from './LessonDemo';
import { StructureView } from './StructureView';

export function LessonPage() {
  const { lessonId } = useParams({ from: '/learn/$lessonId' });
  const location = locateLesson(lessonId);
  const lesson = location?.lesson;
  const [content, setContent] = useState<{ id: string; content: LessonContent } | null>(null);

  useEffect(() => {
    if (!lesson) return;
    let alive = true;
    void lesson.load().then((c) => {
      if (alive) setContent({ id: lesson.id, content: c });
    });
    return () => {
      alive = false;
    };
  }, [lesson]);

  if (!location) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-6">
        <h1 className="text-xl font-semibold">Lesson not found</h1>
        <p className="text-muted">
          There is no lesson called &ldquo;{lessonId}&rdquo;. It may have moved.
        </p>
        <Link to="/learn" className="text-accent underline">
          See all lessons
        </Link>
      </div>
    );
  }
  if (content?.id !== location.lesson.id) return <RouteLoading />;
  return <LessonView key={location.lesson.id} location={location} content={content.content} />;
}

function LessonView({ location, content }: { location: LessonLocation; content: LessonContent }) {
  const { module, lesson, previous, next } = location;
  const demo = useLessonDemo(content.demo);
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';
  const progress = useLearnProgress((s) => s.lessons[lesson.id]);
  const start = useLearnProgress((s) => s.start);
  const complete = useLearnProgress((s) => s.complete);
  const reopen = useLearnProgress((s) => s.reopen);
  const status = lessonStatus(progress);
  const solverName = solvers.get(content.demo.solverId)?.meta.name ?? content.demo.solverId;
  const { Body } = content;

  useEffect(() => {
    start(lesson.id);
  }, [start, lesson.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link to="/learn" className="underline-offset-2 hover:underline">
                  Learn
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>{moduleTitle(module)}</li>
            </ol>
          </nav>
          <h1 className="truncate text-lg font-semibold">{lesson.title}</h1>
        </div>
        {status === 'done' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              reopen(lesson.id);
            }}
            aria-label="Lesson done. Mark as not done"
          >
            <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" /> Done
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              complete(lesson.id);
            }}
          >
            Mark as done
          </Button>
        )}
      </header>
      <Workspace
        stageLabel="Lesson demo"
        stage={<LessonDemo demo={demo} solverName={solverName} pageScroll={touchLayout} />}
        left={
          <Section id="lesson-concept" title="Concept" summary={lesson.summary} defaultOpen>
            <div className="flex flex-col gap-3 text-sm leading-6">
              <Body />
            </div>
          </Section>
        }
        side={
          <>
            <Section
              id="lesson-structure"
              title={structureTitle(solveStructureFor(content.demo.solverId))}
              summary="the frontier"
              defaultOpen
            >
              <StructureView grid={demo.snap.state?.grid ?? null} state={demo.structure} />
            </Section>
            <Section
              id="lesson-pseudocode"
              title="Pseudo-code"
              summary={demo.listing.title}
              defaultOpen={bp !== 'mobile'}
            >
              <PseudocodePanel listing={demo.listing} currentLine={demo.currentLine} hideHeading />
            </Section>
            {content.tryThis && content.tryThis.length > 0 ? (
              <Section id="lesson-try" title="Try this" defaultOpen={bp !== 'mobile'}>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                  {content.tryThis.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <Section
              id="lesson-complexity"
              title="Complexity"
              summary={`${content.complexity.time} time`}
              defaultOpen={bp !== 'mobile'}
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Time</dt>
                <dd className="font-mono">{content.complexity.time}</dd>
                <dt className="text-muted">Space</dt>
                <dd className="font-mono">{content.complexity.space}</dd>
              </dl>
              <p className="mt-2 text-sm text-muted">{content.complexity.why}</p>
            </Section>
            <nav aria-label="Lessons" className="flex items-center justify-between gap-2 pb-2">
              {previous ? (
                <Link
                  to="/learn/$lessonId"
                  params={{ lessonId: previous.id }}
                  className="flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {previous.title}
                </Link>
              ) : (
                <Link
                  to="/learn"
                  className="text-sm text-accent underline-offset-2 hover:underline"
                >
                  All lessons
                </Link>
              )}
              {next ? (
                <Link
                  to="/learn/$lessonId"
                  params={{ lessonId: next.id }}
                  className="flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
                >
                  {next.title} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="text-sm text-muted">More lessons are on the way.</span>
              )}
            </nav>
          </>
        }
      />
    </div>
  );
}
