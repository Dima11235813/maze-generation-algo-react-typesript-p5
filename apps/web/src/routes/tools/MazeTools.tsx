import { IconButton, Kbd, Tooltip, TooltipContent, TooltipTrigger, cn } from '@maze/ui';
import { ChevronsDownUp, ChevronsUpDown, GripVertical, type LucideIcon } from 'lucide-react';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  DOCKED,
  moveBy,
  toFraction,
  toPixels,
  type Box,
  type Fraction,
} from '../../maze/toolsPosition';
import { usePrefs } from '../../state/prefs';

export interface ToolAction {
  readonly id: string;
  readonly label: string;
  /** Keyboard shortcut shown in the tooltip. */
  readonly keys?: string;
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** Toggle buttons report their state (aria-pressed). */
  readonly pressed?: boolean;
  /** Draws the button filled (the main action, e.g. Play). */
  readonly emphasis?: boolean;
}

export interface ToolGroup {
  readonly id: string;
  readonly label: string;
  readonly actions: readonly ToolAction[];
}

export interface MazeToolsProps {
  readonly groups: readonly ToolGroup[];
  /**
   * `row`: in the page flow below the maze (phones and tablets), so the maze is never covered.
   * `floating`: a panel over the maze that can be dragged out of the way (desktop).
   */
  readonly variant: 'row' | 'floating';
}

const NUDGE = 16;
const NUDGE_FAST = 64;

function ToolButton({ action, size }: { action: ToolAction; size: 'icon' | 'icon-sm' }) {
  const Icon = action.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          size={size}
          variant={action.emphasis ? 'default' : 'ghost'}
          aria-label={action.label}
          {...(action.pressed !== undefined ? { 'aria-pressed': action.pressed } : {})}
          disabled={action.disabled ?? false}
          onClick={action.onPress}
          data-tool={action.id}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        {action.label}
        {action.keys ? <Kbd>{action.keys}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function Groups({ groups, size }: { groups: readonly ToolGroup[]; size: 'icon' | 'icon-sm' }) {
  return (
    <>
      {groups
        .filter((g) => g.actions.length > 0)
        .map((g, i) => (
          <div
            key={g.id}
            role="group"
            aria-label={g.label}
            className={cn(
              'flex shrink-0 items-center gap-0.5',
              i > 0 && 'border-l border-border pl-1',
            )}
          >
            {g.actions.map((a) => (
              <ToolButton key={a.id} action={a} size={size} />
            ))}
          </div>
        ))}
    </>
  );
}

/**
 * Quick actions for the maze: playback, solving, camera and view. Phones and tablets get a row
 * under the maze; desktops get a floating panel that is dragged by its grip (or moved with the
 * arrow keys on the grip, Home or a double-click docks it back in the corner) and can be
 * collapsed to the grip. Position and collapsed state persist.
 */
export function MazeTools({ groups, variant }: MazeToolsProps) {
  if (variant === 'row') {
    return (
      <div
        role="toolbar"
        aria-label="Maze tools"
        data-variant="row"
        className="relative flex shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-panel px-2 py-1"
      >
        <Groups groups={groups} size="icon" />
      </div>
    );
  }
  return <FloatingTools groups={groups} />;
}

function FloatingTools({ groups }: { groups: readonly ToolGroup[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const saved = usePrefs((s) => s.toolsPos);
  const collapsed = usePrefs((s) => s.toolsCollapsed);
  const set = usePrefs((s) => s.set);
  const [container, setContainer] = useState<Box | null>(null);
  const [widget, setWidget] = useState<Box | null>(null);
  /** Position while dragging (saved on release). */
  const [dragPos, setDragPos] = useState<Fraction | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const measure = () => {
      setContainer({ width: parent.clientWidth, height: parent.clientHeight });
      setWidget({ width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const pos = dragPos ?? saved;
  const placed = container && widget ? toPixels(pos, container, widget) : null;

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!container || !widget) return;
      set('toolsPos', moveBy(saved, dx, dy, container, widget));
    },
    [container, widget, saved, set],
  );

  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? NUDGE_FAST : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      e.stopPropagation();
      nudge(m[0], m[1]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      set('toolsPos', DOCKED);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!placed) return;
    drag.current = { x: e.clientX, y: e.clientY, left: placed.left, top: placed.top };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || !container || !widget) return;
    setDragPos(toFraction(d.left + e.clientX - d.x, d.top + e.clientY - d.y, container, widget));
  };
  const endDrag = () => {
    if (dragPos) set('toolsPos', dragPos);
    drag.current = null;
    setDragPos(null);
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Maze tools"
      data-variant="floating"
      className={cn(
        'absolute z-10 flex max-w-[min(30rem,calc(100%-1rem))] flex-wrap items-center gap-1 rounded-lg border border-border bg-panel/95 p-1 shadow backdrop-blur',
        // Docked bottom-right until measured, so there is no jump on first paint.
        !placed && 'right-2 bottom-2',
      )}
      style={placed ? { left: placed.left, top: placed.top } : undefined}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Move the maze tools"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
            className="flex h-8 w-5 cursor-grab touch-none items-center justify-center rounded text-muted hover:bg-panel-2 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => {
              set('toolsPos', DOCKED);
            }}
            onKeyDown={onGripKey}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Drag to move · arrow keys nudge · double-click or Home docks it
        </TooltipContent>
      </Tooltip>
      {collapsed ? null : <Groups groups={groups} size="icon-sm" />}
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            size="icon-sm"
            variant="ghost"
            aria-label={collapsed ? 'Show the maze tools' : 'Hide the maze tools'}
            aria-expanded={!collapsed}
            onClick={() => {
              set('toolsCollapsed', !collapsed);
            }}
          >
            {collapsed ? (
              <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
            )}
          </IconButton>
        </TooltipTrigger>
        <TooltipContent side="top">
          {collapsed ? 'Show the tools' : 'Tuck the tools away'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
