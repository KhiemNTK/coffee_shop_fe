import { CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { cn } from '../../../shared/ui/utils'
import type { KitchenTicket, KitchenTicketItem } from '../kitchen.api'
import { OrderOptions } from '../../../shared/ui/order-options'
import { formatStoreDateTime } from '../../../shared/lib/store-time'

interface KitchenTicketCardProps {
  ticket: KitchenTicket
  nowMs: number
  onAdvanceItemStatus: (item: KitchenTicketItem) => void
  isUpdatingStatus?: boolean
}

export function KitchenTicketCard({
  ticket,
  nowMs,
  onAdvanceItemStatus,
  isUpdatingStatus = false,
}: KitchenTicketCardProps) {
  const isCompletedTicket = ticket.state === 'COMPLETED'
  const isOverdue = ticket.isOverdue
  const currentTables = ticket.items.map((item) => item.currentTable)
  const destination = currentTables[0]
  const destinationLabel = currentTables.some((table) => table?.id !== destination?.id)
    ? 'Nhiều phiên'
    : destination
      ? `Bàn: ${destination.name}`
      : 'Mang đi'

  function formatTimeDiff(dueAtStr: string) {
    const diffMs = new Date(dueAtStr).getTime() - nowMs
    const diffMins = Math.round(diffMs / 60_000)
    if (diffMins < 0) {
      return `Quá hạn ${Math.abs(diffMins)} ph`
    }
    return `Còn ${diffMins} ph`
  }

  return (
    <article
      aria-label={`Vé bếp ${ticket.ticketNumber}`}
      className={cn(
        'flex flex-col justify-between overflow-hidden rounded-lg border-2 bg-card transition-all',
        isOverdue
          ? 'border-red-500 shadow-md shadow-red-500/10'
          : isCompletedTicket
            ? 'border-emerald-300'
            : ticket.state === 'IN_PROGRESS'
              ? 'border-sky-400'
              : 'border-border',
      )}
    >
      {/* Header vé */}
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3',
          isOverdue ? 'bg-red-50/50 border-red-100' : 'bg-muted/40 border-border',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="wrap-break-word text-lg font-bold text-foreground">
              #{ticket.ticketNumber}
            </strong>
            <Badge
              variant={destination ? 'secondary' : 'default'}
              className="whitespace-normal wrap-break-word text-[11px] font-bold"
            >
              {destinationLabel}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">Quầy: {ticket.station.name}</span>
        </div>

        <div className="text-right">
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-bold justify-end',
              isOverdue ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {formatTimeDiff(ticket.dueAt)}
          </div>
          <small className="text-[11px] text-muted-foreground">
            Gọi: {formatStoreDateTime(ticket.createdAt)}
          </small>
        </div>
      </div>

      {/* Danh sách món trong vé */}
      <div className="space-y-2.5 p-4">
        {ticket.items.map((item) => {
          const isPending = item.serveStatus === 'PENDING'
          const isCooking = item.serveStatus === 'COOKING'
          const isReady = item.serveStatus === 'READY'
          const isServed = item.serveStatus === 'SERVED'
          const currentTable = item.currentTable
          const advance = () => onAdvanceItemStatus(item)

          return (
            <div
              key={item.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 border-b py-2.5 transition-colors',
                isReady
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : isCooking
                    ? 'border-sky-200 bg-sky-50/50'
                    : 'border-border bg-muted/20',
              )}
            >
              <div className="min-w-0 flex-1 wrap-break-word">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">
                    {item.quantity}x {item.itemName}
                  </span>
                </div>

                <OrderOptions options={item.selectedOptions} />
                {currentTable && <p className="text-xs font-semibold">Bàn: {currentTable.name}</p>}
                {item.note && (
                  <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Ghi chú: {item.note}
                  </p>
                )}
              </div>

              {/* Nút hành động trạng thái món (Step workflow) */}
              <div className="shrink-0">
                {isPending && (
                  <Button
                    type="button"
                    onClick={advance}
                    disabled={isUpdatingStatus}
                    className="min-h-[44px] px-4 text-sm font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs active:scale-95 transition-transform cursor-pointer"
                  >
                    Bắt đầu làm
                  </Button>
                )}

                {isCooking && (
                  <Button
                    type="button"
                    variant="success"
                    onClick={advance}
                    disabled={isUpdatingStatus}
                    className="min-h-[44px] px-4 text-sm font-bold shadow-xs active:scale-95 transition-transform cursor-pointer"
                  >
                    Xong món
                  </Button>
                )}

                {isReady && (
                  <span className="text-xs font-semibold text-emerald-700">Chờ quầy giao món</span>
                )}

                {isServed && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Đã lên món
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
