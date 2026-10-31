import { formatPrice } from '@/shared/lib/format'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { getMenu, type MenuItem } from '../menu/menu.api'
import { ProductDetailModal } from '@/features/menu/product-detail-modal'
import { ProductImage } from '@/features/menu/product-image'
import { useCart } from './cart'
import { CartCheckoutDrawer } from '@/features/online-orders/cart-checkout-drawer'
import { OrderTrackingView } from '@/features/online-orders/order-tracking-view'
import { rememberOrder, type OrderAccess } from './order-access-storage'
import { Button } from '../../shared/ui'
import { SiteHeader } from '@/features/storefront/site-header'

export default function CartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cart = useCart()
  const [checkout, setCheckout] = useState(false)
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [unstoredOrder, setUnstoredOrder] = useState<OrderAccess | null>(null)
  const menu = useQuery({
    queryKey: ['public-menu', 'cart-cross-sell'],
    queryFn: ({ signal }) => getMenu({ page: 1, keyword: '', categoryId: '' }, signal),
  })

  function orderCreated(order: OrderAccess) {
    setCheckout(false)
    cart.clearCart()
    if (order.customerId) {
      navigate(`/account/orders/${order.requestId}`)
      return
    }
    try {
      rememberOrder(order)
      navigate('/order')
    } catch {
      setUnstoredOrder(order)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <ShoppingBag aria-hidden="true" />
          {t('takeaway.cart')}
        </h1>
        {unstoredOrder ? (
          <>
            <p role="alert">{t('takeaway.storageWarning')}</p>
            <OrderTrackingView
              orderAuth={unstoredOrder}
              onNewOrder={() => setUnstoredOrder(null)}
            />
          </>
        ) : !cart.items.length ? (
          <div className="space-y-4 border-y border-border py-12 text-center">
            <p>{t('takeaway.emptyCart')}</p>
            <Link
              to="/menu"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
            >
              {t('nav.menu')}
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section aria-label={t('takeaway.selectedItems')}>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <p className="text-sm text-muted-foreground">
                  {cart.totalCount} {t('takeaway.selectedItems')}
                </p>
                <Button variant="ghost" size="sm" onClick={cart.clearCart}>
                  <Trash2 size={16} aria-hidden="true" />
                  {t('customer.clearCart')}
                </Button>
              </div>
              <ul className="divide-y divide-border">
                {cart.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-4 py-5">
                    <ProductImage
                      item={item.menuItem}
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="break-words font-semibold">{item.menuItem.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {item.menuItem.optionGroups
                          .flatMap((group) => group.options)
                          .filter((option) => item.selectedOptionIds.includes(option.id))
                          .map((option) => option.name)
                          .join(', ')}
                      </p>
                      {item.note && (
                        <p className="break-words text-sm text-muted-foreground">{item.note}</p>
                      )}
                      <p className="text-sm font-medium">{formatPrice(item.calculatedUnitPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t('common.decreaseQuantity') + ' ' + item.menuItem.name}
                        onClick={() => cart.updateQuantity(item.id, -1)}
                      >
                        <Minus size={16} aria-hidden="true" />
                      </Button>
                      <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={item.quantity >= 20}
                        aria-label={t('common.increaseQuantity') + ' ' + item.menuItem.name}
                        onClick={() => cart.updateQuantity(item.id, 1)}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.remove') + ' ' + item.menuItem.name}
                        onClick={() => cart.removeItem(item.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <aside
              className="space-y-5 border-t border-border pt-5 lg:sticky lg:top-28"
              aria-label={t('takeaway.review')}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('takeaway.quotedTotal')}</span>
                <strong className="text-xl">{formatPrice(cart.subtotal)}</strong>
              </div>
              <Button className="w-full" onClick={() => setCheckout(true)}>
                <ArrowRight size={16} aria-hidden="true" />
                {t('customer.checkout')}
              </Button>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('takeaway.cashInfo')}
              </p>
            </aside>
          </div>
        )}
        {!unstoredOrder && cart.items.length > 0 && Boolean(menu.data?.list.length) && (
          <section className="space-y-4 border-t border-border pt-6">
            <h2 className="text-lg font-semibold">{t('takeaway.addOn')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {menu.data?.list
                .filter((item) => !cart.items.some((line) => line.menuItem.id === item.id))
                .slice(0, 4)
                .map((item) => (
                  <article key={item.id} className="space-y-3 rounded-lg border border-border p-4">
                    <h3 className="break-words font-medium">{item.name}</h3>
                    <p className="text-sm">{formatPrice(item.price)}</p>
                    <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                      <Plus size={16} aria-hidden="true" />
                      {t('menu.chooseItem')}
                    </Button>
                  </article>
                ))}
            </div>
          </section>
        )}
      </main>
      {selected && (
        <ProductDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onConfirm={(item) => {
            cart.addItem(item)
            setSelected(null)
          }}
        />
      )}
      {checkout && (
        <CartCheckoutDrawer
          cart={cart.items}
          onClose={() => setCheckout(false)}
          onUpdateQuantity={cart.updateQuantity}
          onRemoveItem={cart.removeItem}
          onAppendItems={(items) => items.forEach(cart.addItem)}
          onOrderCreated={orderCreated}
        />
      )}
    </div>
  )
}
