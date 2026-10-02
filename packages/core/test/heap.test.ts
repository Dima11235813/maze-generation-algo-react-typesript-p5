import fc from 'fast-check';
import { MinHeap } from '../src/util/heap';

describe('MinHeap', () => {
  it('pops in ascending order and reports size/peek', () => {
    const h = new MinHeap<number>((a, b) => a < b);
    expect(h.size).toBe(0);
    expect(h.peek()).toBeUndefined();
    expect(h.pop()).toBeUndefined();
    for (const v of [5, 3, 8, 1, 9, 2, 7]) h.push(v);
    expect(h.size).toBe(7);
    expect(h.peek()).toBe(1);
    const out: number[] = [];
    let v = h.pop();
    while (v !== undefined) {
      out.push(v);
      v = h.pop();
    }
    expect(out).toEqual([1, 2, 3, 5, 7, 8, 9]);
    expect(h.size).toBe(0);
  });

  it('breaks ties deterministically through the comparator', () => {
    const h = new MinHeap<{ k: number; seq: number }>((a, b) =>
      a.k !== b.k ? a.k < b.k : a.seq < b.seq,
    );
    h.push({ k: 1, seq: 2 });
    h.push({ k: 1, seq: 0 });
    h.push({ k: 0, seq: 5 });
    h.push({ k: 1, seq: 1 });
    expect(h.pop()).toEqual({ k: 0, seq: 5 });
    expect(h.pop()).toEqual({ k: 1, seq: 0 });
    expect(h.pop()).toEqual({ k: 1, seq: 1 });
    expect(h.pop()).toEqual({ k: 1, seq: 2 });
  });

  it('clear() empties and toArray() keeps the minimum at index 0', () => {
    const h = new MinHeap<number>((a, b) => a < b);
    [4, 2, 6].forEach((v) => h.push(v));
    expect(h.toArray()[0]).toBe(2);
    h.clear();
    expect(h.size).toBe(0);
  });

  it('property: matches a sorted array for any sequence', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1000, max: 1000 }), { maxLength: 200 }), (xs) => {
        const h = new MinHeap<number>((a, b) => a < b);
        for (const x of xs) h.push(x);
        const out: number[] = [];
        let v = h.pop();
        while (v !== undefined) {
          out.push(v);
          v = h.pop();
        }
        expect(out).toEqual([...xs].sort((a, b) => a - b));
      }),
    );
  });
});
