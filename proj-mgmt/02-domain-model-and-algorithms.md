# 02 - Domain Model & Algorithm Catalog

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-03 (core step engine), D-18 (maze document format), D-04 (rendering
> port, for what the step stream must expose), D-17 (a11y consumers of the step stream)
> ADRs: [ADR-003](./adr/ADR-003-core-step-engine.md), [ADR-018](./adr/ADR-018-maze-document-format.md),
> [ADR-004](./adr/ADR-004-rendering-abstraction.md), [ADR-015](./adr/ADR-015-testing-strategy.md)

This is the computer-science backbone of the product. Everything here lives in `@maze/core`
(see [03-target-architecture.md](./03-target-architecture.md) section 3) and is pure,
dependency-free TypeScript. UI, persistence and networking documents build on these types and
must not redefine them.

---

## 1. A maze is a graph

| Concept | Graph term | In `@maze/core` |
|---------|-----------|-----------------|
| Cell | Vertex | `CellId` (integer `row * width + col`) |
| Passage (no wall between two adjacent cells) | Edge | Absence of the wall bit in both cells' nibbles |
| Wall | Absent edge in the grid graph | Wall bit set (symmetric on both sides) |
| The empty grid (all walls up) | Grid graph `G(w,h)` with no edges selected | `MazeState` with every nibble `0b1111` |
| Perfect maze | **Spanning tree** of the grid graph: connected, acyclic, `E = V - 1` | Output of every generator |
| Braided maze | Spanning tree + extra edges (cycles), fewer/no dead ends | `braid` post-processor |
| Sparse maze | Spanning tree of a subset of cells (unreachable/blocked cells) | `sparsify` post-processor + `blocked` bit (v2 of format) |
| Unicursal maze (labyrinth) | A single Hamiltonian-like path with no branches | Special-cased generator (doubling trick); Learn-mode curiosity, not v1 |

Consequences worth stating once:

- Generating a perfect maze **is** choosing a random spanning tree. Every generation algorithm
  in section 4 is a spanning-tree algorithm with a particular randomisation and therefore a
  particular statistical bias ("texture").
- Solving a perfect maze is path-finding on a tree: exactly one simple path exists between any
  two cells. This makes optimality trivial for complete algorithms but keeps the *work done*
  (nodes expanded) very different between algorithms, which is what makes Race mode
  interesting. Braided mazes restore multiple paths and make optimality non-trivial.
- The graph is **implicit**: neighbours are computed from `(row, col)` arithmetic, never stored.
  The legacy code already did this via `gridUtils.getPointValsAtIndex` and `Cell.walls[0..3]`
  in the order Top, Right, Bottom, Left. We preserve that order as `Dir.N, E, S, W` so old
  mazes and the PDF exports in `misc/mazesCreated/` stay interpretable.

## 2. Shared TypeScript model

The authoritative sketch is in 03-target-architecture.md section 3.2; this section expands it.
Names below are the names the code must use.

### 2.1 Grid and cell addressing

```ts
export interface Grid { readonly width: number; readonly height: number; readonly topology: 'orthogonal' }
export type CellId = number;                                   // 0 .. width*height-1
export const enum Dir { N = 0, E = 1, S = 2, W = 3 }           // legacy walls[0..3] order

export const idOf   = (g: Grid, row: number, col: number): CellId => row * g.width + col;
export const rowOf  = (g: Grid, id: CellId): number => Math.floor(id / g.width);
export const colOf  = (g: Grid, id: CellId): number => id % g.width;
export const inBounds = (g: Grid, row: number, col: number) =>
  row >= 0 && col >= 0 && row < g.height && col < g.width;

const DR = [-1, 0, 1, 0] as const, DC = [0, 1, 0, -1] as const;
/** Returns -1 when the neighbour would fall off the grid (same contract as legacy getPointValsAtIndex). */
export function neighbor(g: Grid, id: CellId, d: Dir): CellId | -1 {
  const r = rowOf(g, id) + DR[d], c = colOf(g, id) + DC[d];
  return inBounds(g, r, c) ? idOf(g, r, c) : -1;
}
export const opposite = (d: Dir): Dir => ((d + 2) & 3) as Dir;
export const dirBetween = (g: Grid, a: CellId, b: CellId): Dir | undefined => { /* N/E/S/W or undefined if not adjacent */ };
```

`topology` is a discriminator reserved for hex/polar/weave grids. Only `'orthogonal'` is
implemented in v1; `neighbor`/`opposite` are the only functions that know the topology, so a
second topology is a new pair of functions behind a `Topology` interface, not a rewrite.

### 2.2 Walls as nibbles

Each cell owns one byte in a `Uint8Array`; the low 4 bits are walls, high 4 bits reserved
(v2: `blocked`, `weaveUnder`, `visitedMask` for editors).

