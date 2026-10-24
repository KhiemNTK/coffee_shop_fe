import { useTranslation } from 'react-i18next'
import { AlertCircle, Ban, Clock, DollarSign, Package, Phone, UserX } from 'lucide-react'
import type { FulfillmentOrder } from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { OrderOptions } from '../../../shared/ui/order-options'
import { Badge, Button, OperationsSummary } from '../../../shared/ui'
import { StaffOrderQueue } from './staff-order-queue'

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
  const { t: translate } = useTranslation()
  const status = (order: FulfillmentOrder) => (
    <div className="flex flex-wrap justify-end gap-1">
      <Badge
        variant={order.fulfillmentStatus === 'READY' ? 'success' : 'secondary'}
        className="rounded-md"
      >
        {translate(
          order.fulfillmentStatus === 'READY'
            ? 'takeaway.readyShort'
            : order.fulfillmentStatus === 'PREPARING'
              ? order.orderItems.length > 0 && order.orderItems.every(item => item.serveStatus === 'PENDING')
                ? 'takeaway.awaitingPreparation'
                : 'takeaway.cookingShort'
              : order.fulfillmentStatus === 'PARTIALLY_READY'
                ? 'takeaway.partiallyReadyShort'
                : 'takeaway.reviewRequired',
        )}
      </Badge>
      {order.isOverdue && (
        <Badge variant="destructive" className="rounded-md">
          {translate('takeaway.overdue')}
        </Badge>
      )}
    </div>
  )
  return (
    <div className="space-y-5">
      {!isError && !isLoading && totalItems !== undefined && (
        <OperationsSummary
          label={translate('takeaway.fulfillmentTab')}
          metrics={[
            { label: translate('ops.queue.count'), value: totalItems, icon: Package },
            {
              label: translate('ops.queue.readyCount'),
              value: orders.filter((order) => order.fulfillmentStatus === 'READY').length,
              icon: DollarSign,
              note: translate('ops.queue.pageScope'),
            },
            {
              label: translate('ops.queue.preparingCount'),
              value: orders.filter((order) =>
                ['PREPARING', 'PARTIALLY_READY'].includes(order.fulfillmentStatus ?? ''),
              ).length,
              icon: Clock,
              note: translate('ops.queue.pageScope'),
            },
            {
              label: translate('ops.queue.lateCount'),
              value: orders.filter((order) => order.isOverdue).length,
              icon: AlertCircle,
              tone: orders.some((order) => order.isOverdue) ? 'danger' : undefined,
              note: translate('ops.queue.pageScope'),
            },
          ]}
        />
      )}
      <label className="flex min-h-11 items-center gap-2 border-b border-border pb-3 text-sm">
        <input
          type="checkbox"
          checked={overdueOnly}
          onChange={(event) => setOverdueOnly(event.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        {translate('takeaway.overdueOnly')}
      </label>
      {isLoading && (
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          {translate('takeaway.loadingFulfillment')}
        </p>
      )}
      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 py-4 text-sm text-destructive"
        >
          <AlertCircle size={16} aria-hidden="true" />
          {errorMessage(error)}
          <Button variant="outline" onClick={onRefetch}>
            {translate('common.retry')}
          </Button>
        </div>
      )}
      {!isLoading && !isError && !orders.length && (
        <div className="py-12 text-center">
          <Package size={32} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">{translate('takeaway.noPendingPickup')}</p>
        </div>
      )}
      {!isLoading && !isError && orders.length > 0 && (
        <StaffOrderQueue
          orders={orders}
          status={status}
          summary={(order) =>
            order.orderItems.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(' · ')
          }
        >
          {(order) => {
            const allPaid =
              order.orderItems.length > 0 && order.orderItems.every((item) => item.isPaid)
            const partlyPaid = !allPaid && order.orderItems.some((item) => item.isPaid)
            const readyForCash =
              order.orderItems.length > 0 &&
              order.orderItems.every((item) => item.serveStatus === 'READY' && !item.isPaid)
            return (
              <div className="space-y-5">
                <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{translate('ops.queue.detail')}</p>
                    <h2 className="mt-1 text-lg font-bold" title={order.id}>
                      #{order.id.slice(-8).toUpperCase()}
                    </h2>
                  </div>
                  {status(order)}
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
                      {translate('takeaway.scheduledPrefix')}
                    </dt>
                    <dd>
                      {order.pickupAt
                        ? formatStoreDateTime(order.pickupAt)
                        : translate('takeaway.asapShort')}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">
                      {translate('takeaway.cashCollectPrefix')}
                    </dt>
                    <dd className={allPaid ? 'text-emerald-800' : 'text-amber-800'}>
                      {translate(
                        allPaid
                          ? 'ops.queue.collected'
                          : partlyPaid
                            ? 'ops.queue.partialPayment'
                            : 'ops.queue.unpaid',
                      )}
                    </dd>
                  </div>
                </dl>
                <section className="space-y-3 border-y border-border py-4">
                  <h3 className="text-sm font-semibold">{translate('ops.queue.items')}</h3>
                  {order.orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words">
                          <strong>{item.quantity}x</strong> {item.menuItem.name}
                        </p>
                        <OrderOptions options={item.selectedOptions} />
                      </div>
                      <Badge
                        variant={item.serveStatus === 'READY' ? 'success' : 'secondary'}
                        className="rounded-md"
                      >
                        {translate(
                          (
                            {
                              PENDING: 'pos.pending',
                              COOKING: 'pos.cooking',
                              READY: 'pos.ready',
                              SERVED: 'takeaway.served',
                              CANCELLED: 'common.cancelled',
                            } as const
                          )[item.serveStatus],
                        )}
                      </Badge>
                    </div>
                  ))}
                </section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {translate('ops.queue.quoted')}
                  </span>
                  <strong className="text-xl tabular-nums text-primary">
                    {formatPrice(order.quotedSubtotal)}
                  </strong>
                </div>
                <Button
                  className="min-h-11 w-full"
                  disabled={!canCollect || order.fulfillmentStatus !== 'READY' || !readyForCash}
                  onClick={() => onCollect(order)}
                >
                  <DollarSign size={16} aria-hidden="true" />
                  {translate('takeaway.collectCash')}
                </Button>
                {canReview && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    {order.isNoShowEligible && (
                      <Button
                        variant="outline"
                        className="min-h-11 text-amber-800"
                        onClick={() => onNoShow(order.id)}
                        disabled={isNoShowPending || allPaid || partlyPaid}
                      >
                        <UserX size={15} aria-hidden="true" />
                        {translate('takeaway.reportNoShow')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="min-h-11 text-destructive"
                      onClick={() => onCancel(order)}
                      disabled={isNoShowPending || allPaid || partlyPaid}
                    >
                      <Ban size={15} aria-hidden="true" />
                      {translate('takeaway.cancel')}
                    </Button>
                  </div>
                )}
                <a
                  href={`tel:${order.phoneNumber}`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
                >
                  <Phone size={15} aria-hidden="true" />
                  {order.phoneNumber}
                </a>
              </div>
            )
          }}
        </StaffOrderQueue>
      )}
    </div>
  )
}
