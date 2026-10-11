import { useEffect, useState } from 'react';

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** Reactive `matchMedia`; returns `false` where media queries are unavailable (SSR, old jsdom). */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = () => {
      setValue(mq.matches);
    };
    setValue(mq.matches);
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, [query]);
  return value;
}

/**
 * Narrow (phone / small tablet) layout. Expressed as a max-width query so environments without
 * media-query support (tests) fall back to the full desktop layout.
 */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 1023.98px)');
}

/** Touch-first device (no fine pointer such as a mouse or trackpad). */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}
