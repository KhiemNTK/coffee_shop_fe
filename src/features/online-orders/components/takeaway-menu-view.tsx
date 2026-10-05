import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, Plus, RefreshCw } from 'lucide-react'
import { formatPrice, getMenu, getCategories, type MenuItem } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { Badge, Button, Card, CardContent } from '../../../shared/ui'
import { ItemCustomizerModal } from './item-customizer-modal'
import { CartCheckoutDrawer } from './cart-checkout-drawer'
import { cartSubtotal, type CartItem } from '../cart'
import { Pagination } from '../../../shared/ui/pagination'


export function TakeawayMenuView({
  onOrderCreated,
}: {
  onOrderCreated: (order: { requestId: string; accessToken: string }) => void
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Fetch menu & categories
  const categoriesQuery = useQuery({
    queryKey: ['public-menu', 'categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })

  const menuQuery = useQuery({
    queryKey: ['public-menu', 'items', { categoryId: selectedCategoryId, page, keyword: '' }],
    queryFn: ({ signal }) =>
      getMenu({ categoryId: selectedCategoryId, page, keyword: '' }, signal),
  })

  const cartTotalAmount = cartSubtotal(cart)
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  function addToCart(newItem: CartItem) {
    setCart((prev) => {
      const matchIndex = prev.findIndex(
        (it) =>
          it.menuItem.id === newItem.menuItem.id &&
          it.note === newItem.note &&
          it.selectedOptionIds.slice().sort().join(',') ===
            newItem.selectedOptionIds.slice().sort().join(','),
      )
      if (matchIndex >= 0) {
        const next = [...prev]
        const existing = next[matchIndex]
        if (existing) {
          next[matchIndex] = {
            ...existing,
            quantity: Math.min(20, existing.quantity + newItem.quantity),
          }
          return next
        }
      }
      return [...prev, newItem]
    })
    setCustomizingItem(null)
    setIsCartOpen(true)
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item
          const newQty = item.quantity + delta
          return newQty > 0 ? { ...item, quantity: Math.min(20, newQty) } : null
        })
        .filter((item): item is CartItem => item !== null),
    )
  }

  function removeCartItem(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div>
      {/* Category selector */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-border scrollbar-none">
        <Button
          type="button"
          size="sm"
          variant={selectedCategoryId === '' ? 'default' : 'outline'}
          onClick={() => { setSelectedCategoryId(''); setPage(1) }}
          className="rounded-full shrink-0 font-medium"
        >
          Tất cả món
        </Button>
        {categoriesQuery.data?.map((cat) => {
          const isActive = selectedCategoryId === cat.id
          return (
            <Button
              key={cat.id}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => { setSelectedCategoryId(cat.id); setPage(1) }}
              className="rounded-full shrink-0 font-medium"
            >
              {cat.name}
            </Button>
          )
        })}
      </div>

      {/* Menu grid */}
      {menuQuery.isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
          <p className="text-sm">Đang tải thực đơn quán…</p>
        </div>
      )}

      {menuQuery.isError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage(menuQuery.error)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void menuQuery.refetch()}>
            Tải lại
          </Button>
        </div>
      )}

      {menuQuery.data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {menuQuery.data.list.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col justify-between hover:shadow-md hover:border-brand-300 transition-all group overflow-hidden"
            >
              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {item.category.name}
                    </span>
                    {item.optionGroups.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {item.optionGroups.length} tùy chọn
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-foreground group-hover:text-brand-900 transition-colors line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-lg font-bold text-brand-700 mt-1">
                    {formatPrice(item.price)}
                  </p>
                  {item.optionGroups.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                      {item.optionGroups.map((g) => g.name).join(' • ')}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCustomizingItem(item)}
                  className="w-full text-brand-800 bg-brand-50 hover:bg-brand-100 hover:text-brand-900 border border-brand-200 font-semibold gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Chọn món
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {menuQuery.data && <div className="pb-28">
        {menuQuery.data.list.length === 0 && <div className="space-y-3 py-8">
          <p className="text-muted-foreground" role="status">Chưa có món khả dụng.</p>
          {page > 1 && <Button variant="outline" onClick={() => setPage(1)}>Về trang đầu</Button>}
        </div>}
        {menuQuery.data.totalPages > 1 && page <= menuQuery.data.totalPages && <Pagination page={page} totalPages={menuQuery.data.totalPages} onPage={setPage} disabled={menuQuery.isFetching} />}
      </div>}

      {/* Floating Cart Trigger Bar (bottom sticky) */}
      {cart.length > 0 && !isCartOpen && (
        <button
          type="button"
          aria-label="Thanh xem nhanh giỏ hàng"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[min(92%,560px)] bg-brand-900 text-white rounded-full px-5 py-3 shadow-2xl flex items-center justify-between z-40 cursor-pointer hover:bg-brand-800 transition-all border border-brand-700/50"
          onClick={() => setIsCartOpen(true)}
        >
          <div className="flex items-center gap-3">
            <span className="bg-white text-brand-900 h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xs">
              {totalItemCount}
            </span>
            <span className="font-semibold text-sm">Giỏ hàng mang đi</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base font-bold tracking-tight">
              {formatPrice(String(cartTotalAmount))}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </button>
      )}

      {/* Item Customizer Modal */}
      {customizingItem && (
        <ItemCustomizerModal
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onConfirm={addToCart}
        />
      )}

      {/* Cart & Checkout Drawer */}
      {isCartOpen && (
        <CartCheckoutDrawer
          cart={cart}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeCartItem}
          onAppendItems={items => setCart(previous => [...previous, ...items])}
          onOrderCreated={(order) => {
            setIsCartOpen(false)
            onOrderCreated(order)
          }}
        />
      )}
    </div>
  )
}
