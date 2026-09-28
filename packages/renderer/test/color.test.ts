import { CellMark, GenerationTracker, SolveTracker, createGrid } from '@maze/core';
import {
  clamp255,
  hexToRgb,
  invertRgb,
  legacyCellColor,
  legacyTheme,
  mix,
  resolve,
  rgbToCss,
  rgbToHex,
  rgbToInt,
} from '../src/color';
import { solveMarkColor, tileColor } from '../src/overlay';

describe('colour helpers', () => {
  it('clamps and converts', () => {
    expect(clamp255(-5)).toBe(0);
    expect(clamp255(300)).toBe(255);
    expect(clamp255(12.6)).toBe(13);
    expect(rgbToCss({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)');
    expect(rgbToCss({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    expect(rgbToHex({ r: 255, g: 0, b: 16 })).toBe('#ff0010');
    expect(hexToRgb('#ff0010')).toEqual({ r: 255, g: 0, b: 16 });
    expect(hexToRgb('nope')).toBeNull();
    expect(rgbToInt({ r: 255, g: 0, b: 16 })).toBe(0xff0010);
  });

  it('invert is an involution and resolve applies it exactly once', () => {
    const c = { r: 10, g: 200, b: 77 };
    expect(invertRgb(invertRgb(c))).toEqual(c);
    expect(resolve(legacyTheme, c)).toEqual(c);
    expect(resolve({ ...legacyTheme, invert: true }, c)).toEqual({ r: 245, g: 55, b: 178 });
  });

  it('legacyCellColor brightens first visits and darkens revisits, blue drops with depth', () => {
    const first = legacyCellColor(legacyTheme, 1, 0);
    const many = legacyCellColor(legacyTheme, 6, 0);
    expect(first.g).toBe(255); // 117 / 0.242 clips to 255
    expect(many.g).toBeLessThan(first.g);
    const deep = legacyCellColor(legacyTheme, 1, 4);
    expect(deep.b).toBe(legacyTheme.cell.b - 4);
    expect(legacyCellColor(legacyTheme, 0, -1)).toEqual(legacyTheme.cell);
  });

  it('mix interpolates and clamps t', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 100, g: 200, b: 50 };
    expect(mix(a, b, 0.5)).toEqual({ r: 50, g: 100, b: 25 });
    expect(mix(a, b, 2)).toEqual(b);
    expect(mix(a, b, -1)).toEqual(a);
  });
});

describe('tileColor', () => {
  const grid = createGrid(2, 2);

  it('uses the base cell colour without trackers', () => {
    expect(tileColor(legacyTheme, null, null, 0)).toEqual(legacyTheme.cell);
  });

  it('follows visit counts from a generation tracker', () => {
    const gen = new GenerationTracker(grid);
    gen.apply({ t: 'visit', cell: 0 });
    gen.apply({ t: 'carve', from: 0, to: 1 });
    gen.apply({ t: 'visit', cell: 1 });
    // cell 0 is no longer current: plain legacy colour
    expect(tileColor(legacyTheme, gen, null, 0)).toEqual(legacyCellColor(legacyTheme, 1, 0));
    // cell 1 is current: tinted towards the highlight, so not equal to the plain colour
    expect(tileColor(legacyTheme, gen, null, 1)).not.toEqual(legacyCellColor(legacyTheme, 1, 1));
  });

  it('tints solve marks', () => {
    const solve = new SolveTracker(grid);
    solve.apply({ t: 'discover', cell: 3, from: 2 });
    expect(solveMarkColor(legacyTheme, CellMark.Frontier)).toEqual(legacyTheme.solveFrontier);
    expect(solveMarkColor(legacyTheme, CellMark.Unseen)).toBeNull();
    const tinted = tileColor(legacyTheme, null, solve, 3);
    expect(tinted).toEqual(mix(legacyTheme.cell, legacyTheme.solveFrontier, 0.6));
  });
});
