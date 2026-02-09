import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded border border-terminal-border bg-terminal-dim px-3 py-1.5 text-sm font-medium text-terminal-text transition-colors hover:bg-terminal-muted/20 hover:text-terminal-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terminal-border disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-terminal-border',
        ghost: 'border-transparent hover:bg-terminal-dim',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
