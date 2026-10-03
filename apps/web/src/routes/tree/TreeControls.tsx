import type { TreeLayoutKind } from '@maze/renderer';
import {
  IconButton,
  Slider,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import { Sprout } from 'lucide-react';
import { TREE_LAYOUT_LABELS } from '../../maze/treeView';

const LAYOUT_HINTS: Record<TreeLayoutKind, string> = {
  tidy: 'Root at the bottom, the solution as a straight trunk',
  radial: 'Root in the middle, rings by distance from the start',
  '3d': 'A 3D tree: drag to turn it round',
};

export interface TreeControlsProps {
  layout: TreeLayoutKind;
  onLayoutChange: (layout: TreeLayoutKind) => void;
  morph: number;
  onMorphChange: (morph: number) => void;
  /** Replays the "pull the paths out" animation. */
  onPull: () => void;
  /** Short facts about the tree (cells, height, dead ends). */
  summary?: string;
}

/**
 * Controls of the Tree view, in a row below the maze (never over it): layout, the maze <-> tree
 * morph and a button that replays the pull from the flat maze.
 */
export function TreeControls(p: TreeControlsProps) {
  const percent = Math.round(p.morph * 100);
  return (
    <div
      role="toolbar"
      aria-label="Tree view controls"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border bg-panel px-3 py-1.5"
    >
      <ToggleGroup
        type="single"
        value={p.layout}
        aria-label="Tree layout"
        onValueChange={(v) => {
          if (v === 'tidy' || v === 'radial' || v === '3d') p.onLayoutChange(v);
        }}
      >
        {(['tidy', 'radial', '3d'] as const).map((l) => (
          <Tooltip key={l}>
            <TooltipTrigger asChild>
              <ToggleGroupItem value={l} aria-label={`${TREE_LAYOUT_LABELS[l]} layout`}>
                {TREE_LAYOUT_LABELS[l]}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{LAYOUT_HINTS[l]}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      <div className="flex min-w-[12rem] flex-1 items-center gap-2">
        <span className="text-xs text-muted" aria-hidden="true">
          Maze
        </span>
        <Slider
          className="min-w-0 flex-1"
          label="Maze to tree"
          hideLabel
          value={percent}
          min={0}
          max={100}
          step={1}
          valueText={`${String(percent)}% tree`}
          onValueChange={(v) => {
            p.onMorphChange(v / 100);
          }}
        />
        <span className="text-xs text-muted" aria-hidden="true">
          Tree
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              size="icon-sm"
              variant="outline"
              aria-label="Pull the tree out of the maze"
              onClick={p.onPull}
            >
              <Sprout className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>Replay: pull the maze&apos;s paths out into the tree</TooltipContent>
        </Tooltip>
      </div>
      {p.summary ? <p className="w-full text-xs text-muted sm:w-auto">{p.summary}</p> : null}
    </div>
  );
}
