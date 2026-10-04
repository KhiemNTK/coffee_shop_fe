import { AlertCircle, Ban, DollarSign, Package, Phone, UserX } from 'lucide-react'
import { type FulfillmentOrder } from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
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
  totalItems: number
  isLoading: boolean
  isError: boolean
  error: unknown
  onRefetch: () => void
  overdueOnly: boolean
  setOverdueOnly: (val: boolean) => void
  canCollect: boolean
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
  onCollect,
  onNoShow,
  isNoShowPending,
  onCancel,
}: StaffFulfillmentOrdersTabProps) {
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-lg border border-[#dce5df] text-xs font-medium">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded border-[#bccdc3] text-[#174f3f] focus:ring-[#174f3f]"
          />
          <span>Chỉ hiển thị đơn trễ hẹn</span>
        </label>

        <span className="text-[#68776f]">
          Tổng: {totalItems} đơn đang xử lý
        </span>
      </div>

      {isLoading && (
        <div className="py-12 text-center text-sm text-[#68776f]">
          Đang tải danh sách đơn chế biến & bàn giao…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 p-4 rounded-lg">
          <AlertCircle size={16} />
          <span>{errorMessage(error)}</span>
          <Button
            variant="link"
            onClick={onRefetch}
            className="text-red-700 font-semibold"
          >
            Thử lại
          </Button>
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <Card className="border-dashed p-12 text-center text-[#68776f]">
          <Package size={36} className="mx-auto mb-3 text-[#9ba8a0]" />
          <p className="text-base font-semibold text-[#1a2723]">
            Không có đơn hàng nào đang chờ bàn giao
          </p>
          <p className="text-sm mt-1 text-[#68776f]">
            Sau khi duyệt đơn ở tab &quot;Chờ duyệt&quot;, đơn hàng sẽ hiển thị tại đây.
          </p>
        </Card>
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
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>{order.pickupName}</CardTitle>
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
                        <Badge variant="success">✓ Sẵn sàng lấy</Badge>
                      ) : (
                        <Badge variant="secondary">Đang chế biến</Badge>
                      )}

                      {order.isOverdue && (
                        <Badge variant="destructive">Trễ hẹn</Badge>
                      )}
                    </div>
                  </div>

                  {/* Pickup Timing */}
                  <div className="mt-3 rounded-md bg-[#f8faf9] px-3 py-1.5 text-xs text-[#202d29]">
                    <span className="font-semibold">Giờ hẹn: </span>
                    {order.pickupAt
                      ? new Date(order.pickupAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : '⚡ Sớm nhất'}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 flex-1">
                  <div className="border-t border-[#f0f4f1] pt-3 space-y-2 text-xs">
                    {order.orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center"
                      >
                        <span>
                          <strong>{item.quantity}x</strong> {item.menuItem.name}
                        </span>
                        <Badge
                          variant={
                            item.serveStatus === 'READY'
                              ? 'success'
                              : item.serveStatus === 'COOKING'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {item.serveStatus === 'READY'
                            ? 'Đã xong'
                            : item.serveStatus === 'COOKING'
                              ? 'Đang làm'
                              : 'Chờ làm'}
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

                  <div className="flex w-full justify-end gap-3 text-xs">
                    {order.isNoShowEligible && (
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

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancel(order)}
                      className="h-auto p-0 text-red-600 hover:text-red-700"
                    >
                      <Ban size={13} />
                      Hủy đơn
                    </Button>
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
