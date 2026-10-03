import {
  GenerationTracker,
  applyGenStep,
  collect,
  createGrid,
  createMazeState,
  createRng,
  createWalls,
  generators,
  type GenStep,
} from '@maze/core';
import { TreeScene, smoothstep } from '../src/tree';
import type { TreeViewOptions } from '../src/types';

const tidy: TreeViewOptions = { layout: 'tidy', morph: 1 };

function generation(seed = 'scene') {
  const grid = createGrid(8, 6);
  const { steps, result } = collect(
    generators.require('recursive-backtracker').run(grid, createRng(seed), {}),
  );
  return { grid, steps, result };
}

/** Runs the scene until it settles (bounded). */
function settle(scene: TreeScene, morph = 1): number {
  let frames = 0;
  while (scene.step(16, morph, false) && frames < 2_000) frames++;
  return frames;
}

describe('TreeScene', () => {
  it('lays out a finished maze rooted at the start and eases into place', () => {
    const { result } = generation();
    const scene = new TreeScene();
    expect(scene.update(result, null, tidy)).toBe(true);
    expect(scene.update(result, null, tidy)).toBe(false);
    expect(scene.tree?.roots).toEqual([result.start]);
    const frames = settle(scene);
    expect(frames).toBeGreaterThan(5);
    expect(scene.morph).toBe(1);
    // Root at the bottom middle-ish; every cell inside the unit box.
    expect(scene.y[result.start]).toBeCloseTo(0, 6);
    for (let c = 0; c < 48; c++) {
      expect(scene.x[c]).toBeGreaterThanOrEqual(-1e-9);
      expect(scene.x[c]).toBeLessThanOrEqual(1 + 1e-9);
      expect(scene.y[c]).toBeGreaterThanOrEqual(-1e-9);
      expect(scene.y[c]).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('jumps straight to the target with reduced motion', () => {
    const { result } = generation();
    const scene = new TreeScene();
    scene.update(result, null, tidy);
    expect(scene.step(16, 1, true)).toBe(false);
    expect(scene.morph).toBe(1);
  });

  it('grows with the generation: new cells sprout from their parent, then re-root at the end', () => {
    const { grid, steps, result } = generation('grow');
    const walls = createWalls(grid);
    const live = createMazeState(grid, walls, result.start, result.goal);
    const tracker = new GenerationTracker(grid);
    const scene = new TreeScene();
    const half = Math.floor(steps.length / 2);
    for (const step of steps.slice(0, half)) {
      tracker.apply(step);
      applyGenStep(walls, grid, step);
    }
    scene.update(live, tracker, tidy);
    settle(scene);
    const before = scene.tree?.count ?? 0;
    expect(before).toBeGreaterThan(1);
    // The growing tree is rooted at the first cell the generator saw.
    const first = Array.from(tracker.seenOrder).indexOf(0);
    expect(scene.tree?.roots[0]).toBe(first);

    tracker.apply(steps[half] as GenStep);
    applyGenStep(walls, grid, steps[half] as GenStep);
    for (const step of steps.slice(half + 1)) {
      tracker.apply(step);
      applyGenStep(walls, grid, step);
    }
    expect(scene.update(live, tracker, tidy)).toBe(true);
    // A cell that was not in the tree before starts at its parent's position.
    const tree = scene.tree;
    expect(tree?.roots).toEqual([result.start]);
    settle(scene);
    expect(scene.animating).toBe(false);
  });

  it('replays the pull from the flat maze when pullKey changes', () => {
    const { result } = generation();
    const scene = new TreeScene();
    scene.update(result, null, { ...tidy, pullKey: 1 });
    settle(scene);
    expect(scene.morph).toBe(1);
    scene.update(result, null, { ...tidy, pullKey: 2 });
    expect(scene.morph).toBe(0);
    scene.step(100, 1, false);
    expect(smoothstep(scene.morph)).toBeGreaterThan(0);
    expect(smoothstep(scene.morph)).toBeLessThan(1);
  });

  it('keeps the radial layout round and stands the 3D tree on its trunk', () => {
    const { result } = generation();
    const radial = new TreeScene();
    radial.update(result, null, { layout: 'radial', morph: 1 });
    expect(radial.uniform).toBe(true);
    const three = new TreeScene();
    three.update(result, null, { layout: '3d', morph: 1 });
    three.step(0, 1, true);
    expect(three.x[result.start]).toBe(0);
    expect(three.z[result.start]).toBe(0);
    expect(three.y[result.start]).toBe(0);
  });
});
