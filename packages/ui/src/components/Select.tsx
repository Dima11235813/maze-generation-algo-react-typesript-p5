import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useId, type ComponentPropsWithRef } from 'react';
import { cn } from '../cn';
import { Label } from './Label';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-panel px-3 text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          'relative z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border border-border bg-panel text-fg shadow-md',
          position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-panel-2',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export interface SimpleSelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SimpleSelectProps<T extends string> {
  label: string;
  hideLabel?: boolean;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SimpleSelectOption<T>[];
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
}

/** Labelled single-value select for the common case. */
export function SimpleSelect<T extends string>({
  label,
  hideLabel,
  value,
  onValueChange,
  options,
  disabled,
  className,
  triggerClassName,
  id: idProp,
}: SimpleSelectProps<T>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as T)}
        {...(disabled !== undefined ? { disabled } : {})}
      >
        <SelectTrigger id={id} className={triggerClassName} aria-label={hideLabel ? label : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} {...(o.disabled ? { disabled: true } : {})}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
