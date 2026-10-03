/**
 * Algorithm metadata and parameter descriptors.
 *
 * `ParamDescriptor` is plain data so that `@maze/core` stays dependency-free; the contracts
 * package converts it to zod for forms and API validation.
 */

interface ParamBase {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
}

export type ParamDescriptor =
  | (ParamBase & {
      readonly kind: 'int';
      readonly min: number;
      readonly max: number;
      readonly step?: number;
      readonly default: number;
    })
  | (ParamBase & {
      readonly kind: 'float';
      readonly min: number;
      readonly max: number;
      readonly step?: number;
      readonly default: number;
    })
  | (ParamBase & { readonly kind: 'bool'; readonly default: boolean })
  | (ParamBase & {
      readonly kind: 'enum';
      readonly options: readonly { readonly value: string; readonly label: string }[];
      readonly default: string;
    });

export type AlgorithmFamily = 'generator' | 'solver' | 'postprocessor';

export interface AlgorithmMeta {
  /** kebab-case, stable forever: 'recursive-backtracker'. */
  readonly id: string;
  readonly name: string;
  readonly family: AlgorithmFamily;
  /** One or two sentences for menus and the Explore catalogue. */
  readonly summary: string;
  readonly complexity: { readonly time: string; readonly space: string };
  readonly tags: readonly string[];
  readonly params: readonly ParamDescriptor[];
  /** Learn-mode slug, e.g. 'learn/recursive-backtracker'. */
  readonly docsSlug: string;
  /** Core version that introduced the algorithm (replay compatibility). */
  readonly since: string;
}

/** Builds the default parameter object from a descriptor list. */
export function defaultParams<P extends Record<string, unknown>>(meta: AlgorithmMeta): P {
  const out: Record<string, unknown> = {};
  for (const p of meta.params) out[p.key] = p.default;
  return out as P;
}

/** Clamps/normalises a raw params object against the descriptors (unknown keys dropped). */
export function sanitizeParams<P extends Record<string, unknown>>(
  meta: AlgorithmMeta,
  raw: Record<string, unknown> | undefined,
): P {
  const out: Record<string, unknown> = {};
  for (const p of meta.params) {
    const v = raw?.[p.key];
    switch (p.kind) {
      case 'int': {
        const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : p.default;
        out[p.key] = Math.min(p.max, Math.max(p.min, n));
        break;
      }
      case 'float': {
        const n = typeof v === 'number' && Number.isFinite(v) ? v : p.default;
        out[p.key] = Math.min(p.max, Math.max(p.min, n));
        break;
      }
      case 'bool':
        out[p.key] = typeof v === 'boolean' ? v : p.default;
        break;
      case 'enum':
        out[p.key] = typeof v === 'string' && p.options.some((o) => o.value === v) ? v : p.default;
        break;
    }
  }
  return out as P;
}
