import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './utils'

export function OperationsHeader({
  title,
  meta,
  actions,
}: {
  title: string
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {meta && <div className="mt-1.5 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function OperationsSummary({
  label,
  metrics,
  variant = 'band',
}: {
  label: string
  variant?: 'band' | 'cards'
  metrics: {
    label: string
    value: string | number
    icon: LucideIcon
    tone?: 'danger' | 'warning'
    note?: string
  }[]
}) {
  return (
    <dl
      aria-label={label}
      className={
        variant === 'cards'
          ? cn(
              'grid gap-3 sm:grid-cols-2 xl:grid-cols-3',
              metrics.length === 4 && 'xl:grid-cols-4',
              metrics.length === 6 && '2xl:grid-cols-6',
            )
          : 'grid grid-cols-2 border-y border-border bg-card lg:grid-cols-4'
      }
    >
      {metrics.map(({ label: name, value, icon: Icon, tone, note }) => (
        <div
          key={name}
          className={
            variant === 'cards'
              ? 'min-w-0 rounded-lg border border-border bg-card p-4'
              : 'min-w-0 border-b border-r border-border p-4 last:border-r-0 lg:border-b-0'
          }
        >
          <dt className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
            <span>{name}</span>
            <Icon
              size={18}
              aria-hidden="true"
              className={cn(
                'shrink-0',
                tone === 'danger'
                  ? 'text-destructive'
                  : tone === 'warning'
                    ? 'text-amber-700'
                    : 'text-primary',
              )}
            />
          </dt>
          <dd
            className={cn(
              'mt-2 break-words text-2xl font-bold tabular-nums',
              tone === 'danger' && 'text-destructive',
            )}
          >
            {value}
          </dd>
          {note && <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function AdminTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="admin-table-scroll">
      <table className="admin-table">{children}</table>
    </div>
  )
}
