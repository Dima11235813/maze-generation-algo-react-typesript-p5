import { generators, solvers } from '@maze/core';
import { SPEED_PRESETS, type PlayerStatus } from '@maze/player';
import { CAMERA_PRESETS, type CameraPreset, type ViewMode } from '@maze/renderer';
import {
  Button,
  IconButton,
  Kbd,
  Label,
  Separator,
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
import type { ReactNode } from 'react';
import { formatSpeed, indexToSpeed, speedToIndex } from '../../lib/speed';

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

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
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

export function PlayToolbar(p: PlayToolbarProps) {
  const playing = p.playerStatus === 'playing';
  const playable = p.playerStatus !== null && p.playerStatus !== 'done';
  const generatorOptions = generators.all.map((g) => ({ value: g.meta.id, label: g.meta.name }));
  const solverOptions = solvers.all.map((s) => ({ value: s.meta.id, label: s.meta.name }));
  const speedIndex = speedToIndex(p.speed);

  return (
    <div
      role="toolbar"
      aria-label="Maze controls"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2"
    >
      <Group label="Generate">
        <Hint label="New maze with a fresh seed" keys="N">
          <Button size="sm" onClick={p.onGenerate}>
            <Shuffle className="h-4 w-4" aria-hidden="true" /> Generate
          </Button>
        </Hint>
        <Hint label="Run the same seed again">
          <IconButton size="icon-sm" variant="outline" aria-label="Regenerate same seed" onClick={p.onRegenerate} disabled={p.phase === 'empty'}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <div className="flex items-center gap-1">
          <Label htmlFor="seed" className="sr-only">
            Seed
          </Label>
          <input
            id="seed"
            className="h-8 w-32 rounded-md border border-border bg-panel px-2 font-mono text-xs"
            value={p.seed}
            placeholder="seed"
            spellCheck={false}
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
        <SimpleSelect
          label="Generator"
          hideLabel
          value={p.generatorId}
          onValueChange={p.onGeneratorChange}
          options={generatorOptions}
          triggerClassName="h-8 w-52 text-xs"
        />
      </Group>

      <Separator orientation="vertical" className="h-6" />

      <Group label="Playback">
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
        <Slider
          className="w-40"
          label="Speed"
          hideLabel
          value={speedIndex}
          min={0}
          max={SPEED_PRESETS.length - 1}
          step={1}
          valueText={formatSpeed(p.speed)}
          onValueChange={(i) => p.onSpeedChange(indexToSpeed(i))}
        />
        <span className="w-24 text-xs tabular-nums text-muted" aria-hidden="true">
          {formatSpeed(p.speed)}
        </span>
      </Group>

      <Separator orientation="vertical" className="h-6" />

      <Group label="View">
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
        <SimpleSelect
          label="Camera"
          hideLabel
          value={p.cameraPreset}
          onValueChange={p.onCameraPresetChange}
          options={CAMERA_PRESETS.map((c) => ({ value: c, label: CAMERA_LABELS[c] }))}
          disabled={p.mode !== '3d' || p.firstPerson}
          triggerClassName="h-8 w-44 text-xs"
        />
        <div className="flex items-center gap-1.5">
          <Switch
            id="follow-pointer"
            checked={p.followPointer}
            onCheckedChange={p.onFollowPointerChange}
            disabled={p.mode !== '3d' || p.firstPerson}
          />
          <Label htmlFor="follow-pointer" className="text-xs">
            Follow pointer <Kbd>F</Kbd>
          </Label>
        </div>
      </Group>

      <Separator orientation="vertical" className="h-6" />

      <Group label="Solve">
        <SimpleSelect
          label="Solver"
          hideLabel
          value={p.solverId}
          onValueChange={p.onSolverChange}
          options={solverOptions}
          triggerClassName="h-8 w-44 text-xs"
        />
        {p.solveActive ? (
          <Button size="sm" variant="secondary" onClick={p.onClearSolve}>
            <X className="h-4 w-4" aria-hidden="true" /> Clear solve
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={p.onSolve} disabled={!p.canSolve}>
            <Route className="h-4 w-4" aria-hidden="true" /> Solve
          </Button>
        )}
      </Group>

      <Separator orientation="vertical" className="h-6" />

      <Group label="Run">
        <Hint label={p.firstPerson ? 'Exit first-person mode' : 'Run the maze in first person (3D)'} keys="R">
          <Button size="sm" variant={p.firstPerson ? 'default' : 'secondary'} aria-pressed={p.firstPerson} onClick={p.onFirstPersonToggle} disabled={!p.canSolve && !p.firstPerson}>
            <Footprints className="h-4 w-4" aria-hidden="true" /> {p.firstPerson ? 'Exit maze' : 'Run maze'}
          </Button>
        </Hint>
      </Group>

      <div className="ml-auto flex items-center gap-1.5">
        <Hint label="Save to library">
          <Button size="sm" variant="outline" onClick={p.onSave} disabled={!p.canSave}>
            <Save className="h-4 w-4" aria-hidden="true" /> Save
          </Button>
        </Hint>
        <Hint label="Open library">
          <IconButton size="icon-sm" variant="outline" aria-label="Library" onClick={p.onOpenLibrary}>
            <Library className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Options" keys="O">
          <IconButton size="icon-sm" variant="outline" aria-label="Options" onClick={p.onOpenOptions}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
      </div>
    </div>
  );
}
