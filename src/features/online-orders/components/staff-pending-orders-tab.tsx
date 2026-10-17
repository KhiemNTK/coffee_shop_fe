import { useTranslation } from 'react-i18next'
import { Check, Clock, Package, Phone } from 'lucide-react'
import type { PendingOrder } from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { formatLineAmount } from '../../../shared/lib/format'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { OrderOptions } from '../../../shared/ui/order-options'
import { Badge, Button } from '../../../shared/ui'
import { StaffOrderQueue } from './staff-order-queue'

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
  const { t: translate } = useTranslation()
  if (isLoading)
    return (
      <p role="status" className="py-12 text-center text-sm text-muted-foreground">
        {translate('takeaway.loadingPending')}
      </p>
    )
  if (isError)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 py-4 text-sm text-destructive">
        {errorMessage(error)}
        <Button variant="outline" onClick={onRefetch}>
          {translate('common.retry')}
        </Button>
      </div>
    )
  if (!orders.length)
    return (
      <div className="py-12 text-center">
        <Package size={32} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
        <p className="font-semibold">{translate('takeaway.noPending')}</p>
      </div>
    )
  const expired = (order: PendingOrder) => Date.parse(order.expiresAt) <= nowMs
  return (
    <StaffOrderQueue
      orders={orders}
      summary={(order) =>
        order.items.map((item) => `${item.quantity}x ${item.quotedName}`).join(' · ')
      }
      status={(order) => (
        <Badge variant={expired(order) ? 'destructive' : 'warning'} className="rounded-md">
          {translate(expired(order) ? 'ops.queue.expired' : 'takeaway.pending')}
        </Badge>
      )}
    >
      {(order) => (
        <div className="space-y-5">
          <header className="border-b border-border pb-4">
            <p className="text-xs text-muted-foreground">{translate('ops.queue.detail')}</p>
            <h2 className="mt-1 text-lg font-bold" title={order.id}>
              #{order.id.slice(-8).toUpperCase()}
            </h2>
          </header>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <dt className="mb-1 text-xs text-muted-foreground">
                {translate('ops.queue.customer')}
              </dt>
              <dd className="break-words font-semibold">
                {order.pickupName} · {order.phoneNumber}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">
                {translate('takeaway.pickupTimePrefix')}
              </dt>
              <dd>
                {order.pickupAt
                  ? formatStoreDateTime(order.pickupAt)
                  : translate('takeaway.asapShort')}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">
                {translate('takeaway.deadlinePrefix')}
              </dt>
              <dd className={expired(order) ? 'text-destructive' : ''}>
                {formatStoreDateTime(order.expiresAt)}
              </dd>
            </div>
          </dl>
          <section className="space-y-3 border-y border-border py-4">
            <h3 className="text-sm font-semibold">{translate('ops.queue.items')}</h3>
            {order.items.map((item) => (
              <div key={item.lineNumber} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="break-words">
                    <strong>{item.quantity}x</strong> {item.quotedName}
                  </p>
                  <OrderOptions options={item.quotedOptions} />
                  {item.note && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">{item.note}</p>
                  )}
                </div>
                <span className="shrink-0 font-medium">
                  {formatLineAmount(item.quotedUnitPrice, item.quantity)}
                </span>
              </div>
            ))}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{translate('ops.queue.quoted')}</span>
            <strong className="text-xl tabular-nums text-primary">
              {formatPrice(order.quotedSubtotal)}
            </strong>
          </div>
          <div className="space-y-2">
            <Button
              className="min-h-11 w-full"
              disabled={!canReview || isBlocked || expired(order)}
              isLoading={isAcceptPending}
              onClick={() => onAccept(order.id)}
            >
              <Check size={16} aria-hidden="true" />
              {translate('takeaway.approve')}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full text-destructive"
              disabled={!canReview || isBlocked}
              onClick={() => onReject(order)}
            >
              {translate('takeaway.rejectShort')}
            </Button>
          </div>
          <a
            href={`tel:${order.phoneNumber}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
          >
            <Phone size={15} aria-hidden="true" />
            {order.phoneNumber}
          </a>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} aria-hidden="true" />
            {formatStoreDateTime(order.createdAt)}
          </p>
        </div>
      )}
    </StaffOrderQueue>
  )
}
