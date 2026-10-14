import { cn } from './utils'

export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'success'

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonVariantOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: ButtonVariantOptions = {}): string {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]'

  const variantStyles = {
    default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs',
    outline:
      'border border-border bg-card hover:bg-muted text-foreground shadow-2xs',
    secondary:
      'bg-primary-light text-primary hover:bg-primary/20 font-semibold',
    success: 'bg-success text-white hover:bg-success/90 shadow-xs',
    ghost: 'hover:bg-muted text-foreground',
    link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
  }[variant]

  const sizeStyles = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 rounded-[8px] px-3 text-xs',
    lg: 'h-12 rounded-[12px] px-6 text-base font-semibold',
    icon: 'h-9 w-9 p-0',
  }[size]

  return cn(baseStyles, variantStyles, sizeStyles, className)
}
