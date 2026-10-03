import { describeCell, randomSeed } from '@maze/core';
import { useStepPlayer } from '@maze/player/react';
import { CAMERA_PRESETS, type CameraState, type Renderer, type ViewMode } from '@maze/renderer';
import type { DomRenderer } from '@maze/renderer/dom';
import { Button } from '@maze/ui';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ShortcutsDialog } from '../../a11y/ShortcutsDialog';
import { useNarrator } from '../../a11y/useNarrator';
import { useAnnouncer } from '../../app/Announcer';
import { useReducedMotion } from '../../app/documentPrefs';
import { log } from '../../lib/log';
import { useCoarsePointer, useIsNarrow } from '../../lib/useMediaQuery';
import { computeGridDims } from '../../maze/gridSizing';
import { MazeSession } from '../../maze/session';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { useCameraView } from '../../maze/view';
import { makeThumbnail, useLibrary, type LibraryItem } from '../../state/library';
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
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { ViewControls, handleViewKey } from './ViewControls';

function useMazeSession(): MazeSession {
  const ref = useRef<MazeSession | null>(null);
  if (!ref.current) ref.current = new MazeSession({ speed: usePrefs.getState().speed });
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
  const reducedMotion = useReducedMotion();
  const coarsePointer = useCoarsePointer();
  const narrowLayout = useIsNarrow();
  const showTouchPad = coarsePointer || narrowLayout;
  const announce = useAnnouncer();

  const [hostSize, setHostSize] = useState<HostSize | null>(null);
  const viewControls = useCameraView(prefs.cameraPreset);
  const { view, resetOrbit } = viewControls;
  const [seedDraft, setSeedDraft] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const rendererRef = useRef<Renderer | null>(null);
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
    () => buildRenderOptions(prefs, rows, reducedMotion, gridCellSize),
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
    (seed?: string) => {
      if (!hostSize) return;
      const dims = computeGridDims(hostSize.width, hostSize.height, prefs.cellSize);
      log('generate', dims, seed);
      session.generate({
        ...dims,
        ...(seed ? { seed } : {}),
        generatorId: prefs.generatorId,
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
      prefs.set('mode', mode);
    },
    [prefs, session],
  );

  const toggleFirstPerson = useCallback(() => {
    if (session.getSnapshot().firstPerson) {
      session.exitFirstPerson();
      return;
    }
    if (prefs.mode !== '3d') prefs.set('mode', '3d');
    if (session.enterFirstPerson()) {
      document.querySelector<HTMLElement>('[data-testid="maze-canvas-host"]')?.focus();
    }
  }, [prefs, session]);

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
      if (fp) {
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
        case 'n':
        case 'N':
          generate();
          break;
        case 'v':
        case 'V':
          if (prefs.mode === '3d') cycleCamera();
          break;
        case 'f':
        case 'F':
          if (prefs.mode === '3d') prefs.set('followPointer', !prefs.followPointer);
          break;
        case 't':
        case 'T':
          setMode(prefs.mode === '3d' ? '2d' : '3d');
          break;
        case 'r':
        case 'R':
          toggleFirstPerson();
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
          if (!fp && handleViewKey(e.key, prefs.mode, viewControls)) e.preventDefault();
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
      : `Maze canvas: ${snap.width} by ${snap.height} cells, ${snap.phase === 'generating' ? 'generation in progress' : 'complete'}${snap.firstPerson ? ', first-person mode' : ''}`;

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
          if (seedDraft.trim()) generate(seedDraft.trim());
          else session.regenerate();
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
        mode={prefs.mode}
        onModeChange={setMode}
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
        onSolve={() => session.startSolve(prefs.solverId)}
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <MazeCanvas
          session={session}
          mode={prefs.mode}
          theme={theme}
          options={options}
          camera={camera}
          firstPerson={snap.firstPerson}
          maze={snap.state}
          generation={session.generation}
          solve={session.solveTracker}
          label={canvasLabel}
          onHostSize={onHostSize}
          onCameraChange={onCameraChange}
          onCellClick={onCellClick}
          onRenderer={onRenderer}
        />
        {snap.firstPerson ? null : (
          <ViewControls
            mode={prefs.mode}
            controls={viewControls}
            className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3"
          />
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
        {snap.firstPerson && snap.state ? (
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

      <MetricsPanel session={session} snap={snap} />

      <OptionsSheet
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        hostWidth={hostSize?.width ?? 1280}
        rows={rows}
      />
      <LibrarySheet open={libraryOpen} onOpenChange={setLibraryOpen} onLoad={loadItem} />
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
