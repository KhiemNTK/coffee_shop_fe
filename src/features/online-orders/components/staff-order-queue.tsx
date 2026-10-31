import { formatPrice } from '@/shared/lib/format'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Clock } from 'lucide-react'
import type { PendingOrder } from '../online-orders.api'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { cn } from '../../../shared/ui'

type QueueOrder = Pick<
  PendingOrder,
  'id' | 'pickupName' | 'phoneNumber' | 'quotedSubtotal' | 'pickupAt'
>

export function StaffOrderQueue<T extends QueueOrder>({
  orders,
  status,
  summary,
  children,
}: {
  orders: T[]
  status: (order: T) => ReactNode
  summary: (order: T) => string
  children: (order: T) => ReactNode
}) {
  const { t: translate } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(() => orders[0]?.id ?? null)
  const detail = useRef<HTMLElement>(null)
  // Keep only the ID; polling must supply the current fulfillment/payment state.
  const selected = orders.find((order) => order.id === selectedId)
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-label={translate('ops.queue.title')} className="min-w-0">
        <h2 className="mb-3 text-sm font-semibold">{translate('ops.queue.title')}</h2>
        <ul className="divide-y divide-border border-y border-border bg-card">
          {orders.map((order) => {
            const code = order.id.slice(-8).toUpperCase()
            return (
              <li key={order.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === order.id}
                  aria-label={translate('ops.queue.view', { name: order.pickupName, code })}
                  onClick={() => {
                    setSelectedId(order.id)
                    if (window.matchMedia('(max-width: 1279px)').matches)
                      detail.current?.scrollIntoView({ block: 'start' })
                  }}
                  className={cn(
                    'flex min-h-24 w-full items-start gap-3 border-l-3 px-4 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    selected?.id === order.id
                      ? 'border-l-primary bg-primary-light/40'
                      : 'border-l-transparent hover:bg-muted/40',
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold">{order.pickupName}</span>
                      <span className="text-xs font-mono text-muted-foreground" title={order.id}>
                        #{code}
                      </span>
                    </div>
                    <p
                      className="line-clamp-2 break-words text-xs text-muted-foreground"
                      title={summary(order)}
                    >
                      {summary(order)}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={12} aria-hidden="true" className="shrink-0" />
                      {order.pickupAt
                        ? formatStoreDateTime(order.pickupAt)
                        : translate('takeaway.asapShort')}
                    </p>
                  </div>
                  <div className="flex max-w-[45%] flex-col items-end gap-2 text-right">
                    <strong className="break-words text-sm tabular-nums">
                      {formatPrice(order.quotedSubtotal)}
                    </strong>
                    {status(order)}
                    <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground" />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <aside
        ref={detail}
        aria-label={translate('ops.queue.detail')}
        className="min-w-0 scroll-mt-28 border-t border-border bg-card p-4 xl:sticky xl:top-20 xl:self-start xl:border-l xl:border-t-0 xl:p-5"
      >
        {selected ? children(selected) : (
          <p role="status" className="text-sm text-muted-foreground">
            {translate('ops.queue.selectionChanged')}
          </p>
        )}
      </aside>
    </div>
  )
}
