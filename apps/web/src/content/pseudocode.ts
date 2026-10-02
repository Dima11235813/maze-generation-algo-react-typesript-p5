/**
 * Pseudo-code listings for the Watch page, keyed by solver id.
 *
 * Each listing maps a `SolveStep` to the line that "executes" it so the panel can highlight the
 * algorithm as it runs (proj-mgmt/13 section 4). Unknown solver ids fall back to a generic
 * graph-search listing so new registry entries still get a sensible panel.
 */
import type { SolveStep } from '@maze/core';

export interface PseudocodeListing {
  /** Display title, e.g. "Breadth-first search". */
  readonly title: string;
  readonly lines: readonly string[];
  /** 0-based line index for a step, or null when the step has no corresponding line. */
  stepToLine(step: SolveStep): number | null;
}

const BFS: PseudocodeListing = {
  title: 'Breadth-first search',
  lines: [
    'queue <- [start]; visited <- {start}',
    'while queue is not empty:',
    '  cell <- queue.dequeue()',
    '  if cell == goal: return path(cell)',
    '  for each neighbour n of cell with no wall between:',
    '    if n not in visited:',
    '      visited.add(n); parent[n] <- cell',
    '      queue.enqueue(n)',
    'return no path',
  ],
  stepToLine(step) {
    switch (step.t) {
      case 'expand':
        return 2;
      case 'discover':
        return 7;
      case 'relax':
        return 6;
      case 'deadend':
        return 4;
      case 'mark':
        return 6;
      case 'move':
        return 2;
      case 'path':
        return 3;
      case 'fail':
        return 8;
      case 'done':
        return null;
    }
  },
};

const DFS: PseudocodeListing = {
  title: 'Depth-first search',
  lines: [
    'stack <- [start]; seen <- {start}',
    'while stack is not empty:',
    '  cell <- stack.pop()',
    '  if cell == goal: return path(cell)',
    '  pushed <- 0',
    '  for each neighbour n of cell with no wall between:',
    '    if n not in seen:',
    '      seen.add(n); parent[n] <- cell',
    '      stack.push(n); pushed <- pushed + 1',
    '  if pushed == 0: mark cell as a dead end',
    'return no path',
  ],
  stepToLine(step) {
    switch (step.t) {
      case 'expand':
        return 2;
      case 'discover':
        return 8;
      case 'relax':
        return 7;
      case 'deadend':
        return 9;
      case 'mark':
        return 7;
      case 'move':
        return 2;
      case 'path':
        return 3;
      case 'fail':
        return 10;
      case 'done':
        return null;
    }
  },
};

/** Generic listing for solvers without a dedicated one. */
export const GENERIC_PSEUDOCODE: PseudocodeListing = {
  title: 'Graph search',
  lines: [
    'frontier <- {start}',
    'while frontier is not empty:',
    '  cell <- frontier.remove()',
    '  if cell == goal: return path(cell)',
    '  for each reachable neighbour n of cell:',
    '    if n is new or cheaper: record it, frontier.add(n)',
    '  if cell has no new neighbours: mark dead end',
    'return no path',
  ],
  stepToLine(step) {
    switch (step.t) {
      case 'expand':
      case 'move':
        return 2;
      case 'discover':
      case 'relax':
      case 'mark':
        return 5;
      case 'deadend':
        return 6;
      case 'path':
        return 3;
      case 'fail':
        return 7;
      case 'done':
        return null;
    }
  },
};

export const PSEUDOCODE: Readonly<Record<string, PseudocodeListing>> = {
  bfs: BFS,
  dfs: DFS,
};

export function pseudocodeFor(solverId: string | null | undefined): PseudocodeListing {
  return (solverId && PSEUDOCODE[solverId]) || GENERIC_PSEUDOCODE;
}
