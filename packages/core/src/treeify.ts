/**
 * Treeify: a perfect maze is a spanning tree of its grid graph (cells are nodes, open passages
 * are edges). "Pulled and stretched out in the proper way" it looks like a tree. This module
 * derives that tree (and, for mazes with loops or mazes still being generated, a spanning
 * forest plus the passages that close loops) and lays it out in 2D and 3D.
 *
 * Everything here is pure and deterministic: the same maze, root and options always give the
 * same tree and the same coordinates. Design: proj-mgmt/19-tree-view.md.
 */
import { DIRS, Dir, NO_CELL, cellCount, neighbor, type CellId, type Grid } from './grid';
import { hasWall, type MazeState } from './walls';

export interface TreeifyOptions {
  /** Root of its component (default: the cell with the lowest `rank`). */
  readonly root?: CellId;
  /** The trunk runs from the root to this cell when both are in the same component. */
  readonly target?: CellId;
  /** Cells that take part (default: every cell). Edges to excluded cells are ignored. */
  readonly include?: (cell: CellId) => boolean;
  /** Lower is older. Picks each component's root and orders the components. Default: cell id. */
  readonly rank?: (cell: CellId) => number;
}

export interface MazeTree {
  readonly grid: Grid;
  /** Number of included cells. */
  readonly count: number;
  readonly included: Uint8Array;
  /** Parent cell, or -1 for roots and excluded cells. */
  readonly parent: Int32Array;
  /** Distance from the component root, -1 when excluded. */
  readonly depth: Int32Array;
  /** Component index (0 = the component holding `root`, or the oldest), -1 when excluded. */
  readonly component: Int32Array;
  readonly roots: readonly CellId[];
  /** Included cells in breadth-first order: every parent comes before its children. */
  readonly order: Int32Array;
  /** Children of `c` are `children[childStart[c] .. childStart[c + 1])`, in N/E/S/W order. */
  readonly childStart: Int32Array;
  readonly children: Int32Array;
  /** Cells in the subtree rooted at each cell (itself included). */
  readonly subtreeSize: Int32Array;
  /** Leaves in the subtree rooted at each cell (a leaf counts 1; never 0 for included cells). */
  readonly subtreeLeaves: Int32Array;
  /** Open passages that are not tree edges (they close loops), as pairs `[a0, b0, a1, b1...]`. */
  readonly loopEdges: Int32Array;
  /** Root-to-target path when a target was given and is reachable; otherwise just the root. */
  readonly trunk: readonly CellId[];
  readonly onTrunk: Uint8Array;
  /** Largest depth. */
  readonly height: number;
  /** Non-root cells without children (in a perfect maze: the dead ends other than the root). */
  readonly leaves: number;
}

const childCount = (t: MazeTree, c: CellId): number =>
  (t.childStart[c + 1] ?? 0) - (t.childStart[c] ?? 0);

/** Iterates the children of `c`. */
export function childrenOf(tree: MazeTree, c: CellId): CellId[] {
  const out: CellId[] = [];
  const end = tree.childStart[c + 1] ?? 0;
  for (let i = tree.childStart[c] ?? 0; i < end; i++) out.push(tree.children[i] as CellId);
  return out;
}

/**
 * Builds the spanning forest of the open passages. Each component is explored breadth first
 * from its root, so with loops the tree holds shortest paths from the root and every other
 * passage becomes a loop edge.
 */
