/**
 * How many dead ends each generator makes, over 50 seeded mazes (M5): a small histogram per
 * generator on one shared axis, so a biased generator stands apart at a glance. The chart is
 * visual only; the table beside it carries the same facts for screen readers.
 */
import { useMemo } from 'react';
import { deadEndSamples, histogram } from '../../learn/bias';

const BIN = 0.025;
const TOP = 0.45;
const SEEDS = 50;

const pct = (v: number): string => `${String(Math.round(v * 100))}%`;

export function DeadEndHistogram({ generatorIds }: { generatorIds: readonly string[] }) {
  const samples = useMemo(() => deadEndSamples(generatorIds, SEEDS), [generatorIds]);
  const rows = samples.map((s) => ({ ...s, bins: histogram(s.ratios, BIN, TOP) }));
  const tallest = Math.max(1, ...rows.flatMap((r) => r.bins));
  return (
    <figure className="relative m-0 flex flex-col gap-2 rounded-md border border-border bg-panel-2 p-3">
      <figcaption className="text-xs font-medium">
        Share of cells that are dead ends, {SEEDS} mazes of 12 by 9 cells from each generator
      </figcaption>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {rows.map((r) => (
          <div key={r.generatorId} className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs">
              <span>{r.name}</span>
              <span className="text-muted tabular-nums">average {pct(r.mean)}</span>
            </div>
            <div className="flex h-8 items-end gap-px border-b border-border">
              {r.bins.map((n, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-accent"
                  style={{ height: `${String((n / tallest) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-between text-[10px] text-muted tabular-nums">
          {[0, 1, 2, 3].map((i) => (
            <span key={i}>{pct((TOP * i) / 3)}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Share of cells that are dead ends, over {SEEDS} mazes per generator</caption>
        <thead>
          <tr>
            <th scope="col">Generator</th>
            <th scope="col">Average</th>
            <th scope="col">Lowest</th>
            <th scope="col">Highest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.generatorId}>
              <th scope="row">{r.name}</th>
              <td>{pct(r.mean)}</td>
              <td>{pct(r.min)}</td>
              <td>{pct(r.max)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
