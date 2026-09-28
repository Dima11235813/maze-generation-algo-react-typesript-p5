import { createGrid, createMazeState, type MazeState } from '../src';

/**
 * The 3x3 perfect maze from proj-mgmt/02 section 2.2 whose single corridor snakes
 * 0-1-2-5-4-3-6-7-8. Nibbles are N=1, E=2, S=4, W=8.
 */
export const THREE_BY_THREE_NIBBLES = [0xd, 0x5, 0x3, 0x9, 0x5, 0x6, 0xc, 0x5, 0x7];
export const THREE_BY_THREE_PACKED = [0x5d, 0x93, 0x65, 0x5c, 0x07];
export const THREE_BY_THREE_BASE64URL = 'XZNlXAc';

export function threeByThree(): MazeState {
  return createMazeState(createGrid(3, 3), Uint8Array.from(THREE_BY_THREE_NIBBLES), 0, 8);
}

/** 2x2 with all walls: four isolated cells (not connected). */
export function twoByTwoClosed(): MazeState {
  return createMazeState(createGrid(2, 2), Uint8Array.from([0xf, 0xf, 0xf, 0xf]), 0, 3);
}
