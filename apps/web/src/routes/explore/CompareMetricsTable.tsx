import { generators, type MazeMetrics } from '@maze/core';
import { cn } from '@maze/ui';
import type { MazeSession } from '../../maze/session';

interface Column {
  key: string;
  label: string;
  /** Which value wins the column. */
  best: 'min' | 'max';
  rule: string;
  value(m: MazeMetrics, steps: number): number | null;
  format(v: number | null): string;
}

const int = (v: number | null): string => (v === null ? '-' : String(v));

export const COLUMNS: readonly Column[] = [
  {
    key: 'deadEnds',
    label: 'Dead ends',
    best: 'min',
    rule: 'fewest',
    value: (m) => m.deadEnds,
    format: int,
  },
  {
    key: 'solution',
    label: 'Solution',
    best: 'max',
    rule: 'longest',
    value: (m) => m.solutionLength,
    format: (v) => (v === null ? 'none' : `${v} moves`),
  },
  {
    key: 'diameter',
    label: 'Diameter',
    best: 'max',
    rule: 'longest',
    value: (m) => m.diameter,
    format: int,
  },
  {
    key: 'degree',
    label: 'Avg degree',
    best: 'max',
    rule: 'highest',
    value: (m) => m.averageDegree,
    format: (v) => (v === null ? '-' : v.toFixed(2)),
  },
  {
    key: 'junctions',
    label: 'Junctions',
    best: 'max',
    rule: 'most',
    value: (m) => m.junctions,
    format: int,
  },
  {
    key: 'steps',
    label: 'Gen. steps',
    best: 'min',
    rule: 'fewest',
    value: (_m, steps) => steps,
    format: int,
  },
];

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

export interface CompareMetricsTableProps {
  lanes: readonly { algoId: string; session: MazeSession }[];
}

/** Metrics per finished lane with the best value per column highlighted and announced. */
export function CompareMetricsTable({ lanes }: CompareMetricsTableProps) {
  const rows = lanes.map((l) => {
    const snap = l.session.getSnapshot();
    const steps = l.session.generation?.steps ?? 0;
    return {
      algoId: l.algoId,
      name: generators.get(l.algoId)?.meta.name ?? l.algoId,
      metrics: snap.metrics,
      steps,
    };
  });
  const bestByColumn = COLUMNS.map((c) =>
    bestLanes(
      rows.map((r) => (r.metrics ? c.value(r.metrics, r.steps) : null)),
      c.best,
    ),
  );
  return (
    <section
      aria-labelledby="compare-metrics-heading"
      className="mx-2 mb-2 flex flex-col gap-2 rounded-lg border border-border bg-panel px-3 py-2"
    >
      <h2
        id="compare-metrics-heading"
        className="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        Metrics
      </h2>
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="compare-metrics">
          <caption className="sr-only">
            Maze metrics per generator. The best value in each column is highlighted and marked
            "best": {COLUMNS.map((c) => `${c.label} ${c.rule}`).join(', ')}.
          </caption>
          <thead>
            <tr className="text-[10px] tracking-wide text-muted uppercase">
              <th scope="col" className="sticky left-0 bg-bg py-1 pr-3 font-medium">
                Generator
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="py-1 pr-3 font-medium whitespace-nowrap">
                  {c.label} <span className="font-normal normal-case">({c.rule})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.algoId}-${i}`}
                className="border-t border-border"
                data-testid="compare-row"
              >
                <th
                  scope="row"
                  className="sticky left-0 max-w-[9rem] bg-bg py-1.5 pr-3 text-sm font-medium sm:max-w-none"
                >
                  {r.name}
                  {rows.filter((x) => x.algoId === r.algoId).length > 1 ? (
                    <span className="ml-1 text-xs text-muted">#{i + 1}</span>
                  ) : null}
                </th>
                {COLUMNS.map((c, ci) => {
                  const v = r.metrics ? c.value(r.metrics, r.steps) : null;
                  const isBest = bestByColumn[ci]?.has(i) ?? false;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        'py-1.5 pr-3 whitespace-nowrap tabular-nums',
                        isBest && 'font-semibold text-accent',
                      )}
                    >
                      {r.metrics ? (
                        c.format(v)
                      ) : (
                        <span className="text-muted">
                          <span aria-hidden="true">…</span>
                          <span className="sr-only">generating</span>
                        </span>
                      )}
                      {isBest ? <span className="sr-only"> (best)</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