```ts
export const WALL = { N: 1 << Dir.N, E: 1 << Dir.E, S: 1 << Dir.S, W: 1 << Dir.W } as const; // 1,2,4,8
export const ALL_WALLS = 0b1111;

export const hasWall = (walls: Uint8Array, id: CellId, d: Dir) => (walls[id] & (1 << d)) !== 0;

/** Removes the wall on BOTH sides. Throws in dev if a,b are not adjacent. */
export function removeWall(walls: Uint8Array, g: Grid, a: CellId, b: CellId): void {
  const d = dirBetween(g, a, b)!;
  walls[a] &= ~(1 << d);
  walls[b] &= ~(1 << opposite(d));
}
export function addWall(walls: Uint8Array, g: Grid, a: CellId, b: CellId): void { /* symmetric set */ }
```

Concrete example: a 3x3 perfect maze whose single passage snakes `0-1-2-5-4-3-6-7-8`
(`S` start = cell 0, `G` goal = cell 8). Bit values are `N=1, E=2, S=4, W=8` (bit index = `Dir`).

```
 +---+---+---+       cell  r c   N E S W   nibble   open sides
 | S         |         0   0 0   1 0 1 1   0xD      E
 +---+---+   +         1   0 1   1 0 1 0   0x5      E, W
 |           |         2   0 2   1 1 0 0   0x3      S, W
 +   +---+---+         3   1 0   1 0 0 1   0x9      E, S
 |         G |         4   1 1   1 0 1 0   0x5      E, W
 +---+---+---+         5   1 2   0 1 1 0   0x6      N, W
                       6   2 0   0 0 1 1   0xC      N, E
                       7   2 1   1 0 1 0   0x5      E, W
                       8   2 2   1 1 1 0   0x7      W
```

Packed two cells per byte (even cell in the low nibble, odd in the high nibble, section 8):

```
 bytes  = [0x5D, 0x93, 0x65, 0x5C, 0x07]     // (1<<4|0), (3<<4|2), (5<<4|4), (7<<4|6), (pad<<4|8)
 walls  = "XZNlXAc"                          // base64url, no padding
```

Symmetry is visible in the table: cell 2 is open `S` and cell 5 is open `N`; cell 3 is open `E`
and cell 4 is open `W`. The encoder enforces `hasWall(a,d) === hasWall(neighbor(a,d), opposite(d))`
and the test suite derives nibbles from ASCII art via a `parseAscii()` utility so fixtures like
this one stay honest.

### 2.3 `MazeState` and the mutability boundary

```ts
export interface MazeState {
  readonly grid: Grid;
  readonly walls: Uint8Array;     // treated as immutable once published
  readonly start: CellId;
  readonly goal: CellId;
}
```

Strategy (the "builder inside, immutable outside" rule):

| Context | Mutability | Why |
|---------|-----------|-----|
| Inside a single generator `run()` | One `Uint8Array` allocated up front, mutated in place | A 1000x1000 maze is 1 MB; copying per step would be 1 TB of allocations. Steps describe the mutation so consumers can mirror it |
| The returned `MazeState` | Frozen (`Object.freeze` on the state object; the array is by convention read-only and `readonly Uint8Array` at the type level) | Renderers, metrics and the API cache hold references; nobody may mutate them |
| Editing (section 7) | Copy-on-write: each edit op returns `{ next: MazeState, patch: Patch, inverse: Patch }` | Undo/redo, collaborative editing later, and cheap diffing for saves |
| Solvers | Never mutate `walls`; keep their own `visited`/`dist` typed arrays | Many solvers may run on one maze concurrently (Race mode) |

### 2.4 Seeded randomness

```ts
export interface Rng {
  readonly seed: string;                         // normalised, printable, copy-pastable
  next(): number;                                // [0, 1)
  int(maxExclusive: number): number;             // uniform integer, rejection-sampled (no modulo bias)
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: T[]): T[];                      // in-place Fisher-Yates
  fork(label: string): Rng;                      // derived stream, e.g. per Race agent
}
export function createRng(seed?: string | number | null, algo: 'xoshiro128ss' | 'mulberry32' = 'xoshiro128ss'): Rng;
```

- Default generator is **xoshiro128**** (128-bit state in four 32-bit lanes, excellent statistical
  quality, no BigInt). `mulberry32` is kept for speed-critical demos and as a teaching example (M10).
  Implemented in `packages/core/src/rng.ts`; the seed is expanded into state with cyrb128.
- **Seed normalisation**: `undefined` -> 12 base32 characters from `crypto.getRandomValues`;
  `number` -> decimal string; `string` -> trimmed, NFC-normalised, expanded with cyrb128 into the RNG
  state. The normalised string is what is stored in provenance and shown in the URL.
