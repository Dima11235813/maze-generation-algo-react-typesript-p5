import {
  assertNever,
  createRegistry,
  defaultParams,
  recursiveBacktrackerMeta,
  sanitizeParams,
  type AlgorithmMeta,
} from '../src';

const meta: AlgorithmMeta = {
  id: 'test-algo',
  name: 'Test',
  family: 'generator',
  summary: 'x',
  complexity: { time: 'O(1)', space: 'O(1)' },
  tags: [],
  params: [
    { key: 'size', label: 'Size', kind: 'int', min: 1, max: 10, default: 5 },
    { key: 'bias', label: 'Bias', kind: 'float', min: 0, max: 1, default: 0.5 },
    { key: 'braid', label: 'Braid', kind: 'bool', default: false },
    {
      key: 'mode',
      label: 'Mode',
      kind: 'enum',
      options: [
        { value: 'newest', label: 'Newest' },
        { value: 'random', label: 'Random' },
      ],
      default: 'newest',
    },
  ],
  docsSlug: 'learn/test',
  since: '0.1.0',
};

describe('meta', () => {
  it('builds defaults from descriptors', () => {
    expect(defaultParams(meta)).toEqual({ size: 5, bias: 0.5, braid: false, mode: 'newest' });
    expect(defaultParams(recursiveBacktrackerMeta)).toEqual({ start: 0 });
  });

  it('sanitizes raw params: clamps, rounds, falls back to defaults, drops unknown keys', () => {
    expect(
      sanitizeParams(meta, { size: 99.6, bias: -3, braid: true, mode: 'random', extra: 1 }),
    ).toEqual({ size: 10, bias: 0, braid: true, mode: 'random' });
    expect(sanitizeParams(meta, { size: 'big', bias: Number.NaN, braid: 'yes', mode: 'nope' })).toEqual(
      { size: 5, bias: 0.5, braid: false, mode: 'newest' },
    );
    expect(sanitizeParams(meta, undefined)).toEqual(defaultParams(meta));
    expect(sanitizeParams(meta, { size: 3.4 })).toMatchObject({ size: 3 });
  });

  it('registry rejects duplicate ids', () => {
    const item = { meta };
    expect(() => createRegistry([item, item])).toThrow(/Duplicate algorithm id/);
    const reg = createRegistry([item]);
    expect(reg.ids).toEqual(['test-algo']);
    expect(Object.isFrozen(reg.all)).toBe(true);
  });

  it('assertNever throws with the offending value', () => {
    expect(() => assertNever({ t: 'weird' } as never)).toThrow(/Unhandled step: {"t":"weird"}/);
  });
});
