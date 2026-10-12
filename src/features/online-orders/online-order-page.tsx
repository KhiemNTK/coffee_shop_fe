import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPublicStore } from '../menu/menu.api'
import { Link } from 'react-router-dom'
import { ArrowLeft, Coffee, Package } from 'lucide-react'
import { Badge, Button } from '../../shared/ui'
import { TakeawayMenuView } from './components/takeaway-menu-view'
import { OrderTrackingView } from './components/order-tracking-view'
import { OrderLookupView } from './components/order-lookup-view'
import { rememberOrder, storedOrders, type OrderAccess } from './order-access-storage'

export default function OnlineOrderPage() {
  const { t: translate } = useTranslation()
  const store = useQuery({
    queryKey: ['public-store'],
    queryFn: ({ signal }) => getPublicStore(signal),
  })
  const [orders, setOrders] = useState(storedOrders)
  const [activeOrder, setActiveOrder] = useState<OrderAccess | null>(() => orders[0] ?? null)
  const [storageWarning, setStorageWarning] = useState(false)

  // Tab: 'menu' | 'track' | 'lookup'
  const [view, setView] = useState<'menu' | 'track' | 'lookup'>(() =>
    activeOrder ? 'track' : 'menu',
  )

  function handleOrderCreated(order: OrderAccess) {
    setActiveOrder(order)
    setOrders((previous) =>
      [order, ...previous.filter((value) => value.requestId !== order.requestId)].slice(0, 10),
    )
    setView('track')
    try {
      rememberOrder(order)
      setStorageWarning(false)
    } catch {
      setStorageWarning(true)
    }
  }

  function handleClearActiveOrder() {
    setView('menu')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={translate('common.home')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                <Coffee className="h-5 w-5" />
              </div>
              <div className="flex flex-wrap min-w-0 items-center gap-2">
                <span className="font-bold text-lg text-primary break-words">
                  {store.data?.name ?? 'Coffee Shop'}
                </span>
                <Badge
                  variant="secondary"
                  className="font-semibold text-xs text-primary bg-primary-light border-border"
                >
                  {translate('menu.takeaway')}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {view === 'menu' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setView('lookup')}
                className="text-muted-foreground hover:text-foreground font-semibold"
              >
                {translate('takeaway.lookup')}
              </Button>
            )}
            {activeOrder && view !== 'track' && (
              <Button
                type="button"
                size="sm"
                onClick={() => setView('track')}
                className="gap-1.5 rounded-full"
              >
                <Package className="h-4 w-4" />
                {translate('takeaway.trackedOrder')}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Views */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {(store.data?.address || store.data?.phone) && (
          <address className="mb-5 border-b border-border pb-4 text-sm not-italic">
            <strong>
              {translate('takeaway.storePrefix')}{' '}
              {store.data.name ?? translate('takeaway.storeFallback')}
            </strong>
            {store.data.address && <p className="mt-1 break-words">{store.data.address}</p>}
            {store.data.phone && (
              <a
                className="mt-1 inline-block underline"
                href={`tel:${store.data.phone.replace(/[^+0-9]/g, '')}`}
              >
                {store.data.phone}
              </a>
            )}
          </address>
        )}
        {orders.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="tracked-order" className="text-sm font-medium">
              {translate('takeaway.savedOrders')}
            </label>
            <select
              id="tracked-order"
              className="max-w-full border border-border rounded-md p-2 text-sm"
              value={activeOrder?.requestId ?? ''}
              onChange={(event) => {
                const order = orders.find((value) => value.requestId === event.target.value)
                if (order) {
                  setActiveOrder(order)
                  setView('track')
                }
              }}
            >
              {orders.map((order) => (
                <option key={order.requestId} value={order.requestId}>
                  #{order.requestId.slice(0, 8).toUpperCase()}…
                  {order.requestId.slice(-6).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}
        {storageWarning && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {translate('takeaway.storageWarning')}
          </p>
        )}
        {view === 'menu' && <TakeawayMenuView onOrderCreated={handleOrderCreated} />}

        {view === 'track' && activeOrder && (
          <OrderTrackingView
            key={activeOrder.requestId}
            orderAuth={activeOrder}
            onNewOrder={handleClearActiveOrder}
          />
        )}

        {view === 'lookup' && (
          <OrderLookupView
            onFound={(order) => {
              handleOrderCreated(order)
            }}
            onBack={() => setView(activeOrder ? 'track' : 'menu')}
          />
        )}
      </main>
    </div>
  )
}