- `Math.random` and the legacy `p.random()` are forbidden inside `@maze/core` (ESLint rule).

### 2.5 Steps

```ts
export type GenStep =
  | { t: 'visit';     cell: CellId }
  | { t: 'carve';     from: CellId; to: CellId }
  | { t: 'backtrack'; from: CellId; to: CellId }
  | { t: 'frontier';  add?: CellId[]; remove?: CellId[] }         // Prim, Growing Tree, Hunt-and-Kill scan
  | { t: 'union';     a: CellId; b: CellId }                      // Kruskal
  | { t: 'walk';      cell: CellId; erased?: CellId[] }           // Aldous-Broder / Wilson random walks
  | { t: 'divide';    cells: CellId[]; wallDir: Dir; gap: CellId }// Recursive Division
  | { t: 'rotate';    oldRoot: CellId; newRoot: CellId }          // Origin Shift
  | { t: 'done' };

export type SolveStep =
  | { t: 'expand';   cell: CellId; g?: number; f?: number; h?: number }
  | { t: 'discover'; cell: CellId; from: CellId; g?: number; f?: number }
  | { t: 'relax';    cell: CellId; from: CellId; oldG: number; newG: number }   // Dijkstra/A* decrease-key
  | { t: 'deadend';  cell: CellId }
  | { t: 'mark';     cell: CellId; dir: Dir; count: 1 | 2 }        // Tremaux marks on passages
  | { t: 'move';     from: CellId; to: CellId; heading?: Dir }     // agent-perspective algorithms
  | { t: 'path';     cells: CellId[] }
  | { t: 'fail' }
  | { t: 'done';     stats: SolveStats };
```

Rules for step design:

1. A step must be **serialisable JSON** (numbers, arrays, string literals). Recorded step logs
   are the replay format for Race results and for a11y text logs.
2. A step carries enough information for a **renderer to update incrementally** without
   re-reading the algorithm's internal state. Data-structure snapshots (`frontier`, `union`)
   are deltas, not full copies.
3. The variants above are the **complete vocabulary**. A new algorithm that needs a new verb
   adds it here (one union member) and every consumer's exhaustive `switch` fails to compile
   until it is handled, which is the point.

### 2.6 Algorithm metadata and parameters

```ts
export type ParamSchema = z.ZodObject<z.ZodRawShape>;            // zod is a devDependency of core (types only) - see note

export interface AlgorithmMeta<P = unknown> {
  id: string;                     // kebab-case, stable forever: 'recursive-backtracker'
  name: string;                   // display
  family: 'generator' | 'solver' | 'postprocessor';
  complexity: { time: string; space: string };
  tags: readonly string[];        // 'dfs' | 'randomized' | 'uniform' | 'heuristic' | 'agent-perspective' | ...
  params: ParamSchema;            // defaults come from the schema; UI builds sliders/selects from it
  docsSlug: string;               // 'learn/recursive-backtracker'
  since: string;                  // core package version that introduced it (for replay compatibility)
}
```

> Dependency note: D-03 says `@maze/core` has **zero runtime dependencies**. `ParamSchema`
> therefore uses a minimal internal schema type (`{ [k]: { kind: 'int'|'float'|'enum'|'bool',
> min?, max?, default, options? } }`) and `@maze/contracts` provides the adapter that turns it
> into a zod schema for the API and the form generator. The `z.ZodObject` alias above is the
> contracts-side view; core exports the plain descriptor.

### 2.7 Generators, solvers, agents, races

```ts
export interface MazeGenerator<P = unknown> {
  readonly meta: AlgorithmMeta<P>;
  run(grid: Grid, rng: Rng, params: P): Generator<GenStep, MazeState>;
}
export interface MazeSolver<P = unknown> {
  readonly meta: AlgorithmMeta<P>;
  run(maze: MazeState, params: P, rng?: Rng): Generator<SolveStep, SolveResult>;   // rng only for randomised solvers
}
export interface SolveStats {
  expanded: number;            // nodes popped / visited
  discovered: number;          // nodes pushed
  frontierPeak: number;        // max size of stack/queue/heap
  pathLength: number | null;   // cells on returned path minus 1; null if fail
  optimal: boolean | null;     // compared against BFS length computed by the harness
  steps: number;               // total steps yielded
}
export interface SolveResult { path: CellId[] | null; stats: SolveStats }

export interface Agent {
  id: string;                         // 'bfs', 'astar:manhattan'
  solver: MazeSolver;
  params: unknown;
  budget: { maxSteps: number; maxMs?: number };   // maxMs only enforced in Worker harness, never for scoring
  rngLabel: string;                   // fork label for randomised solvers -> deterministic per agent
}
export interface RaceConfig {
  document: MazeDocument;             // or provenance only
  agents: Agent[];                    // 2..4 in v1
  lockstep: true;                     // reserved: false = wall-clock mode (not scored)
  scoring: 'first-to-goal' | 'fewest-expanded' | 'composite';
}
export interface RaceTick { tick: number; steps: Array<SolveStep | null> }   // one entry per agent, null when finished
export interface RaceResult { config: RaceConfig; ranking: string[]; perAgent: Record<string, SolveStats & { finishedAtTick: number | null; disqualified?: string }>; log?: RaceTick[] }
```

