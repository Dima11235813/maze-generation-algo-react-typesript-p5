import { describeSolveStep, randomSeed, solvers } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import type { CameraState, Renderer } from '@maze/renderer';
import type { CellId } from '@maze/core';
import { rendererModeFor, treeOptionsFor, type ViewChoice } from '../../maze/treeView';
import { TreeControls } from '../tree/TreeControls';
import { TreeOutline } from '../tree/TreeOutline';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAnnouncer } from '../../app/useAnnouncer';
import { useReducedMotion } from '../../app/documentPrefs';
import { pseudocodeFor } from '../../content/pseudocode';
import { computeGridDims } from '../../maze/gridSizing';
import { MazeSession } from '../../maze/session';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { useCameraView } from '../../maze/view';
import { TimelineBar } from '../play/TimelineBar';
import { handleViewKey } from '../play/ViewControls';
import { MazeTools, type ToolGroup } from '../tools/MazeTools';
import {
  cameraActions,
  downloadSnapshot,
  fullscreenAction,
  playbackActions,
  snapshotAction,
  useStageFullscreen,
} from '../tools/actions';
import { Box as BoxIcon, Eye, RotateCcw, Shuffle, Square } from 'lucide-react';
import { useRideAlong } from '../../maze/rideAlong';
import { RideAlongBar } from '../tools/RideAlongBar';
import { usePrefs } from '../../state/prefs';
import { MazeCanvas, type HostSize } from '../play/MazeCanvas';
import { useKeyboardShortcuts } from '../play/useKeyboardShortcuts';
import { useBreakpoint } from '../../layout/breakpoints';
import { Section } from '../../layout/Section';
import { Workspace } from '../../layout/Workspace';
import { OverlayLegend } from './OverlayLegend';
import { PseudocodePanel } from './PseudocodePanel';
import { currentParams, useAlgoParams } from '../../maze/useAlgoParams';
import { AlgorithmParams } from '../params/ParamFields';
import { SolverPicker } from './SolverPicker';
import { LOG_LIMIT, StepLog, type LogEntry, type LogVerbosity } from './StepLog';
import { WatchStats } from './WatchStats';
import { WatchTransport } from './WatchTransport';

export interface WatchSearch {
  seed?: string;
}

function useOwnedSession(): MazeSession {
  const ref = useRef<MazeSession | null>(null);
  ref.current ??= new MazeSession({ speed: usePrefs.getState().speed });
  useEffect(() => {
    const s = ref.current;
    return () => s?.dispose();
  }, []);
  return ref.current;
}

/** Runs generation to completion synchronously (bounded; each call advances up to 50k steps). */
function drainGeneration(session: MazeSession): void {
  let guard = 0;
  while (session.getSnapshot().phase === 'generating' && guard++ < 1_000) session.runToEnd();
}

/**
 * Watch pillar: a finished maze on the left, the solver's inner workings on the right -
 * pseudo-code with the executing line highlighted, a textual step log, live statistics and a
 * legend for the canvas overlay (proj-mgmt/13 section 4).
 */
