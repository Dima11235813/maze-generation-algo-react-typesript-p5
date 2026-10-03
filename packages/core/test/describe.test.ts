import { describeCell, describeGenStep, describePosition, describeSolveStep } from '../src';
import { threeByThree } from './fixtures';

describe('describe', () => {
  const s = threeByThree();

  it('describes positions 1-based', () => {
    expect(describePosition(s.grid, 0)).toBe('row 1, column 1');
    expect(describePosition(s.grid, 5)).toBe('row 2, column 3');
  });

  it('describes cells with exits, start and goal', () => {
    expect(describeCell(s, 0)).toBe('Row 1, column 1. Dead end, open to the east. Start.');
    expect(describeCell(s, 1)).toBe('Row 1, column 2. Open to the east and west.');
    expect(describeCell(s, 8)).toBe('Row 3, column 3. Dead end, open to the west. Goal.');
  });

  it('describes every generator step verb', () => {
    const g = s.grid;
    expect(describeGenStep(g, { t: 'visit', cell: 4 })).toBe('Visiting row 2, column 2.');
    expect(describeGenStep(g, { t: 'carve', from: 0, to: 1 })).toContain('Carving');
    expect(describeGenStep(g, { t: 'backtrack', from: 1, to: 0 })).toContain('Backtracking');
    expect(describeGenStep(g, { t: 'frontier', add: [1, 2] })).toContain('2 added');
    expect(describeGenStep(g, { t: 'union', a: 0, b: 1 })).toContain('Joining');
    expect(describeGenStep(g, { t: 'walk', cell: 2 })).toContain('Random walk');
    expect(describeGenStep(g, { t: 'divide', cells: [0, 1], wallDir: 1, gap: 0 })).toContain(
      'Dividing 2',
    );
    expect(describeGenStep(g, { t: 'rotate', oldRoot: 0, newRoot: 1 })).toContain('Root moves');
    expect(describeGenStep(g, { t: 'done' })).toBe('Maze generation complete.');
  });

  it('describes every solver step verb', () => {
    const g = s.grid;
    const stats = {
      expanded: 3,
      discovered: 3,
      frontierPeak: 1,
      pathLength: 2,
      optimal: true,
      steps: 5,
    };
    expect(describeSolveStep(g, { t: 'expand', cell: 1, g: 1 })).toBe(
      'Expanding row 1, column 2 at distance 1.',
    );
    expect(describeSolveStep(g, { t: 'expand', cell: 1 })).toBe('Expanding row 1, column 2.');
    expect(describeSolveStep(g, { t: 'discover', cell: 2, from: 1 })).toContain('Discovered');
    expect(describeSolveStep(g, { t: 'relax', cell: 2, from: 1, oldG: 4, newG: 2 })).toContain(
      '4 to 2',
    );
    expect(describeSolveStep(g, { t: 'deadend', cell: 3 })).toContain('Dead end');
    expect(describeSolveStep(g, { t: 'mark', cell: 3, dir: 2, count: 1 })).toContain('south');
    expect(describeSolveStep(g, { t: 'move', from: 3, to: 6 })).toContain('Moving');
    expect(describeSolveStep(g, { t: 'path', cells: [0, 1, 2] })).toBe('Path found with 2 moves.');
    expect(describeSolveStep(g, { t: 'fail' })).toBe('No path exists.');
    expect(describeSolveStep(g, { t: 'done', stats })).toContain('expanding 3 cells');
  });
});
