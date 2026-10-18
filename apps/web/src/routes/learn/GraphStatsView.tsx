/**
 * The M1 graph demo read as a graph: cells (vertices), passages (edges), pieces, loops and dead
 * ends, whether it is a tree, and the selected cell's degree. A DOM view, so it is read out.
 */
import { DIR_NAMES, describePosition, openDirs, type CellId, type MazeState } from '@maze/core';
import { treeVerdict, type GraphStats } from '../../learn/graphDemo';
import { Note, StatGrid } from './StructureParts';

export interface GraphStatsViewProps {
  state: MazeState;
  stats: GraphStats;
  selected: CellId | null;
}

export function GraphStatsView({ state, stats, selected }: GraphStatsViewProps) {
  const dirs = selected === null ? [] : openDirs(state, selected);
  return (
    <div className="flex flex-col gap-3">
      <StatGrid
        stats={[
          ['Cells', stats.cells],
          ['Passages', stats.passages],
          ['Pieces', stats.pieces],
          ['Loops', stats.loops],
          ['Dead ends', stats.deadEnds],
        ]}
      />
      <p className="text-sm font-medium" data-testid="tree-verdict">
        {treeVerdict(stats)}
      </p>
      <p className="text-sm">
        {selected === null ? (
          'No cell selected.'
        ) : (
          <>
            Selected: <strong>{describePosition(state.grid, selected)}</strong>, degree{' '}
            <strong>{dirs.length}</strong>
            {dirs.length > 0
              ? ` (passages ${dirs.map((d) => DIR_NAMES[d]).join(', ')})`
              : ' (no passages: cut off on its own)'}
            .
          </>
        )}
      </p>
      <Note>
        Cells are vertices and open passages are edges. Loops = passages - cells + pieces. Cells on
        a loop are tinted; cells cut off from the start are shaded.
      </Note>
    </div>
  );
}
