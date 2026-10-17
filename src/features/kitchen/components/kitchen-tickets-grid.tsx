import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, Flame } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { errorMessage } from '../../../shared/api/client'
import type { KitchenTicket, KitchenTicketItem } from '../kitchen.api'
import { KitchenTicketCard } from './kitchen-ticket-card'

interface KitchenTicketsGridProps {
  tickets: KitchenTicket[]
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  nowMs: number
  dueSoonWindowSeconds?: number
  onAdvanceItemStatus: (item: KitchenTicketItem) => void
  isUpdatingStatus?: boolean
}

export function KitchenTicketsGrid({
  tickets,
  isLoading,
  isError,
  error,
  onRetry,
  nowMs,
  dueSoonWindowSeconds,
  onAdvanceItemStatus,
  isUpdatingStatus = false,
}: KitchenTicketsGridProps) {
  const { t: translate } = useTranslation()
  if (isLoading) {
    return (
      <div
        className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground"
        role="status"
      >
        <p className="animate-pulse">Đang tải danh sách vé bếp…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="font-semibold text-destructive" role="alert">
          {errorMessage(error)}
        </p>
        <Button onClick={onRetry} className="mt-4 cursor-pointer">
          Thử lại
        </Button>
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <p role="status" className="py-8 text-center text-sm text-muted-foreground">
        Không có vé bếp trong bộ lọc hiện tại.
      </p>
    )
  }

  const lanes = [
    {
      key: 'waiting',
      label: translate('ops.kitchen.waiting'),
      icon: Clock,
      tickets: tickets.filter((ticket) => ticket.state === 'PENDING'),
      color: 'bg-muted/60',
    },
    {
      key: 'cooking',
      label: translate('ops.kitchen.cooking'),
      icon: Flame,
      tickets: tickets.filter((ticket) => ticket.state === 'IN_PROGRESS'),
      color: 'bg-sky-50/70',
    },
    {
      key: 'ready',
      label: translate('ops.kitchen.ready'),
      icon: CheckCircle2,
      tickets: tickets.filter(
        (ticket) =>
          ticket.state === 'COMPLETED' && ticket.items.some((item) => item.serveStatus === 'READY'),
      ),
      color: 'bg-emerald-50/60',
    },
  ]
  const finished = tickets.filter(
    (ticket) =>
      ticket.state === 'CANCELLED' ||
      (ticket.state === 'COMPLETED' && !ticket.items.some((item) => item.serveStatus === 'READY')),
  )
  const card = (ticket: KitchenTicket) => (
    <KitchenTicketCard
      key={ticket.id}
      ticket={ticket}
      nowMs={nowMs}
      dueSoonWindowSeconds={dueSoonWindowSeconds}
      onAdvanceItemStatus={onAdvanceItemStatus}
      isUpdatingStatus={isUpdatingStatus}
    />
  )
  return (
    <div className="operations-board space-y-5">
      <div className="operations-lanes">
        {lanes.map(({ key, label, icon: Icon, tickets: list, color }) => (
          <section key={key} aria-label={label} className={`min-w-0 space-y-3 p-3 ${color}`}>
            <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Icon size={16} aria-hidden="true" />
                {label}
              </span>
              <span
                className="rounded-md bg-card px-2 py-1 text-xs tabular-nums"
                title={translate('ops.queue.page')}
              >
                {list.length}
              </span>
            </h2>
            {list.length ? (
              list.map(card)
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {translate('ops.kitchen.emptyLane')}
              </p>
            )}
          </section>
        ))}
      </div>
      {finished.length > 0 && (
        <section
          aria-label={translate('ops.kitchen.finished')}
          className="border-t border-border pt-4"
        >
          <h2 className="mb-3 text-sm font-semibold">{translate('ops.kitchen.finished')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{finished.map(card)}</div>
        </section>
      )}
    </div>
  )
}
