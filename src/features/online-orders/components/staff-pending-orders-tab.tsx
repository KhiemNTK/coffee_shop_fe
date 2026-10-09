import { Check, Clock, Package, Phone, User } from 'lucide-react'
import { type PendingOrder } from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { formatLineAmount } from '../../../shared/lib/format'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { OrderOptions } from '../../../shared/ui/order-options'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../shared/ui'

interface StaffPendingOrdersTabProps {
  orders: PendingOrder[]
  isLoading: boolean
  isError: boolean
  error: unknown
  onRefetch: () => void
  nowMs: number
  canReview: boolean
  isAcceptPending: boolean
  isBlocked: boolean
  onAccept: (id: string) => void
  onReject: (order: PendingOrder) => void
}

export function StaffPendingOrdersTab({
  orders,
  isLoading,
  isError,
  error,
  onRefetch,
  nowMs,
  canReview,
  isAcceptPending,
  isBlocked,
  onAccept,
  onReject,
}: StaffPendingOrdersTabProps) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-[#68776f]">
        Đang tải danh sách đơn chờ duyệt…
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive p-4">
        <span>{errorMessage(error)}</span>
        <Button variant="link" onClick={onRefetch} className="text-red-700 font-semibold">
          Thử lại
        </Button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Package size={36} className="mx-auto mb-3 text-[#9ba8a0]" />
        <p className="text-base font-semibold text-[#1a2723]">
          Không có đơn hàng nào đang chờ duyệt
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {orders.map((order) => {
        const expiresAt = new Date(order.expiresAt)
        const isUrgent = expiresAt.getTime() - nowMs < 5 * 60_000
        return (
          <Card
            key={order.id}
            className="flex flex-col justify-between shadow-xs hover:shadow-sm transition-shadow"
          >
            <CardHeader className="pb-3">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <User size={15} className="text-[#174f3f]" />
                    <CardTitle className="break-words">{order.pickupName}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#68776f] mt-1">
                    <Phone size={13} />
                    <span>{order.phoneNumber}</span>
                  </div>
                </div>

                <Badge variant={isUrgent ? 'destructive' : 'warning'}>
                  <Clock size={11} />
                  Hạn: {formatStoreDateTime(order.expiresAt)}
                </Badge>
              </div>

              {/* Pickup Time info */}
              <div className="mt-3 rounded-md bg-[#f2f6f3] px-3 py-1.5 text-xs text-[#202d29]">
                <span className="font-semibold">Thời gian nhận: </span>
                {order.pickupAt ? formatStoreDateTime(order.pickupAt) : 'Sớm nhất'}
              </div>
            </CardHeader>

            <CardContent className="space-y-3 flex-1">
              <div className="border-t border-[#f0f4f1] pt-3 space-y-2 text-xs">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex flex-wrap justify-between items-baseline gap-2">
                    <div className="min-w-0 break-words">
                      <span>
                        <strong>{it.quantity}x</strong> {it.quotedName}
                      </span>
                      <OrderOptions options={it.quotedOptions} />
                      {it.note && <p className="text-[11px] text-[#68776f] mt-0.5">({it.note})</p>}
                    </div>
                    <span className="font-semibold text-[#174f3f]">
                      {formatLineAmount(it.quotedUnitPrice, it.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-baseline border-t border-dashed border-[#dce5df] pt-2">
                <span className="text-xs text-[#68776f]">Tổng tiền:</span>
                <strong className="text-base text-[#174f3f]">
                  {formatPrice(order.quotedSubtotal)}
                </strong>
              </div>
            </CardContent>

            <CardFooter className="grid grid-cols-2 gap-2 pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(order)}
                disabled={!canReview || isBlocked}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Từ chối
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => onAccept(order.id)}
                disabled={!canReview || isBlocked}
                isLoading={isAcceptPending}
              >
                <Check size={14} />
                Duyệt đơn
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
