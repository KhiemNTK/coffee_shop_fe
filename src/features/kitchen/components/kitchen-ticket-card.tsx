import { CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { cn } from '../../../shared/ui/utils'
import type { KitchenTicket, KitchenTicketItem } from '../kitchen.api'

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

  function formatTimeDiff(dueAtStr: string) {
    const diffMs = new Date(dueAtStr).getTime() - nowMs
    const diffMins = Math.round(diffMs / 60_000)
    if (diffMins < 0) {
      return `Quá hạn ${Math.abs(diffMins)} ph`
    }
    return `Còn ${diffMins} ph`
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-between overflow-hidden rounded-xl border-2 bg-card transition-all',
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
          'flex items-center justify-between border-b px-4 py-3',
          isOverdue ? 'bg-red-50/50 border-red-100' : 'bg-muted/40 border-border',
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <strong className="text-lg font-bold text-foreground">
              #{ticket.ticketNumber}
            </strong>
            <Badge variant={ticket.table ? 'secondary' : 'default'} className="text-[11px] font-bold">
              {ticket.table ? `Bàn: ${ticket.table.name}` : 'Mang đi'}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Quầy: {ticket.station.name}
          </span>
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
            Gọi: {new Date(ticket.createdAt).toLocaleTimeString('vi-VN')}
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

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors',
                isReady
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : isCooking
                    ? 'border-sky-200 bg-sky-50/50'
                    : 'border-border bg-muted/20',
              )}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">
                    {item.quantity}x {item.itemName}
                  </span>
                </div>

                {item.note && (
                  <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Ghi chú: {item.note}
                  </p>
                )}
              </div>

              {/* Nút hành động trạng thái món (Step workflow) */}
              <div>
                {isPending && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAdvanceItemStatus(item)}
                    disabled={isUpdatingStatus}
                    className="h-8 bg-sky-600 hover:bg-sky-700 text-xs font-semibold cursor-pointer"
                  >
                    Bắt đầu làm
                  </Button>
                )}

                {isCooking && (
                  <Button
                    type="button"
                    size="sm"
                    variant="success"
                    onClick={() => onAdvanceItemStatus(item)}
                    disabled={isUpdatingStatus}
                    className="h-8 text-xs font-semibold cursor-pointer"
                  >
                    Xong món
                  </Button>
                )}

                {isReady && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAdvanceItemStatus(item)}
                    disabled={isUpdatingStatus}
                    title="Bấm để xác nhận đã lên bàn / giao khách"
                    className="h-8 border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Lên bàn
                  </Button>
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
    </div>
  )
}
