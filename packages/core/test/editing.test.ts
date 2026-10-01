import {
  Dir,
  EditHistory,
  applyEdit,
  applyPatch,
  createGrid,
  createRng,
  generators,
  hasWall,
  isDeadEnd,
  isPerfectMaze,
  passageCount,
  runToEnd,
  validateMaze,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

describe('editing', () => {
  it('toggleWall is symmetric and self-inverse', () => {
    const s = threeByThree();
    const { next, inverse } = applyEdit(s, { t: 'toggleWall', a: 0, b: 3 }); // open 0-3 (a loop)
    expect(hasWall(next.walls, 0, Dir.S)).toBe(false);
    expect(hasWall(next.walls, 3, Dir.N)).toBe(false);
    expect(hasWall(s.walls, 0, Dir.S)).toBe(true); // input untouched
    const back = applyPatch(next, inverse);
    expect(Array.from(back.walls)).toEqual(Array.from(s.walls));
    expect(() => applyEdit(s, { t: 'toggleWall', a: 0, b: 8 })).toThrow(RangeError);
  });

  it('setStart / setGoal validate cells and invert to the previous value', () => {
    const s = threeByThree();
    const r = applyEdit(s, { t: 'setGoal', cell: 4 });
    expect(r.next.goal).toBe(4);
    expect(applyPatch(r.next, r.inverse).goal).toBe(8);
    expect(() => applyEdit(s, { t: 'setStart', cell: 99 })).toThrow(RangeError);
  });

  it('resize crops from the top-left, re-seals the cut edge, pads with walls, and inverts losslessly', () => {
    const s = threeByThree();
    const small = applyEdit(s, { t: 'resize', width: 2, height: 2 });
    expect(small.next.grid).toEqual(createGrid(2, 2));
    // cell 1 (row 0, col 1) was open east towards the cropped column; now sealed
    expect(hasWall(small.next.walls, 1, Dir.E)).toBe(true);
    expect(hasWall(small.next.walls, 0, Dir.E)).toBe(false); // 0-1 passage survives
    expect(small.next.goal).toBe(3); // clamped into the new grid
    const restored = applyPatch(small.next, small.inverse);
    expect(restored.grid).toEqual(s.grid);
    expect(Array.from(restored.walls)).toEqual(Array.from(s.walls));
    expect(restored.goal).toBe(8);

    const big = applyEdit(s, { t: 'resize', width: 4, height: 4 }).next;
    expect(passageCount(big)).toBe(passageCount(s)); // padded cells are fully walled
    expect(hasWall(big.walls, 15, Dir.N)).toBe(true);
  });

  it('validateMaze reports unreachable goals, isolated cells, loops and coincident start/goal', () => {
    expect(validateMaze(threeByThree())).toEqual([]);
    const closed = validateMaze(twoByTwoClosed());
    expect(closed.map((i) => i.code)).toEqual(['goal-unreachable', 'isolated-cells']);
    expect(closed[1]?.cells).toEqual([1, 2, 3]);

    const looped = applyEdit(threeByThree(), { t: 'toggleWall', a: 0, b: 3 }).next;
    expect(validateMaze(looped).map((i) => i.code)).toEqual(['not-perfect']);

    const same = applyEdit(threeByThree(), { t: 'setGoal', cell: 0 }).next;
    expect(validateMaze(same).map((i) => i.code)).toContain('start-equals-goal');
  });

  it('isDeadEnd', () => {
    const s = threeByThree();
    expect(isDeadEnd(s, 0)).toBe(true);
    expect(isDeadEnd(s, 1)).toBe(false);
  });

  it('EditHistory supports undo/redo and drops the redo stack on a new edit', () => {
    const start = runToEnd(generators.require('recursive-backtracker').run(createGrid(5, 4), createRng('edit')));
    const h = new EditHistory(start);
    expect(h.canUndo).toBe(false);
    h.apply({ t: 'toggleWall', a: 0, b: 1 });
    h.apply({ t: 'setGoal', cell: 7 });
    expect(h.state.goal).toBe(7);
    expect(h.canUndo).toBe(true);
    h.undo();
    expect(h.state.goal).toBe(start.goal);
    expect(h.canRedo).toBe(true);
    h.redo();
    expect(h.state.goal).toBe(7);
    h.undo();
    h.undo();
    expect(Array.from(h.state.walls)).toEqual(Array.from(start.walls));
    expect(isPerfectMaze(h.state)).toBe(true);
    h.apply({ t: 'resize', width: 3, height: 3 });
    expect(h.canRedo).toBe(false);
    expect(h.patches()).toHaveLength(1);
    h.undo();
    expect(h.state.grid).toEqual(start.grid);
  });
});
