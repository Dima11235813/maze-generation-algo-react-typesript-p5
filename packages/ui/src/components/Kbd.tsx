import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

/** Keyboard hint, e.g. <Kbd>Space</Kbd>. */
export function Kbd({ className, ...props }: ComponentPropsWithRef<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-panel-2 px-1 font-mono text-[10px] leading-none text-muted',
        className,
      )}
      {...props}
    />
  );
}
