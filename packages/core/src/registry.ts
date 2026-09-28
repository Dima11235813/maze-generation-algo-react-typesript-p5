import type { AlgorithmMeta } from './meta';

export interface Registry<T extends { readonly meta: AlgorithmMeta }> {
  readonly all: readonly T[];
  readonly ids: readonly string[];
  get(id: string): T | undefined;
  /** Throws when the id is unknown. */
  require(id: string): T;
  has(id: string): boolean;
}

/**
 * Adding an algorithm = adding one file and one registry entry. Menus, tests, API enums and
 * the Explore catalogue derive from the registry (Open/Closed).
 */
export function createRegistry<T extends { readonly meta: AlgorithmMeta }>(
  items: readonly T[],
): Registry<T> {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (byId.has(item.meta.id)) {
      throw new Error(`Duplicate algorithm id '${item.meta.id}'`);
    }
    byId.set(item.meta.id, item);
  }
  const all = Object.freeze([...items]);
  const ids = Object.freeze(all.map((i) => i.meta.id));
  return {
    all,
    ids,
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    require(id) {
      const item = byId.get(id);
      if (!item) throw new Error(`Unknown algorithm '${id}'. Known: ${ids.join(', ')}`);
      return item;
    },
  };
}