### 2.8 `MazeDocument` v1 (D-18)

```ts
export interface MazeDocumentV1 {
  v: 1;
  id: string;                        // 'sha256:<hex>' of the canonical form (section 8)
  width: number; height: number; topology: 'orthogonal';
  walls: string;                     // base64 of nibble-packed bytes, row-major, 2 cells per byte
  start: CellId; goal: CellId;
  provenance?: { algorithm: string; seed: string; params: Record<string, unknown>; coreVersion: string; postprocessors?: Array<{ algorithm: string; params: Record<string, unknown> }> };
  edited?: boolean;                  // true once any manual edit diverged from provenance
  meta?: { name?: string; description?: string; tags?: string[]; createdAt?: string; authorId?: string };
}
export type MazeDocument = MazeDocumentV1;   // union grows with versions
```

## 3. From the legacy draw loop to a generator function

The legacy `MazeGenerator.ts` performs one algorithm step per p5 `draw()` call and mixes it
with rendering, metrics logging and camera handling. The same algorithm as a pure generator:

```ts
export const recursiveBacktracker: MazeGenerator<{ startAt: 'corner' | 'center' | 'random' }> = {
  meta: { id: 'recursive-backtracker', name: 'Recursive Backtracker (DFS)', family: 'generator',
          complexity: { time: 'O(V)', space: 'O(V)' }, tags: ['dfs', 'randomized', 'long-corridors'],
          params: { startAt: { kind: 'enum', options: ['corner', 'center', 'random'], default: 'corner' } },
          docsSlug: 'learn/recursive-backtracker', since: '1.0.0' },

  *run(grid, rng, params) {
    const n = grid.width * grid.height;
    const walls = new Uint8Array(n).fill(ALL_WALLS);
    const visited = new Uint8Array(n);
    const stack: CellId[] = [];
    let cur: CellId = pickStart(grid, rng, params.startAt);

    visited[cur] = 1; stack.push(cur);
    yield { t: 'visit', cell: cur };

    while (stack.length) {
      cur = stack[stack.length - 1];
      const options: Dir[] = [];
      for (let d = 0 as Dir; d < 4; d++) {
        const nb = neighbor(grid, cur, d);
        if (nb !== -1 && !visited[nb]) options.push(d);
      }
      if (options.length === 0) {                           // legacy: nextCell = stack.pop()
        const from = stack.pop()!;
        if (stack.length) yield { t: 'backtrack', from, to: stack[stack.length - 1] };
        continue;
      }
      const next = neighbor(grid, cur, rng.pick(options)) as CellId;   // legacy: getRandomNeightborToVisit
      removeWall(walls, grid, cur, next);                              // legacy: removeWalls(currentCell, nextCell)
      visited[next] = 1; stack.push(next);
      yield { t: 'carve', from: cur, to: next };
      yield { t: 'visit', cell: next };
    }
    yield { t: 'done' };
    return Object.freeze({ grid, walls, start: 0, goal: n - 1 });
  },
};
```

What changed and why it matters:

| Legacy | New | Effect |
|--------|-----|--------|
| `p.random()` | `rng.pick()` | Reproducible from seed; testable |
| One step per frame | `yield` per step; `StepPlayer` decides timing | 1000x speed range, headless runs, Worker execution |
| `Cell` objects hold walls, visited, colours, 3D state | `Uint8Array` walls + `Uint8Array` visited | ~50x less memory, cache-friendly, serialisable |
| Metrics logged inside the loop | Metrics computed from steps or final state by `@maze/core/metrics` | Single responsibility |
| Stack depth used to drive z-animation in `Cell.show` | Renderer derives the same visual from `backtrack`/`carve` steps | Same look, no coupling |

## 4. Generation algorithm catalog

All produce perfect mazes (spanning trees). `V = width * height`. "Animation" rates how
legible the step stream is when played at 1x-10x for a learner.

