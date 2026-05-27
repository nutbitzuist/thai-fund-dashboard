import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-700 text-white',
        secondary: 'border-transparent bg-slate-100 text-slate-800',
        outline: 'text-slate-700 border-slate-200',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-amber-100 text-amber-800',
        destructive: 'border-transparent bg-red-100 text-red-800',
        risk1: 'border-transparent bg-green-100 text-green-800',
        risk2: 'border-transparent bg-green-100 text-green-800',
        risk3: 'border-transparent bg-lime-100 text-lime-800',
        risk4: 'border-transparent bg-amber-100 text-amber-800',
        risk5: 'border-transparent bg-orange-100 text-orange-800',
        risk6: 'border-transparent bg-red-100 text-red-800',
        risk7: 'border-transparent bg-red-100 text-red-800',
        risk8: 'border-transparent bg-red-200 text-red-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
