/**
 * Pseudo-code listings for the Watch page, keyed by solver id.
 *
 * Each listing maps a `SolveStep` to the line that "executes" it so the panel can highlight the
 * algorithm as it runs (proj-mgmt/13 section 4). The map is a `Record` over every step verb, so
 * a new verb in `@maze/core` fails to compile until each listing places it. Unknown solver ids
 * fall back to a generic graph-search listing so new registry entries still get a panel.
 */
import type { SolveStep } from '@maze/core';

export interface PseudocodeListing {
  /** Display title, e.g. "Breadth-first search". */
  readonly title: string;
  readonly lines: readonly string[];
  /** 0-based line index for a step, or null when the step has no corresponding line. */
  stepToLine(step: SolveStep): number | null;
}

/** Line for every step verb; `done` is the only verb without a line. */
type LineMap = Readonly<Record<Exclude<SolveStep['t'], 'done'>, number>> & {
  readonly done: null;
};

function listing(title: string, lines: readonly string[], map: LineMap): PseudocodeListing {
  return { title, lines, stepToLine: (step) => map[step.t] };
}

const BFS = listing(
  'Breadth-first search',
  [
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
  { expand: 2, discover: 7, relax: 6, deadend: 4, mark: 6, move: 2, path: 3, fail: 8, done: null },
);

const DFS = listing(
  'Depth-first search',
  [
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
  { expand: 2, discover: 8, relax: 7, deadend: 9, mark: 7, move: 2, path: 3, fail: 10, done: null },
);

const ASTAR = listing(
  'A* search',
  [
    'g[start] <- 0; open <- heap of (start, f = w * h(start))',
    'while open is not empty:',
    '  cell <- open.popMin()   # smallest f = g + w * h, ties by h',
    '  if cell is closed or the entry is stale: continue',
    '  close cell; if cell == goal: return path(cell)',
    '  for each neighbour n of cell with no wall between, not closed:',
    '    if n is new: g[n] <- g[cell] + 1; parent[n] <- cell; open.push(n)',
    '    else if g[cell] + 1 < g[n]: g[n] <- g[cell] + 1; parent[n] <- cell; open.push(n)',
    'return no path',
  ],
  { expand: 2, discover: 6, relax: 7, deadend: 5, mark: 6, move: 2, path: 4, fail: 8, done: null },
);

const DIJKSTRA = listing(
  "Dijkstra's algorithm",
  [
    'dist[start] <- 0; heap <- [(start, 0)]',
    'while heap is not empty:',
    '  cell <- heap.popMin()   # cheapest known cost first',
    '  if cell is closed or the entry is stale: continue',
    '  close cell; if cell == goal: return path(cell)',
    '  for each neighbour n of cell with no wall between, not closed:',
    '    if dist[n] is unknown: dist[n] <- dist[cell] + cost(n); heap.push(n)',
    '    else if dist[cell] + cost(n) < dist[n]: relax dist[n] and parent[n]; heap.push(n)',
    'return no path',
  ],
  { expand: 2, discover: 6, relax: 7, deadend: 5, mark: 6, move: 2, path: 4, fail: 8, done: null },
);

const GREEDY = listing(
  'Greedy best-first search',
  [
    'heap <- [(start, h(start))]; seen <- {start}',
    'while heap is not empty:',
    '  cell <- heap.popMin()   # smallest h only; the cost so far is ignored',
    '  if cell == goal: return path(cell)',
    '  for each neighbour n of cell with no wall between:',
    '    if n not in seen:',
    '      seen.add(n); parent[n] <- cell; heap.push(n, h(n))',
    'return no path',
  ],
  { expand: 2, discover: 6, relax: 6, deadend: 4, mark: 6, move: 2, path: 3, fail: 7, done: null },
);

const BIDIRECTIONAL = listing(
  'Bidirectional BFS',
  [
    'A <- BFS wave from start; B <- BFS wave from goal',
    'while no meeting cell and both waves have a frontier:',
    '  side <- the wave with the smaller frontier',
    "  for each cell in side's current layer:",
    '    for each neighbour n with no wall between, not reached by side:',
    '      side.dist[n] <- side.dist[cell] + 1; side.queue.add(n)',
    '      if the other wave reached n: keep n if distA + distB is the smallest',
    'if the waves met: return path(start -> meet) + path(meet -> goal)',
    'return no path',
  ],
  { expand: 3, discover: 5, relax: 6, deadend: 4, mark: 5, move: 3, path: 7, fail: 8, done: null },
);

const DEAD_END_FILLING = listing(
  'Dead-end filling',
  [
    'queue <- every cell with one open side, except start and goal',
    'while queue is not empty:',
    '  cell <- queue.dequeue(); fill cell   # no route can pass through it',
    '  for each open, unfilled neighbour n of cell:',
    '    if n now has one open side and is not start or goal: queue.enqueue(n)',
    'route <- BFS from start through the unfilled cells',
    'if route reaches goal: walk it and return it',
    'return no path',
  ],
  { expand: 6, discover: 4, relax: 4, deadend: 2, mark: 2, move: 6, path: 6, fail: 7, done: null },
);

const FLOOD_FILL = listing(
  'Flood fill (distance map)',
  [
    'dist[goal] <- 0; queue <- [goal]   # flood outwards from the goal',
    'while queue is not empty:',
    '  cell <- queue.dequeue()',
    '  for each neighbour n with no wall between and no distance yet:',
    '    dist[n] <- dist[cell] + 1; queue.enqueue(n)',
    'if start has no distance: return no path',
    'cell <- start',
    'while cell != goal: step to the neighbour whose distance is one smaller',
    'return the cells walked',
  ],
  { expand: 2, discover: 4, relax: 4, deadend: 3, mark: 4, move: 7, path: 8, fail: 5, done: null },
);

const RANDOM_MOUSE = listing(
  'Random mouse',
  [
    'cell <- start',
    'while cell != goal:',
    '  if the move budget is spent or no passage is open: return no path',
    '  choices <- open directions, minus straight back unless it is the only one',
    '  cell <- move one step in a random choice',
    'return the walk with its loops erased',
  ],
  { expand: 4, discover: 4, relax: 4, deadend: 3, mark: 3, move: 4, path: 5, fail: 2, done: null },
);

const WALL_FOLLOWER = listing(
  'Wall follower',
  [
    'cell <- start; heading <- north',
    'while cell != goal:',
    '  if (cell, heading) was seen before or the budget is spent: return no path',
    '  dir <- first open side in hand order: hand side, ahead, other side, back',
    '  move one step towards dir; heading <- dir',
    'return the walk with its loops erased',
  ],
  { expand: 4, discover: 4, relax: 4, deadend: 3, mark: 3, move: 4, path: 5, fail: 2, done: null },
);

const PLEDGE = listing(
  'Pledge algorithm',
  [
    'cell <- start; heading <- preferred; turns <- 0',
    'while cell != goal:',
    '  if (cell, heading, turns) repeats or the budget is spent: return no path',
    '  if turns == 0 and the preferred direction is open: dir <- preferred',
    '  else: dir <- first open side in hand order; turns <- turns + quarter turns made',
    '  move one step towards dir; heading <- dir',
    'return the walk with its loops erased',
  ],
  { expand: 5, discover: 5, relax: 4, deadend: 4, mark: 4, move: 5, path: 6, fail: 2, done: null },
);

const TREMAUX = listing(
  "Trémaux's algorithm",
  [
    'cell <- start; arrivedBy <- none',
    'while cell != goal:',
    '  if the move budget is spent: return no path',
    '  if the only passage is arrivedBy: cell is a dead end; dir <- arrivedBy',
    '  else if this is a revisit through a once-marked passage: dir <- arrivedBy',
    '  else: dir <- an unmarked passage, else the once-marked one',
    '  if every passage is marked twice: return no path',
    '  mark the passage end, move through it, mark the far end',
    'return the walk with its detours erased',
  ],
  { expand: 7, discover: 7, relax: 5, deadend: 3, mark: 7, move: 7, path: 8, fail: 6, done: null },
);

/** Generic listing for solvers without a dedicated one. */
export const GENERIC_PSEUDOCODE = listing(
  'Graph search',
  [
    'frontier <- {start}',
    'while frontier is not empty:',
    '  cell <- frontier.remove()',
    '  if cell == goal: return path(cell)',
    '  for each reachable neighbour n of cell:',
    '    if n is new or cheaper: record it, frontier.add(n)',
    '  if cell has no new neighbours: mark dead end',
    'return no path',
  ],
  { expand: 2, discover: 5, relax: 5, deadend: 6, mark: 5, move: 2, path: 3, fail: 7, done: null },
);

export const PSEUDOCODE: Readonly<Record<string, PseudocodeListing>> = {
  bfs: BFS,
  dfs: DFS,
  astar: ASTAR,
  dijkstra: DIJKSTRA,
  'greedy-best-first': GREEDY,
  'bidirectional-bfs': BIDIRECTIONAL,
  'dead-end-filling': DEAD_END_FILLING,
  'flood-fill': FLOOD_FILL,
  'random-mouse': RANDOM_MOUSE,
  'wall-follower': WALL_FOLLOWER,
  pledge: PLEDGE,
  tremaux: TREMAUX,
};

export function pseudocodeFor(solverId: string | null | undefined): PseudocodeListing {
  return (solverId ? PSEUDOCODE[solverId] : undefined) ?? GENERIC_PSEUDOCODE;
}
