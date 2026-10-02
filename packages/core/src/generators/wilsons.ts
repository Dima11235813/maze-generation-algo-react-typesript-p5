import { DIRS, NO_CELL, cellCount, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export const wilsonsMeta: AlgorithmMeta = {
  id: 'wilsons',
  name: "Wilson's",
  family: 'generator',
  summary:
    'Start a random walk from any cell not yet in the maze; whenever the walk crosses its own ' +
    'path the loop is erased; when it reaches the maze the whole path is carved in. Uniform ' +
    'spanning trees like Aldous-Broder, but it speeds up as the maze grows instead of slowing.',
  complexity: { time: 'expected O(V log V)', space: 'O(V)' },
  tags: ['random-walk', 'loop-erased', 'uniform', 'randomized', 'perfect', 'unbiased'],
  params: [],
  docsSlug: 'learn/wilsons',
  since: CORE_VERSION,
};

/**
 * Wilson's algorithm (loop-erased random walks). The walk records, for every cell it passes,
 * the direction it left by; revisiting a cell overwrites that direction, which erases the
 * loop in one stroke. Once the walk hits the tree we follow the recorded directions from the
 * walk's origin and carve them. Also uniform, but unlike Aldous-Broder the hard part happens
 * first (the first walk has to find a single tree cell) and the end game is quick.
 */
export const wilsons: MazeGenerator = {
  meta: wilsonsMeta,
  *run(grid: Grid, rng: Rng) {
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const inTree = new Uint8Array(total);
    /** Next cell on the current walk's path, -1 when the cell is not on it. */
    const nextOnPath = new Int32Array(total).fill(-1);
    const onPath = new Uint8Array(total);
    const path: CellId[] = [];
    const options: CellId[] = [];

    // Cells not yet in the tree, in a bag we can draw from uniformly (swap-remove).
    const unvisited: CellId[] = [];
    for (let c = 1; c < total; c++) unvisited.push(c);
    inTree[0] = 1;
    yield { t: 'visit', cell: 0 } satisfies GenStep;

    while (unvisited.length > 0) {
      // Any unvisited cell works; a random one gives a livelier animation.
      const i = rng.int(unvisited.length);
      const origin = unvisited[i] as CellId;
      if (inTree[origin] === 1) {
        unvisited[i] = unvisited[unvisited.length - 1] as CellId;
        unvisited.pop();
        continue;
      }

      // Random walk until we touch the tree, erasing loops as they form.
      path.length = 0;
      path.push(origin);
      onPath[origin] = 1;
      let cell = origin;
      while (inTree[cell] === 0) {
        options.length = 0;
        for (const d of DIRS) {
          const nb = neighbor(grid, cell, d);
          if (nb !== NO_CELL) options.push(nb);
        }
        const next = options[rng.int(options.length)] as CellId;
        nextOnPath[cell] = next;
        if (onPath[next] === 1) {
          // Loop: drop every cell after `next` from the path.
          const erased: CellId[] = [];
          for (;;) {
            const last = path[path.length - 1] as CellId;
            if (last === next) break;
            path.pop();
            onPath[last] = 0;
            nextOnPath[last] = -1;
            erased.push(last);
          }
          yield { t: 'walk', cell: next, erased } satisfies GenStep;
        } else {
          if (inTree[next] === 0) {
            path.push(next);
            onPath[next] = 1;
          }
          yield { t: 'walk', cell: next } satisfies GenStep;
        }
        cell = next;
      }

      // Commit the loop-free path: carve from the origin to the tree.
      for (const c of path) {
        const next = nextOnPath[c] as CellId;
        removeWall(walls, grid, c, next);
        yield { t: 'carve', from: c, to: next } satisfies GenStep;
        inTree[c] = 1;
        onPath[c] = 0;
        nextOnPath[c] = -1;
      }
      // The origin is now in the tree; remove it from the bag.
      unvisited[i] = unvisited[unvisited.length - 1] as CellId;
      unvisited.pop();
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
