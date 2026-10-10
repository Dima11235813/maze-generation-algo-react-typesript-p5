/** Prefs-bound access to algorithm parameters (see `algoParams.ts`). */
import { useCallback } from 'react';
import { usePrefs } from '../state/prefs';
import { algorithmMeta, isDefaultParams, paramsFor, type ParamValues } from './algoParams';
import type { AlgorithmMeta } from '@maze/core';

/** Current parameters for an algorithm id from the live prefs (for imperative call sites). */
export function currentParams(id: string): ParamValues {
  const meta = algorithmMeta(id);
  return meta ? paramsFor(usePrefs.getState().algoParams, meta) : {};
}

export interface AlgoParamsApi {
  readonly meta: AlgorithmMeta | null;
  readonly values: ParamValues;
  readonly isDefault: boolean;
  setParam: (key: string, value: unknown) => void;
  reset: () => void;
}

/** Reads and edits one algorithm's parameters in the prefs store. */
export function useAlgoParams(id: string): AlgoParamsApi {
  const stored = usePrefs((s) => s.algoParams);
  const meta = algorithmMeta(id);
  const values = meta ? paramsFor(stored, meta) : {};
  const setParam = useCallback(
    (key: string, value: unknown) => {
      const all = usePrefs.getState().algoParams;
      usePrefs.getState().set('algoParams', { ...all, [id]: { ...all[id], [key]: value } });
    },
    [id],
  );
  const reset = useCallback(() => {
    const { [id]: _dropped, ...rest } = usePrefs.getState().algoParams;
    usePrefs.getState().set('algoParams', rest);
  }, [id]);
  return { meta, values, isDefault: meta ? isDefaultParams(meta, values) : true, setParam, reset };
}
