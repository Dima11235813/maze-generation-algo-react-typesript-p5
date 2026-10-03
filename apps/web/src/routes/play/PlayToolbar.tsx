import { generators, solvers } from '@maze/core';
import { SPEED_PRESETS, type PlayerStatus } from '@maze/player';
import { CAMERA_PRESETS, type CameraPreset, type ViewMode } from '@maze/renderer';
import {
  Button,
  IconButton,
  Kbd,
  Label,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SimpleSelect,
  Slider,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import {
  Box,
  Copy,
  Dices,
  Ellipsis,
  FastForward,
  Footprints,
  Library,
  Pause,
  Play,
  RefreshCw,
  Route,
  Save,
  Settings2,
  Shuffle,
  SkipForward,
  Square,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';
import { useIsNarrow } from '../../lib/useMediaQuery';

const CAMERA_LABELS: Record<CameraPreset, string> = {
  top: 'Top-down',
  tilt: 'Tilted (legacy default)',
  isometric: 'Isometric',
  low: 'Low angle',
  front: 'Front',
};

export interface PlayToolbarProps {
  phase: 'empty' | 'generating' | 'ready';
  playerStatus: PlayerStatus | null;
  seed: string;
  onSeedChange(seed: string): void;
  onGenerate(): void;
  onRegenerate(): void;
  onRandomSeed(): void;
  onCopySeed(): void;
  generatorId: string;
  onGeneratorChange(id: string): void;
  onPlayToggle(): void;
  onStep(): void;
  onRunToEnd(): void;
  speed: number;
  onSpeedChange(speed: number): void;
  mode: ViewMode;
  onModeChange(mode: ViewMode): void;
  cameraPreset: CameraPreset;
  onCameraPresetChange(preset: CameraPreset): void;
  followPointer: boolean;
  onFollowPointerChange(v: boolean): void;
  solverId: string;
  onSolverChange(id: string): void;
  onSolve(): void;
  onClearSolve(): void;
  canSolve: boolean;
  solveActive: boolean;
  firstPerson: boolean;
  onFirstPersonToggle(): void;
  canSave: boolean;
  onSave(): void;
  onOpenLibrary(): void;
  onOpenOptions(): void;
}

function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={className ?? 'flex items-center gap-1.5'}>
      {children}
    </div>
  );
}

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

// ---- building blocks shared by the wide toolbar and the compact toolbar + sheet -------------

function GenerateButton({ p, iconOnlyOnPhone = false }: { p: PlayToolbarProps; iconOnlyOnPhone?: boolean }) {
  return (
    <Hint label="New maze with a fresh seed" keys="N">
      <Button size="sm" onClick={p.onGenerate} aria-label="Generate">
        <Shuffle className="h-4 w-4" aria-hidden="true" />
        <span className={iconOnlyOnPhone ? 'hidden min-[420px]:inline' : undefined}>Generate</span>
      </Button>
    </Hint>
  );
}

function SeedControls({ p, grow = false }: { p: PlayToolbarProps; grow?: boolean }) {
  return (
    <div className={grow ? 'flex flex-1 items-center gap-1' : 'flex items-center gap-1'}>
      <Hint label="Run the same seed again">
        <IconButton size="icon-sm" variant="outline" aria-label="Regenerate same seed" onClick={p.onRegenerate} disabled={p.phase === 'empty'}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Hint>
      <Label htmlFor="seed" className="sr-only">
        Seed
      </Label>
      <input
        id="seed"
        className={`h-8 rounded-md border border-border bg-panel px-2 font-mono text-xs ${grow ? 'min-w-0 flex-1' : 'w-32'}`}
        value={p.seed}
        placeholder="seed"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => p.onSeedChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') p.onRegenerate();
        }}
      />
      <Hint label="Random seed">
        <IconButton size="icon-sm" aria-label="Random seed" onClick={p.onRandomSeed}>
          <Dices className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Hint>
      <Hint label="Copy seed">
        <IconButton size="icon-sm" aria-label="Copy seed" onClick={p.onCopySeed} disabled={!p.seed}>
          <Copy className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Hint>
    </div>
  );
}

function GeneratorSelect({ p, full = false }: { p: PlayToolbarProps; full?: boolean }) {
  const options = generators.all.map((g) => ({ value: g.meta.id, label: g.meta.name }));
  return (
    <SimpleSelect
      label="Generator"
      hideLabel={!full}
      value={p.generatorId}
      onValueChange={p.onGeneratorChange}
      options={options}
      triggerClassName={full ? 'h-10 w-full' : 'h-8 w-52 text-xs'}
    />
  );
}

