import { generators, randomSeed, solvers, type RaceScoring } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useAnnouncer } from '../../app/Announcer';
import { useReducedMotion } from '../../app/documentPrefs';
import { useBreakpoint } from '../../layout/breakpoints';
import { Section } from '../../layout/Section';
import { Workspace } from '../../layout/Workspace';
import {
  RaceRun,
  SCORING_LABELS,
  parseAgents,
  parseScoring,
  parseSize,
  solverName,
  type RaceSetup,
} from '../../maze/race';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { usePrefs } from '../../state/prefs';
import { TimelineBar } from '../play/TimelineBar';
import { useKeyboardShortcuts } from '../play/useKeyboardShortcuts';
import { RaceLane } from './RaceLane';
import { RacersPicker, RaceRules } from './RaceSetupPanel';
import { RaceRanking, RaceStandings, winnerSentence } from './RaceStandings';
import { RaceToolbar } from './RaceToolbar';

export interface RaceSearch {
  seed?: string;
  agents?: string;
  scoring?: string;
  size?: string;
  gen?: string;
}

/** Nominal cell size for the 2D renderer; it scales the maze to each lane anyway. */
const LANE_CELL_SIZE = 20;
/** Height of a lane header, subtracted when choosing how many lanes go in a row. */
const LANE_HEADER_PX = 33;

/**
 * Picks the column count that gives each (square) maze the most room in a `width` x `height`
 * box: two lanes stack on a phone, sit side by side on a tablet, four make a 2 x 2 grid unless
 * the box is very wide.
 */
export function bestColumns(n: number, width: number, height: number): number {
  if (width <= 0 || height <= 0) return Math.min(n, 2);
  let best = 1;
  let bestSide = -1;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const side = Math.min(width / cols, height / rows - LANE_HEADER_PX);
    // Another column must clearly help (10%), so near-ties do not flip the layout when the
    // stage changes height by a few pixels.
    if (side > bestSide * 1.1) {
      best = cols;
      bestSide = side;
    }
  }
  return best;
}

function useLaneColumns(n: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(() => Math.min(n, 2));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCols(bestColumns(n, el.clientWidth, el.clientHeight));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [n]);
  return { ref, cols };
}

const noSubscribe = () => () => undefined;
const zero = () => 0;

/**
 * Race pillar: two to four solvers on one seeded maze, advancing in lockstep. One transport
 * (a StepPlayer over `runRace`) drives every lane, so play, pause, step back, restart and the
 * scrubber all work, and the whole race is reproducible from its URL.
 */
