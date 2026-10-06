/**
 * Action builders for the maze tools widget, shared by Play and Watch so the same action has the
 * same name, icon and shortcut everywhere.
 */
import type { PlayerStatus } from '@maze/player';
import type { ViewMode } from '@maze/renderer';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  FastForward,
  Maximize,
  Maximize2,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  StepBack,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ROTATE_STEP, TILT_STEP, ZOOM_STEP, type CameraViewControls } from '../../maze/view';
import type { ToolAction } from './MazeTools';

export interface PlaybackState {
  readonly status: PlayerStatus | null;
  /** Something to play (a generator or an armed solver). */
  readonly armed: boolean;
  readonly canStepBack: boolean;
  readonly onToggle: () => void;
  readonly onStepBack: () => void;
  readonly onStep: () => void;
  readonly onRunToEnd: () => void;
}

export function playbackActions(p: PlaybackState): ToolAction[] {
  const playing = p.status === 'playing';
  const playable = p.armed && p.status !== null && p.status !== 'done';
  return [
    {
      id: 'step-back',
      label: 'Step back',
      keys: ',',
      icon: StepBack,
      onPress: p.onStepBack,
      disabled: !p.canStepBack,
    },
    {
      id: 'play',
      label: playing ? 'Pause' : 'Play',
      keys: 'Space',
      icon: playing ? Pause : Play,
      onPress: p.onToggle,
      disabled: !playable,
      pressed: playing,
      emphasis: !playing && playable,
    },
    {
      id: 'step',
      label: 'Step once',
      keys: '.',
      icon: SkipForward,
      onPress: p.onStep,
      disabled: !playable,
    },
    {
      id: 'run-to-end',
      label: 'Run to end',
      keys: 'End',
      icon: FastForward,
      onPress: p.onRunToEnd,
      disabled: !playable,
    },
  ];
}

/** Camera moves: rotate and tilt in 3D, zoom and reset everywhere. */
export function cameraActions(mode: ViewMode, controls: CameraViewControls): ToolAction[] {
  const orbit: ToolAction[] =
    mode === '3d'
      ? [
          {
            id: 'rotate-ccw',
            label: 'Rotate counter-clockwise',
            keys: '[',
            icon: RotateCcw,
            onPress: () => {
              controls.rotate(ROTATE_STEP);
            },
          },
          {
            id: 'rotate-cw',
            label: 'Rotate clockwise',
            keys: ']',
            icon: RotateCw,
            onPress: () => {
              controls.rotate(-ROTATE_STEP);
            },
          },
          {
            id: 'tilt-up',
            label: 'Look from higher',
            keys: '}',
            icon: ChevronUp,
            onPress: () => {
              controls.tilt(TILT_STEP);
            },
          },
          {
            id: 'tilt-down',
            label: 'Look from lower',
            keys: '{',
            icon: ChevronDown,
            onPress: () => {
              controls.tilt(-TILT_STEP);
            },
          },
        ]
      : [];
  return [
    ...orbit,
    {
      id: 'zoom-in',
      label: 'Zoom in',
      keys: '+',
      icon: ZoomIn,
      onPress: () => {
        controls.zoomBy(ZOOM_STEP);
      },
    },
    {
      id: 'zoom-out',
      label: 'Zoom out',
      keys: '-',
      icon: ZoomOut,
      onPress: () => {
        controls.zoomBy(1 / ZOOM_STEP);
      },
    },
    { id: 'reset-view', label: 'Reset view', keys: '0', icon: Maximize2, onPress: controls.reset },
  ];
}

const STAGE_SELECTOR = '[data-maze-stage]';

/** Fullscreen for the maze panel (hidden where the browser cannot fullscreen an element). */
export function useStageFullscreen(): {
  supported: boolean;
  active: boolean;
  toggle: () => void;
} {
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled;
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!supported) return;
    const onChange = () => {
      setActive(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [supported]);
  const toggle = useCallback(() => {
    if (!supported) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
    void stage?.requestFullscreen();
  }, [supported]);
  return { supported, active, toggle };
}

export function fullscreenAction(fs: ReturnType<typeof useStageFullscreen>): ToolAction[] {
  if (!fs.supported) return [];
  return [
    {
      id: 'fullscreen',
      label: fs.active ? 'Leave full screen' : 'Full screen maze',
      icon: fs.active ? Minimize : Maximize,
      onPress: fs.toggle,
      pressed: fs.active,
    },
  ];
}

/** Saves the current frame as a PNG through a temporary download link. */
export function downloadSnapshot(dataUrl: string, name: string): boolean {
  if (!dataUrl.startsWith('data:image/png')) return false;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function snapshotAction(onPress: () => void, disabled: boolean): ToolAction {
  return { id: 'snapshot', label: 'Save a picture (PNG)', icon: Camera, onPress, disabled };
}
