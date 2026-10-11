import { Slot } from '@radix-ui/react-slot';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '../cn';
import { buttonVariants } from './buttonVariants';

export interface ButtonProps
  extends ComponentPropsWithRef<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>` (e.g. a router `Link`). */
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'aria-label'> {
  /** Required: icon-only buttons must have an accessible name. */
  'aria-label': string;
  size?: 'icon' | 'icon-sm';
  children: ReactNode;
}

export function IconButton({ size = 'icon', variant = 'ghost', ...props }: IconButtonProps) {
  return <Button size={size} variant={variant} {...props} />;
}
