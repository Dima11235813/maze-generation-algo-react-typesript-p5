import { DIRS, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export type GrowingTreeSelection = 'newest' | 'oldest' | 'random' | 'mixed';

export interface GrowingTreeParams extends Record<string, unknown> {
  /** Which active cell to work on next. `newest` reproduces the recursive backtracker exactly. */
  readonly selection: GrowingTreeSelection;
}

export const growingTreeMeta: AlgorithmMeta = {
  id: 'growing-tree',
  name: 'Growing Tree',
  family: 'generator',
  summary:
    'Keep a list of active cells. Pick one by a policy, carve into one of its unvisited ' +
    'neighbours, or drop it when it has none. The policy is the whole algorithm: newest = ' +
    'recursive backtracker, random = simplified Prim, oldest = breadth-first ripples.',
  complexity: { time: 'O(V)', space: 'O(V)' },
  tags: ['frontier', 'randomized', 'perfect', 'parameterised', 'family'],
  params: [
    {
      key: 'selection',
      label: 'Cell selection',
      description: 'How the next active cell is chosen.',
      kind: 'enum',
      options: [
        { value: 'newest', label: 'Newest (= recursive backtracker)' },
        { value: 'oldest', label: 'Oldest (breadth-first ripples)' },
        { value: 'random', label: 'Random (= simplified Prim)' },
        { value: 'mixed', label: 'Mixed (50% newest, 50% random)' },
      ],
      default: 'newest',
    },
  ],
  docsSlug: 'learn/growing-tree',
  since: CORE_VERSION,
};

/**
 * The Growing Tree family. One loop, one knob. With `newest` the active list is a stack and
 * the algorithm is the recursive backtracker (same RNG draws, byte-identical walls); with
 * `random` it is Prim's simplified variant; `oldest` grows in rings like BFS; `mixed` blends
 * long corridors with the blobby Prim texture.
 */
export const growingTree: MazeGenerator<GrowingTreeParams> = {
  meta: growingTreeMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<GrowingTreeParams>) {
    const selection: GrowingTreeSelection = params?.selection ?? 'newest';
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const visited = new Uint8Array(total);
    const active: CellId[] = [];
    const candidates: CellId[] = [];

    const pickIndex = (): number => {
      switch (selection) {
        case 'newest':
          return active.length - 1;
        case 'oldest':
          return 0;
        case 'random':
          return rng.int(active.length);
        case 'mixed':
          return rng.next() < 0.5 ? active.length - 1 : rng.int(active.length);
      }
    };

    const start: CellId = 0;
    visited[start] = 1;
    active.push(start);
    yield { t: 'frontier', add: [start] } satisfies GenStep;

    while (active.length > 0) {
      const index = pickIndex();
      const cell = active[index] as CellId;
      yield { t: 'visit', cell } satisfies GenStep;

      candidates.length = 0;
      for (const d of DIRS) {
        const nb = neighbor(grid, cell, d);
        if (nb !== NO_CELL && visited[nb] === 0) candidates.push(nb);
      }

      if (candidates.length > 0) {
        const next = candidates[rng.int(candidates.length)] as CellId;
        removeWall(walls, grid, cell, next);
        yield { t: 'carve', from: cell, to: next } satisfies GenStep;
        visited[next] = 1;
        active.push(next);
        yield { t: 'frontier', add: [next] } satisfies GenStep;
      } else {
        // Exhausted: retire the cell (splice keeps the list order the policies rely on).
        active.splice(index, 1);
        yield { t: 'frontier', remove: [cell] } satisfies GenStep;
      }
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
