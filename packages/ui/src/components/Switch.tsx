import * as SwitchPrimitive from '@radix-ui/react-switch';
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { Label } from './Label';

export type SwitchProps = ComponentPropsWithRef<typeof SwitchPrimitive.Root>;

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=unchecked]:bg-border',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-panel shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export interface SwitchFieldProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** Label + switch row; the whole label is clickable. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id: idProp,
  className,
}: SwitchFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1', className)}>
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description ? (
          <span id={descId} className="text-xs text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        {...(disabled !== undefined ? { disabled } : {})}
        {...(descId ? { 'aria-describedby': descId } : {})}
      />
    </div>
  );
}
