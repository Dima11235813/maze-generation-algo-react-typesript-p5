import fc from 'fast-check';
import {
  Dir,
  EditHistory,
  applyEdit,
  braid,
  createGrid,
  createRng,
  generators,
  mazeToSvg,
  nearestWall,
  neighbor,
  passageCount,
  runToEnd,
  snapshotEdit,
  wallsAreSymmetric,
  type EditOp,
  type MazeState,
} from '../src';

function maze(width: number, height: number, seed: string): MazeState {
  return runToEnd(
    generators.require('recursive-backtracker').run(createGrid(width, height), createRng(seed), {}),
  );
}

describe('nearestWall', () => {
  const grid = createGrid(4, 3);
  it('picks the edge the point is closest to', () => {
    expect(nearestWall(grid, 5, 0.5, 0.05)).toEqual({ a: 5, b: 1, dir: Dir.N });
    expect(nearestWall(grid, 5, 0.95, 0.5)).toEqual({ a: 5, b: 6, dir: Dir.E });
    expect(nearestWall(grid, 5, 0.5, 0.9)).toEqual({ a: 5, b: 9, dir: Dir.S });
    expect(nearestWall(grid, 5, 0.1, 0.5)).toEqual({ a: 5, b: 4, dir: Dir.W });
  });
  it('is null in the middle of a cell and on the outer boundary', () => {
    expect(nearestWall(grid, 5, 0.5, 0.5)).toBeNull();
    expect(nearestWall(grid, 0, 0.5, 0.02)).toBeNull();
    expect(nearestWall(grid, 3, 0.98, 0.5)).toBeNull();
  });
});

describe('editing keeps the maze consistent', () => {
  const opArb = (w: number, h: number) =>
    fc.oneof(
      fc
        .tuple(fc.integer({ min: 0, max: w * h - 1 }), fc.constantFrom(Dir.N, Dir.E, Dir.S, Dir.W))
        .map(([a, d]) => ({ a, d })),
      fc.integer({ min: 0, max: w * h - 1 }).map((cell) => ({ cell })),
    );

  it('random wall toggles and start/goal moves keep walls symmetric and undo back exactly', () => {
    fc.assert(
      fc.property(fc.string(), fc.array(opArb(8, 6), { maxLength: 60 }), (seed, raw) => {
        const start = maze(8, 6, seed);
        const history = new EditHistory(start);
        let applied = 0;
        for (const r of raw) {
          let op: EditOp | null = null;
          if ('a' in r) {
            const b = neighbor(start.grid, r.a, r.d);
            if (b >= 0) op = { t: 'toggleWall', a: r.a, b };
          } else {
            op =
              r.cell % 2 === 0 ? { t: 'setStart', cell: r.cell } : { t: 'setGoal', cell: r.cell };
          }
          if (!op) continue;
          history.apply(op);
          applied++;
          expect(wallsAreSymmetric(history.state)).toBe(true);
        }
        for (let i = 0; i < applied; i++) history.undo();
        expect(Array.from(history.state.walls)).toEqual(Array.from(start.walls));
        expect(history.state.start).toBe(start.start);
        expect(history.state.goal).toBe(start.goal);
      }),
      { numRuns: 60 },
    );
  });

  it('a braid applied as one snapshot edit undoes in one step', () => {
    const start = maze(10, 8, 'braid-edit');
    const braided = runToEnd(braid.run(start, createRng('b'), { percent: 100 }));
    expect(passageCount(braided)).toBeGreaterThan(passageCount(start));
    const history = new EditHistory(start);
    history.apply(snapshotEdit(braided));
    expect(Array.from(history.state.walls)).toEqual(Array.from(braided.walls));
    history.undo();
    expect(Array.from(history.state.walls)).toEqual(Array.from(start.walls));
    expect(applyEdit(start, snapshotEdit(start)).next.walls).toEqual(start.walls);
  });
});

describe('mazeToSvg', () => {
  it('draws every wall exactly once and is deterministic', () => {
    const s = maze(6, 5, 'svg');
    const svg = mazeToSvg(s, { cellSize: 10 });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(mazeToSvg(s, { cellSize: 10 })).toBe(svg);
    // Wall count: all cell sides minus open passages, shared walls counted once.
    const sides = 6 * 5 * 4;
    const interior = (6 - 1) * 5 + 6 * (5 - 1);
    const wallsDrawn = (svg.match(/M\d+ \d+[hv]/g) ?? []).length;
    expect(wallsDrawn).toBe(sides - interior - passageCount(s));
  });
});
