import { useEffect, useId, useState } from 'react';
import { cn } from '../cn';
import { Label } from './Label';

export interface NumberFieldProps {
  label: string;
  hideLabel?: boolean;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Suffix shown after the input, e.g. "px". */
  unit?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
}

/** Numeric input that clamps to [min, max] on blur and never emits NaN. */
export function NumberField({
  label,
  hideLabel,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
  className,
  inputClassName,
  id: idProp,
}: NumberFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    const next = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    setText(String(next));
    if (next !== value) onValueChange(next);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className={cn(
            'h-9 w-24 rounded-md border border-border bg-panel px-2 text-sm tabular-nums disabled:opacity-50',
            inputClassName,
          )}
          value={text}
          min={min}
          max={max}
          step={step}
          {...(disabled !== undefined ? { disabled } : {})}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onBlur={(e) => {
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
        />
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}
