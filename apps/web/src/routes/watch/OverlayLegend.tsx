import { resolve, rgbToCss, type RenderTheme } from '@maze/renderer';

export interface OverlayLegendProps {
  theme: RenderTheme;
  hideHeading?: boolean;
}

/** Colour swatches with text labels so the solve overlay is never colour-only. */
export function OverlayLegend({ theme, hideHeading = false }: OverlayLegendProps) {
  const items: { label: string; color: string; shape?: 'square' | 'disc' | 'diamond' | 'line' }[] =
    [
      {
        label: 'Frontier (discovered, waiting)',
        color: rgbToCss(resolve(theme, theme.solveFrontier)),
      },
      { label: 'Expanded (visited)', color: rgbToCss(resolve(theme, theme.solveExpanded)) },
      { label: 'Dead end', color: rgbToCss(resolve(theme, theme.solveDeadEnd)) },
      { label: 'Path found', color: rgbToCss(resolve(theme, theme.path)), shape: 'line' },
      { label: 'Start', color: rgbToCss(resolve(theme, theme.start)), shape: 'disc' },
      { label: 'Goal', color: rgbToCss(resolve(theme, theme.goal)), shape: 'diamond' },
    ];
  return (
    <section aria-labelledby="legend-heading" className="flex flex-col gap-2">
      <h3
        id="legend-heading"
        className={
          hideHeading ? 'sr-only' : 'text-xs font-semibold tracking-wide text-muted uppercase'
        }
      >
        Legend
      </h3>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" role="list">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 border border-border"
              style={{
                background: it.color,
                borderRadius: it.shape === 'disc' ? '9999px' : 0,
                transform: it.shape === 'diamond' ? 'rotate(45deg) scale(0.8)' : undefined,
                height: it.shape === 'line' ? 4 : undefined,
              }}
            />
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