export function treeify(state: MazeState, opts: TreeifyOptions = {}): MazeTree {
  const { grid, walls } = state;
  const n = cellCount(grid);
  const include = opts.include;
  const rank = opts.rank ?? ((c: CellId) => c);

  const included = new Uint8Array(n);
  let count = 0;
  for (let c = 0; c < n; c++) {
    if (!include || include(c)) {
      included[c] = 1;
      count++;
    }
  }
  const open = (c: CellId, d: Dir): CellId => {
    if (hasWall(walls, c, d)) return NO_CELL;
    const nb = neighbor(grid, c, d);
    return nb !== NO_CELL && included[nb] === 1 ? nb : NO_CELL;
  };

  // Pass 1: components and their roots.
  const component = new Int32Array(n).fill(-1);
  const queue = new Int32Array(Math.max(1, n));
  const found: Array<{ root: CellId; rank: number; forced: boolean }> = [];
  for (let s = 0; s < n; s++) {
    if (included[s] !== 1 || component[s] !== -1) continue;
    const id = found.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    component[s] = id;
    let best = s;
    let bestRank = rank(s);
    let forced = false;
    while (head < tail) {
      const c = queue[head++] as CellId;
      if (c === opts.root) forced = true;
      const r = rank(c);
      if (r < bestRank || (r === bestRank && c < best)) {
        best = c;
        bestRank = r;
      }
      for (const d of DIRS) {
        const nb = open(c, d);
        if (nb !== NO_CELL && component[nb] === -1) {
          component[nb] = id;
          queue[tail++] = nb;
        }
      }
    }
    found.push({ root: forced ? (opts.root as CellId) : best, rank: bestRank, forced });
  }
  // The forced root's component first, then oldest first.
  const sorted = found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) =>
      a.forced !== b.forced ? (a.forced ? -1 : 1) : a.rank - b.rank || a.root - b.root,
    );
  const remap = new Int32Array(found.length);
  sorted.forEach((f, k) => {
    remap[f.i] = k;
  });
  for (let c = 0; c < n; c++) {
    const comp = component[c] as number;
    if (comp >= 0) component[c] = remap[comp] as number;
  }

  // Pass 2: breadth-first trees from each root.
  const parent = new Int32Array(n).fill(-1);
  const depth = new Int32Array(n).fill(-1);
  const order = new Int32Array(count);
  let k = 0;
  let height = 0;
  for (const f of sorted) {
    const start = k;
    order[k++] = f.root;
    depth[f.root] = 0;
    for (let h = start; h < k; h++) {
      const c = order[h] as CellId;
      for (const d of DIRS) {
        const nb = open(c, d);
        if (nb !== NO_CELL && depth[nb] === -1) {
          depth[nb] = (depth[c] as number) + 1;
          if (depth[nb] > height) height = depth[nb];
          parent[nb] = c;
          order[k++] = nb;
        }
      }
    }
  }

  // Children (CSR) in discovery order.
  const childStart = new Int32Array(n + 1);
  for (let c = 0; c < n; c++) {
    const p = parent[c] as number;
    if (p >= 0) childStart[p + 1] = (childStart[p + 1] as number) + 1;
  }
  for (let c = 0; c < n; c++)
    childStart[c + 1] = (childStart[c + 1] as number) + (childStart[c] as number);
  const fill = childStart.slice(0, n);
  const children = new Int32Array(Math.max(0, count - sorted.length));
  for (let i = 0; i < count; i++) {
    const c = order[i] as CellId;
    const p = parent[c] as number;
    if (p >= 0) {
      children[fill[p] as number] = c;
      fill[p] = (fill[p] as number) + 1;
    }
  }

  // Subtree sizes and leaf counts, children before parents.
  const subtreeSize = new Int32Array(n);
  const subtreeLeaves = new Int32Array(n);
  let leaves = 0;
  for (let i = count - 1; i >= 0; i--) {
    const c = order[i] as CellId;
    subtreeSize[c] = (subtreeSize[c] as number) + 1;
    const isLeaf = (childStart[c + 1] as number) === (childStart[c] as number);
    if (isLeaf) {
      subtreeLeaves[c] = 1;
      if ((parent[c] as number) >= 0) leaves++;
    }
    const p = parent[c] as number;
    if (p >= 0) {
      subtreeSize[p] = (subtreeSize[p] as number) + subtreeSize[c];
      subtreeLeaves[p] = (subtreeLeaves[p] as number) + (subtreeLeaves[c] as number);
    }
  }

  // Loop edges: every open passage (counted once, via E and S) that is not a tree edge.
  const loops: number[] = [];
  for (let c = 0; c < n; c++) {
    if (included[c] !== 1) continue;
    for (const d of [Dir.E, Dir.S]) {
      const nb = open(c, d);
      if (nb === NO_CELL) continue;
      if (parent[nb] !== c && parent[c] !== nb) loops.push(c, nb);
    }
  }

  // Trunk: root -> target.
  const roots = sorted.map((f) => f.root);
  const mainRoot = roots[0] ?? NO_CELL;
  let trunk: CellId[] = mainRoot === NO_CELL ? [] : [mainRoot];
  const target = opts.target;
  if (
    target !== undefined &&
    mainRoot !== NO_CELL &&
    target >= 0 &&
    target < n &&
    component[target] === 0
  ) {
    const path: CellId[] = [];
    for (let c: number = target; c !== -1; c = parent[c] as number) path.push(c);
    trunk = path.reverse();
  }
  const onTrunk = new Uint8Array(n);
  for (const c of trunk) onTrunk[c] = 1;

  return {
    grid,
    count,
    included,
    parent,
    depth,
    component,
    roots,
    order,
    childStart,
    children,
    subtreeSize,
    subtreeLeaves,
    loopEdges: Int32Array.from(loops),
    trunk,
    onTrunk,
    height,
    leaves,
  };
}

