import {
  decodeRun,
  describeCell,
  encodeRun,
  randomSeed,
  solvers,
  type RunMove,
  type CellId,
} from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import { CAMERA_PRESETS, type CameraState, type Renderer, type ViewMode } from '@maze/renderer';
import type { DomRenderer } from '@maze/renderer/dom';
import { Button } from '@maze/ui';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ShortcutsDialog } from '../../a11y/ShortcutsDialog';
import { useNarrator } from '../../a11y/useNarrator';
import { useAnnouncer } from '../../app/useAnnouncer';
import { useReducedMotion } from '../../app/documentPrefs';
import { log } from '../../lib/log';
import { useCoarsePointer, useIsNarrow } from '../../lib/useMediaQuery';
import { computeGridDims } from '../../maze/gridSizing';
import { currentParams } from '../../maze/useAlgoParams';
import { MazeSession } from '../../maze/session';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { useCameraView } from '../../maze/view';
import { makeThumbnail, useLibrary, type LibraryItem, type SavedRun } from '../../state/library';
import { usePrefs } from '../../state/prefs';
import { A11yGridHost } from './A11yGridHost';
import { FirstPersonHud } from './FirstPersonHud';
import { LibrarySheet } from './LibrarySheet';
import { MazeCanvas, type HostSize } from './MazeCanvas';
import { MetricsPanel } from './MetricsPanel';
import { OptionsSheet } from './OptionsSheet';
import { PlayToolbar } from './PlayToolbar';
import { SaveDialog } from './SaveDialog';
import { StepLogPanel } from './StepLogPanel';
import { useBreakpoint } from '../../layout/breakpoints';
import { Section } from '../../layout/Section';
import { Workspace } from '../../layout/Workspace';
import { TimelineBar } from './TimelineBar';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { handleViewKey } from './ViewControls';
import { MazeTools, type ToolGroup } from '../tools/MazeTools';
import {
  cameraActions,
  downloadSnapshot,
  fullscreenAction,
  playbackActions,
  snapshotAction,
  useStageFullscreen,
} from '../tools/actions';
import {
  Box as BoxIcon,
  Eye,
  Footprints,
  Navigation,
  Route,
  Shuffle,
  Square,
  Video,
  X,
} from 'lucide-react';
import { RunBar } from './RunBar';
import { useRideAlong } from '../../maze/rideAlong';
import { RideAlongBar } from '../tools/RideAlongBar';
import { rendererModeFor, treeOptionsFor, type ViewChoice } from '../../maze/treeView';
import { TreeControls } from '../tree/TreeControls';
import { TreeOutline } from '../tree/TreeOutline';

/** Saved runs replay at this pace. */
const REPLAY_MOVES_PER_SECOND = 6;

function useMazeSession(): MazeSession {
  const ref = useRef<MazeSession | null>(null);
  ref.current ??= new MazeSession({ speed: usePrefs.getState().speed });
  useEffect(() => {
    const s = ref.current;
    return () => s?.dispose();
  }, []);
  return ref.current;
}

