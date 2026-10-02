import { DIRS, NO_CELL, cellCount, idOf, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export const huntAndKillMeta: AlgorithmMeta = {
  id: 'hunt-and-kill',
  name: 'Hunt-and-Kill',
  family: 'generator',
  summary:
    'Walk randomly into unvisited cells ("kill") until you are boxed in, then scan the grid ' +
    'row by row for an unvisited cell next to the maze and continue from there ("hunt"). Long ' +
    'corridors like the backtracker but fewer dead ends, and no stack to keep.',
  complexity: { time: 'O(V^2) worst, ~O(V) typical', space: 'O(1) extra' },
  tags: ['random-walk', 'randomized', 'perfect', 'long-corridors', 'scan'],
  params: [],
  docsSlug: 'learn/hunt-and-kill',
  since: CORE_VERSION,
};

/**
 * Hunt-and-Kill. The kill phase is the backtracker's walk without the backtracking; the
 * hunt phase replaces the stack with a linear scan, which is the teachable inefficiency.
 * Rows above the hunt cursor are completely visited, so each hunt resumes where the last
 * one stopped instead of rescanning the whole grid.
 */
export const huntAndKill: MazeGenerator = {
  meta: huntAndKillMeta,
  *run(grid: Grid, rng: Rng) {
    const total = cellCount(grid);
    const walls = createWalls(grid);
    const visited = new Uint8Array(total);
    const candidates: CellId[] = [];
    let remaining = total - 1;
    let huntRow = 0;

    let current: CellId = 0;
    visited[current] = 1;

    while (remaining > 0) {
      yield { t: 'visit', cell: current } satisfies GenStep;

      // Kill: step into a random unvisited neighbour while one exists.
      candidates.length = 0;
      for (const d of DIRS) {
        const nb = neighbor(grid, current, d);
        if (nb !== NO_CELL && visited[nb] === 0) candidates.push(nb);
      }
      if (candidates.length > 0) {
        const next = candidates[rng.int(candidates.length)] as CellId;
        removeWall(walls, grid, current, next);
        yield { t: 'carve', from: current, to: next } satisfies GenStep;
        visited[next] = 1;
        remaining--;
        current = next;
        continue;
      }

      // Hunt: scan rows for an unvisited cell that touches the maze.
      let found: CellId = NO_CELL;
      for (let row = huntRow; row < grid.height && found === NO_CELL; row++) {
        const unvisitedInRow: CellId[] = [];
        for (let col = 0; col < grid.width; col++) {
          const cell = idOf(grid, row, col);
          if (visited[cell] === 1) continue;
          unvisitedInRow.push(cell);
          if (found !== NO_CELL) continue;
          for (const d of DIRS) {
            const nb = neighbor(grid, cell, d);
            if (nb !== NO_CELL && visited[nb] === 1) {
              found = cell;
              break;
            }
          }
        }
        // One step per scanned row keeps the stream bounded and shows the sweep.
        if (unvisitedInRow.length > 0) {
          yield { t: 'frontier', add: unvisitedInRow } satisfies GenStep;
        } else if (row === huntRow) {
          huntRow++; // this row is finished for good; never scan it again
        }
      }
      if (found === NO_CELL) break; // cannot happen on a connected grid; guards the loop

      // Join the hunted cell to a random visited neighbour and resume walking from it.
      candidates.length = 0;
      for (const d of DIRS) {
        const nb = neighbor(grid, found, d);
        if (nb !== NO_CELL && visited[nb] === 1) candidates.push(nb);
      }
      const from = candidates[rng.int(candidates.length)] as CellId;
      yield { t: 'visit', cell: found } satisfies GenStep;
      removeWall(walls, grid, from, found);
      yield { t: 'carve', from, to: found } satisfies GenStep;
      visited[found] = 1;
      remaining--;
      current = found;
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
