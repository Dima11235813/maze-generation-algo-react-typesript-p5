/**
 * Algorithm parameters chosen by the user (WI-04).
 *
 * Values live in `prefs.algoParams[algorithmId]` exactly as entered and are clamped against the
 * algorithm's `ParamDescriptor`s whenever they are read, so a form, a run and a saved document
 * all see the same sanitised object (the prefs-bound hook is in `useAlgoParams.ts`). Nothing
 * here knows a specific algorithm: a new descriptor in a core `meta` shows up in every form and
 * run without a UI change.
 */
import {
  generators,
  sanitizeParams,
  solvers,
  type AlgorithmMeta,
  type ParamDescriptor,
} from '@maze/core';

export type ParamValues = Record<string, unknown>;

/** Looks an id up in both registries (generators first; ids are unique across them). */
export function algorithmMeta(id: string): AlgorithmMeta | null {
  return generators.get(id)?.meta ?? solvers.get(id)?.meta ?? null;
}

/** The sanitised parameters for `meta` from a stored `algoParams` map. */
export function paramsFor(
  stored: Readonly<Record<string, ParamValues>>,
  meta: AlgorithmMeta,
): ParamValues {
  return sanitizeParams(meta, stored[meta.id]);
}

function formatValue(p: ParamDescriptor, v: unknown): string {
  switch (p.kind) {
    case 'bool':
      return v ? 'on' : 'off';
    case 'enum':
      return p.options.find((o) => o.value === v)?.label ?? String(v);
    case 'int':
    case 'float':
      return String(v);
  }
}

/** True when every parameter is at its default (a plain run of the algorithm). */
export function isDefaultParams(meta: AlgorithmMeta, params: ParamValues): boolean {
  return meta.params.every((p) => params[p.key] === p.default);
}

/** "Heuristic weight 2, Tie-break Insertion order": only the values changed from default. */
export function describeParamValues(meta: AlgorithmMeta, params: ParamValues): string {
  return meta.params
    .filter((p) => p.key in params && params[p.key] !== p.default)
    .map((p) => `${p.label} ${formatValue(p, params[p.key])}`)
    .join(', ');
}

/** "Growing Tree" or "Growing Tree (Pick Newest 50%)" for status lines and labels. */
export function nameWithParams(meta: AlgorithmMeta, params: ParamValues): string {
  const changed = describeParamValues(meta, params);
  return changed ? `${meta.name} (${changed})` : meta.name;
}
