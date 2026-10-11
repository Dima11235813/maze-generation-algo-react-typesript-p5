import {
  Button,
  IconButton,
  Kbd,
  Separator,
  SwitchField,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import { Flag, FolderOpen, MapPin, PenLine, Redo2, Save, Shuffle, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BuildTool } from '../../maze/build';

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

export interface BuildToolbarProps {
  tool: BuildTool;
  onToolChange: (tool: BuildTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showSolution: boolean;
  onShowSolutionChange: (show: boolean) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  dirty: boolean;
}

const TOOLS: ReadonlyArray<{
  value: BuildTool;
  label: string;
  hint: string;
  keys: string;
  icon: typeof PenLine;
}> = [
  {
    value: 'walls',
    label: 'Walls',
    hint: 'Tap near a wall to add or remove it',
    keys: 'W',
    icon: PenLine,
  },
  {
    value: 'start',
    label: 'Start',
    hint: 'Tap a cell to put the start there',
    keys: 'S',
    icon: MapPin,
  },
  { value: 'goal', label: 'Goal', hint: 'Tap a cell to put the goal there', keys: 'G', icon: Flag },
];

/** Build controls: the tap tool, undo/redo, solution overlay and the file actions. */
export function BuildToolbar(p: BuildToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Build controls"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-2 py-1.5 sm:px-3 sm:py-2"
    >
      <ToggleGroup
        type="single"
        value={p.tool}
        aria-label="Tap tool"
        onValueChange={(v) => {
          if (v === 'walls' || v === 'start' || v === 'goal') p.onToolChange(v);
        }}
      >
        {TOOLS.map(({ value, label, hint, keys, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem value={value} aria-label={`${label} tool`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              {hint}
              <Kbd>{keys}</Kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      <div role="group" aria-label="History" className="flex items-center gap-1">
        <Hint label="Undo" keys="U">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Undo"
            onClick={p.onUndo}
            disabled={!p.canUndo}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
        <Hint label="Redo" keys="Shift+U">
          <IconButton
            size="icon-sm"
            variant="outline"
            aria-label="Redo"
            onClick={p.onRedo}
            disabled={!p.canRedo}
          >
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </Hint>
      </div>
      <SwitchField
        label="Show the solution"
        checked={p.showSolution}
        onCheckedChange={p.onShowSolutionChange}
      />
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div role="group" aria-label="File" className="ml-auto flex items-center gap-1">
        <Hint label="Start from a newly generated maze" keys="N">
          <Button size="sm" variant="outline" onClick={p.onNew} aria-label="New maze">
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">New</span>
          </Button>
        </Hint>
        <Hint label="Open a maze from the library">
          <Button size="sm" variant="outline" onClick={p.onOpen} aria-label="Open from library">
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Open</span>
          </Button>
        </Hint>
        <Hint label={p.dirty ? 'Save your changes to the library' : 'Save to the library'}>
          <Button size="sm" onClick={p.onSave} aria-label="Save">
            <Save className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Save{p.dirty ? ' *' : ''}</span>
          </Button>
        </Hint>
      </div>
    </div>
  );
}
