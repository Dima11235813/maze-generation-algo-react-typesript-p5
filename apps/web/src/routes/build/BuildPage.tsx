import {
  DIR_NAMES,
  createGrid,
  createRng,
  decodeDocument,
  describeCell,
  describePosition,
  encodeDocument,
  generators,
  isMazeDocument,
  mazeToSvg,
  nearestWall,
  randomSeed,
  runToEnd,
  type CellId,
  type MazeState,
  type ValidationIssue,
} from '@maze/core';
import type { Renderer } from '@maze/renderer';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAnnouncer } from '../../app/useAnnouncer';
import { useReducedMotion } from '../../app/documentPrefs';
import { useBreakpoint } from '../../layout/breakpoints';
import { Section } from '../../layout/Section';
import { Workspace } from '../../layout/Workspace';
import { BuildModel, dirForArrow } from '../../maze/build';
import { buildCamera, buildRenderOptions, buildTheme } from '../../maze/theme';
import { makeThumbnail, useLibrary, type LibraryItem } from '../../state/library';
import { usePrefs } from '../../state/prefs';
import { LibrarySheet } from '../play/LibrarySheet';
import { MazeCanvas } from '../play/MazeCanvas';
import { SaveDialog } from '../play/SaveDialog';
import { useKeyboardShortcuts } from '../play/useKeyboardShortcuts';
import { downloadSnapshot } from '../tools/actions';
import { BuildToolbar } from './BuildToolbar';
import { MazeOps, ShareOps, ValidationList } from './BuildPanels';

export interface BuildSearch {
  /** Library item to open. */
  item?: string;
}

const DEFAULT_SIZE = { width: 15, height: 10 };
/** Nominal cell size; the 2D renderer scales the maze to the canvas. */
const CELL = 24;

function generate(generatorId: string, width: number, height: number): MazeState {
  const gen = generators.has(generatorId)
    ? generators.require(generatorId)
    : generators.require('recursive-backtracker');
  return runToEnd(gen.run(createGrid(width, height), createRng(randomSeed()), {}));
}

