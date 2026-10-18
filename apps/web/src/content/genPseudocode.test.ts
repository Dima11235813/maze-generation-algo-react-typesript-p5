import { createGrid, createRng, generators } from '@maze/core';
import { describe, expect, it } from 'vitest';
import { genPseudocodeFor } from './genPseudocode';

describe('generator pseudo-code', () => {
  it('places every step of every generator on a line of its listing', () => {
    for (const id of generators.ids) {
      const listing = genPseudocodeFor(id);
      for (const s of generators.require(id).run(createGrid(7, 5), createRng('code'), {})) {
        const line = listing.stepToLine(s);
        expect(line, `${id} ${s.t}`).not.toBeNull();
        expect(listing.lines[line ?? -1], `${id} ${s.t}`).toBeDefined();
      }
    }
  });

  it('follows the recursive backtracker: visit, carve, back up, return', () => {
    const listing = genPseudocodeFor('recursive-backtracker');
    expect(listing.title).toBe('Recursive backtracker');
    expect(listing.lines[listing.stepToLine({ t: 'carve', from: 0, to: 1 }) ?? -1]).toMatch(
      /carve/,
    );
    expect(listing.lines[listing.stepToLine({ t: 'backtrack', from: 1, to: 0 }) ?? -1]).toMatch(
      /stack\.pop/,
    );
    expect(listing.lines[listing.stepToLine({ t: 'visit', cell: 0 }) ?? -1]).toMatch(/stack\.top/);
    expect(listing.lines[listing.stepToLine({ t: 'done' }) ?? -1]).toMatch(/return the maze/);
    expect(genPseudocodeFor('no-such-generator').title).toBe('Maze generator');
  });
});