// ---- layouts ------------------------------------------------------------------------------

export interface TreeLayout {
  /** Horizontal position (2D) / first horizontal axis (3D). */
  readonly x: Float64Array;
  /** Height above the root (depth). */
  readonly y: Float64Array;
  /** Second horizontal axis (3D only; zeros in 2D layouts). */
  readonly z: Float64Array;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Golden angle: successive branches spread evenly round the trunk (phyllotaxis). */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function bounds(tree: MazeTree, x: Float64Array, y: Float64Array, z: Float64Array): TreeLayout {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let minZ = 0;
  let maxZ = 0;
  let first = true;
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const cx = x[c] as number;
    const cy = y[c] as number;
    const cz = z[c] as number;
    if (first) {
      minX = maxX = cx;
      minY = maxY = cy;
      minZ = maxZ = cz;
      first = false;
      continue;
    }
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
    if (cz < minZ) minZ = cz;
    if (cz > maxZ) maxZ = cz;
  }
  return { x, y, z, minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Lays out the subtree under `s` with its leaves on consecutive slots starting at `x0` and
 * moving in `sign` direction; each parent sits midway over its first and last child.
 * Iterative (corridors can be thousands of cells deep). Returns nothing; writes `x`.
 */
function placeSubtree(
  tree: MazeTree,
  s: CellId,
  x0: number,
  sign: 1 | -1,
  x: Float64Array,
  branch: Int32Array,
  branchId: number,
): void {
  let slot = 0;
  const stack: Array<{ c: CellId; next: number }> = [{ c: s, next: tree.childStart[s] as number }];
  branch[s] = branchId;
  while (stack.length > 0) {
    const top = stack[stack.length - 1] as { c: CellId; next: number };
    const end = tree.childStart[top.c + 1] as number;
    if (top.next < end) {
      const child = tree.children[top.next] as CellId;
      top.next++;
      branch[child] = branchId;
      stack.push({ c: child, next: tree.childStart[child] as number });
      continue;
    }
    stack.pop();
    const startIdx = tree.childStart[top.c] as number;
    if (end === startIdx) {
      x[top.c] = x0 + sign * slot;
      slot++;
    } else {
      const first = tree.children[startIdx] as CellId;
      const last = tree.children[end - 1] as CellId;
      x[top.c] = ((x[first] as number) + (x[last] as number)) / 2;
    }
  }
}

interface FirResult {
  readonly x: Float64Array;
  /** Index of the side branch (subtree hanging off a trunk) each cell belongs to; -1 on trunks. */
  readonly branch: Int32Array;
  /** Horizontal centre of each component's trunk. */
  readonly trunkX: Float64Array;
}

/**
 * "Fir tree" layout of every component: the trunk stands straight at x = 0 and the side
 * branches hang off it, alternating left and right. Branches higher up sit nearer the trunk and
 * lower ones further out, so no two edges cross (each branch owns its own band of leaf slots and
 * its link to the trunk passes below every band nearer in).
 */
function firLayout(tree: MazeTree): FirResult {
  const n = cellCount(tree.grid);
  const x = new Float64Array(n);
  const branch = new Int32Array(n).fill(-1);
  const trunkX = new Float64Array(tree.roots.length);
  let cursor = 0;
  let branchId = 0;
  tree.roots.forEach((root, comp) => {
    const trunk = comp === 0 && tree.trunk[0] === root ? tree.trunk : [root];
    const local = new Set<CellId>(trunk);
    let left = 0;
    let right = 0;
    for (let i = trunk.length - 1; i >= 0; i--) {
      const t = trunk[i] as CellId;
      const end = tree.childStart[t + 1] as number;
      for (let j = tree.childStart[t] as number; j < end; j++) {
        const b = tree.children[j] as CellId;
        if (local.has(b)) continue;
        const width = tree.subtreeLeaves[b] as number;
        if (right <= left) {
          placeSubtree(tree, b, right + 1, 1, x, branch, branchId++);
          right += width;
        } else {
          placeSubtree(tree, b, -(left + 1), -1, x, branch, branchId++);
          left += width;
        }
      }
    }
    for (const t of trunk) x[t] = 0;
    // Shift the component so components sit side by side with one slot between them.
    const centre = cursor + left;
    trunkX[comp] = centre;
    const shift = (c: CellId): void => {
      x[c] = (x[c] as number) + centre;
    };
    for (let i = 0; i < tree.count; i++) {
      const c = tree.order[i] as CellId;
      if (tree.component[c] === comp) shift(c);
    }
    cursor += left + right + 2;
  });
  return { x, branch, trunkX };
}

/** 2D upright tree: the root at the bottom (y = 0), depth upwards, trunk straight. */
export function tidyLayout(tree: MazeTree): TreeLayout {
  const n = cellCount(tree.grid);
  const { x } = firLayout(tree);
  const y = new Float64Array(n);
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    y[c] = tree.depth[c] as number;
  }
  return bounds(tree, x, y, new Float64Array(n));
}

/**
 * 2D radial tree: each root in the middle of its own disc, depth = radius, and the tidy
 * layout's left-to-right order wrapped round the circle (the trunk becomes a straight ray).
 * `x`/`y` are Cartesian; rings are one unit apart.
 */
export function radialLayout(tree: MazeTree): TreeLayout {
  const n = cellCount(tree.grid);
  const fir = firLayout(tree);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  // Per component: angular span of its slots, and a disc centre so discs do not overlap.
  const comps = tree.roots.length;
  const minSlot = new Float64Array(comps).fill(Infinity);
  const maxSlot = new Float64Array(comps).fill(-Infinity);
  const radius = new Float64Array(comps);
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const comp = tree.component[c] as number;
    const s = fir.x[c] as number;
    if (s < (minSlot[comp] as number)) minSlot[comp] = s;
    if (s > (maxSlot[comp] as number)) maxSlot[comp] = s;
    if ((tree.depth[c] as number) > (radius[comp] as number))
      radius[comp] = tree.depth[c] as number;
  }
  const centreX = new Float64Array(comps);
  let cursor = 0;
  for (let k = 0; k < comps; k++) {
    centreX[k] = cursor + (radius[k] as number);
    cursor += 2 * (radius[k] as number) + 2;
  }
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const comp = tree.component[c] as number;
    const span = (maxSlot[comp] as number) - (minSlot[comp] as number) + 1;
    // Start the trunk pointing up (angle pi/2) and spread slots over the full circle.
    const trunkSlot = fir.trunkX[comp] as number;
    const angle = Math.PI / 2 + (((fir.x[c] as number) - trunkSlot) / span) * 2 * Math.PI;
    const r = tree.depth[c] as number;
    x[c] = (centreX[comp] as number) + r * Math.cos(angle);
    y[c] = r * Math.sin(angle);
  }
  return bounds(tree, x, y, new Float64Array(n));
}

