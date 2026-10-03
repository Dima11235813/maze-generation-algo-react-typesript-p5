import { generators, randomSeed } from '@maze/core';
import { SPEED_PRESETS } from '@maze/player';
import {
  Button,
  IconButton,
  Kbd,
  Label,
  Separator,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@maze/ui';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Dices, FastForward, Pause, Play, RefreshCw, SkipForward } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useAnnouncer } from '../../app/Announcer';
import { useIsNarrow } from '../../lib/useMediaQuery';
import { useReducedMotion } from '../../app/documentPrefs';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';
import { CompareController, MAX_COMPARE_LANES, parseAlgos } from '../../maze/compare';
import { computeGridDims } from '../../maze/gridSizing';
import { MazeSession } from '../../maze/session';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { usePrefs } from '../../state/prefs';
import type { HostSize } from '../play/MazeCanvas';
import { useKeyboardShortcuts } from '../play/useKeyboardShortcuts';
import { CompareLane } from './CompareLane';
import { CompareMetricsTable } from './CompareMetricsTable';

export interface CompareSearch {
  seed?: string;
  algos?: string;
}

interface Lanes {
  key: string;
  seed: string;
  algos: readonly string[];
  sessions: MazeSession[];
  controller: CompareController;
}

/** Sessions in Compare never schedule themselves; the controller drives them in lockstep. */
const noSchedule = () => () => undefined;

function Hint({ label, keys, children }: { label: string; keys?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {keys ? <Kbd>{keys}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Re-renders when any lane session changes (version counter keeps getSnapshot stable). */
function useSessionsVersion(sessions: readonly MazeSession[]): number {
  const versionRef = useRef(0);
  const subscribe = useCallback(
    (cb: () => void) => {
      const unsubs = sessions.map((s) =>
        s.subscribe(() => {
          versionRef.current++;
          cb();
        }),
      );
      return () => {
        unsubs.forEach((u) => {
          u();
        });
      };
    },
    [sessions],
  );
  return useSyncExternalStore(
    subscribe,
    () => versionRef.current,
    () => versionRef.current,
  );
}

/**
 * Compare mode: 2-4 generators on one seed, side by side, driven by a single lockstep
 * transport, with a metrics table that highlights the best value per column. Deep-linkable
 * through `?seed=&algos=`.
 */
export function ComparePage() {
  const search = useSearch({ from: '/explore/compare' });
  const navigate = useNavigate({ from: '/explore/compare' });
  const prefs = usePrefs();
  const reducedMotion = useReducedMotion();
  const announce = useAnnouncer();
  const narrow = useIsNarrow();

  const fallbackAlgo = generators.has(prefs.generatorId)
    ? prefs.generatorId
    : (generators.ids[0] ?? '');
  const algos = useMemo(
    () => parseAlgos(search.algos, generators.ids, fallbackAlgo),
    [search.algos, fallbackAlgo],
  );
  const [seed] = useState(() => search.seed ?? randomSeed());
  const effectiveSeed = search.seed ?? seed;
  const [hostSize, setHostSize] = useState<HostSize | null>(null);
  const [zoom, setZoom] = useState(1);

  const setSearch = useCallback(
    (next: { seed?: string; algos?: readonly string[] }) => {
      void navigate({
        search: {
          seed: next.seed ?? effectiveSeed,
          algos: (next.algos ?? algos).join(','),
        },
        replace: true,
      });
    },
    [navigate, effectiveSeed, algos],
  );

  // Keep the URL canonical (seed and algos always present).
  useEffect(() => {
    if (search.seed !== effectiveSeed || search.algos !== algos.join(',')) setSearch({});
  }, [search.seed, search.algos, effectiveSeed, algos, setSearch]);

  // ---- lanes (sessions + controller) ------------------------------------------------------
  const laneKey = `${effectiveSeed}|${algos.join(',')}`;
  const lanesRef = useRef<Lanes | null>(null);
  if (!lanesRef.current || lanesRef.current.key !== laneKey) {
    lanesRef.current?.controller.dispose();
    lanesRef.current?.sessions.forEach((s) => {
      s.dispose();
    });
    const sessions = algos.map(() => new MazeSession({ speed: prefs.speed, schedule: noSchedule }));
    lanesRef.current = {
      key: laneKey,
      seed: effectiveSeed,
      algos,
      sessions,
      controller: new CompareController({ sessions, stepsPerSecond: prefs.speed }),
    };
  }
  const lanes = lanesRef.current;
  const { sessions, controller } = lanes;
  const generatedKey = useRef<string | null>(null);

  useEffect(() => {
    const current = lanesRef.current;
    current?.controller.revive();
    return () => {
      current?.controller.dispose();
      current?.sessions.forEach((s) => {
        s.dispose();
      });
    };
  }, []);

  const generateLanes = useCallback(() => {
    if (!hostSize) return;
    const dims = computeGridDims(hostSize.width, hostSize.height, prefs.cellSize);
    lanes.sessions.forEach((s, i) => {
      s.generate({
        ...dims,
        seed: lanes.seed,
        generatorId: lanes.algos[i] ?? fallbackAlgo,
        autoplay: false,
      });
    });
    controller.reset();
    if (!reducedMotion) controller.play();
    announce(
      `Comparing ${lanes.algos.length} generator${lanes.algos.length === 1 ? '' : 's'} on seed ${lanes.seed}.`,
    );
  }, [hostSize, prefs.cellSize, lanes, controller, fallbackAlgo, reducedMotion, announce]);

  useEffect(() => {
    if (!hostSize || generatedKey.current === laneKey) return;
    generatedKey.current = laneKey;
    generateLanes();
  }, [hostSize, laneKey, generateLanes]);

  useEffect(() => {
    controller.setSpeed(prefs.speed);
  }, [controller, prefs.speed]);

  const ctl = useSyncExternalStore(controller.onChange.bind(controller), () =>
    controller.getSnapshot(),
  );
  const version = useSessionsVersion(sessions);

  useEffect(() => {
    if (ctl.status === 'done') announce('All generators finished.');
  }, [ctl.status, announce]);

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
  const first = sessions[0]?.getSnapshot();
  const rows = first?.height || 1;
  const gridCellSize = first && first.phase !== 'empty' ? first.cellSize : prefs.cellSize;
  const options = useMemo(
    () => ({
      ...buildRenderOptions(prefs, rows, reducedMotion, gridCellSize),
      mode: '2d' as const,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.wallWidth, prefs.showGrid, prefs.showStartGoal, rows, reducedMotion, gridCellSize],
  );
  const camera = useMemo(
    () => buildCamera({ cameraPreset: 'top', followPointer: false }, zoom),
    [zoom],
  );

  const onHostSize = useCallback((size: HostSize) => {
    setHostSize((prev) =>
      prev && Math.abs(prev.width - size.width) < 1 && Math.abs(prev.height - size.height) < 1
        ? prev
        : size,
    );
  }, []);

  // ---- algorithm selection ----------------------------------------------------------------
  const toggleAlgo = useCallback(
    (id: string, on: boolean) => {
      const next = on ? [...algos, id] : algos.filter((a) => a !== id);
      if (next.length === 0 || next.length > MAX_COMPARE_LANES) return;
      setSearch({ algos: next });
    },
    [algos, setSearch],
  );

  useKeyboardShortcuts({
    onKeyDown: (e) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          controller.toggle();
          break;
        case '.':
          controller.step();
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

  const playing = ctl.status === 'playing';
  const playable = ctl.status !== 'done';
  const speedIndex = speedToIndex(prefs.speed);
  const laneEntries = useMemo(
    () => lanes.algos.map((algoId, i) => ({ algoId, session: sessions[i] as MazeSession })),
    [lanes.algos, sessions],
  );

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto"
      data-sessions-version={version}
    >
      <div
        role="toolbar"
        aria-label="Compare controls"
        className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2"
      >
        <Button asChild variant="ghost" size="sm">
          <Link to="/explore" aria-label="Back to the catalogue">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Catalogue</span>
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div role="group" aria-label="Playback" className="flex items-center gap-1.5">
          <Hint label={playing ? 'Pause' : 'Play'} keys="Space">
            <IconButton
              size="icon-sm"
              variant="outline"
              aria-label={playing ? 'Pause' : 'Play'}
              aria-pressed={playing}
              onClick={() => {
                controller.toggle();
              }}
              disabled={!playable}
            >
              {playing ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </IconButton>
          </Hint>
          <Hint label="Step all lanes once" keys=".">
            <IconButton
              size="icon-sm"
              variant="outline"
              aria-label="Step once"
              onClick={() => {
                controller.step();
              }}
              disabled={!playable}
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Hint>
          <Hint label="Run every lane to the end">
            <IconButton
              size="icon-sm"
              variant="outline"
              aria-label="Run to end"
              onClick={() => {
                controller.runToEnd();
              }}
              disabled={!playable}
            >
              <FastForward className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Hint>
          <Slider
            className="w-28 sm:w-40"
            label="Speed"
            hideLabel
            value={speedIndex}
            min={0}
            max={SPEED_PRESETS.length - 1}
            step={1}
            valueText={formatSpeed(prefs.speed)}
            onValueChange={(i) => {
              prefs.set('speed', indexToSpeed(i));
            }}
          />
          <span
            className="hidden w-24 text-xs tabular-nums text-muted sm:inline"
            aria-hidden="true"
          >
            {formatSpeed(prefs.speed)}
          </span>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div role="group" aria-label="Seed" className="flex items-center gap-1.5">
          <Label htmlFor="compare-seed" className="sr-only">
            Seed
          </Label>
          <input
            id="compare-seed"
            className="h-8 w-32 rounded-md border border-border bg-panel px-2 font-mono text-xs"
            defaultValue={effectiveSeed}
            key={effectiveSeed}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) setSearch({ seed: v });
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== effectiveSeed) setSearch({ seed: v });
            }}
          />
          <Hint label="Random seed" keys="N">
            <IconButton
              size="icon-sm"
              aria-label="Random seed"
              onClick={() => {
                setSearch({ seed: randomSeed() });
              }}
            >
              <Dices className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Hint>
          <Hint label="Run the same seed again">
            <IconButton
              size="icon-sm"
              variant="outline"
              aria-label="Regenerate same seed"
              onClick={() => {
                generatedKey.current = null;
                generateLanes();
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Hint>
        </div>
      </div>

      <details
        key={narrow ? 'narrow' : 'wide'}
        open={!narrow}
        className="border-b border-border bg-panel px-3 py-2"
      >
        <summary className="cursor-pointer text-sm font-medium select-none">
          Generators ({algos.length} of {MAX_COMPARE_LANES} max)
          <span className="ml-2 font-normal text-muted">
            {algos.map((a) => generators.get(a)?.meta.name ?? a).join(', ')}
          </span>
        </summary>
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
          <legend className="sr-only">Generators to compare (2 to 4)</legend>
          {generators.all.map((g) => {
            const checked = algos.includes(g.meta.id);
            const id = `cmp-${g.meta.id}`;
            return (
              <span
                key={g.meta.id}
                className="flex min-h-8 items-center gap-1.5 text-sm sm:text-xs"
              >
                <input
                  id={id}
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={checked}
                  disabled={
                    (!checked && algos.length >= MAX_COMPARE_LANES) ||
                    (checked && algos.length === 1)
                  }
                  onChange={(e) => {
                    toggleAlgo(g.meta.id, e.target.checked);
                  }}
                />
                <label htmlFor={id}>{g.meta.name}</label>
              </span>
            );
          })}
          {generators.all.length < 2 ? (
            <span className="text-xs text-muted">
              (more generators arrive with the catalogue work)
            </span>
          ) : null}
        </fieldset>
      </details>

      <div className="flex flex-none flex-col gap-2 p-2">
        <div
          className={cn(
            'grid grid-cols-1 gap-2',
            lanes.algos.length >= 2 && 'md:grid-cols-2',
            lanes.algos.length === 3 && 'xl:grid-cols-3',
            lanes.algos.length === 4 && '2xl:grid-cols-4',
          )}
        >
          {laneEntries.map((l, i) => (
            <CompareLane
              key={`${l.algoId}-${i}`}
              index={i}
              algoId={l.algoId}
              session={l.session}
              theme={theme}
              options={options}
              camera={camera}
              onHostSize={onHostSize}
            />
          ))}
        </div>
      </div>

      <CompareMetricsTable lanes={laneEntries} />
      <span className="sr-only">{`Lockstep tick ${ctl.tick}, ${ctl.active.length} generators still running.`}</span>
      <button
        type="button"
        className="sr-only"
        onClick={() => {
          setZoom(1);
        }}
        tabIndex={-1}
        aria-hidden="true"
      >
        reset zoom
      </button>
    </div>
  );
}
