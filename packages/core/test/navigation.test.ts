import {
  Dir,
  canMove,
  initialPose,
  move,
  stepBackward,
  stepForward,
  turnAround,
  turnLeft,
  turnRight,
} from '../src';
import { threeByThree } from './fixtures';

describe('navigation', () => {
  const s = threeByThree();

  it('starts at the start cell facing the first open passage', () => {
    expect(initialPose(s)).toEqual({ cell: 0, heading: Dir.E });
  });

  it('turns cyclically', () => {
    const p = { cell: 0, heading: Dir.N };
    expect(turnRight(p).heading).toBe(Dir.E);
    expect(turnLeft(p).heading).toBe(Dir.W);
    expect(turnAround(p).heading).toBe(Dir.S);
    expect(turnLeft(turnLeft(turnLeft(turnLeft(p))))).toEqual(p);
  });

  it('moves only through open passages (cell-snapped, no wall clipping)', () => {
    let p = initialPose(s);
    expect(canMove(s, 0, Dir.S)).toBe(false);
    expect(stepForward(s, p).cell).toBe(1);
    p = stepForward(s, stepForward(s, p)); // at cell 2 facing E
    expect(p.cell).toBe(2);
    expect(stepForward(s, p)).toBe(p); // wall ahead (grid edge)
    p = turnRight(p); // facing S
    expect(stepForward(s, p).cell).toBe(5);
    expect(stepBackward(s, { cell: 5, heading: Dir.S }).cell).toBe(2);
    expect(move(s, { cell: 5, heading: Dir.S }, Dir.E)).toEqual({ cell: 5, heading: Dir.S });
  });
});