/**
 * 3D "botanical" tree: the trunk stands on the y axis, each side branch grows in its own
 * vertical plane, and successive branches turn by the golden angle round the trunk.
 * Components stand side by side along x.
 */
export function layout3d(tree: MazeTree): TreeLayout {
  const n = cellCount(tree.grid);
  const fir = firLayout(tree);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  // Reach of each component (largest distance from its trunk) to space the components.
  const comps = tree.roots.length;
  const reach = new Float64Array(comps);
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const comp = tree.component[c] as number;
    const r = Math.abs((fir.x[c] as number) - (fir.trunkX[comp] as number));
    if (r > (reach[comp] as number)) reach[comp] = r;
  }
  const baseX = new Float64Array(comps);
  let cursor = 0;
  for (let k = 0; k < comps; k++) {
    baseX[k] = cursor + (reach[k] as number);
    cursor += 2 * (reach[k] as number) + 2;
  }
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const comp = tree.component[c] as number;
    const r = Math.abs((fir.x[c] as number) - (fir.trunkX[comp] as number));
    const b = fir.branch[c] as number;
    const angle = b < 0 ? 0 : b * GOLDEN_ANGLE;
    x[c] = (baseX[comp] as number) + r * Math.cos(angle);
    z[c] = r * Math.sin(angle);
    y[c] = tree.depth[c] as number;
  }
  return bounds(tree, x, y, z);
}

