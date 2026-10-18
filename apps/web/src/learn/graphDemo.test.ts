import {
  CellMark,
  Dir,
  EditHistory,
  braid,
  cellCount,
  createGrid,
  createRng,
  distances,
  generators,
  openNeighbors,
  runToEnd,
  type CellId,
  type MazeState,
} from '@maze/core';
import { describe, expect, it } from 'vitest';
import { GraphDemoModel, cutOffCells, graphDemoMaze, graphStats, loopCells } from './graphDemo';

function perfect(generatorId: string, seed: string, w: number, h: number): MazeState {
  return runToEnd(generators.require(generatorId).run(createGrid(w, h), createRng(seed), {}));
}

function passages(state: MazeState): [CellId, CellId][] {
  const out: [CellId, CellId][] = [];
  for (let c = 0; c < cellCount(state.grid); c++) {
    for (const nb of openNeighbors(state, c)) if (c < nb) out.push([c, nb]);
  }
  return out;
}

/** Brute force: a passage is on a loop when its ends stay connected without it. */
function loopCellsByRemoval(state: MazeState): Set<CellId> {
  const out = new Set<CellId>();
  for (const [a, b] of passages(state)) {
    const without = new EditHistory(state).apply({ t: 'toggleWall', a, b });
    if ((distances(without, a)[b] ?? -1) >= 0) {
      out.add(a);
      out.add(b);
    }
  }
  return out;
}

/** Mazes with loops and pieces: braided, then a few passages closed and walls opened. */
function messy(seed: string): MazeState {
  const base = perfect('recursive-backtracker', seed, 9, 7);
  let state = runToEnd(braid.run(base, createRng(`${seed}/braid`), { percent: 40 }));
  const rng = createRng(`${seed}/edits`);
  for (let k = 0; k < 6; k++) {
    const all = passages(state);
    const [a, b] = all[rng.int(all.length)] as [CellId, CellId];
    state = new EditHistory(state).apply({ t: 'toggleWall', a, b });
  }
  return state;
}

describe('graph stats', () => {
  it('reads a perfect maze as a spanning tree', () => {
    for (const id of ['recursive-backtracker', 'prims', 'kruskals', 'wilsons']) {
      const m = perfect(id, `tree-${id}`, 8, 6);
      expect(graphStats(m), id).toEqual({
        cells: 48,
        passages: 47,
        pieces: 1,
        loops: 0,
        deadEnds: expect.any(Number),
        tree: true,
      });
      expect(loopCells(m).size, id).toBe(0);
      expect(cutOffCells(m), id).toEqual([]);
    }
  });

  it.each(['g-1', 'g-2', 'g-3', 'g-4', 'g-5'])(
    'counts loops as passages - cells + pieces and finds exactly the cells on them (%s)',
    (seed) => {
      const m = messy(seed);
      const s = graphStats(m);
      expect(s.loops).toBe(s.passages - s.cells + s.pieces);
      expect(s.loops).toBeGreaterThanOrEqual(0);
      expect(loopCells(m)).toEqual(loopCellsByRemoval(m));
      expect(loopCells(m).size > 0).toBe(s.loops > 0);
      expect(s.tree).toBe(s.pieces === 1 && s.loops === 0);
      // Cut-off cells are exactly the ones the start cannot reach.
      const dist = distances(m, m.start);
      expect(cutOffCells(m)).toEqual([...dist.keys()].filter((c) => (dist[c] ?? -1) < 0));
    },
  );
});

describe('graph demo maze', () => {
  it('cuts a perfect maze into pieces of at least four cells, the same way every time', () => {
    for (const seed of ['cut-1', 'cut-2', 'grow-a-tree']) {
      const setup = { generatorId: 'recursive-backtracker', seed, width: 7, height: 5, cut: 2 };
      const m = graphDemoMaze(setup);
      const s = graphStats(m);
      expect(s, seed).toMatchObject({ cells: 35, passages: 32, pieces: 3, loops: 0 });
      const cut = new Set(cutOffCells(m));
      const sizes = new Map<number, number>();
      for (const c of cut) {
        const reach = distances(m, c);
        sizes.set(c, [...reach].filter((d) => d >= 0).length);
      }
      expect(Math.min(35 - cut.size, ...sizes.values()), seed).toBeGreaterThanOrEqual(4);
      expect(graphDemoMaze(setup).walls).toEqual(m.walls);
    }
    const whole = graphDemoMaze({ generatorId: 'prims', seed: 'x', width: 6, height: 5 });
    expect(graphStats(whole).tree).toBe(true);
  });
});

describe('graph demo model', () => {
  it('edits with exact undo, selects cells and draws loops and cut-off cells', () => {
    const start = perfect('prims', 'model', 6, 5);
    const model = new GraphDemoModel(start);
    expect(model.getSnapshot()).toMatchObject({ selected: null, edits: 0, canUndo: false });
    expect(model.toggleSelectedWall(Dir.E)).toBe(false);

    // Arrows start from the start cell, then move; the edge stops them.
    expect(model.moveSelection(Dir.E)).toBe(start.start);
    expect(model.moveSelection(Dir.N)).toBe(start.start);
    expect(model.moveSelection(Dir.E)).toBe(start.start + 1);
    expect(model.overlay.tracker.current).toBe(start.start + 1);

    // Open a closed wall: a loop, tinted on the overlay.
    const [a, b] = (() => {
      for (let c = 0; c < 30; c++) {
        for (const d of [Dir.E, Dir.S]) {
          const nb = d === Dir.E ? (c % 6 < 5 ? c + 1 : -1) : c + 6 < 30 ? c + 6 : -1;
          if (nb >= 0 && !openNeighbors(start, c).includes(nb)) return [c, nb];
        }
      }
      throw new Error('no closed wall');
    })();
    model.toggleWall(a, b);
    expect(model.getSnapshot().stats).toMatchObject({ loops: 1, pieces: 1 });
    expect(model.overlay.tracker.marks[a]).toBe(CellMark.Frontier);

    // Close a dead end's only passage: cut off, shaded.
    const dead = [...Array(30).keys()].find(
      (c) => c !== start.start && openNeighbors(model.getSnapshot().state, c).length === 1,
    ) as CellId;
    const [only] = openNeighbors(model.getSnapshot().state, dead) as [CellId];
    model.toggleWall(dead, only);
    expect(model.getSnapshot().stats.pieces).toBe(2);
    expect(model.overlay.tracker.marks[dead]).toBe(CellMark.DeadEnd);
    expect(model.getSnapshot().edits).toBe(2);

    model.undo();
    expect(model.getSnapshot().stats).toMatchObject({ pieces: 1, loops: 1 });
    expect(model.getSnapshot().edits).toBe(1);
    model.reset();
    expect(model.getSnapshot()).toMatchObject({ selected: null, edits: 0, canUndo: false });
    expect(model.getSnapshot().state).toBe(start);
  });
});
