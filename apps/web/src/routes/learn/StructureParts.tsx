/** Small building blocks shared by the data-structure views. */
import type { ReactNode } from 'react';

export function StatGrid({ stats }: { stats: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-center text-xs">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-md bg-panel-2 p-2">
          <dt className="text-muted">{label}</dt>
          <dd className="text-base font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}