| id | Algorithm | Intuition | Data structure | Time / Space | Texture and bias | Uniform? | Animation | Params |
|----|-----------|-----------|----------------|--------------|------------------|----------|-----------|--------|
| `recursive-backtracker` | Randomised DFS | Walk randomly, never revisit, back up when stuck | Explicit stack | O(V) / O(V) | Long winding corridors, few but long dead ends, high "river"; solution path tends to be long | No | Excellent (stack visible) | `startAt` |
| `growing-tree` | Generalised frontier growth | Keep a set of active cells; pick one by a policy; carve to an unvisited neighbour or remove it | Active list | O(V) / O(V) | Policy `newest` = backtracker; `random` = simplified Prim; `oldest` = BFS-like radial; `mixed` p% newest | No | Very good; policy switch is a great lesson | `policy`, `mixRatio`, `startAt` |
| `prims-simplified` | Randomised Prim (cell-based) | Grow a tree by repeatedly attaching a random frontier cell | Frontier set (array + swap-remove) | O(V) / O(V) | Radial "blob" from start, many short dead ends, low river; solutions short and direct | No | Good | `startAt` |
| `prims-true` | Prim's with random edge weights | Always pick the *cheapest* frontier edge under random weights | Binary heap of edges | O(E log E) / O(E) | Same distribution as randomised Kruskal (both = random-weight MST); moderate branching | No (MST of random weights) | Good; heap visible | `weightDist` |
| `kruskals` | Randomised Kruskal | Shuffle all edges; add an edge if it joins two different sets | Disjoint-set (union-find, path compression + rank) | O(E alpha(V)) / O(V) | Many short dead ends, uniform-looking texture, low river; components merge everywhere at once | No | Fair (global, not local; great for union-find lesson) | none |
| `aldous-broder` | Random walk, carve when entering an unvisited cell | Wander until every cell seen | None beyond visited set | Expected O(V log V) but heavy-tailed; worst case unbounded / O(V) | **Uniform spanning tree** (every perfect maze equally likely); no bias | **Yes** | Poor at 1x (tedious end game), good at 100x | `maxSteps` guard |
| `wilsons` | Loop-erased random walks | Start walks from unvisited cells; erase loops; attach to tree | Per-walk direction map | Expected O(V log V), fast end game | **Uniform spanning tree** | **Yes** | Excellent (loop erasure is visually striking) | `firstCell` |
| `hunt-and-kill` | Random walk; when stuck, scan for an unvisited cell adjacent to the tree | Walk + linear "hunt" scan | Scan cursor | O(V^2) worst, ~O(V) typical / O(1) extra | Like backtracker but fewer dead ends; long corridors; scan produces visible sweep | No | Excellent (the hunt sweep is a teachable inefficiency) | `scanOrder` |
| `ellers` | Row-by-row set merging | Carve each row using set membership, join sets across rows, finish last row | Sets per row (small union-find) | O(V) / O(width) | Horizontal bias adjustable; can generate **infinite** mazes streaming row by row | No | Good; unique "one row at a time" | `joinProb`, `dropProb` |
| `sidewinder` | Simplified Eller's | Carve runs eastward, drop one passage north from each run | Run buffer | O(V) / O(width) | Strong texture: the top row is one open corridor; trivially solvable downward from the top | No | Good | `runProb` |
| `binary-tree` | Each cell links N or E at random | Independent coin flip per cell | None | O(V) / O(1) | Strong diagonal bias; two full open borders; solution always monotone; simplest possible | No | Good (shows what bias looks like) | `bias`: `NE`,`NW`,`SE`,`SW` |
| `recursive-division` | Wall-adder: split region with a wall, leave one gap, recurse | Top-down partition | Region stack | O(V) / O(log V) | Long straight walls, boxy rooms, "architectural" look; only algorithm that *adds* walls | No | Excellent (rooms appear) | `minRoom`, `orientationBias` |
| `origin-shift` | Tree rotation: move the root, flip one edge, repeat | Maintain parent pointers of a rooted spanning tree; random root moves change the tree | Parent array | O(1) per shift; mix time ~O(V log V) | Starts from any tree (e.g. binary tree) and drifts; **live-evolving** mazes for Play mode | Converges towards uniform-ish | Unique: continuous animation, no start/end | `shifts`, `seedTree` |

Post-processors (family `postprocessor`, run on a finished `MazeState`, also yield `GenStep`):

| id | Effect | Params | Notes |
|----|--------|--------|-------|
| `braid` | Removes dead ends by knocking through a wall from p% of dead-end cells | `ratio` 0..1, `prefer`: `random`,`toward-goal` | Result has cycles; solvers' optimality now matters |
| `sparsify` | Culls dead-end cells (marks them blocked) k times, leaving cave-like open regions | `passes` | Requires `blocked` bit (format v2) |
| `weave` | Allows passages to pass under others (over/under cells) | none | Needs `topology: 'weave'`; **future** |
| `open-borders` | Adds entrances/exits on the perimeter | `count` | Used by Play mode for classic printable mazes |

