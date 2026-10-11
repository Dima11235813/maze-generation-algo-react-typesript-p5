/**
 * Seeded random numbers. Every maze, solve and race is reproducible from its seed.
 *
 * `Math.random` is never used inside `@maze/core`.
 */

export interface Rng {
  /** Normalised, printable, copy-pastable seed (what provenance stores). */
  readonly seed: string;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive), rejection-sampled (no modulo bias). */
  int(maxExclusive: number): number;
  pick<T>(xs: readonly T[]): T;
  /** In-place Fisher-Yates shuffle; returns the same array. */
  shuffle<T>(xs: T[]): T[];
  /** Derived, independent stream (e.g. one per Race agent). */
  fork(label: string): Rng;
}

export type RngAlgorithm = 'xoshiro128ss' | 'mulberry32';

const SEED_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** 12 base32 characters from the platform CSPRNG. */
export function randomSeed(length = 12): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += SEED_ALPHABET.charAt(b & 31);
  return out;
}

/** `undefined` -> random seed; number -> decimal string; string -> trimmed, NFC-normalised. */
export function normalizeSeed(seed: string | number | undefined | null): string {
  if (seed === undefined || seed === null) return randomSeed();
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) throw new RangeError('Numeric seed must be finite');
    return String(seed);
  }
  const s = seed.normalize('NFC').trim();
  return s.length > 0 ? s : randomSeed();
}

/** cyrb128: 128-bit non-cryptographic string hash, used to expand a seed into RNG state. */
export function hashSeed(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** xoshiro128** - 32-bit output, 128-bit state, excellent statistical quality. */
function xoshiro128ss(s0: number, s1: number, s2: number, s3: number): () => number {
  let a = s0 | 0;
  let b = s1 | 0;
  let c = s2 | 0;
  let d = s3 | 0;
  if ((a | b | c | d) === 0) a = 1; // state must be non-zero
  return () => {
    const t = b << 9;
    let r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return r >>> 0;
  };
}

/** mulberry32 - tiny, fast, 32-bit state. Kept as a teaching example (curriculum M10). */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const TWO_32 = 4294967296;

export function createRng(
  seed?: string | number | null,
  algorithm: RngAlgorithm = 'xoshiro128ss',
): Rng {
  const normalized = normalizeSeed(seed);
  const [a, b, c, d] = hashSeed(normalized);
  const next32 = algorithm === 'mulberry32' ? mulberry32(a) : xoshiro128ss(a, b, c, d);

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > TWO_32) {
      throw new RangeError(`int() bound must be an integer in 1..2^32, got ${maxExclusive}`);
    }
    if (maxExclusive === 1) return 0;
    const threshold = TWO_32 - (TWO_32 % maxExclusive);
    let x = next32();
    while (x >= threshold) x = next32();
    return x % maxExclusive;
  };

  const rng: Rng = {
    seed: normalized,
    next: () => next32() / TWO_32,
    int,
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new RangeError('pick() called with an empty array');
      return xs[int(xs.length)] as T;
    },
    shuffle<T>(xs: T[]): T[] {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const tmp = xs[i] as T;
        xs[i] = xs[j] as T;
        xs[j] = tmp;
      }
      return xs;
    },
    fork(label: string): Rng {
      return createRng(`${normalized}/${label}`, algorithm);
    },
  };
  return rng;
}
