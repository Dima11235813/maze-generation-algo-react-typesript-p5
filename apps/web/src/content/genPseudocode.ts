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
    reject: null,
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
    reject: 2,
    walk: 2,
    divide: 3,
    rotate: 3,
    done: 4,
  },
);

/** The simplified (cell-based) Prim's: a random frontier cell joins the tree each round. */
const PRIMS = listing(
  "Prim's (randomised)",
  [
    'tree <- {start}; frontier <- the neighbours of start',
    'while frontier is not empty:',
    '  cell <- take a random cell out of frontier',
    '  n <- a random neighbour of cell already in the tree',
    '  carve the wall between n and cell',
    '  add cell to the tree',
    '  frontier <- frontier + its neighbours in neither',
    'return the maze',
  ],
  {
    visit: 2,
    carve: 4,
    frontier: 6,
    done: 7,
    seal: null,
    backtrack: null,
    union: null,
    reject: null,
    walk: null,
    divide: null,
    rotate: null,
  },
);

const KRUSKALS = listing(
  "Kruskal's (randomised)",
  [
    'every cell is a set of its own',
    'for each wall, in a random order:',
    '  a, b <- the cells on either side of it',
    '  if find(a) != find(b):',
    '    union(a, b)',
    '    carve the wall between a and b',
    '  else: keep the wall (carving it would close a loop)',
    'return the maze',
  ],
  {
    union: 4,
    carve: 5,
    reject: 6,
    done: 7,
    visit: null,
    seal: null,
    backtrack: null,
    frontier: null,
    walk: null,
    divide: null,
    rotate: null,
  },
);

const LISTINGS: Readonly<Record<string, PseudocodeListing<GenStep>>> = {
  'recursive-backtracker': RECURSIVE_BACKTRACKER,
  prims: PRIMS,
  kruskals: KRUSKALS,
};

export function genPseudocodeFor(generatorId: string): PseudocodeListing<GenStep> {
  return LISTINGS[generatorId] ?? GENERIC;
}
