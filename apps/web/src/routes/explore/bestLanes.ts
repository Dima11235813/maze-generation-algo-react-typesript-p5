/** Indices of lanes holding the best value for a column; empty when all lanes tie or <2 lanes. */
export function bestLanes(values: readonly (number | null)[], best: 'min' | 'max'): Set<number> {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return new Set();
  const target = best === 'min' ? Math.min(...present) : Math.max(...present);
  const out = new Set<number>();
  values.forEach((v, i) => {
    if (v === target) out.add(i);
  });
  return out.size === present.length ? new Set() : out;
}
