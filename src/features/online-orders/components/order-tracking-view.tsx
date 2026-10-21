import { useTranslation } from 'react-i18next'
import { FeedbackResponse } from './feedback-response'
import { useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ReorderLink } from './reorder-link'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  RefreshCw,
} from 'lucide-react'
import { trackOnlineOrder, cancelOnlineOrder } from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { formatLineAmount } from '../../../shared/lib/format'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { OrderOptions } from '../../../shared/ui/order-options'
import { TelegramOrderLink } from './telegram-order-link'
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
  const { t: translate } = useTranslation()
  if (status === 'CANCELLED') {
    return <Badge variant="destructive">{translate('common.cancelled')}</Badge>
  }
  if (status === 'REJECTED') {
    return <Badge variant="destructive">{translate('takeaway.rejected')}</Badge>
  }
  if (status === 'EXPIRED') {
    return <Badge variant="secondary">{translate('takeaway.expired')}</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="warning">{translate('takeaway.pending')}</Badge>
  }
  if (fulfillmentStatus === 'READY') {
    return <Badge variant="success">{translate('takeaway.ready')}</Badge>
  }
  if (fulfillmentStatus === 'COLLECTED') {
    return <Badge variant="success">{translate('takeaway.collected')}</Badge>
  }
  if (fulfillmentStatus === 'NEEDS_REVIEW')
    return <Badge variant="warning">{translate('takeaway.needsReview')}</Badge>
  if (fulfillmentStatus === 'PARTIALLY_READY')
    return <Badge variant="default">{translate('takeaway.partiallyReady')}</Badge>
  return (
    <Badge variant="default" className="bg-sky-600 hover:bg-sky-700 text-white">
      {translate('takeaway.cooking')}
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
  const { t: translate } = useTranslation()
  const steps = [
    { label: translate('takeaway.sent'), done: true },
    {
      label: translate('takeaway.accepted'),
      done: status === 'ACCEPTED' || Boolean(fulfillmentStatus),
    },
    {
      label: translate('takeaway.preparing'),
      done:
        fulfillmentStatus === 'PARTIALLY_READY' ||
        fulfillmentStatus === 'READY' ||
        fulfillmentStatus === 'COLLECTED',
    },
    {
      label: translate('common.ready'),
      done: fulfillmentStatus === 'READY' || fulfillmentStatus === 'COLLECTED',
    },
    {
      label: translate('common.complete'),
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
          className={cn('flex items-center', i < steps.length - 1 ? 'flex-1' : 'flex-none')}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                st.done ? 'bg-brand-800 text-white shadow-xs' : 'bg-stone-200 text-stone-500',
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
  const { t: translate } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)
  const [reviewRequired, setReviewRequired] = useState(false)
  const flight = useRef(false)

  // Query order status every 8 seconds
  const trackQuery = useQuery({
    queryKey: ['online-order', 'track', orderAuth.requestId],
    gcTime: 0,
    staleTime: 0,
    queryFn: ({ signal }) => trackOnlineOrder(orderAuth.requestId, orderAuth.accessToken, signal),
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
    retry: false,
    mutationFn: () => cancelOnlineOrder(orderAuth.requestId, orderAuth.accessToken),
    onSuccess: () => {
      setCancelModalOpen(false)
      setActionError(null)
    },
    onError: (err) => {
      setReviewRequired(true)
      setActionError(errorMessage(err))
    },
    onSettled: () => {
      flight.current = false
      void trackQuery.refetch()
    },
  })

  async function refresh() {
    if (flight.current) return
    const result = await trackQuery.refetch()
    if (result.isSuccess) {
      setReviewRequired(false)
      setActionError(null)
      setCancelModalOpen(false)
    }
  }
  async function copyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopied(false)
      setCopyError(true)
    }
  }

  const order = trackQuery.isSuccess ? trackQuery.data : undefined

  function downloadReceipt() {
    if (!order) return
    const text = [
      'PHIEU NHAN DON - GIU RIENG TU',
      `ID: ${orderAuth.requestId}`,
      `Ma xac thuc: ${orderAuth.accessToken}`,
      `Gio nhan: ${order.pickupAt ? formatStoreDateTime(order.pickupAt) : 'Nhan ngay sau khi quan xac nhan'}`,
      ...(order.accessExpiresAt
        ? [`Het han truy cap: ${formatStoreDateTime(order.accessExpiresAt)}`]
        : []),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `phieu-nhan-${orderAuth.requestId}.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const canCancel = Boolean(
    order &&
    (order.status === 'PENDING' ||
      (order.status === 'ACCEPTED' &&
        !order.isPaid &&
        order.orderItems.length > 0 &&
        order.orderItems.every((item) => item.serveStatus === 'PENDING' && !item.isPaid))),
  )

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
          {translate('takeaway.orderAnother')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={trackQuery.isFetching || cancelMutation.isPending}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', trackQuery.isFetching && 'animate-spin')} />
          {translate('common.update')}
        </Button>
      </div>

      {trackQuery.isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
          <p className="text-sm">{translate('takeaway.loadingOrder')}</p>
        </div>
      )}

      {trackQuery.isError && (
        <div
          role="alert"
          className="p-4 text-destructive flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage(trackQuery.error)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            {translate('common.retry')}
          </Button>
        </div>
      )}

      {order && <ReorderLink requestId={orderAuth.requestId} accessToken={orderAuth.accessToken} />}
      {order?.feedback.map(feedback => <FeedbackResponse key={feedback.id} feedback={feedback} />)}
      {order && (
        <section
          aria-label={translate('takeaway.receipt')}
          className="space-y-3 border-y border-border py-4"
        >
          <h2 className="text-base font-semibold">{translate('takeaway.receipt')}</h2>
          <p className="text-sm">
            {translate('takeaway.idPrefix')}{' '}
            <code className="break-all text-xs">{orderAuth.requestId}</code>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyCode(orderAuth.requestId)}>
              <Copy size={16} /> {translate('takeaway.copyId')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyCode(orderAuth.accessToken)}
            >
              <Copy size={16} /> {translate('takeaway.copyAccess')}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadReceipt}>
              <Download size={16} /> {translate('takeaway.downloadReceipt')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{translate('takeaway.receiptPrivacy')}</p>
          {copied && (
            <p role="status" className="text-sm text-emerald-700">
              {translate('takeaway.copied')}
            </p>
          )}
          {copyError && (
            <p role="alert" className="text-sm text-destructive">
              {translate('takeaway.copyFailed')}
            </p>
          )}
        </section>
      )}
      {order && (
        <>
          {/* Status Hero Card */}
          <Card className="border-brand-200/80 shadow-sm overflow-hidden">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {translate('takeaway.orderStatus')}
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
                    {translate('takeaway.reference')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-sm font-mono font-bold bg-brand-50 text-brand-900 border border-brand-200 px-2 py-0.5 rounded">
                      #{order.requestId.slice(0, 8).toUpperCase()}
                    </code>
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
                    <strong>{translate('takeaway.awaitingShop')}</strong>
                    <p className="mt-1 text-amber-800">
                      {translate('takeaway.expiresPrefix')} {formatStoreDateTime(order.expiresAt)}.
                    </p>
                  </div>
                </div>
              )}

              {order.fulfillmentStatus === 'READY' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="text-sm uppercase tracking-wide">
                      {translate('takeaway.readyHeading')}
                    </strong>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {translate('takeaway.readyInstructions')}
                    </p>
                  </div>
                </div>
              )}

              {order.status === 'CANCELLED' && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive space-y-1">
                  <strong>{translate('takeaway.cancelledSentence')}</strong>
                  {order.cancellationReason && (
                    <p>
                      {translate('common.reasonPrefix')} {order.cancellationReason}
                    </p>
                  )}
                </div>
              )}

              {order.status === 'REJECTED' && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive space-y-1">
                  <strong>{translate('takeaway.rejectedSentence')}</strong>
                  {order.rejectionReason && (
                    <p>
                      {translate('common.reasonPrefix')} {order.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {/* Timing & Pickup details */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border text-xs">
                <div>
                  <span className="text-muted-foreground">
                    {translate('takeaway.pickupTimePrefix')}
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {order.pickupAt
                      ? formatStoreDateTime(order.pickupAt)
                      : translate('takeaway.asapFull')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {translate('takeaway.paymentMethod')}
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {order.isPaid ? translate('common.paid') : translate('takeaway.cashOnPickup')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items breakdown card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-brand-900">
                {translate('takeaway.itemsPrefix')}
                {order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5 border-b border-dashed border-stone-200 text-sm last:border-none"
                >
                  <div className="min-w-0 break-words">
                    <span className="font-semibold text-foreground">
                      {item.quantity}x {item.quotedName}
                    </span>
                    <OrderOptions options={item.quotedOptions} />
                    {item.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                    )}
                  </div>
                  <span className="font-semibold text-brand-800">
                    {formatLineAmount(item.quotedUnitPrice, item.quantity)}
                  </span>
                </div>
              ))}

              <div className="flex items-baseline justify-between pt-2 font-bold">
                <span className="text-sm">{translate('common.total')}</span>
                <span className="text-base text-brand-800">
                  {formatPrice(order.quotedSubtotal)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons (Telegram & Cancel) */}
          <div className="space-y-2.5">
            {actionError && (
              <div role="alert" className="p-3 text-xs text-destructive">
                {actionError}
              </div>
            )}
            {reviewRequired && (
              <Button
                variant="outline"
                disabled={trackQuery.isFetching}
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {translate('takeaway.reviewStatus')}
              </Button>
            )}

            {order.telegram?.enabled &&
              (order.status === 'PENDING' || order.status === 'ACCEPTED') &&
              order.fulfillmentStatus !== 'COLLECTED' && (
                <TelegramOrderLink
                  key={orderAuth.requestId}
                  {...orderAuth}
                  subscribed={order.telegram.subscribed}
                />
              )}

            {canCancel && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCancelModalOpen(true)}
                disabled={cancelMutation.isPending || reviewRequired || trackQuery.isFetching}
                className="w-full font-semibold"
              >
                {translate('takeaway.cancelOrder')}
              </Button>
            )}
          </div>

          {/* Cancel Confirmation Dialog */}
          <Dialog
            open={cancelModalOpen}
            onClose={() => {
              if (!flight.current) setCancelModalOpen(false)
            }}
            maxWidth="sm"
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-destructive">
                {translate('takeaway.cancelHeading')}
              </h3>
              <p className="text-sm text-muted-foreground">{translate('takeaway.cancelInfo')}</p>
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
              {reviewRequired && (
                <Button
                  variant="outline"
                  disabled={trackQuery.isFetching}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  {translate('takeaway.reviewStatus')}
                </Button>
              )}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelMutation.isPending}
                >
                  {translate('common.back')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!canCancel || reviewRequired || trackQuery.isFetching}
                  onClick={() => {
                    if (!flight.current && canCancel && !reviewRequired && !trackQuery.isFetching) {
                      flight.current = true
                      setActionError(null)
                      cancelMutation.mutate()
                    }
                  }}
                  isLoading={cancelMutation.isPending}
                >
                  {translate('takeaway.confirmCancel')}
                </Button>
              </div>
            </div>
          </Dialog>
        </>
      )}
    </div>
  )
}
