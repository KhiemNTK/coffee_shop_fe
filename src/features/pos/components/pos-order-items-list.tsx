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
              !item.isPaid &&
              item.serveStatus !== 'SERVED' &&
              item.serveStatus !== 'CANCELLED'

            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors',
                  item.serveStatus === 'CANCELLED'
                    ? 'border-destructive/20 bg-destructive/5 opacity-70'
                    : 'border-border bg-muted/20',
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold text-foreground',
                        item.serveStatus === 'CANCELLED' &&
                          'line-through text-muted-foreground',
                      )}
                    >
                      {item.quantity}x {item.menuItem.name}
                    </span>
                    <Badge
                      variant={
                        item.serveStatus === 'SERVED'
                          ? 'success'
                          : item.serveStatus === 'CANCELLED'
                            ? 'destructive'
                            : 'warning'
                      }
                      className="text-[10px]"
                    >
                      {item.serveStatus}
                    </Badge>
                  </div>
                  <OrderOptions options={item.selectedOptions} />
                  {item.note && (
                    <small className="block text-xs text-muted-foreground">
                      {item.note}
                    </small>
                  )}
                  <span className="block text-xs font-bold text-primary">
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
