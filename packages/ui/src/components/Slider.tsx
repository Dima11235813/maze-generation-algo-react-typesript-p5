import * as SliderPrimitive from '@radix-ui/react-slider';
import { useId } from 'react';
import { cn } from '../cn';
import { Label } from './Label';

export interface SliderProps {
  /** Visible label (rendered) or accessible name only when `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  value: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Human-readable value for screen readers, e.g. "40 pixels". */
  valueText?: string;
  /** Text shown to the right of the label, defaults to `valueText` or the value. */
  valueDisplay?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Slider({
  label,
  hideLabel,
  value,
  onValueChange,
  onValueCommit,
  min,
  max,
  step = 1,
  valueText,
  valueDisplay,
  disabled,
  className,
  id: idProp,
}: SliderProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const labelId = `${id}-label`;
  const shown = valueDisplay ?? valueText ?? String(value);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className={cn('flex items-center justify-between gap-2', hideLabel && 'sr-only')}>
        <Label id={labelId} htmlFor={id}>
          {label}
        </Label>
        <span className="text-xs tabular-nums text-muted" aria-hidden="true">
          {shown}
        </span>
      </div>
      <SliderPrimitive.Root
        className="relative flex h-5 w-full touch-none items-center select-none"
        value={[value]}
        onValueChange={(v) => {
          const next = v[0];
          if (next !== undefined) onValueChange(next);
        }}
        {...(onValueCommit
          ? {
              onValueCommit: (v: number[]) => {
                const next = v[0];
                if (next !== undefined) onValueCommit(next);
              },
            }
          : {})}
        min={min}
        max={max}
        step={step}
        {...(disabled !== undefined ? { disabled } : {})}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          id={id}
          aria-labelledby={labelId}
          {...(valueText !== undefined ? { 'aria-valuetext': valueText } : {})}
          className="block h-5 w-5 rounded-full border-2 border-accent bg-panel shadow transition-colors hover:bg-panel-2 disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Root>
    </div>
  );
}
