import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';
import { DialogOverlay } from './Dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export type SheetSide = 'left' | 'right' | 'top' | 'bottom';

const sideClasses: Record<SheetSide, string> = {
  left: 'inset-y-0 left-0 h-full w-[min(92vw,22rem)] border-r',
  right: 'inset-y-0 right-0 h-full w-[min(92vw,22rem)] border-l',
  top: 'inset-x-0 top-0 max-h-[80vh] border-b',
  bottom: 'inset-x-0 bottom-0 max-h-[80vh] border-t',
};

export interface SheetContentProps extends ComponentPropsWithRef<typeof DialogPrimitive.Content> {
  side?: SheetSide;
  /** Non-modal sheets keep the canvas interactive behind them (no overlay). */
  modal?: boolean;
}

export function SheetContent({
  side = 'right',
  className,
  children,
  modal = true,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      {modal ? <DialogOverlay /> : null}
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-panel p-4 text-fg shadow-xl',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-fg"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('flex flex-col gap-1 pr-8', className)} {...props} />;
}

export function SheetTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn('text-base font-semibold', className)} {...props} />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />;
}
