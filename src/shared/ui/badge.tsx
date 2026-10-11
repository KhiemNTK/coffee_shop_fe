import React from 'react'
import { cn } from './utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'outline'
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors'

  const variantStyles = {
    default: 'bg-primary-light text-primary font-semibold',
    secondary: 'bg-secondary text-secondary-foreground font-medium',
    success: 'bg-emerald-100 text-emerald-800 font-semibold',
    warning: 'bg-amber-100 text-amber-800 font-semibold',
    destructive: 'bg-rose-100 text-rose-800 font-semibold',
    outline: 'border border-border text-foreground bg-transparent font-medium',
  }[variant]

  return <span className={cn(baseStyles, variantStyles, className)} {...props} />
}
