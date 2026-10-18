/**
 * The data structure of the running generator, chosen by `genStructureFor`: the recursive
 * backtracker's path stack, Prim's frontier, Kruskal's disjoint sets or the random walk. Lesson generator demos (WI-06d).
 */
import { generators, type Grid } from '@maze/core';
import type { GenStructureState } from '../../learn/genStructure';
import { DisjointSetView } from './DisjointSetView';
import { FrontierSetView } from './FrontierSetView';
import { StackView } from './StackView';
import { WalkView } from './WalkView';

export interface GenStructureViewProps {
  grid: Grid | null;
  state: GenStructureState | null;
}

export function GenStructureView({ grid, state }: GenStructureViewProps) {
  if (!grid || !state) return <p className="text-sm text-muted">Preparing the demo...</p>;
  const { structure, generatorId } = state;
  switch (structure.kind) {
    case 'stack':
      return <StackView grid={grid} stack={structure.stack} variant="path" />;
    case 'frontier':
      return <FrontierSetView grid={grid} frontier={structure.frontier} />;
    case 'sets':
      return <DisjointSetView grid={grid} sets={structure.sets} />;
    case 'walk':
      return <WalkView walk={structure.walk} loopErasing={generatorId === 'wilsons'} />;
    case 'none':
      return (
        <p className="text-sm text-muted">
          {generators.get(generatorId)?.meta.name ?? generatorId} keeps no stack or sets worth
          showing: watch the walls it carves instead.
        </p>
      );
  }
}
