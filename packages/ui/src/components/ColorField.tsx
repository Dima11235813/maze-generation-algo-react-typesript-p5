import { useEffect, useId, useState } from 'react';
import { cn } from '../cn';
import { normalizeHex } from './hex';
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
