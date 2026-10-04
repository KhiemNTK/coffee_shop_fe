import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ReorderLink } from './reorder-link'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import {
  trackOnlineOrder,
  cancelOnlineOrder,
  getTelegramLink,
} from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  cn,
} from '../../../shared/ui'

export function OrderStatusBadge({
  status,
  fulfillmentStatus,
}: {
  status: string
  fulfillmentStatus?: string | null
}) {
  if (status === 'CANCELLED') {
    return <Badge variant="destructive">Đã hủy</Badge>
  }
  if (status === 'REJECTED') {
    return <Badge variant="destructive">Từ chối nhận</Badge>
  }
  if (status === 'EXPIRED') {
    return <Badge variant="secondary">Hết hạn duyệt</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="warning">Chờ duyệt</Badge>
  }
  if (fulfillmentStatus === 'READY') {
    return <Badge variant="success">Đã xong - Chờ bạn đến lấy</Badge>
  }
  if (fulfillmentStatus === 'COLLECTED') {
    return <Badge variant="success">Hoàn tất nhận hàng</Badge>
  }
  return (
    <Badge variant="default" className="bg-sky-600 hover:bg-sky-700 text-white">
      Đã tiếp nhận - Đang pha chế
    </Badge>
  )
}

export function OrderStepTimeline({
  status,
  fulfillmentStatus,
}: {
  status: string
  fulfillmentStatus?: string | null
}) {
  const steps = [
    { label: 'Gửi đơn', done: true },
    {
      label: 'Đã duyệt',
      done: status === 'ACCEPTED' || Boolean(fulfillmentStatus),
    },
    {
      label: 'Pha chế',
      done:
        fulfillmentStatus === 'PARTIALLY_READY' ||
        fulfillmentStatus === 'READY' ||
        fulfillmentStatus === 'COLLECTED',
    },
    {
      label: 'Sẵn sàng',
      done: fulfillmentStatus === 'READY' || fulfillmentStatus === 'COLLECTED',
    },
    {
      label: 'Hoàn tất',
      done: fulfillmentStatus === 'COLLECTED',
    },
  ]

  const isFailed = status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED'

  if (isFailed) return null

  return (
    <div className="flex items-center my-3">
      {steps.map((st, i) => (
        <div
          key={st.label}
          className={cn(
            'flex items-center',
            i < steps.length - 1 ? 'flex-1' : 'flex-none',
          )}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                st.done
                  ? 'bg-brand-800 text-white shadow-xs'
                  : 'bg-stone-200 text-stone-500',
              )}
            >
              {st.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-[11px] whitespace-nowrap',
                st.done ? 'font-semibold text-brand-900' : 'text-stone-500',
              )}
            >
              {st.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-0.5 mx-2 -mt-4 transition-colors',
                steps[i + 1]?.done ? 'bg-brand-800' : 'bg-stone-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function OrderTrackingView({
  orderAuth,
  onNewOrder,
}: {
  orderAuth: { requestId: string; accessToken: string }
  onNewOrder: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Query order status every 8 seconds
  const trackQuery = useQuery({
    queryKey: ['online-order', 'track', orderAuth.requestId],
    queryFn: ({ signal }) =>
      trackOnlineOrder(orderAuth.requestId, orderAuth.accessToken, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      const fulfillment = query.state.data?.fulfillmentStatus
      if (
        fulfillment === 'COLLECTED' ||
        status === 'CANCELLED' ||
        status === 'REJECTED' ||
        status === 'EXPIRED'
      ) {
        return false
      }
      return 8_000
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelOnlineOrder(orderAuth.requestId, orderAuth.accessToken),
    onSuccess: () => {
      setCancelModalOpen(false)
      void trackQuery.refetch()
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const telegramMutation = useMutation({
    mutationFn: () =>
      getTelegramLink(orderAuth.requestId, orderAuth.accessToken),
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener,noreferrer')
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  function copyCode(text: string) {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const order = trackQuery.data

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top Banner & Control */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNewOrder}
          className="text-stone-600 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Đặt món khác
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void trackQuery.refetch()}
          disabled={trackQuery.isFetching}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', trackQuery.isFetching && 'animate-spin')} />
          Cập nhật
        </Button>
      </div>

      {trackQuery.isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
          <p className="text-sm">Đang tải thông tin đơn hàng…</p>
        </div>
      )}

      {trackQuery.isError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage(trackQuery.error)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void trackQuery.refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {order && <ReorderLink requestId={orderAuth.requestId} accessToken={orderAuth.accessToken} />}
      {order && (
        <>
          {/* Status Hero Card */}
          <Card className="border-brand-200/80 shadow-sm overflow-hidden">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Trạng thái đơn hàng
                  </span>
                  <div className="mt-1.5">
                    <OrderStatusBadge
                      status={order.status}
                      fulfillmentStatus={order.fulfillmentStatus}
                    />
                  </div>
                </div>

                {/* Pickup Code Display */}
                <div className="text-right">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Mã nhận món
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-sm font-mono font-bold bg-brand-50 text-brand-900 border border-brand-200 px-2 py-0.5 rounded">
                      #{order.requestId.slice(0, 8).toUpperCase()}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyCode(orderAuth.accessToken)}
                      className="h-7 w-7 p-0"
                      title="Sao chép Token xác thực"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step Timeline */}
              <OrderStepTimeline
                status={order.status}
                fulfillmentStatus={order.fulfillmentStatus}
              />

              {/* Explanatory notes per state */}
              {order.status === 'PENDING' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong>Quán đang duyệt đơn của bạn.</strong>
                    <p className="mt-1 text-amber-800">
                      Nhân viên sẽ sớm tiếp nhận và chuyển quầy pha chế. Đơn hàng sẽ tự động hủy
                      nếu không kịp xác nhận trước{' '}
                      {new Date(order.expiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      .
                    </p>
                  </div>
                </div>
              )}

              {order.fulfillmentStatus === 'READY' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="text-sm uppercase tracking-wide">
                      MÓN CỦA BẠN ĐÃ SẴN SÀNG!
                    </strong>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Mời bạn ghé quầy thu ngân, đọc mã{' '}
                      <strong>#{order.requestId.slice(0, 8).toUpperCase()}</strong> để nhận món và
                      thanh toán tiền mặt.
                    </p>
                  </div>
                </div>
              )}

              {order.status === 'CANCELLED' && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive space-y-1">
                  <strong>Đơn hàng đã bị hủy.</strong>
                  {order.cancellationReason && (
                    <p>Lý do: {order.cancellationReason}</p>
                  )}
                </div>
              )}

              {order.status === 'REJECTED' && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive space-y-1">
                  <strong>Quán không thể tiếp nhận đơn hàng này.</strong>
                  {order.rejectionReason && (
                    <p>Lý do: {order.rejectionReason}</p>
                  )}
                </div>
              )}

              {/* Timing & Pickup details */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border text-xs">
                <div>
                  <span className="text-muted-foreground">Thời gian nhận:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {order.pickupAt
                      ? new Date(order.pickupAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : 'Lấy sớm nhất có thể'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Hình thức thanh toán:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {order.isPaid ? '✓ Đã thanh toán' : 'Tiền mặt khi nhận'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items breakdown card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-brand-900">
                Chi tiết món đã đặt ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-baseline justify-between pb-2.5 border-b border-dashed border-stone-200 text-sm last:border-none"
                >
                  <div>
                    <span className="font-semibold text-foreground">
                      {item.quantity}x {item.quotedName}
                    </span>
                    {item.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.note}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-brand-800">
                    {formatPrice(String(Number(item.quotedUnitPrice) * item.quantity))}
                  </span>
                </div>
              ))}

              <div className="flex items-baseline justify-between pt-2 font-bold">
                <span className="text-sm">Tổng tiền:</span>
                <span className="text-base text-brand-800">
                  {formatPrice(order.quotedSubtotal)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons (Telegram & Cancel) */}
          <div className="space-y-2.5">
            {actionError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                {actionError}
              </div>
            )}

            {order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => telegramMutation.mutate()}
                disabled={telegramMutation.isPending}
                className="w-full text-[#0088cc] border-[#0088cc]/30 hover:bg-[#0088cc]/10 hover:text-[#0088cc] font-semibold gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Nhận cập nhật tiến độ qua Telegram Bot
              </Button>
            )}

            {(order.status === 'PENDING' || order.status === 'ACCEPTED') &&
              order.fulfillmentStatus !== 'READY' &&
              order.fulfillmentStatus !== 'COLLECTED' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setCancelModalOpen(true)}
                  className="w-full font-semibold"
                >
                  Hủy đơn hàng này
                </Button>
              )}
          </div>

          {/* Cancel Confirmation Dialog */}
          <Dialog
            open={cancelModalOpen}
            onClose={() => setCancelModalOpen(false)}
            maxWidth="sm"
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-destructive">
                Xác nhận hủy đơn hàng?
              </h3>
              <p className="text-sm text-muted-foreground">
                Bạn có chắc chắn muốn hủy đơn hàng này không? Quán sẽ ngừng chuẩn bị món.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(false)}
                >
                  Quay lại
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  isLoading={cancelMutation.isPending}
                >
                  Xác nhận hủy
                </Button>
              </div>
            </div>
          </Dialog>
        </>
      )}
    </div>
  )
}
