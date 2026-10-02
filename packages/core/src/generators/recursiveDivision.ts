import { Dir, cellCount, idOf, neighbor, type CellId, type Grid } from '../grid';
import type { AlgorithmMeta } from '../meta';
import type { Rng } from '../rng';
import type { GenStep } from '../steps';
import { addWall, createMazeState, createWalls, removeWall } from '../walls';
import { CORE_VERSION } from '../version';
import type { MazeGenerator } from './types';

export interface RecursiveDivisionParams extends Record<string, unknown> {
  /**
   * Stop dividing once a region fits inside `minSize x minSize`. 1 gives a perfect maze;
   * larger values leave open rooms (which contain cycles).
   */
  readonly minSize: number;
}

export const recursiveDivisionMeta: AlgorithmMeta = {
  id: 'recursive-division',
  name: 'Recursive Division',
  family: 'generator',
  summary:
    'Start from an open field and add walls instead of removing them: split the area with a ' +
    'straight wall that has one gap, then recurse into both halves. Long straight walls and ' +
    'boxy rooms give an architectural look; the only wall-adding algorithm in the catalogue.',
  complexity: { time: 'O(V)', space: 'O(log V) stack' },
  tags: ['wall-adder', 'divide-and-conquer', 'randomized', 'perfect', 'rooms', 'straight-walls'],
  params: [
    {
      key: 'minSize',
      label: 'Minimum room size',
      description: '1 keeps the maze perfect; larger values leave open rooms with cycles.',
      kind: 'int',
      min: 1,
      max: 64,
      default: 1,
    },
  ],
  docsSlug: 'learn/recursive-division',
  since: CORE_VERSION,
};

interface Region {
  readonly row: number;
  readonly col: number;
  readonly height: number;
  readonly width: number;
}

/**
 * Recursive Division. Every region is connected when we start on it (initially the whole open
 * field). A wall across it with exactly one gap splits it into two connected halves joined by
 * exactly one passage, so the passage graph stays a tree all the way down. Regions are kept
 * on an explicit stack so very large mazes cannot overflow the call stack.
 */
export const recursiveDivision: MazeGenerator<RecursiveDivisionParams> = {
  meta: recursiveDivisionMeta,
  *run(grid: Grid, rng: Rng, params?: Partial<RecursiveDivisionParams>) {
    const minSize = Math.max(1, Math.floor(params?.minSize ?? 1));
    const total = cellCount(grid);
    const walls = createWalls(grid);

    // Phase 1: open the field - knock down every interior wall.
    for (let cell = 0; cell < total; cell++) {
      const east = neighbor(grid, cell, Dir.E);
      if (east !== -1) {
        removeWall(walls, grid, cell, east);
        yield { t: 'carve', from: cell, to: east } satisfies GenStep;
      }
      const south = neighbor(grid, cell, Dir.S);
      if (south !== -1) {
        removeWall(walls, grid, cell, south);
        yield { t: 'carve', from: cell, to: south } satisfies GenStep;
      }
    }

    // Phase 2: divide.
    const stack: Region[] = [{ row: 0, col: 0, height: grid.height, width: grid.width }];
    while (stack.length > 0) {
      const region = stack.pop() as Region;
      const { row, col, height, width } = region;
      const fitsRoom = width <= minSize && height <= minSize;
      if (fitsRoom || (width < 2 && height < 2)) continue;

      // Choose the orientation: split the longer side; a side that already fits the room
      // size is never split; ties are decided by a coin.
      let horizontal: boolean;
      if (width <= minSize || width < 2) horizontal = true;
      else if (height <= minSize || height < 2) horizontal = false;
      else if (width > height) horizontal = false;
      else if (height > width) horizontal = true;
      else horizontal = rng.next() < 0.5;

      if (horizontal) {
        // Wall between rows `row + split` and `row + split + 1`, open at one column.
        const split = rng.int(height - 1);
        const gapCol = col + rng.int(width);
        const r = row + split;
        const cells: CellId[] = [];
        for (let c = col; c < col + width; c++) {
          const a = idOf(grid, r, c);
          cells.push(a);
          if (c === gapCol) continue;
          const b = idOf(grid, r + 1, c);
          addWall(walls, grid, a, b);
          yield { t: 'seal', a, b } satisfies GenStep;
        }
        yield { t: 'divide', cells, wallDir: Dir.S, gap: idOf(grid, r, gapCol) } satisfies GenStep;
        stack.push({ row, col, height: split + 1, width });
        stack.push({ row: r + 1, col, height: height - split - 1, width });
      } else {
        // Wall between columns `col + split` and `col + split + 1`, open at one row.
        const split = rng.int(width - 1);
        const gapRow = row + rng.int(height);
        const c = col + split;
        const cells: CellId[] = [];
        for (let r = row; r < row + height; r++) {
          const a = idOf(grid, r, c);
          cells.push(a);
          if (r === gapRow) continue;
          const b = idOf(grid, r, c + 1);
          addWall(walls, grid, a, b);
          yield { t: 'seal', a, b } satisfies GenStep;
        }
        yield { t: 'divide', cells, wallDir: Dir.E, gap: idOf(grid, gapRow, c) } satisfies GenStep;
        stack.push({ row, col, height, width: split + 1 });
        stack.push({ row, col: c + 1, height, width: width - split - 1 });
      }
    }

    yield { t: 'done' } satisfies GenStep;
    return createMazeState(grid, walls, 0, total - 1);
  },
};