export function RacePage() {
  const search = useSearch({ from: '/race' });
  const navigate = useNavigate({ from: '/race' });
  const prefs = usePrefs();
  const reducedMotion = useReducedMotion();
  const announce = useAnnouncer();
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';

  // ---- setup from the URL ----------------------------------------------------------------
  const [fallbackSeed] = useState(() => randomSeed());
  const setup = useMemo<RaceSetup>(
    () => ({
      seed: search.seed ?? fallbackSeed,
      generatorId:
        search.gen && generators.has(search.gen)
          ? search.gen
          : generators.has(prefs.generatorId)
            ? prefs.generatorId
            : (generators.ids[0] ?? 'recursive-backtracker'),
      agents: parseAgents(search.agents, solvers.ids),
      scoring: parseScoring(search.scoring),
      size: parseSize(search.size),
    }),
    [
      search.seed,
      search.gen,
      search.agents,
      search.scoring,
      search.size,
      fallbackSeed,
      prefs.generatorId,
    ],
  );
  const setupKey = `${setup.seed}|${setup.generatorId}|${setup.size}|${setup.agents.join(',')}|${setup.scoring}`;

  const setSearch = useCallback(
    (patch: Partial<RaceSetup>) => {
      const next = { ...setup, ...patch };
      void navigate({
        search: {
          seed: next.seed,
          agents: next.agents.join(','),
          scoring: next.scoring,
          size: String(next.size),
          gen: next.generatorId,
        },
        replace: true,
      });
    },
    [navigate, setup],
  );

  // Keep the URL canonical so copying it always reproduces this race.
  useEffect(() => {
    if (
      search.seed !== setup.seed ||
      search.agents !== setup.agents.join(',') ||
      search.scoring !== setup.scoring ||
      search.size !== String(setup.size) ||
      search.gen !== setup.generatorId
    ) {
      setSearch({});
    }
  }, [search, setup, setSearch]);

  // ---- the race (created inside the effect so StrictMode's dev remount gets a fresh one) ---
  const [run, setRun] = useState<RaceRun | null>(null);
  const setupRef = useRef(setup);
  setupRef.current = setup;
  useEffect(() => {
    const r = new RaceRun(setupRef.current, { stepsPerSecond: usePrefs.getState().speed });
    setRun(r);
    return () => {
      r.dispose();
    };
  }, [setupKey]);

  useEffect(() => {
    run?.player.setSpeed(prefs.speed);
  }, [run, prefs.speed]);

  useSyncExternalStore(
    run ? run.subscribe : noSubscribe,
    run ? run.getVersion : zero,
    run ? run.getVersion : zero,
  );
  const playerSnap = useStepPlayer(run?.player ?? null);
  const result = playerSnap?.status === 'done' ? run?.result : undefined;
  const standings = run?.standings() ?? [];
  const racing = standings.filter((s) => s.status === 'running').length;

  useEffect(() => {
    if (run) {
      announce(
        `Race ready: ${run.setup.agents.map(solverName).join(' versus ')} on a ${run.setup.size} by ${run.setup.size} maze, scoring ${SCORING_LABELS[run.setup.scoring].toLowerCase()}.`,
      );
    }
  }, [run, announce]);

  useEffect(() => {
    if (result) announce(winnerSentence(result));
  }, [result, announce]);

  // ---- renderer inputs ------------------------------------------------------------------
  const theme = useMemo(
    () =>
      buildTheme({
        cellColor: prefs.cellColor,
        wallColor: prefs.wallColor,
        backgroundColor: prefs.backgroundColor,
        invert: prefs.invert,
      }),
    [prefs.cellColor, prefs.wallColor, prefs.backgroundColor, prefs.invert],
  );
  const options = useMemo(
    () => ({
      ...buildRenderOptions(prefs, setup.size, reducedMotion, LANE_CELL_SIZE),
      mode: '2d' as const,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.wallWidth, prefs.showGrid, prefs.showStartGoal, setup.size, reducedMotion],
  );
  const camera = useMemo(() => buildCamera({ cameraPreset: 'top', followPointer: false }, 1), []);

  // ---- actions --------------------------------------------------------------------------
  const player = run?.player ?? null;
  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      announce('Race link copied to the clipboard.');
    } catch {
      announce('Could not copy the link.');
    }
  }, [announce]);

  useKeyboardShortcuts({
    onKeyDown: (e) => {
      if (!player) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          player.toggle();
          break;
        case '.':
          player.step();
          break;
        case ',':
          player.stepBack();
          break;
        case 'Home':
          e.preventDefault();
          player.restart();
          break;
        case 'End':
          e.preventDefault();
          player.runToEnd();
          break;
        case 'n':
        case 'N':
          setSearch({ seed: randomSeed() });
          break;
        default:
          break;
      }
    },
  });

  const { ref: lanesRef, cols } = useLaneColumns(setup.agents.length);
  const tick = playerSnap?.stepCount ?? 0;
  const statusLine = result
    ? winnerSentence(result)
    : tick === 0
      ? `${setup.agents.length} racers on the start line. Press play.`
      : `Tick ${tick}: ${racing} of ${standings.length} still racing.`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Race</h1>
      <RaceToolbar
        status={playerSnap?.status ?? null}
        canStepBack={tick > 0}
        onPlayToggle={() => player?.toggle()}
        onStep={() => player?.step()}
        onStepBack={() => player?.stepBack()}
        onRunToEnd={() => player?.runToEnd()}
        speed={prefs.speed}
        onSpeedChange={(s) => {
          prefs.set('speed', s);
        }}
        seed={setup.seed}
        onSeedChange={(seed) => {
          setSearch({ seed });
        }}
        onRandomSeed={() => {
          setSearch({ seed: randomSeed() });
        }}
        onCopyLink={() => void copyLink()}
      />
      <Workspace
        stageLabel="Race lanes"
        stage={
          <>
            <p
              className="truncate border-b border-border bg-panel px-3 py-1.5 text-sm"
              data-testid="race-status"
              title={statusLine}
            >
              {statusLine}
            </p>
            <div
              ref={lanesRef}
              className="grid min-h-0 flex-1 gap-2 p-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridAutoRows: 'minmax(0, 1fr)',
              }}
            >
              {run
                ? standings.map((s) => (
                    <RaceLane
                      key={`${run.setup.agents.join(',')}-${s.agentId}`}
                      standing={s}
                      sink={run.renderSink(s.index)}
                      maze={run.state}
                      tracker={run.trackers[s.index]!}
                      theme={theme}
                      options={options}
                      camera={camera}
                      rank={result ? result.ranking.indexOf(s.agentId) + 1 : null}
                      pageScroll={touchLayout}
                    />
                  ))
                : null}
            </div>
            <TimelineBar
              snapshot={playerSnap}
              label="Race"
              onSeek={(n) => {
                player?.seek(n);
              }}
              onRestart={() => {
                player?.restart();
              }}
            />
          </>
        }
        left={
          <>
            <Section
              id="race-racers"
              title="Racers"
              summary={setup.agents.map(solverName).join(', ')}
              defaultOpen={bp !== 'mobile'}
            >
              <RacersPicker
                agents={setup.agents}
                onChange={(agents) => {
                  setSearch({ agents });
                }}
              />
            </Section>
            <Section
              id="race-rules"
              title="Rules"
              summary={SCORING_LABELS[setup.scoring]}
              defaultOpen={bp === 'wide'}
            >
              <RaceRules
                scoring={setup.scoring}
                onScoringChange={(scoring: RaceScoring) => {
                  setSearch({ scoring });
                }}
                generatorId={setup.generatorId}
                onGeneratorChange={(generatorId) => {
                  setSearch({ generatorId });
                }}
                size={setup.size}
                onSizeChange={(size) => {
                  setSearch({ size });
                }}
              />
            </Section>
          </>
        }
        side={
          <>
            <Section
              id="race-standings"
              title="Standings"
              summary={result ? 'final' : `tick ${tick}`}
            >
              <RaceStandings standings={standings} solutionLength={run?.solutionLength ?? null} />
            </Section>
            <Section id="race-ranking" title="Ranking">
              {result ? (
                <RaceRanking result={result} solutionLength={run?.solutionLength ?? null} />
              ) : (
                <p className="text-sm text-muted">
                  The ranking appears when every racer has finished. Run to the end to see it now.
                </p>
              )}
            </Section>
          </>
        }
      />
    </div>
  );
}
