import fc from 'fast-check';
import {
  CORE_VERSION,
  canonicalJson,
  createGrid,
  createMazeState,
  createRng,
  decodeDocument,
  encodeDocument,
  encodeDocumentSync,
  fromBase64Url,
  generators,
  hashDocument,
  isMazeDocument,
  packWalls,
  runToEnd,
  toBase64Url,
  unpackWalls,
} from '../src';
import {
  THREE_BY_THREE_BASE64URL,
  THREE_BY_THREE_NIBBLES,
  THREE_BY_THREE_PACKED,
  threeByThree,
} from './fixtures';

describe('MazeDocument v1', () => {
  it('packs two cells per byte, even cell in the low nibble (doc section 2.2 fixture)', () => {
    const packed = packWalls(Uint8Array.from(THREE_BY_THREE_NIBBLES));
    expect(Array.from(packed)).toEqual(THREE_BY_THREE_PACKED);
    expect(toBase64Url(packed)).toBe(THREE_BY_THREE_BASE64URL);
    expect(Array.from(unpackWalls(packed, 9))).toEqual(THREE_BY_THREE_NIBBLES);
    expect(Array.from(fromBase64Url(THREE_BY_THREE_BASE64URL))).toEqual(THREE_BY_THREE_PACKED);
    expect(() => unpackWalls(packed, 12)).toThrow(RangeError);
    expect(() => fromBase64Url('not base64!')).toThrow(SyntaxError);
  });

  it('encodes the fixture with provenance and a stable sha256 id', async () => {
    const doc = await encodeDocument(threeByThree(), {
      provenance: { algorithm: 'hand-made', seed: 'fixture', params: {} },
      meta: { name: 'Snake' },
    });
    expect(doc.v).toBe(1);
    expect(doc.width).toBe(3);
    expect(doc.height).toBe(3);
    expect(doc.walls).toBe(THREE_BY_THREE_BASE64URL);
    expect(doc.start).toBe(0);
    expect(doc.goal).toBe(8);
    expect(doc.id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(doc.provenance?.coreVersion).toBe(CORE_VERSION);
    expect(doc.meta?.name).toBe('Snake');
    // id ignores meta/provenance
    const again = await encodeDocument(threeByThree());
    expect(again.id).toBe(doc.id);
    expect(await hashDocument(encodeDocumentSync(threeByThree()))).toBe(doc.id);
    expect(isMazeDocument(doc)).toBe(true);
    expect(isMazeDocument({ v: 2 })).toBe(false);
    expect(isMazeDocument(null)).toBe(false);
  });

  it('canonicalJson sorts keys recursively and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('property: encode/decode round-trips every generated maze', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 1, max: 15 }),
        fc.string(),
        async (w, h, seed) => {
          const state = runToEnd(
            generators.require('recursive-backtracker').run(createGrid(w, h), createRng(seed)),
          );
          const doc = await encodeDocument(state);
          const back = decodeDocument(doc);
          expect(back.grid).toEqual(state.grid);
          expect(Array.from(back.walls)).toEqual(Array.from(state.walls));
          expect(back.start).toBe(state.start);
          expect(back.goal).toBe(state.goal);
          expect((await encodeDocument(back)).id).toBe(doc.id);
        },
      ),
      { numRuns: 40 },
    );
  });

  it('rejects invalid documents', () => {
    const base = encodeDocumentSync(threeByThree());
    expect(() => decodeDocument({ ...base, v: 2 as unknown as 1 })).toThrow(RangeError);
    expect(() => decodeDocument({ ...base, goal: 99 })).toThrow(RangeError);
    // asymmetric walls: cell 0 open E but cell 1 closed W
    const bad = createMazeState(createGrid(2, 1), Uint8Array.from([0xd, 0xf]), 0, 1);
    expect(() => decodeDocument(encodeDocumentSync(bad))).toThrow(/not symmetric/);
  });
});
