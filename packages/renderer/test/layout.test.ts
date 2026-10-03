import {
  Dir,
  cellCount,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  passageCount,
  recursiveBacktracker,
  runToEnd,
  type MazeState,
} from '@maze/core';
import {
  cellAt,
  cellCenter,
  clampZoom,
  collectWallSegments,
  createSegmentBuffer,
  fitScale,
  headingVector,
  headingYaw,
  segmentCapacity,
  segmentEndpoints,
  wallSideCount,
  wheelZoomFactor,
} from '../src/layout';

function fullyWalled(w: number, h: number): MazeState {
  const grid = createGrid(w, h);
  return createMazeState(grid, createWalls(grid), 0, cellCount(grid) - 1);
}

describe('collectWallSegments', () => {
  it('de-duplicates shared walls: a fully walled 2x2 has 12 unique segments', () => {
    const state = fullyWalled(2, 2);
    const buf = createSegmentBuffer(state.grid);
    expect(collectWallSegments(state, buf)).toBe(12);
    expect(buf.count).toBe(12);
    expect(wallSideCount(state)).toBe(16);
  });

  it('never exceeds the capacity bound 2wh + w + h', () => {
    const state = fullyWalled(7, 5);
    const buf = createSegmentBuffer(state.grid);
    const n = collectWallSegments(state, buf);
    expect(n).toBe(segmentCapacity(state.grid));
    expect(n).toBe(2 * 35 + 7 + 5);
  });

  it('a perfect maze has cells*4 - 2*passages wall sides and (sides + perimeter)/2 segments', () => {
    const grid = createGrid(3, 3);
    const state = runToEnd(recursiveBacktracker.run(grid, createRng('layout-3x3')));
    const passages = passageCount(state);
    expect(passages).toBe(8);
    const sides = wallSideCount(state);
    expect(sides).toBe(9 * 4 - 2 * passages);
    const buf = createSegmentBuffer(grid);
    const perimeter = 2 * (grid.width + grid.height);
    expect(collectWallSegments(state, buf)).toBe((sides + perimeter) / 2);
  });

  it('with a seen filter, a lone seen cell owns all four of its walls', () => {
    const state = fullyWalled(3, 3);
    const buf = createSegmentBuffer(state.grid);
    expect(collectWallSegments(state, buf, (c) => c === 4)).toBe(4);
    for (let i = 0; i < 4; i++) expect(buf.cells[i]).toBe(4);
  });

  it('with a seen filter, two adjacent seen cells share one wall', () => {
    const state = fullyWalled(3, 1);
    const buf = createSegmentBuffer(state.grid);
    // cells 0 and 1 seen: 4 + 4 - 1 shared = 7
    expect(collectWallSegments(state, buf, (c) => c < 2)).toBe(7);
  });
});

describe('segmentEndpoints', () => {
  const grid = createGrid(4, 3);
  const out = { x0: 0, y0: 0, x1: 0, y1: 0 };

  it('maps the four walls of cell (row 1, col 2) with cs = 10', () => {
    const cell = 1 * 4 + 2;
    expect(segmentEndpoints(grid, cell, Dir.N, 10, out)).toEqual({
      x0: 20,
      y0: 10,
      x1: 30,
      y1: 10,
    });
    expect(segmentEndpoints(grid, cell, Dir.E, 10, out)).toEqual({
      x0: 30,
      y0: 10,
      x1: 30,
      y1: 20,
    });
    expect(segmentEndpoints(grid, cell, Dir.S, 10, out)).toEqual({
      x0: 20,
      y0: 20,
      x1: 30,
      y1: 20,
    });
    expect(segmentEndpoints(grid, cell, Dir.W, 10, out)).toEqual({
      x0: 20,
      y0: 10,
      x1: 20,
      y1: 20,
    });
  });
});

describe('cell geometry', () => {
  const grid = createGrid(4, 3);

  it('cellCenter and cellAt round-trip', () => {
    const p = { x: 0, y: 0 };
    for (let cell = 0; cell < cellCount(grid); cell++) {
      cellCenter(grid, cell, 8, p);
      expect(cellAt(grid, p.x, p.y, 8)).toBe(cell);
    }
  });

  it('cellAt returns null outside the maze', () => {
    expect(cellAt(grid, -1, 0, 8)).toBeNull();
    expect(cellAt(grid, 0, -1, 8)).toBeNull();
    expect(cellAt(grid, 32, 0, 8)).toBeNull();
    expect(cellAt(grid, 0, 24, 8)).toBeNull();
    expect(cellAt(grid, 31.9, 23.9, 8)).toBe(11);
  });
});

describe('headings', () => {
  it('vectors point north = -y, east = +x, south = +y, west = -x', () => {
    const v = { x: 0, y: 0 };
    expect(headingVector(Dir.N, v)).toEqual({ x: 0, y: -1 });
    expect(headingVector(Dir.E, v)).toEqual({ x: 1, y: 0 });
    expect(headingVector(Dir.S, v)).toEqual({ x: 0, y: 1 });
    expect(headingVector(Dir.W, v)).toEqual({ x: -1, y: 0 });
  });

  it('yaw grows clockwise in quarter turns', () => {
    expect(headingYaw(Dir.N)).toBe(0);
    expect(headingYaw(Dir.E)).toBeCloseTo(Math.PI / 2);
    expect(headingYaw(Dir.S)).toBeCloseTo(Math.PI);
    expect(headingYaw(Dir.W)).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe('fitting and zoom', () => {
  it('fitScale picks the limiting axis and honours margins', () => {
    expect(fitScale(200, 100, 100, 100, 0)).toBe(1);
    expect(fitScale(200, 100, 100, 50, 0)).toBe(2);
    expect(fitScale(220, 120, 100, 100, 10)).toBe(1);
  });

  it('fitScale is 1 for degenerate inputs', () => {
    expect(fitScale(0, 0, 10, 10)).toBe(1);
    expect(fitScale(100, 100, 0, 10)).toBe(1);
  });

  it('clampZoom keeps zoom within bounds and wheel factors are monotone', () => {
    expect(clampZoom(0.01)).toBe(0.25);
    expect(clampZoom(100)).toBe(8);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });
});
