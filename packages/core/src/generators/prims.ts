import { DIRS, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import { BinaryHeap } from './binaryHeap';
import type { MazeGenerator } from './types';

export interface PrimsParams extends Record<string, unknown> {
  /**
   * `false` (default): simplified, cell-based Prim's - pick a random frontier cell.
   * `true`: "true" Prim's - give every edge a random weight and always take the cheapest
   * frontier edge, which yields the same distribution as randomised Kruskal's.
   */
  readonly weighted: boolean;
}

export const primsMeta: AlgorithmMeta = {
  id: 'prims',
  name: "Prim's (randomised)",
  family: 'generator',
  summary:
    'Grow one tree outward from the start: keep the set of cells touching the tree (the ' +
    'frontier) and attach a random one at a time. Radial, blob-like texture with many short ' +
    'dead ends and short, direct solutions.',
  complexity: { time: 'O(V) simplified, O(E log E) weighted', space: 'O(V)' },
  tags: ['frontier', 'randomized', 'perfect', 'short-dead-ends', 'radial'],
  params: [
    {
      key: 'weighted',
      label: 'Weighted edges (true Prim)',
      description:
        'Assign random weights to edges and always take the cheapest frontier edge. Produces ' +
        'the same maze distribution as randomised Kruskal.',
      kind: 'bool',
      default: false,
    },
  ],
  docsSlug: 'learn/prims',
  since: CORE_VERSION,
};

/**
 * Randomised Prim's algorithm.
 *
 * The simplified variant treats the frontier as a bag of *cells*: pick one uniformly, link
 * it to a random tree neighbour, add its unvisited neighbours to the bag. The weighted variant
 * is textbook Prim's on random edge weights with a binary heap. Both grow a single blob out
 * from the start cell, so the texture is radial: lots of little branches, little "river".
 */
export const prims: MazeGenerator<PrimsParams> = {
  meta: primsMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<PrimsParams>) {
    return yield* (params?.weighted ? runWeighted : runSimplified)(grid, rng);
  },
};

function* runSimplified(grid: Grid, rng: Rng): Generator<GenStep, ReturnType<typeof createMazeState>> {
  const total = cellCount(grid);
  const walls = createWalls(grid);
  const inTree = new Uint8Array(total);
  const inFrontier = new Uint8Array(total);
  const frontier: CellId[] = [];
  const treeNeighbors: CellId[] = [];

  /** Adds every unvisited, not-yet-queued neighbour of `cell` to the frontier bag. */
  const expand = (cell: CellId): CellId[] => {
    const added: CellId[] = [];
    for (const d of DIRS) {
      const nb = neighbor(grid, cell, d);
      if (nb !== NO_CELL && inTree[nb] === 0 && inFrontier[nb] === 0) {
        inFrontier[nb] = 1;
        frontier.push(nb);
        added.push(nb);
      }
    }
    return added;
  };

  const start: CellId = 0;
  inTree[start] = 1;
  yield { t: 'visit', cell: start } satisfies GenStep;
  const first = expand(start);
  if (first.length > 0) yield { t: 'frontier', add: first } satisfies GenStep;

  while (frontier.length > 0) {
    // Pick a uniformly random frontier cell; swap-remove keeps this O(1).
    const i = rng.int(frontier.length);
    const cell = frontier[i] as CellId;
    frontier[i] = frontier[frontier.length - 1] as CellId;
    frontier.pop();
    inFrontier[cell] = 0;

    // Link it to one of its neighbours that is already in the tree.
    treeNeighbors.length = 0;
    for (const d of DIRS) {
      const nb = neighbor(grid, cell, d);
      if (nb !== NO_CELL && inTree[nb] === 1) treeNeighbors.push(nb);
    }
    const from = treeNeighbors[rng.int(treeNeighbors.length)] as CellId;

    yield { t: 'visit', cell } satisfies GenStep;
    removeWall(walls, grid, from, cell);
    yield { t: 'carve', from, to: cell } satisfies GenStep;
    inTree[cell] = 1;

    const added = expand(cell);
    yield (added.length > 0
      ? { t: 'frontier', remove: [cell], add: added }
      : { t: 'frontier', remove: [cell] }) satisfies GenStep;
  }

  yield { t: 'done' } satisfies GenStep;
  return createMazeState(grid, walls, 0, total - 1);
}

interface Edge {
  readonly from: CellId;
  readonly to: CellId;
}

function* runWeighted(grid: Grid, rng: Rng): Generator<GenStep, ReturnType<typeof createMazeState>> {
  const total = cellCount(grid);
  const walls = createWalls(grid);
  const inTree = new Uint8Array(total);
  const inFrontier = new Uint8Array(total);
  const heap = new BinaryHeap<Edge>();

  /** Pushes every edge from `cell` to a non-tree neighbour with a fresh random weight. */
  const pushEdges = (cell: CellId): CellId[] => {
    const added: CellId[] = [];
    for (const d of DIRS) {
      const nb = neighbor(grid, cell, d);
      if (nb === NO_CELL || inTree[nb] === 1) continue;
      heap.push(rng.next(), { from: cell, to: nb });
      if (inFrontier[nb] === 0) {
        inFrontier[nb] = 1;
        added.push(nb);
      }
    }
    return added;
  };

  const start: CellId = 0;
  inTree[start] = 1;
  yield { t: 'visit', cell: start } satisfies GenStep;
  const first = pushEdges(start);
  if (first.length > 0) yield { t: 'frontier', add: first } satisfies GenStep;

  for (let entry = heap.pop(); entry !== undefined; entry = heap.pop()) {
    const { from, to } = entry.value;
    // A cell can be reached by several frontier edges; only the cheapest one wins.
    if (inTree[to] === 1) continue;

    yield { t: 'visit', cell: to } satisfies GenStep;
    removeWall(walls, grid, from, to);
    yield { t: 'carve', from, to } satisfies GenStep;
    inTree[to] = 1;
    inFrontier[to] = 0;

    const added = pushEdges(to);
    yield (added.length > 0
      ? { t: 'frontier', remove: [to], add: added }
      : { t: 'frontier', remove: [to] }) satisfies GenStep;
  }

  yield { t: 'done' } satisfies GenStep;
  return createMazeState(grid, walls, 0, total - 1);
}
