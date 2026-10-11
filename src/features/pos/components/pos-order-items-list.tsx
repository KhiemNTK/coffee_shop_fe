import { Trash2 } from 'lucide-react'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { cn } from '../../../shared/ui/utils'
import { formatLineAmount } from '../../../shared/lib/format'
import type { SessionItem } from '../pos.api'
import { OrderOptions } from '../../../shared/ui/order-options'

interface PosOrderItemsListProps {
  orderItems: SessionItem[]
  onCancelItem: (itemId: string, reason: string) => void
  isCancelling?: boolean
  canCancel: boolean
}

const SERVE_STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
  }
> = {
  PENDING: { label: 'Chờ làm', variant: 'warning' },
  COOKING: { label: 'Đang làm', variant: 'secondary' },
  READY: { label: 'Đã xong', variant: 'success' },
  SERVED: { label: 'Đã lên món', variant: 'outline' },
  CANCELLED: { label: 'Đã hủy', variant: 'destructive' },
}

export function PosOrderItemsList({
  orderItems,
  onCancelItem,
  isCancelling = false,
  canCancel,
}: PosOrderItemsListProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Món đã order ({orderItems.length})
      </span>

      {orderItems.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground italic">
          Chưa có món nào được gửi.
        </p>
      ) : (
        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {orderItems.map((item) => {
            const isCancelable =
              canCancel &&
              !item.invoiceId &&
              (!item.isPaid || Boolean(item.replacementRemake)) &&
              item.serveStatus !== 'SERVED' &&
              item.serveStatus !== 'CANCELLED'

            const statusConfig = SERVE_STATUS_CONFIG[item.serveStatus] ?? {
              label: item.serveStatus,
              variant: 'warning' as const,
            }

            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-all min-w-0',
                  item.serveStatus === 'CANCELLED'
                    ? 'border-destructive/20 bg-destructive/5 opacity-70'
                    : 'border-border bg-card shadow-xs',
                )}
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <span
                      className={cn(
                        'text-sm font-semibold text-foreground min-w-0 flex-1 break-words line-clamp-2 leading-snug',
                        item.serveStatus === 'CANCELLED' &&
                          'line-through text-muted-foreground',
                      )}
                      title={`${item.quantity}x ${item.menuItem.name}`}
                    >
                      {item.quantity}x {item.menuItem.name}
                    </span>
                    <Badge
                      variant={statusConfig.variant}
                      className="text-[10px] font-semibold shrink-0"
                      data-status={item.serveStatus}
                    >
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <OrderOptions options={item.selectedOptions} />
                  {item.replacementRemake && <Badge variant="secondary">Làm lại · Không thu tiền</Badge>}
                  {item.originalRemake && <p className="text-xs text-sky-800">Đã yêu cầu làm lại</p>}
                  {item.note && (
                    <small className="block text-xs text-muted-foreground break-words line-clamp-2">
                      {item.note}
                    </small>
                  )}
                  <span className="block text-xs font-bold text-primary tabular-nums">
                    {formatLineAmount(item.priceAtTime, item.quantity)}
                  </span>
                </div>

                {isCancelable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Hủy món"
                    disabled={isCancelling}
                    onClick={() => {
                      const reason = window.prompt('Nhập lý do hủy món:')
                      if (reason === null || !reason.trim()) return
                      onCancelItem(item.id, reason)
                    }}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