## 5. Solving algorithm catalog

"Map" solvers see the whole `MazeState`. "Agent-perspective" solvers see only the walls of the
current cell plus their own memory - these are the ones that also drive first-person Run Maze
mode. `b` = branching factor, `d` = solution depth.

| id | Algorithm | Complete? | Optimal? | Time / Space | Data structure | Teaches | Step stream exposes |
|----|-----------|-----------|----------|--------------|----------------|---------|---------------------|
| `bfs` | Breadth-first search | Yes | Yes (unweighted) | O(V+E) / O(V) | FIFO queue | Frontier as concentric rings; shortest path by layers | `expand`, `discover` with `g` = depth; frontier deltas |
| `dfs` | Depth-first search (iterative) | Yes (finite graph) | No | O(V+E) / O(V) | LIFO stack | Contrast with BFS; why it finds *a* path not *the* path; on a perfect maze DFS with backtracking is the recursive backtracker in reverse | `expand`, `deadend`, `discover` |
| `recursive-dfs` | Naive recursive DFS | Yes but **stack overflow** beyond ~10k depth in JS | No | as DFS | Call stack | Recursion vs explicit stack; engineering limits | Same as `dfs` plus a `depth` warning surfaced in Learn mode |
| `dijkstra` | Uniform-cost search | Yes | Yes (non-negative weights) | O((V+E) log V) / O(V) | Binary heap (decrease-key via lazy deletion) | Weighted cells (mud/ice tiles in Learn mode); relaxation | `expand` with `g`, `relax` on improvement |
| `astar` | A* with heuristic | Yes | Yes if `h` admissible (and consistent for closed-set correctness) | O((V+E) log V) worst, far fewer expansions in practice / O(V) | Binary heap ordered by `f = g + h` | Heuristics, admissibility, consistency, tie-breaking (`prefer higher g`) | `expand` with `g,h,f`; `relax` |
| `greedy-best-first` | Order by `h` only | Yes (with closed set) | No | O((V+E) log V) / O(V) | Binary heap by `h` | Speed vs optimality trade-off; shows heuristic being fooled | `expand` with `h` |
| `bidirectional-bfs` | BFS from start and goal, meet in the middle | Yes | Yes (unweighted) | O(b^(d/2)) / O(b^(d/2)) | Two queues, two visited maps | Exponential savings; meeting-point detection | Two-coloured frontiers; `path` assembled from both |
| `ida-star` | Iterative-deepening A* | Yes | Yes (admissible h) | O(b^d) time, **O(d)** space | Recursion + threshold | Memory-bounded search | Threshold per iteration; re-expansions count (stretch) |
| `jps` | Jump Point Search | Yes | Yes (uniform grid, 8-connected) | Much faster than A* on open grids | Heap | Symmetry pruning; less useful on perfect mazes (no open areas) - a good "why not always?" lesson (stretch) | Jump points only |
| `flood-fill` | Distance map from goal, then descend | Yes | Yes | O(V+E) / O(V) | Queue + `Int32Array dist` | Dynamic programming view; produces the whole distance field used by metrics | `expand` with `g`; final `dist` array snapshot (typed array, chunked) |
| `dead-end-filling` | Repeatedly fill dead ends until only the solution remains | Yes on perfect mazes; on braided mazes leaves all loops | Yes on perfect mazes | O(V) / O(V) | Degree counts + queue | Elimination reasoning; global vs local information | `deadend` bursts; remaining cells = solution |
| `wall-follower` | Left- or right-hand rule (agent-perspective) | Only if start/goal on the outer boundary and maze is simply connected | No | O(V) moves worst / O(1) | Heading only | Why it fails on islands; topology of simply-connected regions | `move` with `heading`; loops detected by tick budget |
| `pledge` | Wall follower with turn counter (agent-perspective) | Yes for escaping from inside a simply-connected maze to the outside | No | O(V) / O(1) | Heading + integer counter | Escaping islands; invariant reasoning | `move`, `heading`, `turnCount` in `move` payload extension |
| `tremaux` | Mark passages once/twice (agent-perspective) | Yes | No (but path of single marks is a solution) | O(E) / O(E) | Per-passage mark counts | Local memory suffices for completeness; ancestor of DFS | `mark`, `move` |
| `random-mouse` | Random walk until goal (agent-perspective baseline) | Yes in expectation; unbounded worst case | No | Expected O(V^2)-ish / O(1) | None | Baseline for Race mode; why memory matters | `move` |

Heuristics for `astar` / `greedy-best-first` (params `heuristic`, `weight`, `tieBreak`):

