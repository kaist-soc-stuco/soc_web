import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'interaction-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ui-control-radius)] text-[length:var(--ui-control-font-size)] [font-weight:var(--ui-control-font-weight)] leading-[var(--ui-control-line-height)] transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default: 'border border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'border border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700',
        outline: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
        secondary: 'border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200/75 hover:text-slate-900',
        ghost: 'border border-transparent bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[var(--ui-control-height)] px-4 py-2',
        sm: 'h-[var(--ui-control-height-compact)] rounded-md gap-1.5 px-3',
        lg: 'h-[var(--ui-control-height)] rounded-md px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
