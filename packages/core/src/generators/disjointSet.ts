/**
 * Disjoint-set forest (union-find) with path halving and union by rank.
 *
 * Kruskal's and Eller's algorithms ask one question over and over: "are these two cells
 * already connected?" A disjoint set answers it in near-constant amortised time
 * (O(alpha(n)), where alpha is the inverse Ackermann function - at most 4 for any n that fits
 * in memory). Each cell starts in its own set; `union` merges two sets; `find` returns a
 * canonical representative so two cells are connected iff their representatives are equal.
 */
export class DisjointSet {
  private readonly parent: Int32Array;
  private readonly rank: Uint8Array;
  /** Number of distinct sets remaining. */
  count: number;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
    this.rank = new Uint8Array(size);
    this.count = size;
  }

  /** Representative of the set containing `x` (path halving keeps trees shallow). */
  find(x: number): number {
    let cur = x;
    for (;;) {
      const p = this.parent[cur] as number;
      if (p === cur) return cur;
      const gp = this.parent[p] as number;
      this.parent[cur] = gp; // point to grandparent: halves the path length each pass
      cur = gp;
    }
  }

  /** True when `a` and `b` are already in the same set. */
  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  /** Merges the sets of `a` and `b`. Returns false when they were already connected. */
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    const rankA = this.rank[ra] as number;
    const rankB = this.rank[rb] as number;
    if (rankA < rankB) {
      this.parent[ra] = rb;
    } else if (rankA > rankB) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra] = rankA + 1;
    }
    this.count--;
    return true;
  }
}
