import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

export function ToggleGroup({
  className,
  ...props
}: ComponentPropsWithRef<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-border bg-panel-2 p-0.5', className)}
      {...props}
    />
  );
}

export function ToggleGroupItem({
  className,
  ...props
}: ComponentPropsWithRef<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'inline-flex h-7 min-w-8 items-center justify-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-panel disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-fg',
        className,
      )}
      {...props}
    />
  );
}
