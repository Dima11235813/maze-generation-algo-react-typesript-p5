import {
  ALL_WALLS,
  Dir,
  WALL,
  addWall,
  createGrid,
  createMazeState,
  createWalls,
  hasWall,
  isConnected,
  isPerfectMaze,
  openDirs,
  openNeighbors,
  passageCount,
  removeWall,
  wallsAreSymmetric,
} from '../src';
import { threeByThree, twoByTwoClosed } from './fixtures';

describe('walls', () => {
  it('uses bit index = Dir', () => {
    expect(WALL.N).toBe(1);
    expect(WALL.E).toBe(2);
    expect(WALL.S).toBe(4);
    expect(WALL.W).toBe(8);
    expect(ALL_WALLS).toBe(15);
  });

  it('createWalls fills every wall', () => {
    const g = createGrid(3, 2);
    const w = createWalls(g);
    expect(w.length).toBe(6);
    expect([...w].every((v) => v === ALL_WALLS)).toBe(true);
  });

  it('removeWall / addWall keep symmetry and reject non-adjacent cells', () => {
    const g = createGrid(3, 3);
    const w = createWalls(g);
    removeWall(w, g, 4, 5);
    expect(hasWall(w, 4, Dir.E)).toBe(false);
    expect(hasWall(w, 5, Dir.W)).toBe(false);
    expect(hasWall(w, 4, Dir.N)).toBe(true);
    addWall(w, g, 4, 5);
    expect(hasWall(w, 4, Dir.E)).toBe(true);
    expect(hasWall(w, 5, Dir.W)).toBe(true);
    expect(() => removeWall(w, g, 0, 8)).toThrow(/not adjacent/);
  });

  it('createMazeState validates and freezes', () => {
    const g = createGrid(2, 2);
    expect(() => createMazeState(g, new Uint8Array(3), 0, 3)).toThrow(RangeError);
    expect(() => createMazeState(g, new Uint8Array(4), 0, 4)).toThrow(RangeError);
    const s = createMazeState(g, createWalls(g), 0, 3);
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('reports open directions and neighbours for the 3x3 fixture', () => {
    const s = threeByThree();
    expect(openDirs(s, 0)).toEqual([Dir.E]);
    expect(openDirs(s, 1)).toEqual([Dir.E, Dir.W]);
    expect(openDirs(s, 5)).toEqual([Dir.N, Dir.W]);
    expect(openNeighbors(s, 2)).toEqual([5, 1]);
    expect(openNeighbors(s, 8)).toEqual([7]);
  });

  it('classifies perfect and imperfect mazes', () => {
    const s = threeByThree();
    expect(wallsAreSymmetric(s)).toBe(true);
    expect(isConnected(s)).toBe(true);
    expect(passageCount(s)).toBe(8);
    expect(isPerfectMaze(s)).toBe(true);

    const closed = twoByTwoClosed();
    expect(wallsAreSymmetric(closed)).toBe(true);
    expect(isConnected(closed)).toBe(false);
    expect(isPerfectMaze(closed)).toBe(false);

    // asymmetric: cell 0 open east but cell 1 closed west
    const g = createGrid(2, 1);
    const bad = createMazeState(g, Uint8Array.from([0xd, 0xf]), 0, 1);
    expect(wallsAreSymmetric(bad)).toBe(false);
  });
});
