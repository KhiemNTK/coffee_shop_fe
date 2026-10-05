import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './utils'
import { X } from 'lucide-react'

export interface DialogProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  className?: string
  label?: string
  showCloseButton?: boolean
}

export function Dialog({
  open, onClose, onOpenChange, maxWidth = 'md', children, className,
  label = 'Hộp thoại',
  showCloseButton = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const handleClose = () => {
    onClose?.()
    onOpenChange?.(false)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const heading = dialog.querySelector('h1, h2, h3')
    if (heading) {
      heading.id ||= headingId
      dialog.setAttribute('aria-labelledby', heading.id)
    }
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, headingId])

  if (!open || typeof document === 'undefined') return null
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[maxWidth]

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={label}
      onCancel={(event) => { event.preventDefault(); handleClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) handleClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/50',
        width, className,
      )}
    >
      {showCloseButton && <button
        type="button"
        onClick={handleClose}
        className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Đóng"
        title="Đóng"
      >
        <X size={18} aria-hidden="true" />
      </button>}
      {children}
    </dialog>,
    document.body,
  )
}

export function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4', className)} {...props} />
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col space-y-1.5 pr-8 text-left', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-tight text-foreground', className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end', className)} {...props} />
}
