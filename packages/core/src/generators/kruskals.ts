import { Dir, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import { DisjointSet } from './disjointSet';
import type { MazeGenerator } from './types';

export const kruskalsMeta: AlgorithmMeta = {
  id: 'kruskals',
  name: "Kruskal's (randomised)",
  family: 'generator',
  summary:
    'Shuffle every wall, then knock each one down only if it joins two cells that are not yet ' +
    'connected (tracked with a disjoint set). Components merge everywhere at once, giving an ' +
    'even texture with many short dead ends and little river.',
  complexity: { time: 'O(E alpha(V))', space: 'O(V)' },
  tags: ['union-find', 'randomized', 'perfect', 'short-dead-ends', 'global'],
  params: [],
  docsSlug: 'learn/kruskals',
  since: CORE_VERSION,
};

/** Each interior wall is an edge; encode as `cell * 2 + (0 = east, 1 = south)` to avoid objects. */
function collectEdges(grid: Grid): number[] {
  const edges: number[] = [];
  const total = cellCount(grid);
  for (let cell = 0; cell < total; cell++) {
    if (neighbor(grid, cell, Dir.E) !== NO_CELL) edges.push(cell * 2);
    if (neighbor(grid, cell, Dir.S) !== NO_CELL) edges.push(cell * 2 + 1);
  }
  return edges;
}

/**
 * Randomised Kruskal's algorithm: a minimum spanning tree over random edge weights, where
 * "random weights" is implemented by shuffling the edge list. Unlike the walk-based
 * algorithms it has no notion of a current cell - the maze condenses out of many small
 * fragments, which is exactly what makes it a good illustration of union-find.
 */
export const kruskals: MazeGenerator = {
  meta: kruskalsMeta,
  *run(grid: Grid, rng: Rng) {
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const sets = new DisjointSet(total);
    const edges = rng.shuffle(collectEdges(grid));

    for (const edge of edges) {
      if (sets.count === 1) break; // spanning tree complete, remaining edges would make loops
      const a: CellId = edge >> 1;
      const b: CellId = neighbor(grid, a, edge % 2 === 0 ? Dir.E : Dir.S);
      // Only edges between different components may be added; anything else closes a cycle.
      if (!sets.union(a, b)) {
        yield { t: 'reject', a, b } satisfies GenStep;
        continue;
      }
      yield { t: 'union', a, b } satisfies GenStep;
      removeWall(walls, grid, a, b);
      yield { t: 'carve', from: a, to: b } satisfies GenStep;
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
