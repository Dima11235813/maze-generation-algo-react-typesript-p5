/**
 * Tree view wiring shared by the pages: the three-way view choice (2D, 3D, Tree), which
 * renderer it needs, and the outline model (the tree's corridors and forks) used by the
 * accessible outline and the canvas highlight.
 */
import { childrenOf, type CellId, type MazeTree } from '@maze/core';
import type { TreeLayoutKind, TreeViewOptions, ViewMode } from '@maze/renderer';

export type ViewChoice = '2d' | '3d' | 'tree';

export const TREE_LAYOUT_LABELS: Record<TreeLayoutKind, string> = {
  tidy: 'Upright',
  radial: 'Radial',
  '3d': '3D tree',
};

/** The renderer a view needs: 2D tree layouts draw on the canvas, the 3D tree on three.js. */
export function rendererModeFor(view: ViewChoice, layout: TreeLayoutKind): ViewMode {
  if (view === 'tree') return layout === '3d' ? '3d' : '2d';
  return view;
}

export function treeOptionsFor(
  view: ViewChoice,
  layout: TreeLayoutKind,
  morph: number,
  pullKey: number,
  highlight: readonly CellId[] | null,
): TreeViewOptions | null {
  return view === 'tree' ? { layout, morph, pullKey, highlight } : null;
}

// ---- outline model --------------------------------------------------------------------------

export type SegmentEnd = 'fork' | 'dead-end';

/** A corridor of the tree: from a fork (or the root) to the next fork or dead end. */
export interface TreeSegment {
  readonly id: number;
  readonly parent: number | null;
  readonly cells: readonly CellId[];
  readonly end: SegmentEnd;
  /** Segments that start at this segment's closing fork, trunk first. */
  readonly children: readonly number[];
  /** Part of the start-to-goal path. */
  readonly onTrunk: boolean;
  readonly containsGoal: boolean;
  /** Cells in this segment and everything beyond it. */
  readonly size: number;
  /** Dead ends beyond (and including) this segment. */
  readonly deadEnds: number;
  /** Distance of the segment's first cell from the start. */
  readonly depth: number;
}

/** Splits a tree rooted at the start into corridors between forks (iterative, any size). */
export function buildSegments(tree: MazeTree, goal: CellId): TreeSegment[] {
  const root = tree.roots[0];
  if (root === undefined) return [];
  interface Draft {
    id: number;
    parent: number | null;
    cells: CellId[];
    end: SegmentEnd;
    children: number[];
    onTrunk: boolean;
    containsGoal: boolean;
  }
  const drafts: Draft[] = [];
  const queue: Array<{ start: CellId; parent: number | null }> = [{ start: root, parent: null }];
  while (queue.length > 0) {
    const { start, parent } = queue.shift() as { start: CellId; parent: number | null };
    const id = drafts.length;
    const cells: CellId[] = [start];
    let c = start;
    let kids = childrenOf(tree, c);
    while (kids.length === 1) {
      c = kids[0] as CellId;
      cells.push(c);
      kids = childrenOf(tree, c);
    }
    const draft: Draft = {
      id,
      parent,
      cells,
      end: kids.length === 0 ? 'dead-end' : 'fork',
      children: [],
      onTrunk: tree.onTrunk[start] === 1,
      containsGoal: cells.includes(goal),
    };
    drafts.push(draft);
    if (parent !== null) drafts[parent]?.children.push(id);
    // Trunk branch first so the solution path reads top to bottom.
    kids.sort((a, b) => (tree.onTrunk[b] ?? 0) - (tree.onTrunk[a] ?? 0));
    for (const k of kids) queue.push({ start: k, parent: id });
  }
  return drafts.map((d) => {
    const first = d.cells[0] as CellId;
    return {
      ...d,
      size: tree.subtreeSize[first] ?? d.cells.length,
      deadEnds: tree.subtreeLeaves[first] ?? 0,
      depth: tree.depth[first] ?? 0,
    };
  });
}

/** Every cell of a segment and all segments beyond it (what the canvas highlights). */
export function segmentSubtreeCells(segments: readonly TreeSegment[], id: number): CellId[] {
  const out: CellId[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const s = segments[stack.pop() as number];
    if (!s) continue;
    out.push(...s.cells);
    stack.push(...s.children);
  }
  return out;
}

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** Spoken/visible label of an outline item. */
export function segmentLabel(s: TreeSegment): string {
  const corridor =
    s.cells.length === 1 ? 'a single cell' : `a corridor of ${plural(s.cells.length, 'cell')}`;
  const ending =
    s.end === 'fork'
      ? `then a fork with ${plural(s.children.length, 'way')} on`
      : 'ending in a dead end';
  const head = s.parent === null ? 'Start' : s.onTrunk ? 'Solution path' : 'Branch';
  const extra =
    s.parent !== null && !s.onTrunk
      ? ` (${plural(s.size, 'cell')}, ${plural(s.deadEnds, 'dead end')})`
      : '';
  const goal = s.containsGoal ? ', reaches the goal' : '';
  return `${head}${extra}: ${corridor}${goal}, ${ending}`;
}
