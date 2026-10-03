import { useMediaQuery } from '../lib/useMediaQuery';

/**
 * Layout tiers, aligned with Tailwind's `md` (768), `lg` (1024) and `xl` (1280) breakpoints.
 *
 * - mobile:  one scrolling column of collapsible sections
 * - tablet:  maze on top, sections in a two-column grid below
 * - desktop: maze beside one side column
 * - wide:    side column on each side of the maze
 *
 * Queries are max-width so environments without media queries (tests) resolve to `wide`.
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export function useBreakpoint(): Breakpoint {
  const mobile = useMediaQuery('(max-width: 767.98px)');
  const tablet = useMediaQuery('(max-width: 1023.98px)');
  const desktop = useMediaQuery('(max-width: 1279.98px)');
  if (mobile) return 'mobile';
  if (tablet) return 'tablet';
  if (desktop) return 'desktop';
  return 'wide';
}
