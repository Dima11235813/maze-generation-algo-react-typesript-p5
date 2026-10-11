import { cva } from 'class-variance-authority';

/** Button class recipe, shared by `Button`, `IconButton` and links styled as buttons. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-sm font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-accent aria-pressed:text-accent-fg data-[state=on]:bg-accent data-[state=on]:text-accent-fg',
  {
    variants: {
      variant: {
        default: 'border-accent bg-accent text-accent-fg hover:opacity-90',
        secondary: 'border-border bg-panel-2 text-fg hover:bg-border/60',
        outline: 'border-border bg-transparent text-fg hover:bg-panel-2',
        ghost: 'border-transparent bg-transparent text-fg hover:bg-panel-2',
        destructive: 'border-danger bg-danger text-danger-fg hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);
