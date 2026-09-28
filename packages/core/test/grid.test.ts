import {
  Dir,
  NO_CELL,
  cellCount,
  colOf,
  createGrid,
  dirBetween,
  idOf,
  inBounds,
  isValidCell,
  manhattan,
  neighbor,
  opposite,
  rowOf,
} from '../src';

describe('grid', () => {
  const g = createGrid(4, 3); // 4 wide, 3 tall

  it('validates dimensions', () => {
    expect(() => createGrid(0, 3)).toThrow(RangeError);
    expect(() => createGrid(2.5, 3)).toThrow(RangeError);
    expect(() => createGrid(5000, 1)).toThrow(RangeError);
    expect(Object.isFrozen(g)).toBe(true);
  });

  it('maps ids to rows/cols and back (row-major, like the legacy getPointValsAtIndex)', () => {
    expect(cellCount(g)).toBe(12);
    expect(idOf(g, 0, 0)).toBe(0);
    expect(idOf(g, 1, 0)).toBe(4);
    expect(idOf(g, 2, 3)).toBe(11);
    expect(rowOf(g, 7)).toBe(1);
    expect(colOf(g, 7)).toBe(3);
    expect(inBounds(g, 2, 3)).toBe(true);
    expect(inBounds(g, 3, 0)).toBe(false);
    expect(inBounds(g, 0, -1)).toBe(false);
    expect(isValidCell(g, 11)).toBe(true);
    expect(isValidCell(g, 12)).toBe(false);
    expect(isValidCell(g, 1.5)).toBe(false);
  });

  it('finds neighbours in N,E,S,W order and NO_CELL at edges', () => {
    const centre = idOf(g, 1, 1); // 5
    expect(neighbor(g, centre, Dir.N)).toBe(1);
    expect(neighbor(g, centre, Dir.E)).toBe(6);
    expect(neighbor(g, centre, Dir.S)).toBe(9);
    expect(neighbor(g, centre, Dir.W)).toBe(4);
    expect(neighbor(g, 0, Dir.N)).toBe(NO_CELL);
    expect(neighbor(g, 0, Dir.W)).toBe(NO_CELL);
    expect(neighbor(g, 11, Dir.E)).toBe(NO_CELL);
    expect(neighbor(g, 11, Dir.S)).toBe(NO_CELL);
  });

  it('opposite and dirBetween are consistent', () => {
    expect(opposite(Dir.N)).toBe(Dir.S);
    expect(opposite(Dir.E)).toBe(Dir.W);
    expect(opposite(Dir.S)).toBe(Dir.N);
    expect(opposite(Dir.W)).toBe(Dir.E);
    expect(dirBetween(g, 5, 1)).toBe(Dir.N);
    expect(dirBetween(g, 5, 6)).toBe(Dir.E);
    expect(dirBetween(g, 5, 9)).toBe(Dir.S);
    expect(dirBetween(g, 5, 4)).toBe(Dir.W);
    expect(dirBetween(g, 5, 10)).toBeUndefined();
    expect(dirBetween(g, 3, 4)).toBeUndefined(); // wraps a row: not adjacent
  });

  it('computes manhattan distance', () => {
    expect(manhattan(g, 0, 11)).toBe(5);
    expect(manhattan(g, 5, 5)).toBe(0);
  });
});
