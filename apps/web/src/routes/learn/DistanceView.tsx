/**
 * The distance map (proj-mgmt/13 section 4.2): each settled cell's distance from the start. Small
 * mazes get a numeric grid (visual only; the summary sentence carries the same facts for screen
 * readers), larger ones just the summary.
 */
import { colOf, describePosition, rowOf, type Grid } from '@maze/core';
import { cn } from '@maze/ui';
import type { DistanceSnapshot } from '../../learn/distanceModel';

/** Above this many columns the numbers stop fitting a phone. */
const MAX_GRID_COLUMNS = 16;
const MAX_GRID_CELLS = 400;

export interface DistanceViewProps {
  grid: Grid | null;
  distances: DistanceSnapshot | null;
  /** What the number means: 'steps' (BFS rings) or 'cost' (Dijkstra/A*). */
  unit: 'steps' | 'cost';
  origin?: 'start' | 'goal';
}

export function DistanceView({ grid, distances, unit, origin = 'start' }: DistanceViewProps) {
  if (!grid || !distances) return null;
  const { dist, settled, max, last } = distances;
  const lastDist = last !== null ? (dist[last] ?? -1) : -1;
  const summary =
    settled === 0
      ? 'No cell settled yet.'
      : `${String(settled)} cell${settled === 1 ? '' : 's'} settled; farthest ${String(max)} ${unit === 'steps' ? 'steps' : 'cost'} from the ${origin}${
          last !== null ? `; last ${describePosition(grid, last)} at ${String(lastDist)}` : ''
        }.`;
  const showGrid = grid.width <= MAX_GRID_COLUMNS && grid.width * grid.height <= MAX_GRID_CELLS;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{summary}</p>
      {showGrid ? (
        <div
          aria-hidden="true"
          className="grid gap-px overflow-x-auto rounded-md border border-border bg-border p-px font-mono text-[10px] tabular-nums"
          style={{ gridTemplateColumns: `repeat(${String(grid.width)}, minmax(1.25rem, 1fr))` }}
        >
          {Array.from({ length: grid.width * grid.height }, (_, cell) => {
            const d = dist[cell] ?? -1;
            const ring = d >= 0 && d % 2 === 1;
            return (
              <span
                key={cell}
                data-row={rowOf(grid, cell)}
                data-col={colOf(grid, cell)}
                className={cn(
                  'flex h-5 items-center justify-center bg-panel',
                  ring && 'bg-accent/15',
                  cell === last && 'font-bold text-accent',
                  d < 0 && 'text-transparent',
                )}
              >
                {d >= 0 ? d : '.'}
              </span>
            );
          })}
        </div>
      ) : null}
      <p className="text-xs text-muted">
        {unit === 'steps'
          ? `Every cell shows how many steps it is from the ${origin}: the rings BFS explores, one distance at a time.`
          : `Every settled cell shows its cheapest known cost from the ${origin}; once settled it never changes.`}
      </p>
    </div>
  );
}
