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
    default: 'bg-[#e0ece5] text-[#174f3f]',
    secondary: 'bg-[#f0f4f1] text-[#4d6357]',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    destructive: 'bg-red-100 text-red-800',
    outline: 'border border-[#cbd7cf] text-[#202d29] bg-transparent',
  }[variant]

  return <span className={cn(baseStyles, variantStyles, className)} {...props} />
}
