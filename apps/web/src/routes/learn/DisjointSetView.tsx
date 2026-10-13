/**
 * Kruskal's disjoint sets (proj-mgmt/13 section 4.2): how many separate components remain, the
 * largest ones and the latest union. Shown by generator lessons (M4).
 */
import { describePosition, type Grid } from '@maze/core';
import type { DisjointSetSnapshot } from '../../learn/disjointSetModel';
import { Note, StatGrid } from './StructureParts';

export interface DisjointSetViewProps {
  grid: Grid | null;
  sets: DisjointSetSnapshot | null;
}

export function DisjointSetView({ grid, sets }: DisjointSetViewProps) {
  if (!grid || !sets) return <p className="text-sm text-muted">Preparing the demo...</p>;
  return (
    <div className="flex flex-col gap-3">
      <StatGrid
        stats={[
          ['Components', sets.sets],
          ['Unions', sets.unions],
          ['Cells', sets.cells],
        ]}
      />
      <p className="text-sm">
        {sets.lastUnion ? (
          <>
            Last union joined <strong>{describePosition(grid, sets.lastUnion.a)}</strong> and{' '}
            <strong>{describePosition(grid, sets.lastUnion.b)}</strong> into a component of{' '}
            {sets.lastUnion.size} cells.
          </>
        ) : (
          'No unions yet: every cell is its own component.'
        )}
      </p>
      {sets.largest.length > 0 ? (
        <ol aria-label="Largest components" className="flex flex-col gap-1 text-sm">
          {sets.largest.map((c) => (
            <li key={c.root} className="flex items-center justify-between gap-2">
              <span>Component around {describePosition(grid, c.root)}</span>
              <span className="font-mono text-xs tabular-nums">{c.size} cells</span>
            </li>
          ))}
        </ol>
      ) : null}
      <Note>
        A wall is removed only between two different components; joining cells that are already
        connected would close a loop. One component left means the spanning tree is complete.
      </Note>
    </div>
  );
}
