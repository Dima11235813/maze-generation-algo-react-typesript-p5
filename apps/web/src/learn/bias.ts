/**
 * Generator bias in numbers (M5, proj-mgmt/13 section 7): the share of dead ends in many mazes
 * from each generator, over a fixed list of seeds, so the same page always shows the same chart.
 */
import { cellCount, createGrid, createRng, deadEnds, generators, runToEnd } from '@maze/core';

export interface DeadEndSample {
  readonly generatorId: string;
  readonly name: string;
  /** Dead ends / cells, one per seed. */
  readonly ratios: readonly number[];
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

export function deadEndSamples(
  generatorIds: readonly string[],
  seeds = 50,
  width = 12,
  height = 9,
): DeadEndSample[] {
  const grid = createGrid(width, height);
  return generatorIds.map((generatorId) => {
    const generator = generators.require(generatorId);
    const ratios: number[] = [];
    for (let i = 0; i < seeds; i++) {
      const maze = runToEnd(generator.run(grid, createRng(`bias-${String(i)}`), {}));
      ratios.push(deadEnds(maze) / cellCount(grid));
    }
    return {
      generatorId,
      name: generator.meta.name,
      ratios,
      mean: ratios.reduce((a, b) => a + b, 0) / ratios.length,
      min: Math.min(...ratios),
      max: Math.max(...ratios),
    };
  });
}

/** Counts per bin of `width` from 0 up to `top` (values at or above `top` go in the last bin). */
export function histogram(values: readonly number[], width: number, top: number): number[] {
  const bins = new Array<number>(Math.round(top / width)).fill(0);
  for (const v of values) {
    const i = Math.min(bins.length - 1, Math.max(0, Math.floor(v / width)));
    bins[i] = (bins[i] ?? 0) + 1;
  }
  return bins;
}
