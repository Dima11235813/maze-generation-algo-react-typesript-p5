/**
 * Form controls generated from an algorithm's `ParamDescriptor`s (WI-04).
 *
 * int/float with a short range -> slider, long ranges -> number input, bool -> switch,
 * enum -> select. Descriptions render under each control. Nothing here names an algorithm, so
 * a parameter added to a core `meta` appears in every form (Play options, Watch, Compare, Race).
 */
import type { AlgorithmMeta, ParamDescriptor } from '@maze/core';
import { Button, NumberField, SimpleSelect, Slider, SwitchField } from '@maze/ui';
import { useEffect, useId, useState } from 'react';
import type { ParamValues } from '../../maze/algoParams';
import { useAlgoParams } from '../../maze/useAlgoParams';

/** Ranges with at most this many slider stops get a slider; longer ones a number input. */
const MAX_SLIDER_STOPS = 200;

export interface ParamFieldsProps {
  meta: AlgorithmMeta;
  values: ParamValues;
  onChange(key: string, value: unknown): void;
}

function stepOf(p: ParamDescriptor & { kind: 'int' | 'float' }): number {
  return p.step ?? (p.kind === 'int' ? 1 : 0.1);
}

function decimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

function NumericParam({
  p,
  value,
  onChange,
}: {
  p: ParamDescriptor & { kind: 'int' | 'float' };
  value: number;
  onChange(v: number): void;
}) {
  const step = stepOf(p);
  // Drag a local copy; commit on release so a run is not restarted on every pixel.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  if ((p.max - p.min) / step > MAX_SLIDER_STOPS) {
    return (
      <NumberField
        label={p.label}
        value={value}
        min={p.min}
        max={p.max}
        step={step}
        onValueChange={onChange}
      />
    );
  }
  const shown = draft.toFixed(decimals(step));
  return (
    <Slider
      label={p.label}
      value={draft}
      min={p.min}
      max={p.max}
      step={step}
      valueText={shown}
      onValueChange={setDraft}
      onValueCommit={(v) => {
        onChange(p.kind === 'int' ? Math.round(v) : Number(v.toFixed(decimals(step))));
      }}
    />
  );
}

function ParamField({
  p,
  value,
  onChange,
}: {
  p: ParamDescriptor;
  value: unknown;
  onChange(v: unknown): void;
}) {
  switch (p.kind) {
    case 'int':
    case 'float':
      return (
        <NumericParam
          p={p}
          value={typeof value === 'number' ? value : p.default}
          onChange={onChange}
        />
      );
    case 'bool':
      return (
        <SwitchField
          label={p.label}
          {...(p.description ? { description: p.description } : {})}
          checked={typeof value === 'boolean' ? value : p.default}
          onCheckedChange={onChange}
        />
      );
    case 'enum':
      return (
        <SimpleSelect
          label={p.label}
          value={typeof value === 'string' ? value : p.default}
          onValueChange={onChange}
          options={p.options}
        />
      );
  }
}

/** The controls for one algorithm's parameters (renders nothing when it has none). */
export function ParamFields({ meta, values, onChange }: ParamFieldsProps) {
  if (meta.params.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {meta.params.map((p) => (
        <div key={p.key} className="flex flex-col gap-1" data-param={p.key}>
          <ParamField
            p={p}
            value={values[p.key]}
            onChange={(v) => {
              onChange(p.key, v);
            }}
          />
          {p.description && p.kind !== 'bool' ? (
            <p className="text-xs text-muted">{p.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export interface AlgorithmParamsProps {
  algorithmId: string;
  /** Heading level text; defaults to "<name> parameters". */
  title?: string;
  /** Show "No parameters" instead of rendering nothing for parameterless algorithms. */
  showEmpty?: boolean;
  className?: string;
}

/** `ParamFields` bound to the saved parameters for one algorithm, with a reset button. */
export function AlgorithmParams({
  algorithmId,
  title,
  showEmpty = false,
  className,
}: AlgorithmParamsProps) {
  const { meta, values, isDefault, setParam, reset } = useAlgoParams(algorithmId);
  const headingId = useId();
  if (!meta || (meta.params.length === 0 && !showEmpty)) return null;
  return (
    <section
      aria-labelledby={headingId}
      className={className ?? 'flex flex-col gap-3'}
      data-testid={`params-${meta.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id={headingId} className="text-sm font-medium">
          {title ?? `${meta.name} parameters`}
        </h4>
        {meta.params.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isDefault}
            onClick={reset}
            aria-label={`Reset ${meta.name} parameters`}
          >
            Reset
          </Button>
        ) : null}
      </div>
      {meta.params.length === 0 ? (
        <p className="text-xs text-muted">{meta.name} has no parameters.</p>
      ) : (
        <ParamFields meta={meta} values={values} onChange={setParam} />
      )}
    </section>
  );
}
