import type { ParamDescriptor } from '@maze/core';

/** Read-only, human-readable rendering of one parameter descriptor. */
export function describeParam(p: ParamDescriptor): string {
  switch (p.kind) {
    case 'int':
    case 'float':
      return `${p.label}: ${p.min === Number.MAX_SAFE_INTEGER ? 'any' : p.min}..${
        p.max === Number.MAX_SAFE_INTEGER ? 'any' : p.max
      } (default ${p.default})`;
    case 'bool':
      return `${p.label}: on | off (default ${p.default ? 'on' : 'off'})`;
    case 'enum':
      return `${p.label}: ${p.options.map((o) => o.label).join(' | ')} (default ${
        p.options.find((o) => o.value === p.default)?.label ?? p.default
      })`;
  }
}
