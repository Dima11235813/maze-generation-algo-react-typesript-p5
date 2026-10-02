import {
  ALL_WALLS,
  Dir,
  GenerationTracker,
  applyGenStep,
  createGrid,
  createWalls,
  describeGenStep,
  hasWall,
  replayGenSteps,
  type GenStep,
} from '../src';

describe('replay', () => {
  const grid = createGrid(3, 2);

  it('applyGenStep: carve removes, seal adds, other verbs leave walls alone', () => {
    const walls = createWalls(grid);
    applyGenStep(walls, grid, { t: 'carve', from: 0, to: 1 });
    expect(hasWall(walls, 0, Dir.E)).toBe(false);
    expect(hasWall(walls, 1, Dir.W)).toBe(false);

    applyGenStep(walls, grid, { t: 'seal', a: 1, b: 0 });
    expect(hasWall(walls, 0, Dir.E)).toBe(true);
    expect(hasWall(walls, 1, Dir.W)).toBe(true);

    const before = Array.from(walls);
    const informational: GenStep[] = [
      { t: 'visit', cell: 0 },
      { t: 'backtrack', from: 1, to: 0 },
      { t: 'frontier', add: [2], remove: [1] },
      { t: 'union', a: 0, b: 3 },
      { t: 'walk', cell: 4, erased: [5] },
      { t: 'divide', cells: [0, 1, 2], wallDir: Dir.S, gap: 1 },
      { t: 'rotate', oldRoot: 0, newRoot: 1 },
      { t: 'done' },
    ];
    for (const s of informational) applyGenStep(walls, grid, s);
    expect(Array.from(walls)).toEqual(before);
  });

  it('replayGenSteps starts from a fully walled grid and applies in order', () => {
    const walls = replayGenSteps(grid, [
      { t: 'carve', from: 0, to: 3 },
      { t: 'carve', from: 3, to: 4 },
      { t: 'seal', a: 0, b: 3 },
    ]);
    expect(walls[0]).toBe(ALL_WALLS);
    expect(hasWall(walls, 3, Dir.E)).toBe(false);
    expect(hasWall(walls, 3, Dir.N)).toBe(true);
    expect(() => replayGenSteps(grid, [{ t: 'carve', from: 0, to: 5 }])).toThrow(/not adjacent/);
  });

  it('seal is described and makes both cells visible without touching the DFS depth', () => {
    expect(describeGenStep(grid, { t: 'seal', a: 0, b: 1 })).toBe(
      'Adding a wall between row 1, column 1 and row 1, column 2.',
    );
    const t = new GenerationTracker(grid);
    t.apply({ t: 'carve', from: 0, to: 1 });
    expect(t.depth).toBe(1);
    t.apply({ t: 'seal', a: 4, b: 5 });
    expect(t.depth).toBe(1);
    expect(t.isSeen(4)).toBe(true);
    expect(t.isSeen(5)).toBe(true);
    expect(t.seenCount).toBe(4);
  });

  it('carve makes its endpoints visible at the post-increment depth (matches a following visit)', () => {
    const t = new GenerationTracker(grid);
    t.apply({ t: 'visit', cell: 0 });
    t.apply({ t: 'carve', from: 0, to: 1 });
    expect(t.isSeen(1)).toBe(true);
    expect(t.depthAtVisit[1]).toBe(1);
    expect(t.visitCount[1]).toBe(0);
    t.apply({ t: 'visit', cell: 1 });
    expect(t.depthAtVisit[1]).toBe(1);
    expect(t.visitCount[1]).toBe(1);
    expect(t.seenCount).toBe(2);
  });
});
