import {
  Kbd,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@maze/ui';
import { Box, GitFork, Square, type LucideIcon } from 'lucide-react';
import type { ViewChoice } from '../../maze/treeView';

const ITEMS: ReadonlyArray<{
  value: ViewChoice;
  label: string;
  hint: string;
  keys?: string;
  icon: LucideIcon;
}> = [
  { value: '2d', label: '2D', hint: 'Top-down maze', keys: 'T', icon: Square },
  { value: '3d', label: '3D', hint: 'Maze in 3D with the depth cubes', keys: 'T', icon: Box },
  {
    value: 'tree',
    label: 'Tree',
    hint: 'The maze pulled out into the tree it is',
    keys: 'Y',
    icon: GitFork,
  },
];

export interface ViewModeToggleProps {
  value: ViewChoice;
  onChange: (view: ViewChoice) => void;
  disabled?: boolean;
}

/** 2D / 3D / Tree: the three ways to look at a maze, with a tooltip on each. */
export function ViewModeToggle({ value, onChange, disabled }: ViewModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label="View mode"
      onValueChange={(v) => {
        if (v === '2d' || v === '3d' || v === 'tree') onChange(v);
      }}
      disabled={disabled ?? false}
    >
      {ITEMS.map(({ value: v, label, hint, keys, icon: Icon }) => (
        <Tooltip key={v}>
          <TooltipTrigger asChild>
            <ToggleGroupItem value={v} aria-label={`${label} view`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {/* Icons only on phones so the three choices always fit the toolbar. */}
              <span className="hidden sm:inline">{label}</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            {hint}
            {keys ? <Kbd>{keys}</Kbd> : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
