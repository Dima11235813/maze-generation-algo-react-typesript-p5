import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]', className)}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentPropsWithRef<typeof DialogPrimitive.Content> {
  /** Hide the default close button (provide your own). */
  hideClose?: boolean;
}

export function DialogContent({ className, children, hideClose, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-panel p-5 text-fg shadow-xl',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-fg"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('flex justify-end gap-2', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base leading-none font-semibold', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />;
}
