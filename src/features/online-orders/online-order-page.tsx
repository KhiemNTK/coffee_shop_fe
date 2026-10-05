import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Coffee,
  Package,
} from 'lucide-react'
import {
  Badge,
  Button,
} from '../../shared/ui'
import { TakeawayMenuView } from './components/takeaway-menu-view'
import { OrderTrackingView } from './components/order-tracking-view'
import { OrderLookupView } from './components/order-lookup-view'

const STORAGE_KEY = 'coffee_shop_takeaway_order'

function getStoredOrder(): { requestId: string; accessToken: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { requestId?: unknown; accessToken?: unknown }
    if (
      typeof parsed?.requestId === 'string' &&
      typeof parsed?.accessToken === 'string'
    ) {
      return { requestId: parsed.requestId, accessToken: parsed.accessToken }
    }
    return null
  } catch {
    return null
  }
}

export default function OnlineOrderPage() {
  const [activeOrder, setActiveOrder] = useState<{
    requestId: string
    accessToken: string
  } | null>(() => getStoredOrder())
  const [storageWarning, setStorageWarning] = useState(false)

  // Tab: 'menu' | 'track' | 'lookup'
  const [view, setView] = useState<'menu' | 'track' | 'lookup'>(() =>
    activeOrder ? 'track' : 'menu',
  )

  function handleOrderCreated(order: { requestId: string; accessToken: string }) {
    setActiveOrder(order)
    setView('track')
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order)); setStorageWarning(false) }
    catch { setStorageWarning(true) }
  }

  function handleClearActiveOrder() {
    try { sessionStorage.removeItem(STORAGE_KEY) }
    catch { setStorageWarning(true) }
    setActiveOrder(null)
    setView('menu')
  }

  return (
    <div className="min-h-screen bg-stone-50 text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-stone-100 transition-colors"
              title="Về trang chủ"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-brand-800 text-white flex items-center justify-center shadow-xs">
                <Coffee className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-brand-900 tracking-tight">
                  Coffee Shop
                </span>
                <Badge
                  variant="secondary"
                  className="font-semibold text-xs text-brand-800 bg-brand-50 border-brand-200"
                >
                  Đặt mang đi
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
                className="text-stone-600 font-semibold"
              >
                Tra cứu đơn
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
                Đơn đang theo dõi
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Views */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {storageWarning && <p role="alert" className="mb-4 text-sm text-destructive">Đơn đã gửi nhưng chưa lưu được thông tin theo dõi. Giữ trang này mở để theo dõi đơn.</p>}
        {view === 'menu' && (
          <TakeawayMenuView onOrderCreated={handleOrderCreated} />
        )}

        {view === 'track' && activeOrder && (
          <OrderTrackingView
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
