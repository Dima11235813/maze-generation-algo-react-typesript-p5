import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentPropsWithRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1 rounded-md bg-panel-2 p-1 text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-panel data-[state=active]:text-fg data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-2', className)} {...props} />;
}
