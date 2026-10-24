import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Heart, LogOut, RefreshCw, ShoppingBag } from 'lucide-react'
import { SiteHeader } from '../../shared/components/site-header'
import { ApiError, errorMessage } from '../../shared/api/client'
import { Badge, Button } from '../../shared/ui'
import { formatPrice, formatLineAmount } from '../../shared/lib/format'
import { formatStoreDateTime } from '../../shared/lib/store-time'
import { OrderOptions } from '../../shared/ui/order-options'
import { OrderStatusBadge } from '../online-orders/components/order-tracking-view'
import { customerKey, useCustomer, useCustomerLogout } from './customers.api'
import { getCustomerOrder, getCustomerOrders } from './customer-orders.api'
import { CustomerSignIn } from './customer-sign-in'
import { CustomerPickupCode } from './customer-pickup-code'
import { FeedbackResponse } from '../online-orders/components/feedback-response'

const invoiceStatusKeys = {
  UNPAID: 'ops.queue.unpaid',
  PAID: 'common.paid',
  VOIDED: 'common.cancelled',
  PARTIALLY_REFUNDED: 'customer.partialRefund',
  REFUNDED: 'customer.fullRefund',
} as const

export default function CustomerAccountPage() {
  const { t } = useTranslation()
  const customer = useCustomer()
  const client = useQueryClient()
  const logout = useCustomerLogout()
  const { orderId } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.min(1000, Math.max(1, Math.trunc(Number(params.get('page'))) || 1))
  const id = !customer.isError ? (customer.data?.id ?? '') : ''
  const orders = useQuery({
    queryKey: ['customer', id, 'orders', page],
    queryFn: ({ signal }) => getCustomerOrders(id, page, signal),
    enabled: Boolean(id) && !orderId,
    retry: false,
    staleTime: 10000,
    gcTime: 60000,
  })
  const detail = useQuery({
    queryKey: ['customer', id, 'order', orderId],
    queryFn: ({ signal }) => getCustomerOrder(id, orderId!, signal),
    enabled: Boolean(id && orderId),
    retry: false,
    staleTime: 10000,
    gcTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data
      return data &&
        ['PENDING', 'ACCEPTED'].includes(data.status) &&
        data.fulfillmentStatus !== 'COLLECTED' &&
        !query.state.error
        ? 15000
        : false
    },
  })
  const active = orderId ? detail : orders
  const error = customer.error ?? active.error ?? logout.error
  useEffect(() => {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.code === 'CUSTOMER_SESSION_CHANGED')
    )
      void client.invalidateQueries({ queryKey: customerKey })
  }, [client, error])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold">{t('customer.account')}</h1>
            {customer.data && (
              <p className="break-all text-sm text-muted-foreground">{customer.data.email}</p>
            )}
          </div>
          {id && (
            <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
              <LogOut size={16} aria-hidden="true" />
              {t('auth.signOut')}
            </Button>
          )}
        </div>
        {customer.isPending ? (
          <p role="status">{t('common.loading')}</p>
        ) : customer.isError ? (
          <>
            <p role="alert">{errorMessage(customer.error)}</p>
            <Button variant="outline" onClick={() => void customer.refetch()}>
              {t('common.retry')}
            </Button>
          </>
        ) : !id ? (
          <CustomerSignIn returnTo={orderId ? `/account/orders/${orderId}` : '/account'} />
        ) : (
          <>
            <nav
              className="flex flex-wrap gap-5 text-sm font-medium"
              aria-label={t('customer.account')}
            >
              <Link to="/account" className="inline-flex min-h-11 items-center gap-2 text-primary">
                <ShoppingBag size={18} aria-hidden="true" />
                {t('customer.orders')}
              </Link>
              <Link to="/wishlist" className="inline-flex min-h-11 items-center gap-2 text-primary">
                <Heart size={18} aria-hidden="true" />
                {t('wishlist.title')}
              </Link>
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {t(orderId ? 'customer.orderDetail' : 'customer.orders')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={active.isFetching}
                onClick={() => void active.refetch()}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t('common.refresh')}
              </Button>
            </div>
            {error ? (
              <p role="alert" className="break-words text-sm text-destructive">
                {errorMessage(error)}
              </p>
            ) : active.isPending ? (
              <p role="status">{t('common.loading')}</p>
            ) : orderId && detail.data ? (
              <section className="space-y-5">
                <Link
                  to="/account"
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  {t('customer.orders')}
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <code className="break-all text-sm">{detail.data.requestId}</code>
                  <OrderStatusBadge
                    status={detail.data.status}
                    fulfillmentStatus={detail.data.fulfillmentStatus}
                    waitingForPreparation={detail.data.orderItems.length > 0 && detail.data.orderItems.every(item => item.serveStatus === 'PENDING')}
                  />
                </div>
                {detail.data.pickupAt && (
                  <p className="text-sm">
                    {t('takeaway.pickupTime')}: {formatStoreDateTime(detail.data.pickupAt)}
                  </p>
                )}
                {detail.data.pickupAccessToken &&
                  detail.data.accessExpiresAt &&
                  detail.data.status === 'ACCEPTED' &&
                  detail.data.fulfillmentStatus !== 'COLLECTED' &&
                  !detail.data.noShowAt && (
                    <CustomerPickupCode
                      key={`${id}:${orderId}:${detail.data.pickupAccessToken}`}
                      token={detail.data.pickupAccessToken}
                      expiresAt={detail.data.accessExpiresAt}
                    />
                  )}
                <ul className="divide-y divide-border">
                  {detail.data.items.map((line) => (
                    <li
                      key={line.lineNumber}
                      className="flex items-start justify-between gap-4 py-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <h3 className="break-words font-medium">
                          {line.quantity} × {line.quotedName}
                        </h3>
                        <OrderOptions options={line.quotedOptions} />
                        {line.note && (
                          <p className="break-words text-sm text-muted-foreground">{line.note}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">
                        {formatLineAmount(line.quotedUnitPrice, line.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-right font-semibold">
                  {t('takeaway.quotedTotal')}: {formatPrice(detail.data.quotedSubtotal)}
                </p>
                {detail.data.feedback.map(feedback => <FeedbackResponse key={feedback.id} feedback={feedback} />)}
                {detail.data.invoices.length ? (
                  <ul className="space-y-2 border-t border-border pt-4">
                    {detail.data.invoices.map((invoice) => (
                      <li key={invoice.id} className="flex flex-wrap justify-between gap-3 text-sm">
                        <span className="break-all">
                          {t('pos.invoiceNumber')} {invoice.invoiceNumber}
                        </span>
                        <span>
                          {formatPrice(invoice.totalAmount)} ·{' '}
                          {t(
                            invoiceStatusKeys[
                              invoice.paymentStatus as keyof typeof invoiceStatusKeys
                            ] ?? 'common.unknown',
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">
                    {t(detail.data.isPaid ? 'common.paid' : 'ops.queue.unpaid')}
                  </p>
                )}
                {(detail.data.rejectionReason || detail.data.cancellationReason) && (
                  <p className="break-words text-sm">
                    {t('common.reasonPrefix')}{' '}
                    {detail.data.rejectionReason ?? detail.data.cancellationReason}
                  </p>
                )}
                <Link
                  to={`/account/orders/${orderId}/reorder`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  {t('takeaway.reorderThis')}
                </Link>
                <p className="text-xs text-muted-foreground">{t('customer.reorderNotice')}</p>
              </section>
            ) : orders.data?.list.length ? (
              <>
                <ul className="divide-y divide-border">
                  {orders.data.list.map((order) => (
                    <li key={order.id}>
                      <Link
                        to={`/account/orders/${order.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 py-5 hover:text-primary"
                      >
                        <div className="min-w-0 space-y-2">
                          <p className="break-all font-mono text-sm">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatStoreDateTime(order.createdAt)}
                          </p>
                        </div>
                        {order.status === 'ACCEPTED' ? (
                          <Badge variant="secondary">{t('takeaway.accepted')}</Badge>
                        ) : (
                          <OrderStatusBadge status={order.status} />
                        )}
                        <span className="font-semibold">{formatPrice(order.quotedSubtotal)}</span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <nav
                  className="flex items-center justify-between gap-3"
                  aria-label={t('customer.orders')}
                >
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setParams({ page: String(page - 1) })}
                  >
                    {t('common.previousPage')}
                  </Button>
                  <span className="text-sm tabular-nums">
                    {orders.data.currentPage} / {orders.data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= orders.data.totalPages}
                    onClick={() => setParams({ page: String(page + 1) })}
                  >
                    {t('common.nextPage')}
                  </Button>
                </nav>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('customer.noOrders')}</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
