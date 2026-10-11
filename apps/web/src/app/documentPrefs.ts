import { useEffect, useState } from 'react';
import { usePrefs } from '../state/prefs';

/** Mirrors theme and reduced-motion preferences onto <html data-*> for the stylesheet. */
export function useApplyDocumentPrefs(): void {
  const theme = usePrefs((s) => s.theme);
  const motion = usePrefs((s) => s.reducedMotion);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    if (motion === 'system') delete root.dataset.reducedMotion;
    else root.dataset.reducedMotion = motion;
  }, [theme, motion]);
}

function systemReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Effective reduced-motion flag: user override wins, else the OS setting. */
export function useReducedMotion(): boolean {
  const pref = usePrefs((s) => s.reducedMotion);
  const [system, setSystem] = useState(systemReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setSystem(mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);
  return pref === 'system' ? system : pref === 'on';
}
