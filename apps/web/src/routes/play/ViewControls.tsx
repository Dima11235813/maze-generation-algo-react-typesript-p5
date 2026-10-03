import type { ViewMode } from '@maze/renderer';
import { Kbd, Tooltip, TooltipContent, TooltipTrigger, cn } from '@maze/ui';
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { ROTATE_STEP, TILT_STEP, ZOOM_STEP, type CameraViewControls } from '../../maze/view';

export interface ViewControlsProps {
  mode: ViewMode;
  controls: CameraViewControls;
  className?: string;
}

function ControlButton({
  label,
  keys,
  icon: Icon,
  onPress,
}: {
  label: string;
  keys: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onPress}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-panel-2 active:bg-accent active:text-accent-fg"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        {label}
        <Kbd>{keys}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Map-style camera controls floating over the canvas: rotate and tilt (3D), zoom and reset.
 * Dragging the 3D view and pinching/scrolling do the same things; these buttons make every
 * camera move reachable by keyboard, switch and touch users too.
 */
export function ViewControls({ mode, controls, className }: ViewControlsProps) {
  const is3d = mode === '3d';
  return (
    <div
      role="group"
      aria-label="View controls"
      className={cn(
        'pointer-events-auto grid grid-cols-2 gap-0.5 rounded-lg border border-border bg-panel/90 p-1 shadow backdrop-blur',
        className,
      )}
    >
      {is3d ? (
        <>
          <ControlButton
            label="Rotate counter-clockwise"
            keys="["
            icon={RotateCcw}
            onPress={() => {
              controls.rotate(ROTATE_STEP);
            }}
          />
          <ControlButton
            label="Rotate clockwise"
            keys="]"
            icon={RotateCw}
            onPress={() => {
              controls.rotate(-ROTATE_STEP);
            }}
          />
          <ControlButton
            label="Look from higher"
            keys="}"
            icon={ChevronUp}
            onPress={() => {
              controls.tilt(TILT_STEP);
            }}
          />
          <ControlButton
            label="Look from lower"
            keys="{"
            icon={ChevronDown}
            onPress={() => {
              controls.tilt(-TILT_STEP);
            }}
          />
        </>
      ) : null}
      <ControlButton
        label="Zoom in"
        keys="+"
        icon={ZoomIn}
        onPress={() => {
          controls.zoomBy(ZOOM_STEP);
        }}
      />
      <ControlButton
        label="Zoom out"
        keys="-"
        icon={ZoomOut}
        onPress={() => {
          controls.zoomBy(1 / ZOOM_STEP);
        }}
      />
      <div className="col-span-2 flex justify-center">
        <ControlButton label="Reset view" keys="0" icon={Maximize2} onPress={controls.reset} />
      </div>
    </div>
  );
}

/**
 * Shared keyboard handling for the view shortcuts. Returns true when the key was consumed.
 * `[`/`]` rotate, `{`/`}` tilt, `+`/`=`/`-` zoom, `0` reset.
 */
export function handleViewKey(key: string, mode: ViewMode, controls: CameraViewControls): boolean {
  const is3d = mode === '3d';
  switch (key) {
    case '[':
      if (!is3d) return false;
      controls.rotate(ROTATE_STEP);
      return true;
    case ']':
      if (!is3d) return false;
      controls.rotate(-ROTATE_STEP);
      return true;
    case '}':
      if (!is3d) return false;
      controls.tilt(TILT_STEP);
      return true;
    case '{':
      if (!is3d) return false;
      controls.tilt(-TILT_STEP);
      return true;
    case '+':
    case '=':
      controls.zoomBy(ZOOM_STEP);
      return true;
    case '-':
    case '_':
      controls.zoomBy(1 / ZOOM_STEP);
      return true;
    case '0':
      controls.reset();
      return true;
    default:
      return false;
  }
}
