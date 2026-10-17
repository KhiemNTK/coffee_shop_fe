import { useTranslation } from 'react-i18next'
import { Armchair, CheckCircle2, Clock } from 'lucide-react'
import { Badge, Button, cn } from '../../../shared/ui'
import type { KitchenTicket, KitchenTicketItem } from '../kitchen.api'
import { OrderOptions } from '../../../shared/ui/order-options'
import { formatStoreDateTime } from '../../../shared/lib/store-time'

interface KitchenTicketCardProps {
  ticket: KitchenTicket
  nowMs: number
  dueSoonWindowSeconds?: number
  onAdvanceItemStatus: (item: KitchenTicketItem) => void
  isUpdatingStatus?: boolean
}

export function KitchenTicketCard({
  ticket,
  nowMs,
  dueSoonWindowSeconds,
  onAdvanceItemStatus,
  isUpdatingStatus = false,
}: KitchenTicketCardProps) {
  const { t: translate } = useTranslation()
  const tables = ticket.items.map((item) => item.currentTable)
  const table = tables[0]
  const destination = tables.some((value) => value?.id !== table?.id)
    ? translate('ops.kitchen.mixed')
    : table
      ? `Bàn: ${table.name}`
      : translate('ops.kitchen.takeaway')
  const open = ticket.state === 'PENDING' || ticket.state === 'IN_PROGRESS'
  const remainingMs = Date.parse(ticket.dueAt) - nowMs
  const overdue = open && !ticket.isScheduled && (ticket.isOverdue || remainingMs <= 0)
  const warning =
    open &&
    !overdue &&
    !ticket.isScheduled &&
    dueSoonWindowSeconds !== undefined &&
    remainingMs > 0 &&
    remainingMs <= dueSoonWindowSeconds * 1000
  const minutes = Math.max(1, Math.ceil(Math.abs(remainingMs) / 60_000))
  const timeLabel = open
    ? minutes >= 120
      ? formatStoreDateTime(ticket.dueAt)
      : translate(overdue ? 'ops.kitchen.late' : 'ops.kitchen.remaining', { minutes })
    : translate(
        ticket.items.some((item) => item.serveStatus === 'READY')
          ? 'ops.kitchen.ready'
          : 'ops.kitchen.finished',
      )

  return (
    <article
      aria-label={`Vé bếp ${ticket.ticketNumber}`}
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-xs',
        overdue
          ? 'border-l-4 border-l-destructive'
          : warning
            ? 'border-l-4 border-l-amber-500'
            : '',
      )}
    >
      <header className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="break-words text-base" title={ticket.id}>
            #{ticket.ticketNumber}
          </strong>
          <Badge
            variant={
              overdue
                ? 'destructive'
                : warning
                  ? 'warning'
                  : open
                    ? 'secondary'
                    : ticket.state === 'CANCELLED'
                      ? 'outline'
                      : 'success'
            }
            className="max-w-full rounded-md break-words"
            title={formatStoreDateTime(ticket.dueAt)}
          >
            <Clock size={12} aria-hidden="true" />
            {timeLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="break-words font-medium text-foreground">{destination}</span>
          <span>·</span>
          <span className="break-words">{ticket.station.name}</span>
        </div>
      </header>
      <div className="divide-y divide-border px-4">
        {ticket.items.map((item) => (
          <div key={item.id} className="space-y-2 py-3">
            <span className="block break-words text-sm font-semibold">
              {item.quantity}x {item.itemName}
            </span>
            <OrderOptions options={item.selectedOptions} />
            {item.remake && (
              <div className="space-y-1">
                <Badge variant="secondary">Làm lại · Không thu tiền</Badge>
                <p className="break-words text-xs text-muted-foreground">{item.remake.reason}</p>
              </div>
            )}
            {item.currentTable && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Armchair size={13} aria-hidden="true" className="shrink-0" />
                <span>Bàn: {item.currentTable.name}</span>
              </p>
            )}
            {item.note && (
              <p className="break-words border-l-2 border-amber-400 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                {translate('ops.kitchen.note')}: {item.note}
              </p>
            )}
            {item.serveStatus === 'PENDING' && (
              <Button
                type="button"
                onClick={() => onAdvanceItemStatus(item)}
                disabled={isUpdatingStatus}
                className="min-h-11 w-full text-sm"
              >
                Bắt đầu làm
              </Button>
            )}
            {item.serveStatus === 'COOKING' && (
              <Button
                type="button"
                onClick={() => onAdvanceItemStatus(item)}
                disabled={isUpdatingStatus}
                className="min-h-11 w-full text-sm"
              >
                Xong món
              </Button>
            )}
            {item.serveStatus === 'READY' && (
              <Badge variant="success" className="rounded-md">
                {translate('ops.kitchen.readyHandoff')}
              </Badge>
            )}
            {item.serveStatus === 'SERVED' && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-800">
                <CheckCircle2 size={14} aria-hidden="true" />
                {translate('takeaway.served')}
              </p>
            )}
            {item.serveStatus === 'CANCELLED' && (
              <Badge variant="outline">{translate('common.cancelled')}</Badge>
            )}
          </div>
        ))}
      </div>
      <footer className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        {translate('ops.kitchen.queued')}{' '}
        {formatStoreDateTime(ticket.availableAt ?? ticket.createdAt)}
      </footer>
    </article>
  )
}
