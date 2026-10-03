import { describeSolveStep, randomSeed, solvers } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import type { CameraState, ViewMode } from '@maze/renderer';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAnnouncer } from '../../app/Announcer';
import { useReducedMotion } from '../../app/documentPrefs';
import { pseudocodeFor } from '../../content/pseudocode';
import { computeGridDims } from '../../maze/gridSizing';
import { MazeSession } from '../../maze/session';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { useCameraView } from '../../maze/view';
import { TimelineBar } from '../play/TimelineBar';
import { ViewControls, handleViewKey } from '../play/ViewControls';
import { usePrefs } from '../../state/prefs';
import { MazeCanvas, type HostSize } from '../play/MazeCanvas';
import { useKeyboardShortcuts } from '../play/useKeyboardShortcuts';
import { OverlayLegend } from './OverlayLegend';
import { PseudocodePanel } from './PseudocodePanel';
import { SolverPicker } from './SolverPicker';
import { LOG_LIMIT, StepLog, type LogEntry, type LogVerbosity } from './StepLog';
import { WatchStats } from './WatchStats';
import { WatchTransport } from './WatchTransport';

export interface WatchSearch {
  seed?: string;
}

function useOwnedSession(): MazeSession {
  const ref = useRef<MazeSession | null>(null);
  if (!ref.current) ref.current = new MazeSession({ speed: usePrefs.getState().speed });
  useEffect(() => {
    const s = ref.current;
    return () => s?.dispose();
  }, []);
  return ref.current;
}

/** Runs generation to completion synchronously (bounded; each call advances up to 50k steps). */
export function drainGeneration(session: MazeSession): void {
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

  const [hostSize, setHostSize] = useState<HostSize | null>(null);
  const [mode, setMode] = useState<ViewMode>('2d');
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
    () => ({ ...buildRenderOptions(prefs, rows, reducedMotion, gridCellSize), mode }),
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
    (seed?: string) => {
      if (!hostSize) return;
      const dims = computeGridDims(hostSize.width, hostSize.height, prefs.cellSize);
      session.generate({
        ...dims,
        ...(seed ? { seed } : {}),
        generatorId: prefs.generatorId,
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
    if (snap.phase === 'ready' && !snap.solvePlayer) session.startSolve(solverId, false);
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

  const armed = snap.phase === 'ready' && snap.solvePlayer !== null;

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
        default:
          if (handleViewKey(e.key, mode, viewControls)) e.preventDefault();
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
        }`;

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
        mode={mode}
        onModeChange={setMode}
        onNewMaze={() => {
          generateWith(randomSeed());
        }}
        onRegenerate={() => {
          generateWith(snap.seed || undefined);
        }}
        seed={snap.seed}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-[40vh] flex-1 flex-col">
          <MazeCanvas
            session={session}
            mode={mode}
            theme={theme}
            options={options}
            camera={camera}
            firstPerson={null}
            maze={snap.state}
            generation={null}
            solve={session.solveTracker}
            label={canvasLabel}
            onHostSize={onHostSize}
            onCameraChange={onCameraChange}
          />
          <ViewControls
            mode={mode}
            controls={viewControls}
            className="absolute right-2 bottom-14"
          />
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
        </div>
        <aside
          aria-label="Solver details"
          className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-border bg-panel p-3 lg:w-[26rem] lg:border-t-0 lg:border-l"
        >
          <SolverPicker value={solverId} onChange={changeSolver} />
          <WatchStats snap={snap} tracker={session.solveTracker} player={playerSnap} />
          <PseudocodePanel listing={listing} currentLine={currentLine} />
          <StepLog entries={entries} verbosity={verbosity} onVerbosityChange={setVerbosity} />
          <OverlayLegend theme={theme} />
        </aside>
      </div>
    </div>
  );
}
