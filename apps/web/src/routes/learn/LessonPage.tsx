/**
 * A Learn lesson (proj-mgmt/13 section 4, 20-learn-mode): concept prose, a live demo with the
 * transport and breakpoints below the maze, pseudo-code synced to the steps, the data-structure
 * view, try-it checks, a complexity callout and the quiz, with previous/next lessons and local
 * progress. A passed quiz completes the lesson; lessons without one have a "Mark as done" button.
 */
import { generators, openNeighbors, solvers } from '@maze/core';
import { Button } from '@maze/ui';
import { Link, useParams } from '@tanstack/react-router';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RouteLoading } from '../../app/RouteLoading';
import { locateLesson, moduleTitle, type LessonLocation } from '../../content/learn/curriculum';
import type {
  DemoState,
  GraphDemoSpec,
  LessonContent,
  PairDemoSpec,
  PlayerDemoSpec,
} from '../../content/learn/types';
import type { CodeListing } from '../../content/pseudocode';
import { useBreakpoint } from '../../layout/breakpoints';
import { Section } from '../../layout/Section';
import { Workspace } from '../../layout/Workspace';
import { genStructureFor, genStructureTitle } from '../../learn/genStructure';
import { graphSummary } from '../../learn/graphDemo';
import { useGraphDemo } from '../../learn/useGraphDemo';
import { usePairDemo } from '../../learn/usePairDemo';
import { solveStructureFor, structureTitle } from '../../learn/solveStructure';
import { useLessonDemo } from '../../learn/useLessonDemo';
import { lessonStatus, useLearnProgress } from '../../state/learnProgress';
import { PseudocodePanel } from '../watch/PseudocodePanel';
import { GenStructureView } from './GenStructureView';
import { GraphDemo } from './GraphDemo';
import { GraphStatsView } from './GraphStatsView';
import { LessonDemo } from './LessonDemo';
import { PairDemo } from './PairDemo';
import { PairStatsView } from './PairStatsView';
import { Quiz } from './Quiz';
import { StructureView } from './StructureView';
import { TryItList } from './TryItList';

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
  const spec = content.content.demo;
  if (spec.kind === 'pair') {
    return (
      <PairLessonView
        key={location.lesson.id}
        location={location}
        content={content.content}
        spec={spec}
      />
    );
  }
  return spec.kind === 'graph' ? (
    <GraphLessonView
      key={location.lesson.id}
      location={location}
      content={content.content}
      spec={spec}
    />
  ) : (
    <PlayerLessonView
      key={location.lesson.id}
      location={location}
      content={content.content}
      spec={spec}
    />
  );
}

/** The page around any demo: header and progress, sections, try-its, quiz and navigation. */
interface LessonFrameProps {
  location: LessonLocation;
  content: LessonContent;
  stage: ReactNode;
  /** The section beside the demo: the data structure, or the graph. */
  structure: { readonly title: string; readonly summary: string; readonly node: ReactNode };
  /** Pseudo-code synced to the demo; null when no algorithm runs. */
  code: { readonly listing: CodeListing; readonly currentLine: number | null } | null;
  demoState: DemoState;
}

