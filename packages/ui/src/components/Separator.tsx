import * as SeparatorPrimitive from '@radix-ui/react-separator';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: ComponentPropsWithRef<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px self-stretch',
        className,
      )}
      {...props}
    />
  );
}
