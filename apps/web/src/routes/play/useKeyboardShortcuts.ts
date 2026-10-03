import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  /** Called for keydown events that are safe to treat as global shortcuts. */
  onKeyDown(e: KeyboardEvent): void;
  onKeyUp?(e: KeyboardEvent): void;
}

const TEXT_TARGETS = 'input, textarea, select, [contenteditable="true"], [role="dialog"]';
const ARROW_TARGETS =
  '[role="slider"], [role="combobox"], [role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="tablist"], [role="tab"], [role="menu"], [role="menuitem"]';

function isElement(t: EventTarget | null): t is HTMLElement {
  return t instanceof HTMLElement;
}

/**
 * Returns true when a global shortcut must NOT fire: the user is typing in a field or inside
 * a dialog, pressing Space/Enter on a focused control, or using arrows in an arrow-driven
 * widget (slider, select, tabs). Escape is always allowed.
 */
export function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const target = e.target;
  if (!isElement(target)) return false;
  if (target.closest(TEXT_TARGETS)) return true;
  const isArrow = e.key.startsWith('Arrow');
  // Tree widgets (the Tree view outline) own arrows, Home/End, Space and Enter.
  if (
    (isArrow || e.key === 'Home' || e.key === 'End' || e.key === ' ' || e.key === 'Enter') &&
    target.closest('[role="tree"]')
  ) {
    return true;
  }
  if (isArrow && target.closest(ARROW_TARGETS)) return true;
  if (
    (e.key === ' ' || e.key === 'Enter') &&
    target.closest('button, a, [role="button"], [role="switch"]')
  ) {
    return true;
  }
  return false;
}

/** Window-level keyboard shortcuts with the same ignore rules for keydown and keyup. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;
      ref.current.onKeyDown(e);
    };
    const up = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;
      ref.current.onKeyUp?.(e);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enabled]);
}