| Heuristic | Formula (`dr = |r1-r2|`, `dc = |c1-c2|`) | Admissible on 4-connected grid? |
|-----------|------------------------------------------|----------------------------------|
| `manhattan` | `dr + dc` | Yes, and consistent |
| `euclidean` | `sqrt(dr^2 + dc^2)` | Yes (weaker) |
| `chebyshev` | `max(dr, dc)` | Yes (weakest; meant for 8-connected) |
| `zero` | `0` | Yes - reduces A* to Dijkstra (nice demo) |
| `weighted` | `w * manhattan`, `w > 1` | No - demonstrates bounded-suboptimal search |

Weighted cells (Dijkstra/A* in Learn mode) are a **solver-side overlay** (`Float32Array` cost
per cell supplied in `params`), not part of `MazeState`, so the maze format stays unchanged.

## 6. Metrics (`@maze/core/metrics`)

All functions take a `MazeState` (and optionally a `SolveResult`) and return plain numbers.
They are pure and memoised per `document.id` by the callers.

| Metric | Definition | Computation | Use |
|--------|-----------|-------------|-----|
| `cells` | `V = width * height` | trivial | normalisation |
| `passages` | number of edges `E` | popcount of cleared wall bits / 2 | sanity: `E == V-1` for perfect mazes |
| `deadEnds`, `deadEndRatio` | cells with exactly one open side; ratio `/V` | degree scan O(V) | texture fingerprint of a generator |
| `junctions` | cells with degree >= 3 | degree scan | branching |
| `avgBranching` | mean degree of non-dead-end, non-corridor cells | degree scan | difficulty input |
| `solutionLength` | edges on the unique/shortest path start->goal | BFS from start (`flood-fill`) | Play scoring, Race optimality reference |
| `diameter` (longest path) | longest shortest-path between any two cells | **Double BFS**: BFS from any cell -> farthest `u`; BFS from `u` -> farthest `v`; exact on trees, lower bound on braided mazes | "hardest possible start/goal" suggestion |
| `river` | mean length of maximal corridors (runs of degree-2 cells) | walk corridors | high for backtracker, low for Kruskal |
| `twistiness` | turns on the solution path / `solutionLength` | direction changes along path | difficulty input |
| `symmetry` | fraction of wall bits equal under horizontal/vertical/rotational mirroring | compare nibbles under transforms | detect biased generators (binary tree, sidewinder) |
| `difficulty` | heuristic `0..100`: `w1*z(solutionLength/V) + w2*z(deadEndRatio) + w3*z(twistiness) + w4*z(decoyDepth)` where `decoyDepth` = mean depth of dead-end branches off the solution | computed from the distance field + path | Play mode level labels; weights tuned empirically and versioned |
| Solver-relative | `expanded`, `discovered`, `frontierPeak`, `steps`, `pathLength`, `optimalityRatio = pathLength / solutionLength` | from `SolveStats` | Race scoring, Learn mode comparisons |

## 7. Editing (`@maze/core/editing`)

Pure functions; each returns the new state plus a reversible patch.

```ts
export interface Patch { ops: Array<{ cell: CellId; before: number; after: number } | { field: 'start' | 'goal'; before: CellId; after: CellId } | { field: 'grid'; before: Grid; after: Grid }> }
export interface EditResult { next: MazeState; patch: Patch; inverse: Patch }

toggleWall(state, cell, dir): EditResult          // always updates both sides; no-op on the outer boundary
setStart(state, cell): EditResult
setGoal(state, cell): EditResult
resize(state, width, height, anchor: 'top-left' | 'center', fill: 'walls' | 'open'): EditResult   // crop or pad
clearRegion(state, cells): EditResult             // open all interior walls (room)
applyPatch(state, patch): MazeState               // used by undo/redo and by the API to store deltas between versions

validate(state): ValidationIssue[]                // never throws
type ValidationIssue =
  | { code: 'goal-unreachable'; from: CellId; to: CellId }
  | { code: 'isolated-region'; cells: CellId[]; size: number }
  | { code: 'not-a-tree'; extraEdges: number }    // informational: maze is braided
  | { code: 'start-equals-goal' }
  | { code: 'asymmetric-wall'; a: CellId; b: CellId }   // only possible after a corrupt import
```

The Build UI runs `validate` after every edit (in a Worker for large mazes) and renders issues
as overlays; saving a maze with `goal-unreachable` is allowed but flagged in `meta.tags`.
Any edit sets `edited: true` in the document and provenance becomes historical.

## 8. Serialization (`@maze/core/document`, D-18)

Packing:

1. Walls are row-major `CellId` order. Two cells per byte: **even cell in the low nibble, odd
   cell in the high nibble**. Odd `V` pads the last high nibble with `0`.
