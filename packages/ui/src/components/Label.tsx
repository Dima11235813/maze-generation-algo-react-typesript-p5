import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

export type LabelProps = ComponentPropsWithRef<typeof LabelPrimitive.Root>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-medium leading-none select-none', className)}
      {...props}
    />
  );
}

export function VisuallyHidden({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return <span className={cn('sr-only', className)} {...props} />;
}
