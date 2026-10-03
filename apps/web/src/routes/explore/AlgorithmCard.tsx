import type { AlgorithmMeta, ParamDescriptor } from '@maze/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@maze/ui';

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

const FAMILY_LABEL: Record<AlgorithmMeta['family'], string> = {
  generator: 'Generator',
  solver: 'Solver',
  postprocessor: 'Post-processor',
};

export interface AlgorithmCardProps {
  meta: AlgorithmMeta;
}

/** One registry entry: everything the Explore catalogue knows comes from `AlgorithmMeta`. */
export function AlgorithmCard({ meta }: AlgorithmCardProps) {
  return (
    <Card
      data-testid="algorithm-card"
      data-family={meta.family}
      data-algorithm-id={meta.id}
      className="h-full"
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span>{meta.name}</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
            {FAMILY_LABEL[meta.family]}
          </span>
        </CardTitle>
        <CardDescription>{meta.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-muted">Time</dt>
          <dd className="font-mono">{meta.complexity.time}</dd>
          <dt className="text-muted">Space</dt>
          <dd className="font-mono">{meta.complexity.space}</dd>
          <dt className="text-muted">Since</dt>
          <dd className="font-mono">v{meta.since}</dd>
          <dt className="text-muted">Lesson</dt>
          <dd className="truncate font-mono" title={meta.docsSlug}>
            {meta.docsSlug}
          </dd>
        </dl>
        {meta.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label={`${meta.name} tags`}>
            {meta.tags.map((t) => (
              <li
                key={t}
                className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <h4 className="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">
            Parameters
          </h4>
          {meta.params.length === 0 ? (
            <p className="text-muted">None</p>
          ) : (
            <ul className="flex flex-wrap gap-1" aria-label={`${meta.name} parameters`}>
              {meta.params.map((p) => (
                <li
                  key={p.key}
                  className="rounded-md bg-panel-2 px-1.5 py-0.5 font-mono text-[10px]"
                  title={p.description}
                >
                  {describeParam(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