function downloadText(text: string, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

const slug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'maze';

/**
 * Build mode (WI-03): edit a maze by hand. Tap near a wall to toggle it (or use the keyboard
 * cursor: arrows move, Shift+arrow toggles that wall), place the start and goal, resize, braid,
 * undo/redo; validation explains what is wrong and moves the cursor there; save to the library,
 * save a copy, export PNG/SVG/JSON or import JSON.
 */
export function BuildPage() {
  const search = useSearch({ from: '/build' });
  const navigate = useNavigate({ from: '/build' });
  const prefs = usePrefs();
  const reducedMotion = useReducedMotion();
  const announce = useAnnouncer();
  const bp = useBreakpoint();
  const touchLayout = bp === 'mobile' || bp === 'tablet';
  const items = useLibrary((s) => s.items);
  const addToLibrary = useLibrary((s) => s.add);
  const replaceInLibrary = useLibrary((s) => s.replace);

  const modelRef = useRef<BuildModel | null>(null);
  if (!modelRef.current) {
    const fromItem = search.item ? items.find((i) => i.id === search.item) : undefined;
    modelRef.current = fromItem
      ? new BuildModel(decodeDocument(fromItem.document), {
          itemId: fromItem.id,
          name: fromItem.name,
        })
      : new BuildModel(
          generate(usePrefs.getState().generatorId, DEFAULT_SIZE.width, DEFAULT_SIZE.height),
        );
  }
  const model = modelRef.current;
  const snap = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const { state } = snap;

  const rendererRef = useRef<Renderer | null>(null);
  const onRenderer = useCallback((r: Renderer | null) => {
    rendererRef.current = r;
  }, []);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState<'save' | 'copy' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ---- renderer inputs ---------------------------------------------------------------------
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
      ...buildRenderOptions(prefs, state.grid.height, reducedMotion, CELL),
      mode: '2d' as const,
      // Walls must be easy to see while editing.
      wallWidth: Math.max(2, prefs.wallWidth),
      showStartGoal: true,
      tree: null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.wallWidth, prefs.showGrid, state.grid.height, reducedMotion],
  );
  const camera = useMemo(() => buildCamera({ cameraPreset: 'top', followPointer: false }, 1), []);

  // ---- actions -----------------------------------------------------------------------------
  const describeCursor = useCallback(
    (cell: CellId) => {
      announce(describeCell(model.getSnapshot().state, cell));
    },
    [announce, model],
  );

  const onCellClick = useCallback(
    (cell: CellId | null, at?: { fx: number; fy: number }) => {
      if (cell === null) return;
      const s = model.getSnapshot();
      if (s.tool === 'walls' && at) {
        const wall = nearestWall(s.state.grid, cell, at.fx, at.fy);
        if (wall) {
          model.setCursor(cell);
          model.toggleWall(wall.a, wall.b);
          return;
        }
        model.setCursor(cell);
        return;
      }
      model.useToolOn(cell);
    },
    [model],
  );

  const newMaze = useCallback(() => {
    const { width, height } = model.getSnapshot().state.grid;
    model.load(generate(prefs.generatorId, width, height), { itemId: null, name: 'New maze' });
    void navigate({ search: {}, replace: true });
    announce('A new maze to edit.');
  }, [model, prefs.generatorId, navigate, announce]);

  const openItem = useCallback(
    (item: LibraryItem) => {
      model.load(decodeDocument(item.document), { itemId: item.id, name: item.name });
      void navigate({ search: { item: item.id }, replace: true });
      announce(`Editing "${item.name}".`);
    },
    [model, navigate, announce],
  );

  const save = useCallback(
    async (name: string, asCopy: boolean) => {
      const s = model.getSnapshot();
      const document = await encodeDocument(s.state, {
        edited: true,
        meta: { name: name.trim() || 'Untitled maze', createdAt: new Date().toISOString() },
      });
      const dataUrl = rendererRef.current?.toDataURL();
      const thumbnail = dataUrl ? await makeThumbnail(dataUrl) : undefined;
      const input = { name, document, ...(thumbnail ? { thumbnail } : {}) };
      const itemId = s.source.itemId;
      const saved = !asCopy && itemId ? replaceInLibrary(itemId, input) : addToLibrary(input);
      const item = saved ?? addToLibrary(input);
      model.markSaved({ itemId: item.id, name: item.name });
      void navigate({ search: { item: item.id }, replace: true });
      announce(asCopy ? `Saved a copy as "${item.name}".` : `Saved "${item.name}" to the library.`);
    },
    [model, replaceInLibrary, addToLibrary, navigate, announce],
  );

  const exportAs = useCallback(
    async (kind: 'png' | 'svg' | 'json') => {
      const s = model.getSnapshot();
      const base = slug(s.source.name);
      if (kind === 'png') {
        const ok = downloadSnapshot(rendererRef.current?.toDataURL() ?? '', `${base}.png`);
        announce(ok ? 'PNG exported.' : 'Could not export a PNG.');
      } else if (kind === 'svg') {
        downloadText(
          mazeToSvg(s.state, {
            cellSize: 20,
            background: prefs.backgroundColor,
            cell: prefs.cellColor,
            wall: prefs.wallColor,
          }),
          'image/svg+xml',
          `${base}.svg`,
        );
        announce('SVG exported.');
      } else {
        const doc = await encodeDocument(s.state, {
          edited: true,
          meta: { name: s.source.name, createdAt: new Date().toISOString() },
        });
        downloadText(JSON.stringify(doc, null, 2), 'application/json', `${base}.json`);
        announce('Maze exported as JSON.');
      }
    },
    [model, prefs.backgroundColor, prefs.cellColor, prefs.wallColor, announce],
  );

  const importFile = useCallback(
    async (file: File) => {
      try {
        const data: unknown = JSON.parse(await file.text());
        if (!isMazeDocument(data)) throw new Error('This file is not a Maze Lab maze.');
        const imported = decodeDocument(data);
        model.load(imported, {
          itemId: null,
          name: data.meta?.name ?? file.name.replace(/\.json$/i, ''),
        });
        setImportError(null);
        void navigate({ search: {}, replace: true });
        announce(
          `Imported a ${String(imported.grid.width)} by ${String(imported.grid.height)} maze.`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setImportError(`Could not import: ${message}`);
        announce(`Could not import: ${message}`);
      }
    },
    [model, navigate, announce],
  );

  const focusIssue = useCallback(
    (issue: ValidationIssue) => {
      const first = issue.cells?.[0];
      if (first === undefined) return;
      model.setCursor(first);
      document.querySelector<HTMLElement>('[data-testid="maze-canvas-host"]')?.focus();
      announce(`${issue.message} Cursor moved to ${describePosition(state.grid, first)}.`);
    },
    [model, announce, state.grid],
  );

  // A library item named in the URL that arrives after mount (e.g. navigating here).
  useEffect(() => {
    if (!search.item || search.item === model.getSnapshot().source.itemId) return;
    const item = items.find((i) => i.id === search.item);
    if (item) openItem(item);
  }, [search.item, items, model, openItem]);

  // ---- keyboard ----------------------------------------------------------------------------
  useKeyboardShortcuts({
    onKeyDown: (e) => {
      const dir = dirForArrow(e.key);
      if (dir !== undefined) {
        e.preventDefault();
        if (e.shiftKey) {
          const s = model.getSnapshot();
          const had = (s.state.walls[s.cursor] ?? 0) & (1 << dir);
          if (model.toggleCursorWall(dir)) {
            announce(`Wall ${had ? 'removed' : 'added'} to the ${DIR_NAMES[dir]}.`);
          } else {
            announce('That is the outer wall of the maze.');
          }
        } else {
          describeCursor(model.moveCursor(dir));
        }
        return;
      }
      switch (e.key) {
        case 'u':
          model.undo();
          break;
        case 'U':
          model.redo();
          break;
        case 's':
        case 'S':
          model.setStart(model.getSnapshot().cursor);
          announce('Start placed at the cursor.');
          break;
        case 'g':
        case 'G':
          model.setGoal(model.getSnapshot().cursor);
          announce('Goal placed at the cursor.');
          break;
        case 'w':
        case 'W':
          model.setTool('walls');
          break;
        case 'n':
        case 'N':
          newMaze();
          break;
        case 'Enter':
          model.useToolOn(model.getSnapshot().cursor);
          break;
        default:
          break;
      }
    },
  });

  // ---- render ------------------------------------------------------------------------------
  const errors = snap.issues.filter((i) => i.severity === 'error').length;
  const cursorText = `${describePosition(state.grid, snap.cursor)}${
    snap.cursor === state.start ? ' (start)' : snap.cursor === state.goal ? ' (goal)' : ''
  }`;
  const canvasLabel = `Maze being edited: ${String(state.grid.width)} by ${String(state.grid.height)} cells, ${
    errors > 0 ? `${String(errors)} problem${errors === 1 ? '' : 's'}` : 'valid'
  }. Cursor at ${cursorText}.`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Build</h1>
      <BuildToolbar
        tool={snap.tool}
        onToolChange={(t) => {
          model.setTool(t);
        }}
        canUndo={snap.canUndo}
        canRedo={snap.canRedo}
        onUndo={() => {
          model.undo();
        }}
        onRedo={() => {
          model.redo();
        }}
        showSolution={snap.showSolution}
        onShowSolutionChange={(v) => {
          model.setShowSolution(v);
        }}
        onNew={newMaze}
        onOpen={() => {
          setLibraryOpen(true);
        }}
        onSave={() => {
          setSaveOpen('save');
        }}
        dirty={snap.dirty}
      />
      <Workspace
        stageLabel="Maze editor"
        stage={
          <>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MazeCanvas
                session={model}
                mode="2d"
                theme={theme}
                options={options}
                camera={camera}
                firstPerson={null}
                maze={state}
                generation={null}
                solve={model.overlay.tracker}
                label={canvasLabel}
                onHostSize={() => undefined}
                onCellClick={onCellClick}
                onRenderer={onRenderer}
                // Taps edit the maze, so the canvas does not scroll the page on touch screens.
                pageScroll={false}
              />
            </div>
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-panel px-3 py-1.5 text-xs"
              data-testid="build-status"
            >
              <span className="font-medium">Cursor: {cursorText}</span>
              <span className="text-muted">
                {touchLayout
                  ? 'Tap near a wall to toggle it; pick Start or Goal, then tap a cell.'
                  : 'Arrows move · Shift+arrow toggles a wall · S start · G goal · U undo'}
              </span>
            </div>
          </>
        }
        side={
          <>
            <Section
              id="build-validation"
              title="Validation"
              summary={errors > 0 ? `${String(errors)} problem${errors === 1 ? '' : 's'}` : 'valid'}
            >
              <ValidationList issues={snap.issues} onFocusIssue={focusIssue} />
            </Section>
            <Section
              id="build-maze"
              title="Maze"
              summary={`${String(state.grid.width)} x ${String(state.grid.height)}`}
            >
              <MazeOps
                key={`${String(state.grid.width)}x${String(state.grid.height)}`}
                width={state.grid.width}
                height={state.grid.height}
                onResize={(w, h) => {
                  model.resize(w, h);
                  announce(`Resized to ${String(w)} by ${String(h)}.`);
                }}
                onBraid={(percent) => {
                  model.braid(percent, randomSeed());
                  announce('Braided: some dead ends now open into loops.');
                }}
                onFill={(kind) => {
                  model.fill(kind);
                  announce(kind === 'walls' ? 'Every wall closed.' : 'Every inner wall opened.');
                }}
              />
            </Section>
            <Section
              id="build-share"
              title="Save and share"
              summary={snap.source.name}
              defaultOpen={bp !== 'mobile'}
            >
              <ShareOps
                onSaveCopy={() => {
                  setSaveOpen('copy');
                }}
                onExport={(k) => void exportAs(k)}
                onImport={(f) => void importFile(f)}
                importError={importError}
              />
            </Section>
          </>
        }
      />
      <LibrarySheet open={libraryOpen} onOpenChange={setLibraryOpen} onLoad={openItem} />
      <SaveDialog
        key={`${saveOpen ?? 'closed'}-${snap.source.name}`}
        open={saveOpen !== null}
        onOpenChange={(open) => {
          if (!open) setSaveOpen(null);
        }}
        defaultName={saveOpen === 'copy' ? `${snap.source.name} (copy)` : snap.source.name}
        onSave={(name) => save(name, saveOpen === 'copy')}
      />
    </div>
  );
}
