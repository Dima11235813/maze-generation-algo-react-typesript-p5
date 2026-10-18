/**
 * Pseudo-code listings for generators, keyed by generator id (WI-06d), the counterpart of
 * `pseudocode.ts` for solvers. The map covers every generator step verb, so a new verb in
 * `@maze/core` fails to compile until each listing places it (or says it has no line).
 */
import type { GenStep } from '@maze/core';
import type { PseudocodeListing } from './pseudocode';

type LineMap = Readonly<Record<GenStep['t'], number | null>>;

function listing(
  title: string,
  lines: readonly string[],
  map: LineMap,
): PseudocodeListing<GenStep> {
  return { title, lines, stepToLine: (step) => map[step.t] };
}

const RECURSIVE_BACKTRACKER = listing(
  'Recursive backtracker',
  [
    'stack <- [start]; mark start visited',
    'while stack is not empty:',
    '  cell <- stack.top()',
    '  if cell has an unvisited neighbour:',
    '    n <- a random unvisited neighbour of cell',
    '    carve the wall between cell and n',
    '    mark n visited; stack.push(n)',
    '  else:',
    '    stack.pop()   (back up one cell)',
    'return the maze',
  ],
  {
    visit: 2,
    carve: 5,
    backtrack: 8,
    done: 9,
    seal: null,
    frontier: null,
    union: null,
    walk: null,
    divide: null,
    rotate: null,
  },
);

/** Generic listing for generators without a dedicated one. */
const GENERIC = listing(
  'Maze generator',
  [
    'start with every wall standing',
    'until every cell is joined:',
    '  pick a cell and a wall by the rule of the algorithm',
    '  carve the wall (or put one back)',
    'return the maze',
  ],
  {
    visit: 2,
    carve: 3,
    seal: 3,
    backtrack: 2,
    frontier: 2,
    union: 3,
    walk: 2,
    divide: 3,
    rotate: 3,
    done: 4,
  },
);

const LISTINGS: Readonly<Record<string, PseudocodeListing<GenStep>>> = {
  'recursive-backtracker': RECURSIVE_BACKTRACKER,
};

export function genPseudocodeFor(generatorId: string): PseudocodeListing<GenStep> {
  return LISTINGS[generatorId] ?? GENERIC;
}
