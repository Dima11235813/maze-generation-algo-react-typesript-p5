import fc from 'fast-check';
import { createRng, hashSeed, normalizeSeed, randomSeed } from '../src';

describe('rng', () => {
  it('normalises seeds', () => {
    expect(normalizeSeed(42)).toBe('42');
    expect(normalizeSeed('  hello ')).toBe('hello');
    expect(normalizeSeed('')).toMatch(/^[a-z2-7]{12}$/);
    expect(normalizeSeed(undefined)).toMatch(/^[a-z2-7]{12}$/);
    expect(() => normalizeSeed(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(randomSeed(20)).toHaveLength(20);
  });

  it('is deterministic for the same seed and different for different seeds', () => {
    const a = createRng('maze');
    const b = createRng('maze');
    const c = createRng('maze2');
    const seqA = Array.from({ length: 20 }, () => a.int(1000));
    const seqB = Array.from({ length: 20 }, () => b.int(1000));
    const seqC = Array.from({ length: 20 }, () => c.int(1000));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    expect(a.seed).toBe('maze');
  });

  it('hashSeed spreads similar strings apart', () => {
    expect(hashSeed('a')).not.toEqual(hashSeed('b'));
    expect(hashSeed('')).toHaveLength(4);
  });

  it('next() is in [0,1) and int(n) is in [0,n) for both algorithms', () => {
    for (const algo of ['xoshiro128ss', 'mulberry32'] as const) {
      const rng = createRng('range-test', algo);
      for (let i = 0; i < 5000; i++) {
        const f = rng.next();
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(1);
        const n = rng.int(7);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(7);
      }
      expect(rng.int(1)).toBe(0);
    }
  });

  it('int() is roughly uniform', () => {
    const rng = createRng('uniform');
    const buckets = new Array<number>(5).fill(0);
    const N = 50_000;
    for (let i = 0; i < N; i++) buckets[rng.int(5)]!++;
    for (const b of buckets) {
      expect(b / N).toBeGreaterThan(0.18);
      expect(b / N).toBeLessThan(0.22);
    }
  });

  it('rejects bad bounds and empty picks', () => {
    const rng = createRng('x');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('pick/shuffle use the stream deterministically', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const a = createRng('shuffle').shuffle([...items]);
    const b = createRng('shuffle').shuffle([...items]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(items).toContain(createRng('pick').pick(items));
  });

  it('fork() derives an independent but deterministic stream', () => {
    const base = createRng('race');
    const f1 = base.fork('agent-1');
    const f2 = createRng('race').fork('agent-1');
    const f3 = base.fork('agent-2');
    expect(f1.seed).toBe('race/agent-1');
    expect(f1.int(1e6)).toBe(f2.int(1e6));
    expect(f1.int(1e6)).not.toBe(f3.int(1e6));
  });

  it('property: same non-blank seed => same sequence (blank seeds are random by design)', () => {
    const seedArb = fc.string().filter((s) => s.trim().length > 0);
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 50 }), (seed, len) => {
        const x = createRng(seed);
        const y = createRng(seed);
        for (let i = 0; i < len; i++) {
          if (x.int(1 << 20) !== y.int(1 << 20)) return false;
        }
        return true;
      }),
    );
  });
});
