/**
 * Minimal binary min-heap keyed by a numeric priority. Used by weighted Prim's, where the
 * frontier is a set of edges and we always want the cheapest one next.
 */
export interface HeapEntry<T> {
  readonly key: number;
  readonly value: T;
}

export class BinaryHeap<T> {
  private readonly items: HeapEntry<T>[] = [];

  get size(): number {
    return this.items.length;
  }

  push(key: number, value: T): void {
    const items = this.items;
    items.push({ key, value });
    // Sift up: swap with the parent while the parent is larger.
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((items[parent] as HeapEntry<T>).key <= (items[i] as HeapEntry<T>).key) break;
      const tmp = items[parent] as HeapEntry<T>;
      items[parent] = items[i] as HeapEntry<T>;
      items[i] = tmp;
      i = parent;
    }
  }

  /** Removes and returns the entry with the smallest key, or undefined when empty. */
  pop(): HeapEntry<T> | undefined {
    const items = this.items;
    const top = items[0];
    if (top === undefined) return undefined;
    const last = items.pop() as HeapEntry<T>;
    if (items.length > 0) {
      items[0] = last;
      // Sift down: swap with the smaller child while a child is smaller.
      let i = 0;
      const n = items.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && (items[l] as HeapEntry<T>).key < (items[smallest] as HeapEntry<T>).key) {
          smallest = l;
        }
        if (r < n && (items[r] as HeapEntry<T>).key < (items[smallest] as HeapEntry<T>).key) {
          smallest = r;
        }
        if (smallest === i) break;
        const tmp = items[smallest] as HeapEntry<T>;
        items[smallest] = items[i] as HeapEntry<T>;
        items[i] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}