function PlaybackButtons({ p }: { p: PlayToolbarProps }) {
  const playing = p.playerStatus === 'playing';
  const playable = p.playerStatus !== null && p.playerStatus !== 'done';
  return (
    <>
      <Hint label={playing ? 'Pause' : 'Play'} keys="Space">
        <IconButton size="icon-sm" variant="outline" aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing} onClick={p.onPlayToggle} disabled={!playable}>
          {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
      </Hint>
      <Hint label="Step once" keys=".">
        <IconButton size="icon-sm" variant="outline" aria-label="Step once" onClick={p.onStep} disabled={!playable}>
          <SkipForward className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Hint>
      <Hint label="Run to end">
        <IconButton size="icon-sm" variant="outline" aria-label="Run to end" onClick={p.onRunToEnd} disabled={!playable}>
          <FastForward className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Hint>
    </>
  );
}

function SpeedControl({ p, full = false }: { p: PlayToolbarProps; full?: boolean }) {
  const speedIndex = speedToIndex(p.speed);
  return (
    <>
      <Slider
        className={full ? 'w-full' : 'w-40'}
        label="Speed"
        hideLabel={!full}
        value={speedIndex}
        min={0}
        max={SPEED_PRESETS.length - 1}
        step={1}
        valueText={formatSpeed(p.speed)}
        onValueChange={(i) => p.onSpeedChange(indexToSpeed(i))}
      />
      {full ? null : (
        <span className="w-24 text-xs tabular-nums text-muted" aria-hidden="true">
          {formatSpeed(p.speed)}
        </span>
      )}
    </>
  );
}