// ---- metrics ------------------------------------------------------------------------------

export interface TreeMetrics {
  /** Depth of the deepest cell below the root (the start). */
  readonly height: number;
  /** Cells on the trunk (the solution path, start and goal included). */
  readonly trunkLength: number;
  /** Side branches hanging directly off the trunk. */
  readonly trunkBranches: number;
  /** Cells in the largest side branch. */
  readonly largestBranch: number;
  /** Mean number of children over cells that have any. */
  readonly branchingFactor: number;
  /** Cells with three or more open passages. */
  readonly forks: number;
  /** Leaves / included cells. */
  readonly leafShare: number;
  /** Open passages that close a loop (0 for a perfect maze). */
  readonly loopEdges: number;
}

/** Shape of the maze seen as a tree rooted at the start, with the solution as its trunk. */
export function treeMetrics(state: MazeState): TreeMetrics {
  const tree = treeify(state, { root: state.start, target: state.goal });
  let internal = 0;
  let childTotal = 0;
  let forks = 0;
  for (let i = 0; i < tree.count; i++) {
    const c = tree.order[i] as CellId;
    const kids = childCount(tree, c);
    if (kids > 0) {
      internal++;
      childTotal += kids;
    }
    const degree = kids + ((tree.parent[c] as number) >= 0 ? 1 : 0);
    if (degree >= 3) forks++;
  }
  let trunkBranches = 0;
  let largestBranch = 0;
  for (const t of tree.trunk) {
    for (const b of childrenOf(tree, t)) {
      if (tree.onTrunk[b] === 1) continue;
      trunkBranches++;
      largestBranch = Math.max(largestBranch, tree.subtreeSize[b] as number);
    }
  }
  return {
    height: tree.height,
    trunkLength: tree.trunk.length,
    trunkBranches,
    largestBranch,
    branchingFactor: internal === 0 ? 0 : childTotal / internal,
    forks,
    leafShare: tree.count === 0 ? 0 : tree.leaves / tree.count,
    loopEdges: tree.loopEdges.length / 2,
  };
}
