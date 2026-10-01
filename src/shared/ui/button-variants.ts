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
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174f3f] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer'

  const variantStyles = {
    default: 'bg-[#174f3f] text-white hover:bg-[#123e32] shadow-sm',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    outline:
      'border border-[#cbd7cf] bg-white hover:bg-[#f2f6f3] text-[#202d29] shadow-2xs',
    secondary:
      'bg-[#e0ece5] text-[#174f3f] hover:bg-[#d0e2d7] font-semibold',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    ghost: 'hover:bg-[#f2f6f3] text-[#202d29]',
    link: 'text-[#174f3f] underline-offset-4 hover:underline p-0 h-auto',
  }[variant]

  const sizeStyles = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-12 rounded-lg px-6 text-base font-semibold',
    icon: 'h-9 w-9 p-0',
  }[size]

  return cn(baseStyles, variantStyles, sizeStyles, className)
}