2. Bytes are base64url-encoded (no padding) into `walls`. A 100x100 maze is 5 000 bytes ->
   6 667 characters; a 1000x1000 maze is 500 kB -> 667 kB, which is why provenance-only
   storage exists.
3. `id = 'sha256:' + hex(sha256(canonical))` where `canonical` is the JSON of
   `{ v, width, height, topology, walls, start, goal }` with keys in exactly that order and no
   whitespace. `provenance`, `edited` and `meta` are **excluded** so the same maze reached by
   generation or by hand has the same id (deduplication in the API).
4. **Provenance-only reconstruction rule**: a document may omit `walls` when `edited !== true`
   and `provenance` is present; `decode()` then regenerates via the registry and verifies the
   `id` matches. Mismatch (e.g. algorithm changed between core versions) is a hard error that
   surfaces as "this maze needs re-saving", which is why `provenance.coreVersion` is recorded
   and algorithms are never modified after release without a new `id` (e.g. `wilsons-v2`).
5. `migrate(doc): MazeDocument` applies `v -> v+1` functions in sequence; v1 is the only version
   today. Unknown `v` is rejected.

`encode`/`decode` and `sha256` use only `Uint8Array`, `TextEncoder` and `crypto.subtle`
(available in browsers, Node 22 and Tauri), keeping the zero-dependency rule.

## 9. Race semantics

| Rule | Detail |
|------|--------|
| Same maze | All agents receive the identical `MazeState` (from one document id). Randomised solvers get `rng.fork(agent.rngLabel)` from the race seed, so replays are exact |
| Lockstep | The scheduler advances every unfinished agent by **one step per tick**, in agent order, and records a `RaceTick`. Wall-clock time is never used for scoring |
| Finish | An agent finishes on its `done` step. `finishedAtTick` is recorded; `path` is verified by the harness by walking it against `walls` |
| Disqualification | Any of: `path` contains a non-adjacent pair or crosses a wall; `expanded` exceeds `budget.maxSteps`; a `move` step through a wall (agent-perspective solvers); a thrown exception. Reason is stored |
| Tie-break (`first-to-goal`) | earlier `finishedAtTick`, then fewer `expanded`, then shorter `pathLength`, then lexical agent id |
| `fewest-expanded` | rank by `expanded`, then `finishedAtTick`, then `pathLength` |
| `composite` | `score = 0.5 * norm(finishedAtTick) + 0.3 * norm(expanded) + 0.2 * (optimalityRatio - 1)`, lower is better; `norm` divides by the best agent's value |
| Replay format | `RaceResult` with the optional `log: RaceTick[]`; the log is also the a11y text transcript. Large races store only `config` + `ranking` and regenerate the log on demand (deterministic) |
| Fairness note | Agent-perspective solvers "see" less than map solvers; the UI labels the two classes and the default race pairs like with like. Mixed races are allowed and are a lesson in themselves |

## 10. Property-based test checklist (fast-check, D-15)

For every registered generator, on random `(width 1..64, height 1..64, seed, params)`:

- [ ] Output is connected (BFS reaches all cells) and `passages === V - 1` (spanning tree).
- [ ] Every wall bit is symmetric with its neighbour's opposite bit; boundary walls are set.
- [ ] Same inputs -> byte-identical `walls` (determinism), across two fresh `Rng` instances.
- [ ] Step stream is consistent: replaying `carve` steps onto an all-walls grid reproduces `walls`.
- [ ] Every `carve`/`backtrack`/`union` references adjacent cells; `done` is the last step exactly once.
- [ ] Generator terminates within `k * V` steps for a documented `k` (Aldous-Broder excluded;
      guarded by `maxSteps`).

For every registered solver, on generated perfect and braided mazes:

- [ ] Complete solvers return a path whenever BFS finds one; `fail` only when BFS fails.
- [ ] Returned path is valid: consecutive cells adjacent with no wall between.
- [ ] BFS, Dijkstra (unit weights), A* (admissible h), bidirectional BFS and flood-fill return
      `pathLength === solutionLength`.
- [ ] `stats.expanded <= V`, `stats.frontierPeak <= V`, `stats.steps` equals steps yielded.
- [ ] Agent-perspective solvers never yield a `move` through a wall.

For the document format:

- [ ] `decode(encode(m))` deep-equals `m` for random states including odd `V`.
- [ ] `id` equals a fixture computed independently (Python script in `test/fixtures`) for 5 known mazes.
- [ ] Provenance-only documents regenerate to the recorded `id`.
- [ ] Every `toggleWall` followed by `applyPatch(inverse)` is the identity.

Golden tests: one fixture per algorithm at 10x10 with seed `"golden"`, compared byte-for-byte,
so any accidental change in an algorithm's randomness consumption is caught (this protects
provenance-only documents in production).