function LessonFrame({ location, content, stage, structure, code, demoState }: LessonFrameProps) {
  const { module, lesson, previous, next } = location;
  const bp = useBreakpoint();
  const progress = useLearnProgress((s) => s.lessons[lesson.id]);
  const start = useLearnProgress((s) => s.start);
  const complete = useLearnProgress((s) => s.complete);
  const reopen = useLearnProgress((s) => s.reopen);
  const recordQuiz = useLearnProgress((s) => s.recordQuiz);
  const completeTryIt = useLearnProgress((s) => s.completeTryIt);
  const status = lessonStatus(progress);
  const { quiz, tryIt, tryThis, Body } = content;

  useEffect(() => {
    start(lesson.id);
  }, [start, lesson.id]);

  const onTryItDone = useCallback(
    (checkId: string) => {
      completeTryIt(lesson.id, checkId);
    },
    [completeTryIt, lesson.id],
  );

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
        ) : quiz ? (
          <span className="text-xs text-muted">Pass the quiz to finish</span>
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
        stage={stage}
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
              title={structure.title}
              summary={structure.summary}
              defaultOpen
            >
              {structure.node}
            </Section>
            {code ? (
              <Section
                id="lesson-pseudocode"
                title="Pseudo-code"
                summary={code.listing.title}
                defaultOpen={bp !== 'mobile'}
              >
                <PseudocodePanel
                  listing={code.listing}
                  currentLine={code.currentLine}
                  hideHeading
                />
              </Section>
            ) : null}
            {tryIt?.length || tryThis?.length ? (
              <Section
                id="lesson-try"
                title="Try it"
                summary={
                  tryIt?.length
                    ? `${String(tryIt.filter((c) => progress?.tryIts?.includes(c.id)).length)} of ${String(tryIt.length)} done`
                    : undefined
                }
                defaultOpen={bp !== 'mobile'}
              >
                <div className="flex flex-col gap-3">
                  {tryIt?.length ? (
                    <TryItList
                      checks={tryIt}
                      demo={demoState}
                      done={progress?.tryIts ?? []}
                      onDone={onTryItDone}
                    />
                  ) : null}
                  {tryThis?.length ? (
                    <div className="flex flex-col gap-1.5">
                      {tryIt?.length ? (
                        <h3 className="text-xs font-medium text-muted">More to explore</h3>
                      ) : null}
                      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                        {tryThis.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
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
            {quiz ? (
              <Section
                id="lesson-quiz"
                title="Quiz"
                summary={
                  progress?.quiz
                    ? `best ${String(progress.quiz.best)} of ${String(progress.quiz.total)}`
                    : `${String(quiz.questions.length)} questions`
                }
                defaultOpen={bp !== 'mobile'}
              >
                <Quiz
                  quiz={quiz}
                  onChecked={(correct, total, passed) => {
                    recordQuiz(lesson.id, correct, total, passed);
                  }}
                />
              </Section>
            ) : null}
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

/** A lesson whose demo plays an algorithm: a solver on a finished maze, or a generator. */
function PlayerLessonView({
  location,
  content,
  spec,
}: {
  location: LessonLocation;
  content: LessonContent;
  spec: PlayerDemoSpec;
}) {
  const demo = useLessonDemo(spec);
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';
  const grid = demo.snap.state?.grid ?? null;
  const algorithmName =
    spec.kind === 'solve'
      ? (solvers.get(spec.solverId)?.meta.name ?? spec.solverId)
      : (generators.get(spec.generatorId)?.meta.name ?? spec.generatorId);
  const structure =
    spec.kind === 'solve'
      ? {
          title: structureTitle(solveStructureFor(spec.solverId)),
          summary: 'the frontier',
          node: <StructureView grid={grid} state={demo.structure} />,
        }
      : {
          title: genStructureTitle(genStructureFor(spec.generatorId)),
          summary: 'what the generator keeps',
          node: <GenStructureView grid={grid} state={demo.genStructure} />,
        };
  const demoState = useMemo<DemoState>(
    () => ({
      status: demo.playerSnap?.status ?? null,
      stepCount: demo.playerSnap?.stepCount ?? 0,
      lastStep: demo.lastStep,
      maze: demo.snap.state,
      structure: demo.structure,
      genStructure: demo.genStructure,
      graph: null,
      pair: null,
    }),
    [demo.playerSnap, demo.lastStep, demo.snap.state, demo.structure, demo.genStructure],
  );
  return (
    <LessonFrame
      location={location}
      content={content}
      stage={<LessonDemo demo={demo} algorithmName={algorithmName} pageScroll={touchLayout} />}
      structure={structure}
      code={{ listing: demo.listing, currentLine: demo.currentLine }}
      demoState={demoState}
    />
  );
}

/** A lesson whose demo is a maze edited by hand and read as a graph (M1). */
function GraphLessonView({
  location,
  content,
  spec,
}: {
  location: LessonLocation;
  content: LessonContent;
  spec: GraphDemoSpec;
}) {
  const demo = useGraphDemo(spec);
  const { state, stats, selected, edits } = demo.snap;
  const demoState = useMemo<DemoState>(
    () => ({
      status: null,
      stepCount: edits,
      lastStep: null,
      maze: state,
      structure: null,
      genStructure: null,
      graph: {
        stats,
        selected,
        degree: selected === null ? null : openNeighbors(state, selected).length,
        edits,
      },
      pair: null,
    }),
    [state, stats, selected, edits],
  );
  return (
    <LessonFrame
      location={location}
      content={content}
      stage={<GraphDemo demo={demo} />}
      structure={{
        title: 'Graph',
        summary: graphSummary(stats),
        node: <GraphStatsView state={state} stats={stats} selected={selected} />,
      }}
      code={null}
      demoState={demoState}
    />
  );
}

/** A lesson whose demo runs two solvers side by side on one maze, in lockstep (M3). */
function PairLessonView({
  location,
  content,
  spec,
}: {
  location: LessonLocation;
  content: LessonContent;
  spec: PairDemoSpec;
}) {
  const demo = usePairDemo(spec);
  const { model, playerSnap, lanes } = demo;
  const demoState = useMemo<DemoState>(
    () => ({
      status: playerSnap?.status ?? null,
      stepCount: playerSnap?.stepCount ?? 0,
      lastStep: null,
      maze: model.maze,
      structure: null,
      genStructure: null,
      graph: null,
      pair: { lanes, shortest: model.shortest },
    }),
    [playerSnap, model, lanes],
  );
  const found = lanes.filter((l) => l.pathMoves !== null).length;
  return (
    <LessonFrame
      location={location}
      content={content}
      stage={<PairDemo demo={demo} />}
      structure={{
        title: 'Side by side',
        summary: `${String(found)} of ${String(lanes.length)} paths found`,
        node: <PairStatsView lanes={lanes} shortest={model.shortest} />,
      }}
      code={null}
      demoState={demoState}
    />
  );
}
