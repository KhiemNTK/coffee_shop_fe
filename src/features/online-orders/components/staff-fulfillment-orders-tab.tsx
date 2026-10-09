import { AlertCircle, Ban, DollarSign, Package, Phone, UserX } from 'lucide-react'
import { type FulfillmentOrder } from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
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

interface StaffFulfillmentOrdersTabProps {
  orders: FulfillmentOrder[]
  totalItems?: number
  isLoading: boolean
  isError: boolean
  error: unknown
  onRefetch: () => void
  overdueOnly: boolean
  setOverdueOnly: (val: boolean) => void
  canCollect: boolean
  canReview: boolean
  onCollect: (order: FulfillmentOrder) => void
  onNoShow: (id: string) => void
  isNoShowPending: boolean
  onCancel: (order: FulfillmentOrder) => void
}

export function StaffFulfillmentOrdersTab({
  orders,
  totalItems,
  isLoading,
  isError,
  error,
  onRefetch,
  overdueOnly,
  setOverdueOnly,
  canCollect,
  canReview,
  onCollect,
  onNoShow,
  isNoShowPending,
  onCancel,
}: StaffFulfillmentOrdersTabProps) {
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-3 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded border-[#bccdc3] text-[#174f3f] focus:ring-[#174f3f]"
          />
          <span>Chỉ hiển thị đơn trễ hẹn</span>
        </label>

        {!isError && !isLoading && totalItems !== undefined && (
          <span className="text-muted-foreground">Tổng: {totalItems} đơn đang xử lý</span>
        )}
      </div>

      {isLoading && (
        <div className="py-12 text-center text-sm text-[#68776f]">
          Đang tải danh sách đơn chế biến & bàn giao…
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-destructive p-4"
        >
          <AlertCircle size={16} />
          <span>{errorMessage(error)}</span>
          <Button variant="link" onClick={onRefetch} className="text-red-700 font-semibold">
            Thử lại
          </Button>
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <Package size={36} className="mx-auto mb-3 text-[#9ba8a0]" />
          <p className="text-base font-semibold text-[#1a2723]">
            Không có đơn hàng nào đang chờ bàn giao
          </p>
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order) => {
            const isReady = order.fulfillmentStatus === 'READY'
            return (
              <Card
                key={order.id}
                className={`flex flex-col justify-between transition-all ${
                  isReady ? 'ring-2 ring-emerald-600 bg-emerald-50/20' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="break-words">{order.pickupName}</CardTitle>
                        <code className="text-xs bg-[#f2f6f3] px-1.5 py-0.5 rounded text-[#174f3f] font-bold">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#68776f] mt-1">
                        <Phone size={13} />
                        <span>{order.phoneNumber}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isReady ? (
                        <Badge variant="success">Sẵn sàng lấy</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {order.fulfillmentStatus === 'NEEDS_REVIEW'
                            ? 'Cần đối chiếu'
                            : order.fulfillmentStatus === 'PARTIALLY_READY'
                              ? 'Một phần đã xong'
                              : 'Đang chế biến'}
                        </Badge>
                      )}

                      {order.isOverdue && <Badge variant="destructive">Trễ hẹn</Badge>}
                    </div>
                  </div>

                  {/* Pickup Timing */}
                  <div className="mt-3 rounded-md bg-[#f8faf9] px-3 py-1.5 text-xs text-[#202d29]">
                    <span className="font-semibold">Giờ hẹn: </span>
                    {order.pickupAt ? formatStoreDateTime(order.pickupAt) : 'Sớm nhất'}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 flex-1">
                  <div className="border-t border-[#f0f4f1] pt-3 space-y-2 text-xs">
                    {order.orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap justify-between items-center gap-2"
                      >
                        <div className="min-w-0 break-words">
                          <strong>{item.quantity}x</strong> {item.menuItem.name}
                          <OrderOptions options={item.selectedOptions} />
                        </div>
                        <Badge
                          variant={
                            item.serveStatus === 'READY'
                              ? 'success'
                              : item.serveStatus === 'COOKING'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {
                            {
                              PENDING: 'Chờ làm',
                              COOKING: 'Đang làm',
                              READY: 'Đã xong',
                              SERVED: 'Đã giao',
                              CANCELLED: 'Đã hủy',
                            }[item.serveStatus]
                          }
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-baseline border-t border-dashed border-[#dce5df] pt-2">
                    <span className="text-xs text-[#68776f]">Thu tiền mặt:</span>
                    <strong className="text-base text-[#174f3f]">
                      {formatPrice(order.quotedSubtotal)}
                    </strong>
                  </div>
                </CardContent>

                <CardFooter className="flex-col gap-2 pt-0">
                  <Button
                    variant={isReady ? 'success' : 'secondary'}
                    size="default"
                    onClick={() => onCollect(order)}
                    disabled={!canCollect || !isReady}
                    className="w-full"
                  >
                    <DollarSign size={16} />
                    Khách nhận & Thu tiền
                  </Button>

                  <div className="flex w-full flex-wrap justify-end gap-3 text-xs">
                    {canReview && order.isNoShowEligible && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNoShow(order.id)}
                        disabled={isNoShowPending}
                        className="h-auto p-0 text-amber-700 hover:text-amber-800"
                      >
                        <UserX size={13} />
                        Báo vắng mặt (No-show)
                      </Button>
                    )}

                    {canReview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancel(order)}
                        disabled={isNoShowPending}
                        className="h-auto p-0 text-red-600 hover:text-red-700"
                      >
                        <Ban size={13} />
                        Hủy đơn
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
