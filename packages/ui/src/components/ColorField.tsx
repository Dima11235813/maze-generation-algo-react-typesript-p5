import { useEffect, useId, useState } from 'react';
import { cn } from '../cn';
import { Label } from './Label';

export interface ColorFieldProps {
  label: string;
  /** `#rrggbb` */
  value: string;
  onValueChange: (hex: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const HEX = /^#?([0-9a-f]{6})$/i;
const SHORT_HEX = /^#?([0-9a-f]{3})$/i;

/** Normalises user text to `#rrggbb`, or null when invalid. */
export function normalizeHex(input: string): string | null {
  const s = input.trim();
  const long = HEX.exec(s);
  if (long) return `#${(long[1] as string).toLowerCase()}`;
  const short = SHORT_HEX.exec(s);
  if (short) {
    const [a, b, c] = (short[1] as string).toLowerCase();
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return null;
}

/**
 * Native colour input (keyboard and screen-reader accessible in every browser) plus a hex
 * text field. Replaces the legacy react-color SketchPicker.
 */
export function ColorField({
  label,
  value,
  onValueChange,
  disabled,
  className,
  id: idProp,
}: ColorFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const textId = `${id}-hex`;
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);

  const commitText = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) {
      setText(hex);
      if (hex !== value) onValueChange(hex);
    } else {
      setText(value);
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-panel p-0.5 disabled:opacity-50"
          value={value}
          {...(disabled !== undefined ? { disabled } : {})}
          onChange={(e) => {
            onValueChange(e.target.value);
          }}
        />
        <input
          id={textId}
          type="text"
          aria-label={`${label} hex value`}
          className="h-9 w-28 rounded-md border border-border bg-panel px-2 font-mono text-sm uppercase disabled:opacity-50"
          value={text}
          spellCheck={false}
          maxLength={7}
          {...(disabled !== undefined ? { disabled } : {})}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onBlur={(e) => {
            commitText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value);
          }}
        />
      </div>
    </div>
  );
}