export function WatchPage() {
  const session = useOwnedSession();
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const search = useSearch({ from: '/watch' });
  const navigate = useNavigate({ from: '/watch' });
  const prefs = usePrefs();
  const reducedMotion = useReducedMotion();
  const announce = useAnnouncer();
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';

  const [hostSize, setHostSize] = useState<HostSize | null>(null);
  const [viewChoice, setViewChoice] = useState<ViewChoice>('2d');
  const [pullKey, setPullKey] = useState(0);
  const [treeHighlight, setTreeHighlight] = useState<readonly CellId[] | null>(null);
  /** Ride along (WI-10): a first-person camera that follows the solver. */
  const [rideAlong, setRideAlong] = useState(false);
  /** Riding along needs the 3D renderer and the maze (not the tree). */
  const effectiveView: ViewChoice = rideAlong ? '3d' : viewChoice;
  const mode = rendererModeFor(effectiveView, prefs.treeLayout);
  const viewControls = useCameraView(prefs.cameraPreset);
  const { view } = viewControls;
  const [solverId, setSolverId] = useState(() =>
    solvers.has(usePrefs.getState().solverId)
      ? usePrefs.getState().solverId
      : (solvers.ids[0] ?? 'bfs'),
  );
  const [verbosity, setVerbosity] = useState<LogVerbosity>('all');
  const [entries, setEntries] = useState<readonly LogEntry[]>([]);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const seqRef = useRef(0);
  const bufferRef = useRef<LogEntry[]>([]);

  const playerSnap = useStepPlayer(snap.solvePlayer);
  const listing = useMemo(
    () => pseudocodeFor(snap.solverId ?? solverId),
    [snap.solverId, solverId],
  );

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
  const rows = snap.height || 1;
  const gridCellSize = snap.phase === 'empty' ? prefs.cellSize : snap.cellSize;
  const options = useMemo(
    () => ({
      ...buildRenderOptions(prefs, rows, reducedMotion, gridCellSize),
      mode,
      tree: treeOptionsFor(
        effectiveView,
        prefs.treeLayout,
        prefs.treeMorph,
        pullKey,
        treeHighlight,
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      prefs.wallWidth,
      prefs.showProjection,
      prefs.mirror,
      prefs.maxProjectionDepth,
      prefs.projectionUnit,
      prefs.wallHeight,
      prefs.showGrid,
      prefs.showStartGoal,
      rows,
      reducedMotion,
      gridCellSize,
      mode,
      effectiveView,
      prefs.treeLayout,
      prefs.treeMorph,
      pullKey,
      treeHighlight,
    ],
  );
  const camera = useMemo(
    () => buildCamera({ cameraPreset: prefs.cameraPreset, followPointer: false }, view),
    [prefs.cameraPreset, view],
  );

  // ---- generation -----------------------------------------------------------------------
  const resetLog = useCallback(() => {
    seqRef.current = 0;
    bufferRef.current = [];
    setEntries([]);
    setCurrentLine(null);
  }, []);

  const generateWith = useCallback(
    (seed?: string, sameGrid = false) => {
      if (!hostSize) return;
      const current = session.getSnapshot();
      // Regenerate keeps the grid: same seed + same grid = same maze.
      const dims =
        sameGrid && current.phase !== 'empty'
          ? { width: current.width, height: current.height, cellSize: current.cellSize }
          : computeGridDims(hostSize.width, hostSize.height, prefs.cellSize);
      session.generate({
        ...dims,
        ...(seed ? { seed } : {}),
        generatorId: prefs.generatorId,
        params: currentParams(prefs.generatorId),
        autoplay: false,
      });
      drainGeneration(session);
      resetLog();
      const actual = session.getSnapshot().seed;
      if (actual && actual !== search.seed) {
        void navigate({ search: { seed: actual }, replace: true });
      }
    },
    [hostSize, prefs.cellSize, prefs.generatorId, session, resetLog, navigate, search.seed],
  );

  // First maze as soon as the canvas has a size.
  useEffect(() => {
    if (hostSize && snap.phase === 'empty') generateWith(search.seed);
  }, [hostSize, snap.phase, generateWith, search.seed]);

  // Deep link changed to another seed while mounted.
  useEffect(() => {
    if (!hostSize || snap.phase === 'empty') return;
    if (search.seed && search.seed !== session.getSnapshot().seed) generateWith(search.seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.seed]);

  // Arm the chosen solver (paused) whenever the maze is ready and nothing is armed.
  useEffect(() => {
    if (snap.phase === 'ready' && !snap.solvePlayer)
      session.startSolve(solverId, false, currentParams(solverId));
  }, [snap.phase, snap.solvePlayer, solverId, session]);

  useEffect(() => {
    session.setSpeed(prefs.speed);
  }, [session, prefs.speed]);

  useEffect(() => {
    if (snap.statusSeq > 0 && snap.status) announce(snap.status);
  }, [snap.statusSeq, snap.status, announce]);

  // Fold solver steps into the log and the pseudo-code highlight.
  useEffect(() => {
    const player = snap.solvePlayer;
    const grid = snap.state?.grid;
    if (!player || !grid) return;
    const pseudo = pseudocodeFor(snap.solverId);
    // A rewind replays the solve from the start: clear the log so it is rebuilt from the replay.
    const offReset = player.onReset(() => {
      seqRef.current = 0;
      bufferRef.current = [];
      setEntries([]);
      setCurrentLine(null);
    });
    const offSteps = player.subscribe((batch) => {
      const slice = batch.length > LOG_LIMIT ? batch.slice(-LOG_LIMIT) : batch;
      const base = seqRef.current + batch.length - slice.length;
      const buf = bufferRef.current;
      slice.forEach((step, i) => {
        buf.push({ seq: base + i + 1, kind: step.t, text: describeSolveStep(grid, step) });
      });
      seqRef.current += batch.length;
      if (buf.length > LOG_LIMIT) buf.splice(0, buf.length - LOG_LIMIT);
      setEntries([...buf]);
      const last = batch[batch.length - 1];
      if (last) setCurrentLine(pseudo.stepToLine(last));
    });
    return () => {
      offReset();
      offSteps();
    };
  }, [snap.solvePlayer, snap.solverId, snap.state]);

  // ---- actions --------------------------------------------------------------------------
  const onHostSize = useCallback((size: HostSize) => {
    setHostSize((prev) =>
      prev && Math.abs(prev.width - size.width) < 1 && Math.abs(prev.height - size.height) < 1
        ? prev
        : size,
    );
  }, []);

  const onCameraChange = useCallback(
    (c: CameraState) => {
      viewControls.fromCamera(c);
    },
    [viewControls],
  );

  const changeSolver = useCallback(
    (id: string) => {
      setSolverId(id);
      prefs.set('solverId', id);
      session.clearSolve();
      resetLog();
    },
    [prefs, session, resetLog],
  );

  const resetSolver = useCallback(() => {
    session.clearSolve();
    resetLog();
  }, [session, resetLog]);

  // Changing a solver parameter re-arms the solve with the new values (paused at step 0).
  // Switching solvers already re-arms (changeSolver), so only same-solver edits count.
  const solverParamsKey = JSON.stringify(useAlgoParams(solverId).values);
  const lastParams = useRef({ solverId, key: solverParamsKey });
  useEffect(() => {
    const last = lastParams.current;
    lastParams.current = { solverId, key: solverParamsKey };
    if (last.solverId === solverId && last.key !== solverParamsKey) resetSolver();
  }, [solverId, solverParamsKey, resetSolver]);

  const armed = snap.phase === 'ready' && snap.solvePlayer !== null;
  const ride = useRideAlong({
    session,
    enabled: rideAlong && armed,
    status: playerSnap?.status ?? null,
    stepCount: playerSnap?.stepCount ?? 0,
    grid: snap.state?.grid ?? null,
    path: snap.solveResult?.path ?? null,
    solverName: solvers.get(snap.solverId ?? solverId)?.meta.name ?? solverId,
    reducedMotion,
    announce,
  });

  // ---- maze tools -------------------------------------------------------------------------
  const rendererRef = useRef<Renderer | null>(null);
  const onRenderer = useCallback((r: Renderer | null) => {
    rendererRef.current = r;
  }, []);
  const fullscreen = useStageFullscreen();
  const takeSnapshot = useCallback(() => {
    const url = rendererRef.current?.toDataURL() ?? '';
    announce(
      downloadSnapshot(url, `maze-${snap.seed || 'lab'}-${snap.solverId ?? 'solve'}.png`)
        ? 'Picture saved.'
        : 'Could not save a picture.',
    );
  }, [snap.seed, snap.solverId, announce]);
  const toolGroups: ToolGroup[] = [
    {
      id: 'playback',
      label: 'Playback',
      actions: playbackActions({
        status: playerSnap?.status ?? null,
        armed,
        canStepBack: armed && (playerSnap?.stepCount ?? 0) > 0,
        onToggle: () => {
          session.toggle();
        },
        onStepBack: () => {
          session.stepBack();
        },
        onStep: () => {
          session.step();
        },
        onRunToEnd: () => {
          session.runToEnd();
        },
      }),
    },
    {
      id: 'ride',
      label: 'Ride along',
      actions: [
        {
          id: 'ride-along',
          label: rideAlong ? 'Stop riding along' : 'Ride along with the solver (first person)',
          keys: 'R',
          icon: Eye,
          onPress: () => {
            setRideAlong((r) => !r);
          },
          pressed: rideAlong,
          disabled: !armed,
        },
      ],
    },
    {
      id: 'maze',
      label: 'Maze',
      actions: [
        {
          id: 'reset-solver',
          label: 'Reset the solver on this maze',
          icon: RotateCcw,
          onPress: resetSolver,
          disabled: !armed,
        },
        {
          id: 'new-maze',
          label: 'New maze',
          keys: 'N',
          icon: Shuffle,
          onPress: () => {
            generateWith(randomSeed());
          },
        },
        {
          id: 'switch-view',
          label: mode === '3d' && viewChoice !== 'tree' ? 'Switch to 2D' : 'Switch to 3D',
          icon: mode === '3d' && viewChoice !== 'tree' ? Square : BoxIcon,
          onPress: () => {
            setRideAlong(false);
            setViewChoice(mode === '3d' && viewChoice !== 'tree' ? '2d' : '3d');
          },
        },
      ],
    },
    // Camera moves do nothing in first person; hide them while riding along.
    { id: 'camera', label: 'Camera', actions: rideAlong ? [] : cameraActions(mode, viewControls) },
    {
      id: 'share',
      label: 'Picture and full screen',
      actions: [snapshotAction(takeSnapshot, !snap.state), ...fullscreenAction(fullscreen)],
    },
  ];

  useKeyboardShortcuts({
    onKeyDown: (e) => {
      switch (e.key) {
        case ' ':
          if (armed) {
            e.preventDefault();
            session.toggle();
          }
          break;
        case '.':
          if (armed) session.step();
          break;
        case ',':
          if (armed) session.stepBack();
          break;
        case 'Home':
          if (armed) {
            e.preventDefault();
            session.restart();
          }
          break;
        case 'n':
        case 'N':
          generateWith(randomSeed());
          break;
        case 'r':
        case 'R':
          if (armed) setRideAlong((r) => !r);
          break;
        case 'Escape':
          setRideAlong(false);
          break;
        default:
          if (!rideAlong && handleViewKey(e.key, mode, viewControls)) e.preventDefault();
          break;
      }
    },
  });

  const solverName = snap.solverId
    ? (solvers.get(snap.solverId)?.meta.name ?? snap.solverId)
    : null;
  const canvasLabel =
    snap.phase === 'empty'
      ? 'Maze canvas, waiting to generate'
      : `Maze canvas: ${snap.width} by ${snap.height} cells${
          solverName ? `, ${solverName} ${playerSnap?.status ?? 'ready'}` : ''
        }${ride.firstPerson ? ', riding along in first person' : ''}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Watch</h1>
      <WatchTransport
        status={playerSnap?.status ?? null}
        armed={armed}
        onPlayToggle={() => {
          session.toggle();
        }}
        onStep={() => {
          session.step();
        }}
        onStepBack={() => {
          session.stepBack();
        }}
        canStepBack={armed && (playerSnap?.stepCount ?? 0) > 0}
        onRunToEnd={() => {
          session.runToEnd();
        }}
        onReset={resetSolver}
        speed={prefs.speed}
        onSpeedChange={(s) => {
          prefs.set('speed', s);
        }}
        view={viewChoice}
        onViewChange={setViewChoice}
        onNewMaze={() => {
          generateWith(randomSeed());
        }}
        onRegenerate={() => {
          generateWith(snap.seed, true);
        }}
        seed={snap.seed}
      />
      <Workspace
        stageLabel="Maze"
        stage={
          <>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MazeCanvas
                session={session}
                mode={mode}
                theme={theme}
                options={options}
                camera={camera}
                firstPerson={ride.firstPerson}
                maze={snap.state}
                generation={null}
                solve={session.solveTracker}
                label={canvasLabel}
                onHostSize={onHostSize}
                onCameraChange={onCameraChange}
                onRenderer={onRenderer}
                pageScroll={touchLayout}
              />
              {touchLayout ? null : <MazeTools variant="floating" groups={toolGroups} />}
            </div>
            {touchLayout ? <MazeTools variant="row" groups={toolGroups} /> : null}
            {ride.firstPerson ? (
              <RideAlongBar
                statusText={ride.statusText}
                onStop={() => {
                  setRideAlong(false);
                }}
              />
            ) : null}
            {effectiveView === 'tree' ? (
              <TreeControls
                layout={prefs.treeLayout}
                onLayoutChange={(l) => {
                  prefs.set('treeLayout', l);
                }}
                morph={prefs.treeMorph}
                onMorphChange={(m) => {
                  prefs.set('treeMorph', m);
                }}
                onPull={() => {
                  if (prefs.treeMorph < 0.5) prefs.set('treeMorph', 1);
                  setPullKey((k) => k + 1);
                }}
              />
            ) : null}
            <TimelineBar
              snapshot={armed ? playerSnap : null}
              label="Solve"
              onSeek={(n) => {
                session.seek(n);
              }}
              onRestart={() => {
                session.restart();
              }}
            />
          </>
        }
        left={
          <Section
            id="watch-solver"
            title="Solver"
            summary={solvers.get(solverId)?.meta.name}
            defaultOpen={bp === 'wide'}
          >
            {/* The chosen solver's parameters sit above the (long) list so they stay in view. */}
            <AlgorithmParams
              algorithmId={solverId}
              className="mb-4 flex flex-col gap-3 border-b border-border pb-4"
            />
            <SolverPicker value={solverId} onChange={changeSolver} hideHeading />
          </Section>
        }
        side={
          <>
            {viewChoice === 'tree' ? (
              <Section id="watch-tree" title="Tree" summary="corridors and forks">
                <TreeOutline
                  maze={snap.phase === 'ready' ? snap.state : null}
                  onHighlight={setTreeHighlight}
                />
              </Section>
            ) : null}
            <Section id="watch-stats" title="Statistics">
              <WatchStats
                snap={snap}
                tracker={session.solveTracker}
                player={playerSnap}
                hideHeading
              />
            </Section>
            <Section id="watch-pseudocode" title="Pseudo-code" summary={listing.title}>
              <PseudocodePanel listing={listing} currentLine={currentLine} hideHeading />
            </Section>
            <Section id="watch-steplog" title="Step log" defaultOpen={!touchLayout}>
              <StepLog
                entries={entries}
                verbosity={verbosity}
                onVerbosityChange={setVerbosity}
                hideHeading
              />
            </Section>
            <Section id="watch-legend" title="Legend" defaultOpen={bp !== 'mobile'}>
              <OverlayLegend theme={theme} hideHeading />
            </Section>
          </>
        }
      />
    </div>
  );
}
