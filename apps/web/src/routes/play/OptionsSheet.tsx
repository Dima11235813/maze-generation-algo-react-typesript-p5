import {
  Button,
  ColorField,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SimpleSelect,
  Slider,
  SwitchField,
} from '@maze/ui';
import { useEffect, useState } from 'react';
import { autoProjectionDepth, MIN_CELL_SIZE, maxCellSizeFor } from '../../maze/gridSizing';
import {
  DEFAULT_PREFS,
  LIMITS,
  usePrefs,
  type MotionPref,
  type ThemePref,
} from '../../state/prefs';
import { AlgorithmParams } from '../params/ParamFields';
import { VERBOSITY_OPTIONS } from './StepLogPanel';

export interface OptionsSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Canvas host width, for the legacy cell-size upper bound (width / 9). */
  hostWidth: number;
  rows: number;
}

const MOTION_OPTIONS: { value: MotionPref; label: string }[] = [
  { value: 'system', label: 'Follow system setting' },
  { value: 'on', label: 'Reduce motion' },
  { value: 'off', label: 'Allow motion' },
];

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function OptionsSheet({ open, onOpenChange, hostWidth, rows }: OptionsSheetProps) {
  const prefs = usePrefs();
  const maxCell = Math.max(MIN_CELL_SIZE + 1, maxCellSizeFor(hostWidth));

  // Cell size regenerates the maze on commit (legacy behaviour), so drag a local copy.
  const [cellDraft, setCellDraft] = useState(prefs.cellSize);
  useEffect(() => {
    setCellDraft(prefs.cellSize);
  }, [prefs.cellSize]);

  const maxWall = Math.max(1, Math.floor(prefs.cellSize / 2));
  const autoDepth = autoProjectionDepth(rows);
  const depthIsAuto = prefs.maxProjectionDepth === 'auto';
  const depthValue: number =
    prefs.maxProjectionDepth === 'auto' ? autoDepth : prefs.maxProjectionDepth;
  const depthMax = Math.max(10, rows * 2, depthValue);
  const is3d = prefs.mode === '3d';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby="options-desc">
        <SheetHeader>
          <SheetTitle>Maze options</SheetTitle>
          <SheetDescription id="options-desc">
            Sizes, colours and rendering. Everything is saved in this browser.
          </SheetDescription>
        </SheetHeader>

        <section aria-labelledby="opt-size" className="flex flex-col gap-4">
          <h3 id="opt-size" className="text-xs font-semibold tracking-wide text-muted uppercase">
            Size
          </h3>
          <Slider
            label="Cell size"
            value={Math.min(cellDraft, maxCell)}
            min={MIN_CELL_SIZE}
            max={maxCell}
            valueText={`${cellDraft} pixels`}
            onValueChange={setCellDraft}
            onValueCommit={(v) => {
              prefs.set('cellSize', v);
            }}
          />
          <Slider
            label="Wall width"
            value={Math.min(prefs.wallWidth, maxWall)}
            min={LIMITS.wallWidth.min}
            max={maxWall}
            valueText={`${prefs.wallWidth} pixels`}
            onValueChange={(v) => {
              prefs.set('wallWidth', v);
            }}
          />
        </section>

        <Separator />

        <section aria-labelledby="opt-algorithms" className="flex flex-col gap-4">
          <h3
            id="opt-algorithms"
            className="text-xs font-semibold tracking-wide text-muted uppercase"
          >
            Algorithms
          </h3>
          <p className="text-xs text-muted">Changes apply to the next maze and the next solve.</p>
          <AlgorithmParams algorithmId={prefs.generatorId} showEmpty />
          <AlgorithmParams algorithmId={prefs.solverId} showEmpty />
        </section>

        <Separator />

        <section aria-labelledby="opt-colors" className="flex flex-col gap-3">
          <h3 id="opt-colors" className="text-xs font-semibold tracking-wide text-muted uppercase">
            Colours
          </h3>
          <ColorField
            label="Cell colour"
            value={prefs.cellColor}
            onValueChange={(v) => {
              prefs.set('cellColor', v);
            }}
          />
          <ColorField
            label="Wall colour"
            value={prefs.wallColor}
            onValueChange={(v) => {
              prefs.set('wallColor', v);
            }}
          />
          <ColorField
            label="Background colour"
            value={prefs.backgroundColor}
            onValueChange={(v) => {
              prefs.set('backgroundColor', v);
            }}
          />
          <SwitchField
            label="Invert colours"
            description="Draw every colour as its negative."
            checked={prefs.invert}
            onCheckedChange={(v) => {
              prefs.set('invert', v);
            }}
          />
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                prefs.patch({
                  cellColor: DEFAULT_PREFS.cellColor,
                  wallColor: DEFAULT_PREFS.wallColor,
                  backgroundColor: DEFAULT_PREFS.backgroundColor,
                  invert: false,
                });
              }}
            >
              Reset colours
            </Button>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="opt-3d" className="flex flex-col gap-3">
          <h3 id="opt-3d" className="text-xs font-semibold tracking-wide text-muted uppercase">
            3D rendering
          </h3>
          <SwitchField
            label="Use 3D"
            description="Extruded walls and the generator cube projection."
            checked={is3d}
            onCheckedChange={(v) => {
              prefs.set('mode', v ? '3d' : '2d');
            }}
          />
          {is3d ? (
            <SwitchField
              label="Show cube projection"
              description="Cubes rise with the backtracker's history: recently visited cells stay low."
              checked={prefs.showProjection}
              onCheckedChange={(v) => {
                prefs.set('showProjection', v);
              }}
            />
          ) : null}
          {is3d && prefs.showProjection ? (
            <SwitchField
              label="Show 3D mirror"
              description="Mirror the projection below the floor."
              checked={prefs.mirror}
              onCheckedChange={(v) => {
                prefs.set('mirror', v);
              }}
            />
          ) : null}
          {is3d && prefs.showProjection ? (
            <div className="flex flex-col gap-2">
              <SwitchField
                label="Automatic projection depth"
                description={`Auto = ${autoDepth} depth units for ${rows} rows.`}
                checked={depthIsAuto}
                onCheckedChange={(v) => {
                  prefs.set('maxProjectionDepth', v ? 'auto' : autoDepth);
                }}
              />
              <Slider
                label="Max projection depth"
                value={depthValue}
                min={LIMITS.maxProjectionDepth.min}
                max={depthMax}
                valueText={`${depthValue} depth units`}
                disabled={depthIsAuto}
                onValueChange={(v) => {
                  prefs.set('maxProjectionDepth', v);
                }}
              />
            </div>
          ) : null}
        </section>

        <Separator />

        <section aria-labelledby="opt-display" className="flex flex-col gap-3">
          <h3 id="opt-display" className="text-xs font-semibold tracking-wide text-muted uppercase">
            Display
          </h3>
          <SwitchField
            label="Show start and goal"
            checked={prefs.showStartGoal}
            onCheckedChange={(v) => {
              prefs.set('showStartGoal', v);
            }}
          />
          <SwitchField
            label="Show grid"
            checked={prefs.showGrid}
            onCheckedChange={(v) => {
              prefs.set('showGrid', v);
            }}
          />
          <SimpleSelect
            label="Motion"
            value={prefs.reducedMotion}
            onValueChange={(v) => {
              prefs.set('reducedMotion', v);
            }}
            options={MOTION_OPTIONS}
          />
          <SimpleSelect
            label="Theme"
            value={prefs.theme}
            onValueChange={(v) => {
              prefs.set('theme', v);
            }}
            options={THEME_OPTIONS}
          />
        </section>

        <Separator />

        <section aria-labelledby="opt-a11y" className="flex flex-col gap-3">
          <h3 id="opt-a11y" className="text-xs font-semibold tracking-wide text-muted uppercase">
            Accessibility
          </h3>
          <SwitchField
            label="Screen-reader grid"
            description="A hidden grid that mirrors the maze for assistive technology. Press G to focus it."
            checked={prefs.screenReaderGrid}
            onCheckedChange={(v) => {
              prefs.set('screenReaderGrid', v);
            }}
          />
          <SimpleSelect
            label="Narration"
            value={prefs.narratorVerbosity}
            onValueChange={(v) => {
              prefs.set('narratorVerbosity', v);
            }}
            options={VERBOSITY_OPTIONS}
          />
          <SwitchField
            label="Show step log"
            description="A readable log of what the narrator said. Press L to toggle."
            checked={prefs.showStepLog}
            onCheckedChange={(v) => {
              prefs.set('showStepLog', v);
            }}
          />
        </section>

        <Separator />
        <div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              prefs.reset();
            }}
          >
            Reset all options
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