export function PlayPage() {
  const session = useMazeSession();
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const prefs = usePrefs();
  const addToLibrary = useLibrary((s) => s.add);
  const addRunToLibrary = useLibrary((s) => s.addRun);
  const reducedMotion = useReducedMotion();
  const coarsePointer = useCoarsePointer();
  const narrowLayout = useIsNarrow();
  const showTouchPad = coarsePointer || narrowLayout;
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';
  const announce = useAnnouncer();

  const [hostSize, setHostSize] = useState<HostSize | null>(null);
  const viewControls = useCameraView(prefs.cameraPreset);
  const { view, resetOrbit } = viewControls;
  const [seedDraft, setSeedDraft] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pullKey, setPullKey] = useState(0);
  const [treeHighlight, setTreeHighlight] = useState<readonly CellId[] | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  /** Ride along (WI-10): a first-person camera that follows the running solver. */
  const [rideAlong, setRideAlong] = useState(false);
  const viewChoice: ViewChoice = rideAlong
    ? '3d'
    : (snap.runView ?? (prefs.treeView ? 'tree' : prefs.mode));
  const rendererMode = rendererModeFor(viewChoice, prefs.treeLayout);
  const a11yRef = useRef<DomRenderer | null>(null);

  const activePlayer = session.activePlayer;
  const playerSnap = useStepPlayer(activePlayer);

  // ---- derived renderer inputs ------------------------------------------------------------
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
      mode: rendererMode,
      tree: treeOptionsFor(viewChoice, prefs.treeLayout, prefs.treeMorph, pullKey, treeHighlight),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      prefs.wallWidth,
      prefs.mode,
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
      rendererMode,
      viewChoice,
      prefs.treeLayout,
      prefs.treeMorph,
      pullKey,
      treeHighlight,
    ],
  );
  const camera = useMemo(
    () =>
      buildCamera({ cameraPreset: prefs.cameraPreset, followPointer: prefs.followPointer }, view),
    [prefs.cameraPreset, prefs.followPointer, view],
  );

  // ---- session wiring ---------------------------------------------------------------------
  useEffect(() => {
    session.setSpeed(prefs.speed);
  }, [session, prefs.speed]);

  // Narration: session statuses and (depending on verbosity) algorithm steps reach the live
  // region or, while the step log is open, the log itself. Statuses are never announced twice.
  const { narrator, log: narrationLog } = useNarrator({
    snap,
    verbosity: prefs.narratorVerbosity,
    logIsLive: prefs.showStepLog,
    announce,
  });

  useEffect(() => {
    setSeedDraft(snap.seed);
  }, [snap.seed]);

  const generate = useCallback(
    (seed?: string, sameGrid = false) => {
      if (!hostSize) return;
      const current = session.getSnapshot();
      // "Regenerate same seed" keeps the grid too: same seed + same grid = same maze, even
      // after the window (or the metrics strip) changed the canvas size.
      const dims =
        sameGrid && current.phase !== 'empty'
          ? { width: current.width, height: current.height, cellSize: current.cellSize }
          : computeGridDims(hostSize.width, hostSize.height, prefs.cellSize);
      log('generate', dims, seed);
      session.generate({
        ...dims,
        ...(seed ? { seed } : {}),
        generatorId: prefs.generatorId,
        params: currentParams(prefs.generatorId),
      });
    },
    [hostSize, prefs.cellSize, prefs.generatorId, session],
  );

  // Legacy auto-start: generate as soon as the canvas has a size.
  useEffect(() => {
    if (hostSize && snap.phase === 'empty') generate();
  }, [hostSize, snap.phase, generate]);

  // Legacy: changing the cell size rebuilds the maze (same seed).
  const lastCellSize = useRef(prefs.cellSize);
  useEffect(() => {
    if (lastCellSize.current === prefs.cellSize) return;
    lastCellSize.current = prefs.cellSize;
    if (snap.phase !== 'empty' && snap.seed) generate(snap.seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.cellSize]);

  const needsRefit = useMemo(() => {
    if (!hostSize || snap.phase === 'empty') return false;
    const dims = computeGridDims(hostSize.width, hostSize.height, snap.cellSize);
    return dims.width !== snap.width || dims.height !== snap.height;
  }, [hostSize, snap.phase, snap.cellSize, snap.width, snap.height]);

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

  const onRenderer = useCallback((r: Renderer | null) => {
    rendererRef.current = r;
  }, []);

  const onA11yRenderer = useCallback((r: DomRenderer | null) => {
    a11yRef.current = r;
  }, []);

  const focusA11yGrid = useCallback(() => {
    const grid = a11yRef.current;
    if (!grid) {
      announce('The screen-reader grid is turned off. Enable it in Options.');
      return;
    }
    grid.focusCell(grid.getFocusedCell());
  }, [announce]);

  const onCellClick = useCallback(
    (cell: number | null) => {
      if (cell === null || !snap.state) return;
      announce(describeCell(snap.state, cell));
    },
    [snap.state, announce],
  );

  const setMode = useCallback(
    (mode: ViewMode) => {
      if (mode === '2d' && session.getSnapshot().firstPerson) session.exitFirstPerson();
      prefs.patch({ mode, treeView: false });
    },
    [prefs, session],
  );

  const setView = useCallback(
    (next: ViewChoice) => {
      if (next !== 'tree') {
        setMode(next);
        return;
      }
      if (session.getSnapshot().firstPerson) session.exitFirstPerson();
      prefs.set('treeView', true);
      announce('Tree view: the maze pulled out into the tree it is. Start at the root.');
    },
    [prefs, session, setMode, announce],
  );

  // Riding along ends with the solve it follows.
  useEffect(() => {
    if (!snap.solvePlayer) setRideAlong(false);
  }, [snap.solvePlayer]);
  const ride = useRideAlong({
    session,
    enabled: rideAlong && snap.solvePlayer !== null,
    status: snap.solvePlayer ? snap.solvePlayer.getSnapshot().status : null,
    stepCount: snap.solvePlayer ? (playerSnap?.stepCount ?? 0) : 0,
    grid: snap.state?.grid ?? null,
    path: snap.solveResult?.path ?? null,
    solverName: solvers.get(snap.solverId ?? prefs.solverId)?.meta.name ?? prefs.solverId,
    reducedMotion,
    announce,
  });

  const toggleFirstPerson = useCallback(() => {
    setRideAlong(false);
    if (session.getSnapshot().firstPerson) {
      session.exitFirstPerson();
      return;
    }
    if (prefs.mode !== '3d' || prefs.treeView) prefs.patch({ mode: '3d', treeView: false });
    if (session.enterFirstPerson()) {
      document.querySelector<HTMLElement>('[data-testid="maze-canvas-host"]')?.focus();
    }
  }, [prefs, session]);

  /** Walk the maze top-down (2D) with arrows, WASD, swipes or the D-pad. */
  const toggleWalk2d = useCallback(() => {
    setRideAlong(false);
    if (session.getSnapshot().firstPerson) {
      session.exitFirstPerson();
      return;
    }
    if (session.enterRun('2d')) {
      document.querySelector<HTMLElement>('[data-testid="maze-canvas-host"]')?.focus();
    }
  }, [session]);

  const saveRun = useCallback(async () => {
    const s = session.getSnapshot();
    if (!s.run || !s.runSummary || !s.runView) return;
    const name = s.sourceName ?? `Maze ${String(s.width)}x${String(s.height)} ${s.seed}`;
    const doc = await session.save(name);
    const dataUrl = rendererRef.current?.toDataURL();
    const thumbnail = dataUrl ? await makeThumbnail(dataUrl) : undefined;
    addRunToLibrary({
      name,
      document: doc,
      ...(thumbnail ? { thumbnail } : {}),
      run: {
        moves: encodeRun(s.run),
        view: s.runView,
        timeMs: s.runSummary.timeMs,
        moveCount: s.runSummary.moves,
        optimalMoves: s.runSummary.optimalMoves,
        hints: s.runSummary.hints,
        undos: s.runSummary.undos,
      },
    });
    announce(`Run saved to the library with "${name}".`);
  }, [session, addRunToLibrary, announce]);

  const replayRun = useCallback(
    (item: LibraryItem, saved: SavedRun) => {
      session.loadDocument(item.document, item.name);
      try {
        session.startReplay(decodeRun(saved.moves), saved.view);
      } catch {
        announce('That saved run could not be read.');
      }
    },
    [session, announce],
  );

  // Replays advance a few moves per second.
  useEffect(() => {
    if (!snap.runReplay) return;
    const id = setInterval(() => {
      if (!session.replayTick()) clearInterval(id);
    }, 1000 / REPLAY_MOVES_PER_SECOND);
    return () => {
      clearInterval(id);
    };
  }, [snap.runReplay, session]);

  const cycleCamera = useCallback(() => {
    const i = CAMERA_PRESETS.indexOf(prefs.cameraPreset);
    const next = CAMERA_PRESETS[(i + 1) % CAMERA_PRESETS.length] ?? 'tilt';
    prefs.set('cameraPreset', next);
    resetOrbit();
    announce(`Camera: ${next}`);
  }, [prefs, announce, resetOrbit]);

  const copySeed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snap.seed);
      announce('Seed copied to clipboard.');
    } catch {
      announce('Could not copy the seed.');
    }
  }, [snap.seed, announce]);

  const saveMaze = useCallback(
    async (name: string) => {
      const doc = await session.save(name);
      const dataUrl = rendererRef.current?.toDataURL();
      const thumbnail = dataUrl ? await makeThumbnail(dataUrl) : undefined;
      addToLibrary({ name, document: doc, ...(thumbnail ? { thumbnail } : {}) });
      announce(`Saved "${name}" to the library.`);
    },
    [session, addToLibrary, announce],
  );

  const loadItem = useCallback(
    (item: LibraryItem) => {
      session.loadDocument(item.document, item.name);
    },
    [session],
  );

  const runClock = useCallback(() => session.clock(), [session]);

  // ---- maze tools ---------------------------------------------------------------------------
  const fullscreen = useStageFullscreen();
  const takeSnapshot = useCallback(() => {
    const url = rendererRef.current?.toDataURL() ?? '';
    announce(
      downloadSnapshot(url, `maze-${snap.seed || 'lab'}.png`)
        ? 'Picture saved.'
        : 'Could not save a picture.',
    );
  }, [snap.seed, announce]);
  const solverName = solvers.get(prefs.solverId)?.meta.name ?? prefs.solverId;
  const toolGroups: ToolGroup[] = [
    {
      id: 'playback',
      label:
        activePlayer !== null && activePlayer === snap.solvePlayer ? 'Solve playback' : 'Playback',
      actions: playbackActions({
        status: playerSnap?.status ?? null,
        armed: activePlayer !== null,
        canStepBack: (playerSnap?.stepCount ?? 0) > 0,
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
      id: 'solve',
      label: 'Solve',
      actions: [
        snap.solvePlayer
          ? {
              id: 'clear-solve',
              label: 'Clear solve',
              icon: X,
              onPress: () => {
                session.clearSolve();
              },
            }
          : {
              id: 'solve',
              label: `Solve with ${solverName}`,
              icon: Route,
              onPress: () => {
                session.startSolve(prefs.solverId, true, currentParams(prefs.solverId));
              },
              disabled: snap.phase !== 'ready',
            },
        ...(snap.solvePlayer
          ? [
              {
                id: 'ride-along',
                label: rideAlong
                  ? 'Stop riding along'
                  : 'Ride along with the solver (first person)',
                icon: Eye,
                onPress: () => {
                  if (!rideAlong && session.getSnapshot().firstPerson) session.exitFirstPerson();
                  setRideAlong((r) => !r);
                },
                pressed: rideAlong,
              },
            ]
          : []),
      ],
    },
    {
      id: 'maze',
      label: 'Maze',
      actions: [
        {
          id: 'new-maze',
          label: 'New maze',
          keys: 'N',
          icon: Shuffle,
          onPress: () => {
            generate();
          },
        },
        {
          id: 'run-maze',
          label: 'Run the maze in first person',
          keys: 'R',
          icon: Footprints,
          onPress: toggleFirstPerson,
          disabled: snap.phase !== 'ready',
        },
        {
          id: 'walk-2d',
          label: 'Walk the maze from above (2D game)',
          keys: 'K',
          icon: Navigation,
          onPress: toggleWalk2d,
          disabled: snap.phase !== 'ready',
        },
        {
          id: 'switch-view',
          label: rendererMode === '3d' && viewChoice !== 'tree' ? 'Switch to 2D' : 'Switch to 3D',
          keys: 'T',
          icon: rendererMode === '3d' && viewChoice !== 'tree' ? Square : BoxIcon,
          onPress: () => {
            setMode(rendererMode === '3d' && viewChoice !== 'tree' ? '2d' : '3d');
          },
        },
      ],
    },
    {
      id: 'camera',
      label: 'Camera',
      // Camera moves do nothing in first person; hide them while riding along.
      actions: rideAlong
        ? []
        : [
            ...cameraActions(rendererMode, viewControls),
            ...(rendererMode === '3d' && viewChoice !== 'tree'
              ? [
                  {
                    id: 'cycle-camera',
                    label: 'Next camera angle',
                    keys: 'V',
                    icon: Video,
                    onPress: cycleCamera,
                  },
                ]
              : []),
          ],
    },
    {
      id: 'share',
      label: 'Picture and full screen',
      actions: [snapshotAction(takeSnapshot, !snap.state), ...fullscreenAction(fullscreen)],
    },
  ];

  // ---- keyboard ---------------------------------------------------------------------------
  useKeyboardShortcuts({
    onKeyDown: (e) => {
      // The screen-reader grid handles its own arrows/I and marks the event as handled.
      if (e.defaultPrevented) return;
      const fp = session.getSnapshot().firstPerson;
      if (e.key === 'Escape') {
        if (fp) {
          e.preventDefault();
          session.exitFirstPerson();
        }
        return;
      }
      if (fp && snap.runReplay) {
        if (e.key === ' ') {
          e.preventDefault();
          session.stopReplay();
        }
        return;
      }
      if (fp) {
        switch (e.key) {
          case 'u':
          case 'Backspace':
            e.preventDefault();
            session.runUndo();
            return;
          case 'U':
            e.preventDefault();
            session.runRedo();
            return;
          case 'h':
          case 'H':
            e.preventDefault();
            session.runHint();
            return;
          default:
            break;
        }
      }
      if (fp && snap.runView === '2d') {
        const compass: Record<string, RunMove> = {
          ArrowUp: 'N',
          w: 'N',
          W: 'N',
          ArrowRight: 'E',
          d: 'E',
          D: 'E',
          ArrowDown: 'S',
          s: 'S',
          S: 'S',
          ArrowLeft: 'W',
          a: 'W',
          A: 'W',
        };
        const m = compass[e.key];
        if (m) {
          e.preventDefault();
          session.runMove(m);
          return;
        }
        if (e.key === 'i' || e.key === 'I') {
          const text = session.describeCurrentCell();
          if (text) announce(text);
          return;
        }
      }
      if (fp && snap.runView !== '2d') {
        switch (e.key) {
          case 'ArrowUp':
          case 'w':
          case 'W':
            e.preventDefault();
            session.fpForward();
            return;
          case 'ArrowDown':
          case 's':
          case 'S':
            e.preventDefault();
            session.fpBackward();
            return;
          case 'ArrowLeft':
          case 'a':
          case 'A':
          case 'q':
          case 'Q':
            e.preventDefault();
            session.fpTurnLeft();
            return;
          case 'ArrowRight':
          case 'd':
          case 'D':
          case 'e':
          case 'E':
            e.preventDefault();
            session.fpTurnRight();
            return;
          case 'p':
          case 'P':
            e.preventDefault();
            session.setPeek(true);
            return;
          case 'i':
          case 'I': {
            const text = session.describeCurrentCell();
            if (text) announce(text);
            return;
          }
          default:
            break;
        }
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          session.toggle();
          break;
        case '.':
          session.step();
          break;
        case ',':
          session.stepBack();
          break;
        case 'Home':
          e.preventDefault();
          session.restart();
          break;
        case 'End':
          e.preventDefault();
          session.runToEnd();
          break;
        case 'n':
        case 'N':
          generate();
          break;
        case 'v':
        case 'V':
          if (rendererMode === '3d') cycleCamera();
          break;
        case 'f':
        case 'F':
          if (rendererMode === '3d') prefs.set('followPointer', !prefs.followPointer);
          break;
        case 't':
        case 'T':
          setMode(prefs.treeView ? prefs.mode : prefs.mode === '3d' ? '2d' : '3d');
          break;
        case 'y':
        case 'Y':
          setView(prefs.treeView ? prefs.mode : 'tree');
          break;
        case 'r':
        case 'R':
          toggleFirstPerson();
          break;
        case 'k':
        case 'K':
          toggleWalk2d();
          break;
        case 'o':
        case 'O':
          setOptionsOpen(true);
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          focusA11yGrid();
          break;
        case 'l':
        case 'L':
          prefs.set('showStepLog', !prefs.showStepLog);
          break;
        case '?':
          setShortcutsOpen(true);
          break;
        default:
          if (!fp && handleViewKey(e.key, rendererMode, viewControls)) e.preventDefault();
          break;
      }
    },
    onKeyUp: (e) => {
      if (e.key === 'p' || e.key === 'P') session.setPeek(false);
    },
  });

  // ---- render -----------------------------------------------------------------------------
  const canvasLabel =
    snap.phase === 'empty'
      ? 'Maze canvas, waiting to generate'
      : `Maze canvas: ${snap.width} by ${snap.height} cells, ${snap.phase === 'generating' ? 'generation in progress' : 'complete'}${snap.firstPerson ? ', first-person mode' : ''}${viewChoice === 'tree' ? ', shown as a tree' : ''}${ride.firstPerson ? ', riding along with the solver in first person' : ''}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Play</h1>
      <PlayToolbar
        phase={snap.phase}
        playerStatus={playerSnap?.status ?? null}
        seed={seedDraft}
        onSeedChange={setSeedDraft}
        onGenerate={() => {
          generate();
        }}
        onRegenerate={() => {
          // Same grid, current generator and parameters; the typed seed, else the current one.
          generate(seedDraft.trim() || snap.seed, true);
        }}
        onRandomSeed={() => {
          generate(randomSeed());
        }}
        onCopySeed={() => void copySeed()}
        generatorId={prefs.generatorId}
        onGeneratorChange={(id) => {
          prefs.set('generatorId', id);
        }}
        onPlayToggle={() => {
          session.toggle();
        }}
        onStepBack={() => {
          session.stepBack();
        }}
        canStepBack={(playerSnap?.stepCount ?? 0) > 0}
        onStep={() => {
          session.step();
        }}
        onRunToEnd={() => {
          session.runToEnd();
        }}
        speed={prefs.speed}
        onSpeedChange={(s) => {
          prefs.set('speed', s);
        }}
        mode={rendererMode}
        view={viewChoice}
        onViewChange={setView}
        cameraPreset={prefs.cameraPreset}
        onCameraPresetChange={(c) => {
          prefs.set('cameraPreset', c);
          resetOrbit();
        }}
        followPointer={prefs.followPointer}
        onFollowPointerChange={(v) => {
          prefs.set('followPointer', v);
        }}
        solverId={prefs.solverId}
        onSolverChange={(id) => {
          prefs.set('solverId', id);
        }}
        onSolve={() => session.startSolve(prefs.solverId, true, currentParams(prefs.solverId))}
        onClearSolve={() => {
          session.clearSolve();
        }}
        canSolve={snap.phase === 'ready'}
        solveActive={snap.solvePlayer !== null}
        firstPerson={snap.firstPerson !== null}
        onFirstPersonToggle={toggleFirstPerson}
        canSave={snap.phase === 'ready'}
        onSave={() => {
          setSaveOpen(true);
        }}
        onOpenLibrary={() => {
          setLibraryOpen(true);
        }}
        onOpenOptions={() => {
          setOptionsOpen(true);
        }}
      />

      <Workspace
        stageLabel="Maze"
        stage={
          <>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MazeCanvas
                session={session}
                mode={rendererMode}
                theme={theme}
                options={options}
                camera={camera}
                firstPerson={ride.firstPerson ?? snap.firstPerson}
                maze={snap.state}
                generation={session.generation}
                solve={session.hintTracker ?? session.solveTracker}
                label={canvasLabel}
                onHostSize={onHostSize}
                onCameraChange={onCameraChange}
                onCellClick={onCellClick}
                onRenderer={onRenderer}
                pageScroll={touchLayout && snap.runView !== '2d'}
                {...(snap.runView === '2d' && !snap.runReplay
                  ? {
                      onSwipe: (dir: 'N' | 'E' | 'S' | 'W') => {
                        session.runMove(dir);
                      },
                    }
                  : {})}
              />
              {snap.firstPerson || touchLayout ? null : (
                <MazeTools variant="floating" groups={toolGroups} />
              )}
              {needsRefit && !snap.firstPerson ? (
                <div className="absolute top-2 right-2 left-2 flex items-center justify-between gap-2 rounded-md border border-border bg-panel/95 px-3 py-1.5 text-xs shadow sm:top-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:justify-start">
                  <span className="hidden sm:inline">
                    The window changed size. The maze keeps its shape; regenerate to refit.
                  </span>
                  <span className="sm:hidden">Screen size changed.</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      generate(snap.seed);
                    }}
                  >
                    Regenerate to refit
                  </Button>
                </div>
              ) : null}
              {snap.sourceName && snap.phase === 'ready' ? (
                <div className="absolute top-3 left-3 rounded-md border border-border bg-panel/95 px-2 py-1 text-xs shadow">
                  Loaded: <strong>{snap.sourceName}</strong>
                </div>
              ) : null}
              {snap.firstPerson && snap.state && snap.runView !== '2d' ? (
                <FirstPersonHud
                  state={snap.state}
                  firstPerson={snap.firstPerson}
                  reachedGoal={snap.reachedGoal}
                  onExit={() => {
                    session.exitFirstPerson();
                  }}
                  showPad={showTouchPad}
                  onForward={() => {
                    session.fpForward();
                  }}
                  onBackward={() => {
                    session.fpBackward();
                  }}
                  onTurnLeft={() => {
                    session.fpTurnLeft();
                  }}
                  onTurnRight={() => {
                    session.fpTurnRight();
                  }}
                  onPeekChange={(peek) => {
                    session.setPeek(peek);
                  }}
                />
              ) : null}
              {prefs.screenReaderGrid ? (
                <A11yGridHost
                  session={session}
                  theme={theme}
                  options={options}
                  firstPerson={snap.firstPerson}
                  maze={snap.state}
                  generation={session.generation}
                  solve={session.solveTracker}
                  onDescribe={(text) => {
                    announce(text);
                  }}
                  onRenderer={onA11yRenderer}
                />
              ) : null}
            </div>
            {touchLayout && !snap.firstPerson ? (
              <MazeTools variant="row" groups={toolGroups} />
            ) : null}
            {snap.run && snap.runView ? (
              <RunBar
                run={snap.run}
                view={snap.runView}
                startedAt={snap.runStartedAt}
                finishedAt={snap.runFinishedAt}
                clock={runClock}
                optimalMoves={snap.metrics?.solutionLength ?? null}
                hints={snap.runHints}
                undos={snap.runUndos}
                summary={snap.runSummary}
                replaying={snap.runReplay}
                showPad={showTouchPad}
                onMove={(m) => {
                  session.runMove(m);
                }}
                onUndo={() => {
                  session.runUndo();
                }}
                onRedo={() => {
                  session.runRedo();
                }}
                onSeek={(n) => {
                  session.runSeek(n);
                }}
                onHint={() => {
                  session.runHint();
                }}
                onRestart={() => {
                  session.restartRun();
                }}
                onExit={() => {
                  session.exitFirstPerson();
                }}
                onSave={() => void saveRun()}
                onStopReplay={() => {
                  session.stopReplay();
                }}
              />
            ) : null}
            {ride.firstPerson ? (
              <RideAlongBar
                statusText={ride.statusText}
                onStop={() => {
                  setRideAlong(false);
                }}
              />
            ) : null}
            {viewChoice === 'tree' ? (
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
              snapshot={playerSnap}
              label={
                activePlayer !== null && activePlayer === snap.solvePlayer ? 'Solve' : 'Generation'
              }
              onSeek={(n) => {
                session.seek(n);
              }}
              onRestart={() => {
                session.restart();
              }}
            />
          </>
        }
        side={
          <>
            {viewChoice === 'tree' ? (
              <Section id="play-tree" title="Tree" summary="corridors and forks">
                <TreeOutline
                  maze={snap.phase === 'ready' ? snap.state : null}
                  onHighlight={setTreeHighlight}
                />
              </Section>
            ) : null}
            <Section id="play-metrics" title="Metrics" defaultOpen={bp !== 'mobile'}>
              <MetricsPanel session={session} snap={snap} layout="tiles" />
            </Section>
            {prefs.showStepLog ? (
              <StepLogPanel
                entries={narrationLog}
                verbosity={prefs.narratorVerbosity}
                onVerbosityChange={(v) => {
                  prefs.set('narratorVerbosity', v);
                }}
                onClose={() => {
                  prefs.set('showStepLog', false);
                }}
                onClear={() => {
                  narrator.clearLog();
                }}
              />
            ) : null}
          </>
        }
      />

      <OptionsSheet
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        hostWidth={hostSize?.width ?? 1280}
        rows={rows}
      />
      <LibrarySheet
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onLoad={loadItem}
        onReplay={replayRun}
      />
      <SaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultName={snap.sourceName ?? `Maze ${snap.width}x${snap.height} ${snap.seed}`}
        onSave={saveMaze}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
