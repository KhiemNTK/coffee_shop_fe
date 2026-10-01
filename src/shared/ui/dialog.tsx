import React, { useEffect, useRef } from 'react'
import { cn } from './utils'
import { X } from 'lucide-react'

export interface DialogProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  className?: string
}

export function Dialog({
  open,
  onClose,
  onOpenChange,
  maxWidth = 'md',
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleClose = React.useCallback(() => {
    onClose?.()
    onOpenChange?.(false)
  }, [onClose, onOpenChange])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [open, handleClose])

  if (!open) return null

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[maxWidth]

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog content */}
      <div
        ref={dialogRef}
        className={cn(
          'relative z-50 w-full rounded-2xl bg-white p-6 shadow-2xl transition-all animate-in zoom-in-95 border border-[#dce5df]',
          maxWidthClass,
          className,
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-[#65776d] hover:bg-[#f2f6f3] hover:text-[#202d29] transition-colors focus:outline-none focus:ring-2 focus:ring-[#174f3f]"
          aria-label="Đóng"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

export function DialogContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4', className)} {...props} />
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-[#174f3f]',
        className,
      )}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-[#68776f] mt-1', className)}
      {...props}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-4 border-t border-[#e2eae5]',
        className,
      )}
      {...props}
    />
  )
}
