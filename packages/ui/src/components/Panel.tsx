import type { ComponentPropsWithRef } from 'react';
import { cn } from '../cn';

/** Bordered surface for grouped controls and info. */
export function Panel({ className, ...props }: ComponentPropsWithRef<'section'>) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-panel text-fg shadow-sm', className)}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: ComponentPropsWithRef<'header'>) {
  return <header className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...props} />;
}

export function PanelTitle({ className, children, ...props }: ComponentPropsWithRef<'h2'>) {
  return (
    <h2 className={cn('text-sm font-semibold tracking-tight', className)} {...props}>
      {children}
    </h2>
  );
}

export function PanelDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return <p className={cn('text-xs text-muted', className)} {...props} />;
}

export function PanelContent({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('p-4 pt-2', className)} {...props} />;
}

/** @alias Panel (the app reads better with Card*). */
export const Card = Panel;
/** @alias */
export const CardHeader = PanelHeader;
/** @alias */
export const CardTitle = PanelTitle;
/** @alias */
export const CardDescription = PanelDescription;
/** @alias */
export const CardContent = PanelContent;