function ViewToggle({ p }: { p: PlayToolbarProps }) {
  return (
    <ToggleGroup
      type="single"
      value={p.mode}
      aria-label="View mode"
      onValueChange={(v) => {
        if (v === '2d' || v === '3d') p.onModeChange(v);
      }}
    >
      <ToggleGroupItem value="2d" aria-label="2D view">
        <Square className="h-3.5 w-3.5" aria-hidden="true" /> 2D
      </ToggleGroupItem>
      <ToggleGroupItem value="3d" aria-label="3D view">
        <Box className="h-3.5 w-3.5" aria-hidden="true" /> 3D
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function CameraControls({ p, full = false }: { p: PlayToolbarProps; full?: boolean }) {
  const disabled = p.mode !== '3d' || p.firstPerson;
  return (
    <>
      <SimpleSelect
        label="Camera"
        hideLabel={!full}
        value={p.cameraPreset}
        onValueChange={p.onCameraPresetChange}
        options={CAMERA_PRESETS.map((c) => ({ value: c, label: CAMERA_LABELS[c] }))}
        disabled={disabled}
        triggerClassName={full ? 'h-10 w-full' : 'h-8 w-44 text-xs'}
      />
      <div className="flex items-center gap-1.5">
        <Switch id="follow-pointer" checked={p.followPointer} onCheckedChange={p.onFollowPointerChange} disabled={disabled} />
        <Label htmlFor="follow-pointer" className={full ? 'text-sm' : 'text-xs'}>
          Follow pointer <Kbd>F</Kbd>
        </Label>
      </div>
    </>
  );
}

function SolveControls({ p, full = false }: { p: PlayToolbarProps; full?: boolean }) {
  const options = solvers.all.map((s) => ({ value: s.meta.id, label: s.meta.name }));
  return (
    <>
      <SimpleSelect
        label="Solver"
        hideLabel={!full}
        value={p.solverId}
        onValueChange={p.onSolverChange}
        options={options}
        triggerClassName={full ? 'h-10 w-full' : 'h-8 w-44 text-xs'}
      />
      {p.solveActive ? (
        <Button size={full ? 'md' : 'sm'} variant="secondary" onClick={p.onClearSolve}>
          <X className="h-4 w-4" aria-hidden="true" /> Clear solve
        </Button>
      ) : (
        <Button size={full ? 'md' : 'sm'} variant="secondary" onClick={p.onSolve} disabled={!p.canSolve}>
          <Route className="h-4 w-4" aria-hidden="true" /> Solve
        </Button>
      )}
    </>
  );
}

function RunMazeButton({ p, full = false }: { p: PlayToolbarProps; full?: boolean }) {
  return (
    <Hint label={p.firstPerson ? 'Exit first-person mode' : 'Run the maze in first person (3D)'} keys="R">
      <Button
        size={full ? 'md' : 'sm'}
        variant={p.firstPerson ? 'default' : 'secondary'}
        aria-pressed={p.firstPerson}
        onClick={p.onFirstPersonToggle}
        disabled={!p.canSolve && !p.firstPerson}
      >
        <Footprints className="h-4 w-4" aria-hidden="true" /> {p.firstPerson ? 'Exit maze' : 'Run maze'}
      </Button>
    </Hint>
  );
}

function LibraryButtons({ p, full = false }: { p: PlayToolbarProps; full?: boolean }) {
  return (
    <>
      <Hint label="Save to library">
        <Button size={full ? 'md' : 'sm'} variant="outline" onClick={p.onSave} disabled={!p.canSave}>
          <Save className="h-4 w-4" aria-hidden="true" /> Save
        </Button>
      </Hint>
      {full ? (
        <Button size="md" variant="outline" onClick={p.onOpenLibrary}>
          <Library className="h-4 w-4" aria-hidden="true" /> Library
        </Button>
      ) : (
        <Hint label="Open library">
          <IconButton size="icon-sm" variant="outline" aria-label="Library" onClick={p.onOpenLibrary}>
            <Library className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
      )}
    </>
  );
}

function OptionsButton({ p }: { p: PlayToolbarProps }) {
  return (
    <Hint label="Options" keys="O">
      <IconButton size="icon-sm" variant="outline" aria-label="Options" onClick={p.onOpenOptions}>
        <Settings2 className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </Hint>
  );
}

// ---- layouts --------------------------------------------------------------------------------

function WideToolbar({ p }: { p: PlayToolbarProps }) {
  return (
    <div role="toolbar" aria-label="Maze controls" className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
      <Group label="Generate">
        <GenerateButton p={p} />
        <SeedControls p={p} />
        <GeneratorSelect p={p} />
      </Group>
      <Separator orientation="vertical" className="h-6" />
      <Group label="Playback">
        <PlaybackButtons p={p} />
        <SpeedControl p={p} />
      </Group>
      <Separator orientation="vertical" className="h-6" />
      <Group label="View">
        <ViewToggle p={p} />
        <CameraControls p={p} />
      </Group>
      <Separator orientation="vertical" className="h-6" />
      <Group label="Solve">
        <SolveControls p={p} />
      </Group>
      <Separator orientation="vertical" className="h-6" />
      <Group label="Run">
        <RunMazeButton p={p} />
      </Group>
      <div className="ml-auto flex items-center gap-1.5">
        <LibraryButtons p={p} />
        <OptionsButton p={p} />
      </div>
    </div>
  );
}

/**
 * Phone / small-tablet layout: one row of essentials plus a bottom sheet with everything else.
 * Each control is rendered exactly once, so ids and labels stay unique.
 */
function CompactToolbar({ p }: { p: PlayToolbarProps }) {
  const [moreOpen, setMoreOpen] = useState(false);
  // Actions that change what is on screen close the sheet so the result is visible at once.
  const closing: PlayToolbarProps = {
    ...p,
    onSolve: () => {
      p.onSolve();
      setMoreOpen(false);
    },
    onClearSolve: () => {
      p.onClearSolve();
      setMoreOpen(false);
    },
    onFirstPersonToggle: () => {
      p.onFirstPersonToggle();
      setMoreOpen(false);
    },
    onSave: () => {
      setMoreOpen(false);
      p.onSave();
    },
    onOpenLibrary: () => {
      setMoreOpen(false);
      p.onOpenLibrary();
    },
  };
  return (
    <>
      <div
        role="toolbar"
        aria-label="Maze controls"
        className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-panel px-2 py-1.5 [scrollbar-width:none]"
      >
        <GenerateButton p={p} iconOnlyOnPhone />
        <Group label="Playback">
          <PlaybackButtons p={p} />
        </Group>
        <Group label="View">
          <ViewToggle p={p} />
        </Group>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <OptionsButton p={p} />
          <Hint label="More controls">
            <IconButton size="icon-sm" variant="outline" aria-label="More controls" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
              <Ellipsis className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </Hint>
        </div>
      </div>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" aria-describedby="more-controls-desc" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Maze controls</SheetTitle>
            <SheetDescription id="more-controls-desc">Seed, algorithm, speed, camera, solver and library.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5">
            <Group label="Generate" className="flex flex-col gap-2">
              <SeedControls p={p} grow />
              <GeneratorSelect p={p} full />
            </Group>
            <Group label="Playback" className="flex flex-col gap-2">
              <SpeedControl p={p} full />
            </Group>
            <Group label="View" className="flex flex-col gap-2">
              <CameraControls p={p} full />
            </Group>
            <Group label="Solve" className="flex flex-col gap-2">
              <SolveControls p={closing} full />
            </Group>
            <Group label="Run" className="flex flex-col gap-2">
              <RunMazeButton p={closing} full />
            </Group>
            <Group label="Library" className="flex flex-wrap gap-2">
              <LibraryButtons p={closing} full />
            </Group>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function PlayToolbar(p: PlayToolbarProps) {
  const narrow = useIsNarrow();
  return narrow ? <CompactToolbar p={p} /> : <WideToolbar p={p} />;
}
