import fc from 'fast-check';
import {
  RideAlongTracker,
  collect,
  createGrid,
  createRng,
  dirBetween,
  generators,
  hasWall,
  headingToward,
  neighbor,
  pathPoses,
  runToEnd,
  solvers,
  startPose,
  type MazeState,
  type SolveStep,
} from '../src';

const gridArb = fc.record({
  width: fc.integer({ min: 2, max: 12 }),
  height: fc.integer({ min: 2, max: 12 }),
});

function maze(width: number, height: number, seed: string): MazeState {
  return runToEnd(
    generators.require('recursive-backtracker').run(createGrid(width, height), createRng(seed), {}),
  );
}

function steps(solverId: string, state: MazeState): SolveStep[] {
  return collect(solvers.require(solverId).run(state, {}, createRng('ride'))).steps;
}

describe('ride along pose', () => {
  it('starts at the start facing an open passage', () => {
    const state = maze(6, 5, 'start');
    const pose = startPose(state);
    expect(pose.cell).toBe(state.start);
    expect(hasWall(state.walls, state.start, pose.heading)).toBe(false);
  });

  it('walking solvers are followed exactly: every pose is reached through an open passage, facing the way it moved', () => {
    fc.assert(
      fc.property(
        gridArb,
        fc.string(),
        fc.constantFrom('wall-follower', 'tremaux', 'pledge', 'random-mouse'),
        ({ width, height }, seed, id) => {
          const state = maze(width, height, seed);
          const ride = new RideAlongTracker(state);
          for (const step of steps(id, state)) {
            const before = ride.pose;
            ride.apply(step);
            const after = ride.pose;
            if (after.cell === before.cell) continue;
            expect(after.glide).toBe(false);
            expect(after.mode).toBe('walking');
            const d = dirBetween(state.grid, before.cell, after.cell);
            expect(d).toBeDefined();
            expect(hasWall(state.walls, before.cell, d!)).toBe(false);
            expect(neighbor(state.grid, before.cell, after.heading)).toBe(after.cell);
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('search solvers glide exactly when the next cell is not an open neighbour', () => {
    fc.assert(
      fc.property(
        gridArb,
        fc.string(),
        fc.constantFrom('bfs', 'dfs', 'astar', 'dijkstra'),
        ({ width, height }, seed, id) => {
          const state = maze(width, height, seed);
          const ride = new RideAlongTracker(state);
          for (const step of steps(id, state)) {
            const before = ride.pose;
            ride.apply(step);
            const after = ride.pose;
            if (after.cell === before.cell) continue;
            const d = dirBetween(state.grid, before.cell, after.cell);
            const open = d !== undefined && !hasWall(state.walls, before.cell, d);
            expect(after.glide).toBe(!open);
            expect(after.mode).toBe('searching');
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('replaying the same steps after a reset gives the same poses (rewind is exact)', () => {
    const state = maze(10, 8, 'rewind');
    const all = steps('bfs', state);
    const ride = new RideAlongTracker(state);
    ride.applyAll(all.slice(0, 40));
    const at40 = ride.pose;
    ride.applyAll(all.slice(40, 70));
    ride.reset();
    expect(ride.pose).toEqual(startPose(state));
    ride.applyAll(all.slice(0, 40));
    expect(ride.pose).toEqual(at40);
    expect(ride.steps).toBe(40);
  });

  it('walking the found path faces the next cell at every step', () => {
    const state = maze(9, 7, 'path');
    const result = runToEnd(solvers.require('bfs').run(state, {}, createRng('p')));
    const poses = pathPoses(state.grid, result.path!);
    expect(poses.map((p) => p.cell)).toEqual(result.path);
    poses.slice(0, -1).forEach((p, i) => {
      expect(neighbor(state.grid, p.cell, p.heading)).toBe(result.path![i + 1]);
    });
    expect(headingToward(state.grid, 0, 8)).toBe(1 /* E */);
  });
});
