/**
 * Binary min-heap (priority queue) used by Dijkstra, A* and greedy best-first search.
 *
 * Teaching notes: a binary heap keeps the smallest element at index 0 and stores the tree in a
 * flat array (children of `i` are `2i + 1` and `2i + 2`). `push` and `pop` are O(log n);
 * `peek` is O(1). Ordering is supplied by a `less(a, b)` comparator so callers can break ties
 * deterministically (e.g. by insertion order), which keeps every solver reproducible.
 */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    // Sift up: swap with the parent while we are smaller than it.
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i] as T, a[parent] as T)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0] as T;
    const last = a.pop() as T;
    if (a.length > 0) {
      a[0] = last;
      // Sift down: swap with the smaller child while a child is smaller than us.
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && this.less(a[l] as T, a[smallest] as T)) smallest = l;
        if (r < n && this.less(a[r] as T, a[smallest] as T)) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  clear(): void {
    this.items.length = 0;
  }

  /** Snapshot in heap order (index 0 is the minimum); for debugging and tests. */
  toArray(): readonly T[] {
    return [...this.items];
  }

  private swap(i: number, j: number): void {
    const a = this.items;
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
}
