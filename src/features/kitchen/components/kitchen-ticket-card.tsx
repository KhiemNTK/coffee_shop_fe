import { Armchair, CheckCircle2, Clock } from 'lucide-react'
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
  const currentTables = ticket.items.map((item) =>
    item.currentTable === undefined ? ticket.table : item.currentTable,
  )
  const destination = currentTables[0]
  const destinationLabel = currentTables.some((table) => table?.id !== destination?.id)
    ? 'Nhiều phiên'
    : destination
      ? `Bàn: ${destination.name}`
      : 'Mang đi'

  const elapsedMs = Math.max(0, nowMs - new Date(ticket.createdAt).getTime())
  const elapsedMins = Math.floor(elapsedMs / 60_000)
  const isUrgent = isOverdue || elapsedMins >= 10
  const isWarning = !isUrgent && elapsedMins >= 5

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
        'flex flex-col justify-between overflow-hidden rounded-lg border-2 bg-card transition-colors shadow-xs',
        isUrgent
          ? 'border-rose-500 shadow-md shadow-rose-500/15'
          : isWarning
            ? 'border-amber-400 shadow-xs shadow-amber-500/10'
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
          'flex items-start justify-between gap-2.5 border-b p-3.5 sm:p-4',
          isUrgent
            ? 'bg-rose-50/80 border-rose-200'
            : isWarning
              ? 'bg-amber-50/80 border-amber-200'
              : 'bg-muted/40 border-border',
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <strong className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight shrink-0">
              #{ticket.ticketNumber}
            </strong>
            <Badge
              variant={destination ? 'secondary' : 'default'}
              className="font-bold text-[11px] truncate max-w-[140px] sm:max-w-[180px]"
              title={destinationLabel}
            >
              {destinationLabel}
            </Badge>
            {isUrgent && (
              <Badge variant="destructive" className="text-[10px] font-bold uppercase animate-pulse shrink-0">
                Khẩn cấp
              </Badge>
            )}
            {isWarning && (
              <Badge variant="warning" className="text-[10px] font-bold uppercase shrink-0">
                Chờ lâu
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate block font-medium">
            Quầy: <strong className="text-foreground">{ticket.station.name}</strong>
          </span>
        </div>

        <div className="text-right shrink-0 space-y-0.5">
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
              isUrgent
                ? 'bg-rose-100 text-rose-700'
                : isWarning
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            <Clock className="h-3 w-3" />
            {formatTimeDiff(ticket.dueAt)}
          </div>
          <small
            className="block text-[11px] text-muted-foreground tabular-nums truncate max-w-[150px]"
            title={`Gọi lúc: ${formatStoreDateTime(ticket.createdAt)}`}
          >
            Chờ {elapsedMins} ph · {formatStoreDateTime(ticket.createdAt).split(' ')[1] || formatStoreDateTime(ticket.createdAt)}
          </small>
        </div>
      </div>

      {/* Danh sách món trong vé */}
      <div className="space-y-2.5 p-3.5 sm:p-4">
        {ticket.items.map((item) => {
          const isPending = item.serveStatus === 'PENDING'
          const isCooking = item.serveStatus === 'COOKING'
          const isReady = item.serveStatus === 'READY'
          const isServed = item.serveStatus === 'SERVED'
          const currentTable =
            item.currentTable === undefined ? ticket.table : item.currentTable
          const advance = () => onAdvanceItemStatus({ ...item, currentTable })

          return (
            <div
              key={item.id}
              className={cn(
                'flex flex-wrap items-start justify-between gap-3 border-b border-border py-3 transition-colors min-w-0',
                isReady
                  ? 'border-emerald-300 bg-emerald-50/70'
                  : isCooking
                    ? 'border-sky-300 bg-sky-50/70'
                    : 'border-border/80 bg-stone-50/70',
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">
                    {item.quantity}x {item.itemName}
                  </span>
                </div>

                <OrderOptions options={item.selectedOptions} />
                {item.remake && <div className="space-y-1"><Badge variant="secondary" className="border-sky-200 bg-sky-50 text-sky-800">Làm lại · Không thu tiền</Badge><p className="break-words text-xs text-muted-foreground">{item.remake.reason}</p></div>}

                {currentTable && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-foreground/80 pt-0.5">
                    <Armchair className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="break-words">Bàn: {currentTable.name}</span>
                  </div>
                )}

                {item.note && (
                  <div className="mt-1 inline-block rounded-md border border-amber-200 bg-amber-100/90 px-2 py-0.5 text-xs font-semibold text-amber-900 break-words max-w-full">
                    Ghi chú: {item.note}
                  </div>
                )}
              </div>

              {/* Nút hành động trạng thái món (Step workflow) */}
              <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                {isPending && (
                  <Button
                    type="button"
                    onClick={advance}
                    disabled={isUpdatingStatus}
                    className="h-9 px-3.5 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs active:scale-95 transition-transform cursor-pointer shrink-0"
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
                    className="h-9 px-3.5 text-xs font-bold shadow-xs active:scale-95 transition-transform cursor-pointer shrink-0"
                  >
                    Xong món
                  </Button>
                )}

                {isReady && (
                  <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 shrink-0">
                    Chờ quầy giao món
                  </span>
                )}

                {isServed && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Đã lên món
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
