/**
 * MazeDocument v1 (D-18): the versioned, content-addressed wire format.
 *
 * - `walls`: base64url of nibble-packed bytes, row-major, two cells per byte
 *   (even cell in the low nibble, odd cell in the high nibble).
 * - `id`: `sha256:<hex>` over the canonical JSON (sorted keys) of the document without
 *   `id`, `meta` and `provenance`, so identical mazes share an id however they were made.
 */
import { cellCount, createGrid, isValidCell, type CellId } from './grid';
import { createMazeState, wallsAreSymmetric, WALL_MASK, type MazeState } from './walls';
import { CORE_VERSION } from './version';

export interface MazeProvenance {
  readonly algorithm: string;
  readonly seed: string;
  readonly params: Record<string, unknown>;
  readonly coreVersion: string;
  readonly postprocessors?: ReadonlyArray<{
    readonly algorithm: string;
    readonly params: Record<string, unknown>;
  }>;
}

export interface MazeDocumentMeta {
  readonly name?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly createdAt?: string;
  readonly authorId?: string;
}

export interface MazeDocumentV1 {
  readonly v: 1;
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly topology: 'orthogonal';
  readonly walls: string;
  readonly start: CellId;
  readonly goal: CellId;
  readonly provenance?: MazeProvenance;
  readonly edited?: boolean;
  readonly meta?: MazeDocumentMeta;
}

export type MazeDocument = MazeDocumentV1;

/** Two cells per byte; even cell low nibble, odd cell high nibble. */
export function packWalls(walls: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(walls.length / 2));
  for (let i = 0; i < walls.length; i++) {
    const nib = (walls[i] ?? 0) & WALL_MASK;
    const j = i >> 1;
    out[j] = (out[j] ?? 0) | (i % 2 === 0 ? nib : nib << 4);
  }
  return out;
}

export function unpackWalls(bytes: Uint8Array, cellCountTotal: number): Uint8Array {
  if (bytes.length !== Math.ceil(cellCountTotal / 2)) {
    throw new RangeError(
      `Packed walls has ${bytes.length} bytes, expected ${Math.ceil(cellCountTotal / 2)}`,
    );
  }
  const out = new Uint8Array(cellCountTotal);
  for (let i = 0; i < cellCountTotal; i++) {
    const b = bytes[i >> 1] ?? 0;
    out[i] = i % 2 === 0 ? b & 0x0f : (b >> 4) & 0x0f;
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new SyntaxError('Invalid base64url string');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Deterministic JSON: object keys sorted recursively, arrays kept in order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export type UnidentifiedDocument = Omit<MazeDocumentV1, 'id'>;

function hashInput(doc: UnidentifiedDocument): string {
  return canonicalJson({
    v: doc.v,
    width: doc.width,
    height: doc.height,
    topology: doc.topology,
    walls: doc.walls,
    start: doc.start,
    goal: doc.goal,
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Content hash over the structural fields only (not `meta`/`provenance`). */
export async function hashDocument(doc: UnidentifiedDocument): Promise<string> {
  return `sha256:${await sha256Hex(hashInput(doc))}`;
}

export interface EncodeOptions {
  readonly provenance?: Omit<MazeProvenance, 'coreVersion'> & { readonly coreVersion?: string };
  readonly edited?: boolean;
  readonly meta?: MazeDocumentMeta;
}

/** Serialises a state; `id` is left empty (fill with {@link encodeDocument} or {@link hashDocument}). */
export function encodeDocumentSync(
  state: MazeState,
  opts: EncodeOptions = {},
): UnidentifiedDocument {
  const doc: UnidentifiedDocument = {
    v: 1,
    width: state.grid.width,
    height: state.grid.height,
    topology: 'orthogonal',
    walls: toBase64Url(packWalls(state.walls)),
    start: state.start,
    goal: state.goal,
    ...(opts.provenance
      ? {
          provenance: {
            ...opts.provenance,
            coreVersion: opts.provenance.coreVersion ?? CORE_VERSION,
          },
        }
      : {}),
    ...(opts.edited !== undefined ? { edited: opts.edited } : {}),
    ...(opts.meta ? { meta: opts.meta } : {}),
  };
  return doc;
}

export async function encodeDocument(
  state: MazeState,
  opts: EncodeOptions = {},
): Promise<MazeDocumentV1> {
  const doc = encodeDocumentSync(state, opts);
  return { id: await hashDocument(doc), ...doc };
}

export function isMazeDocument(x: unknown): x is MazeDocument {
  if (typeof x !== 'object' || x === null) return false;
  const d = x as Record<string, unknown>;
  return (
    d.v === 1 &&
    typeof d.width === 'number' &&
    typeof d.height === 'number' &&
    d.topology === 'orthogonal' &&
    typeof d.walls === 'string' &&
    typeof d.start === 'number' &&
    typeof d.goal === 'number'
  );
}

/** Rebuilds a frozen `MazeState`; validates dimensions, cell ids and wall symmetry. */
export function decodeDocument(doc: MazeDocument | UnidentifiedDocument): MazeState {
  if (doc.v !== 1) throw new RangeError(`Unsupported MazeDocument version ${String(doc.v)}`);
  const grid = createGrid(doc.width, doc.height);
  const total = cellCount(grid);
  const walls = unpackWalls(fromBase64Url(doc.walls), total);
  if (!isValidCell(grid, doc.start) || !isValidCell(grid, doc.goal)) {
    throw new RangeError('start/goal out of range');
  }
  const state = createMazeState(grid, walls, doc.start, doc.goal);
  if (!wallsAreSymmetric(state)) throw new RangeError('MazeDocument walls are not symmetric');
  return state;
}
