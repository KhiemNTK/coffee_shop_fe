import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  User,
  X,
  AlertCircle,
} from 'lucide-react'
import { formatPrice, getMenu, getCategories, type MenuItem } from '../menu/menu.api'
import {
  createOnlineOrder,
  trackOnlineOrder,
  cancelOnlineOrder,
  getPickupSlots,
  getTelegramLink,
  type CreateOnlineOrderPayload,
} from './online-orders.api'
import { Turnstile } from '../auth/turnstile'
import { errorMessage } from '../../shared/api/client'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  cn,
} from '../../shared/ui'

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

const STORAGE_KEY = 'coffee_shop_takeaway_order'

interface CartItem {
  id: string
  menuItem: MenuItem
  quantity: number
  note: string
  selectedOptionIds: string[]
  calculatedUnitPrice: number
}

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

  // Tab: 'menu' | 'track' | 'lookup'
  const [view, setView] = useState<'menu' | 'track' | 'lookup'>(() =>
    activeOrder ? 'track' : 'menu',
  )

  function handleOrderCreated(order: { requestId: string; accessToken: string }) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    setActiveOrder(order)
    setView('track')
  }

  function handleClearActiveOrder() {
    sessionStorage.removeItem(STORAGE_KEY)
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
                <Badge variant="secondary" className="font-semibold text-xs text-brand-800 bg-brand-50 border-brand-200">
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
        {view === 'menu' && (
          <TakeawayOrderView onOrderCreated={handleOrderCreated} />
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

// ============================================================================
// VIEW 1: TAKEAWAY ORDER VIEW (MENU + CUSTOMIZER + CART + CHECKOUT)
// ============================================================================

function TakeawayOrderView({
  onOrderCreated,
}: {
  onOrderCreated: (order: { requestId: string; accessToken: string }) => void
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Fetch menu & categories
  const categoriesQuery = useQuery({
    queryKey: ['public-menu', 'categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })

  const menuQuery = useQuery({
    queryKey: ['public-menu', 'items', { categoryId: selectedCategoryId, page: 1 }],
    queryFn: ({ signal }) =>
      getMenu({ categoryId: selectedCategoryId, page: 1, keyword: '' }, signal),
  })

  const cartTotalAmount = cart.reduce(
    (sum, item) => sum + item.calculatedUnitPrice * item.quantity,
    0,
  )
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
          onClick={() => setSelectedCategoryId('')}
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
              onClick={() => setSelectedCategoryId(cat.id)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-24">
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

      {/* Floating Cart Trigger Bar (bottom sticky) */}
      {cart.length > 0 && !isCartOpen && (
        <aside
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
            <span className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors">
              Xem giỏ →
            </span>
          </div>
        </aside>
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
          onOrderCreated={(order) => {
            setIsCartOpen(false)
            onOrderCreated(order)
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// ITEM CUSTOMIZER MODAL
// ============================================================================

function ItemCustomizerModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem
  onClose: () => void
  onConfirm: (cartItem: CartItem) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>()
    item.optionGroups.forEach((group) => {
      const firstOpt = group.options[0]
      if (group.minSelected === 1 && group.maxSelected === 1 && firstOpt) {
        map.set(group.id, [firstOpt.id])
      } else {
        map.set(group.id, [])
      }
    })
    return map
  })

  // Calculate dynamic unit price
  const basePrice = Number(item.price)
  let deltaSum = 0
  selectedOptions.forEach((optIds, groupId) => {
    const group = item.optionGroups.find((g) => g.id === groupId)
    if (!group) return
    optIds.forEach((id) => {
      const opt = group.options.find((o) => o.id === id)
      if (opt) deltaSum += Number(opt.priceDelta)
    })
  })
  const unitPrice = basePrice + deltaSum

  // Check group constraints
  const errors: string[] = []
  item.optionGroups.forEach((group) => {
    const selected = selectedOptions.get(group.id) ?? []
    if (group.minSelected > 0 && selected.length < group.minSelected) {
      errors.push(`Vui lòng chọn ít nhất ${group.minSelected} tùy chọn cho "${group.name}".`)
    }
    if (group.maxSelected > 0 && selected.length > group.maxSelected) {
      errors.push(`Chỉ được chọn tối đa ${group.maxSelected} tùy chọn cho "${group.name}".`)
    }
  })

  function toggleOption(groupId: string, optionId: string, maxSelected: number) {
    setSelectedOptions((prev) => {
      const next = new Map(prev)
      const current = next.get(groupId) ?? []
      if (maxSelected === 1) {
        next.set(groupId, [optionId])
      } else {
        if (current.includes(optionId)) {
          next.set(
            groupId,
            current.filter((id) => id !== optionId),
          )
        } else {
          if (maxSelected === 0 || current.length < maxSelected) {
            next.set(groupId, [...current, optionId])
          }
        }
      }
      return next
    })
  }

  function handleSave() {
    if (errors.length > 0) return
    const allOptionIds = Array.from(selectedOptions.values()).flat()
    onConfirm({
      id: crypto.randomUUID(),
      menuItem: item,
      quantity,
      note: note.trim(),
      selectedOptionIds: allOptionIds,
      calculatedUnitPrice: unitPrice,
    })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-brand-900">{item.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Giá cơ bản: <span className="font-semibold text-brand-700">{formatPrice(item.price)}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {item.optionGroups.map((group) => {
            const selected = selectedOptions.get(group.id) ?? []
            const isSingle = group.maxSelected === 1
            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    {group.name}
                    {group.minSelected > 0 && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {isSingle
                      ? 'Chọn 1'
                      : group.maxSelected > 0
                        ? `Chọn tối đa ${group.maxSelected}`
                        : 'Tùy chọn'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {group.options.map((opt) => {
                    const isChecked = selected.includes(opt.id)
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => toggleOption(group.id, opt.id, group.maxSelected)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border text-left transition-all text-sm',
                          isChecked
                            ? 'border-brand-600 bg-brand-50/80 text-brand-950 font-medium ring-1 ring-brand-500'
                            : 'border-border bg-card hover:bg-stone-50 text-foreground',
                        )}
                      >
                        <span>{opt.name}</span>
                        <div className="flex items-center gap-2">
                          {Number(opt.priceDelta) > 0 && (
                            <span className="text-brand-700 font-semibold text-xs">
                              +{formatPrice(opt.priceDelta)}
                            </span>
                          )}
                          <span
                            className={cn(
                              'h-4 w-4 flex items-center justify-center transition-colors',
                              isSingle ? 'rounded-full' : 'rounded',
                              isChecked
                                ? 'bg-brand-700 text-white'
                                : 'border border-stone-300 bg-white',
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Special note */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Ghi chú cho quán (nếu có)
            </label>
            <Input
              type="text"
              placeholder="VD: Ít đá, nhiều đường, mang đi xa..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
            />
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm font-semibold text-foreground">Số lượng</span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="h-8 w-8 rounded-full p-0"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-base font-bold min-w-6 text-center">
                {quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                disabled={quantity >= 20}
                className="h-8 w-8 rounded-full p-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1">
              {errors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-stone-50 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs text-muted-foreground block">Tổng tiền món:</span>
            <span className="text-lg font-bold text-brand-800">
              {formatPrice(String(unitPrice * quantity))}
            </span>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={errors.length > 0}
            className="font-semibold"
          >
            Thêm vào giỏ
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ============================================================================
// CART & CHECKOUT DRAWER
// ============================================================================

function CartCheckoutDrawer({
  cart,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onOrderCreated,
}: {
  cart: CartItem[]
  onClose: () => void
  onUpdateQuantity: (id: string, delta: number) => void
  onRemoveItem: (id: string) => void
  onOrderCreated: (order: { requestId: string; accessToken: string }) => void
}) {
  const [clientRequestId] = useState(() => crypto.randomUUID())

  // Form fields
  const [pickupName, setPickupName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10))
  const [pickupDate, setPickupDate] = useState(todayStr)
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)

  // Fetch slots if scheduled pickup is selected
  const slotsQuery = useQuery({
    queryKey: ['pickup-slots', pickupDate],
    queryFn: ({ signal }) => getPickupSlots(pickupDate, signal),
    enabled: isScheduled,
  })

  const subtotal = cart.reduce(
    (sum, item) => sum + item.calculatedUnitPrice * item.quantity,
    0,
  )

  const submitMutation = useMutation({
    mutationFn: (payload: CreateOnlineOrderPayload) => createOnlineOrder(payload),
    onSuccess: (data) => {
      onOrderCreated({
        requestId: data.requestId,
        accessToken: data.accessToken,
      })
    },
    onError: (err) => {
      setFormError(errorMessage(err))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const cleanName = pickupName.trim()
    const cleanPhone = phoneNumber.trim()

    if (cleanName.length < 2) {
      setFormError('Vui lòng nhập tên người nhận (tối thiểu 2 ký tự).')
      return
    }
    if (!/^\+?[0-9]{8,15}$/.test(cleanPhone)) {
      setFormError('Số điện thoại không hợp lệ (8 - 15 chữ số).')
      return
    }

    if (isScheduled && !selectedSlotTime) {
      setFormError('Vui lòng chọn khung giờ nhận hàng.')
      return
    }

    if (cart.length === 0) {
      setFormError('Giỏ hàng đang trống.')
      return
    }

    const payload: CreateOnlineOrderPayload = {
      clientRequestId,
      pickupName: cleanName,
      phoneNumber: cleanPhone,
      pickupAt: isScheduled ? selectedSlotTime : undefined,
      maxSubtotal: subtotal.toFixed(2),
      turnstileToken: turnstileToken || undefined,
      items: cart.map((it) => ({
        menuItemId: it.menuItem.id,
        quantity: it.quantity,
        note: it.note || undefined,
        optionIds: it.selectedOptionIds.length > 0 ? it.selectedOptionIds : undefined,
      })),
    }

    submitMutation.mutate(payload)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md h-full bg-card shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Giỏ hàng mang đi</h2>
              <p className="text-xs text-muted-foreground">{cart.length} món đã chọn</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-4 sm:p-5 space-y-6 flex-1">
            {/* Cart Items List */}
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        {item.menuItem.name}
                      </h4>
                      <p className="text-xs font-semibold text-brand-700 mt-0.5">
                        {formatPrice(String(item.calculatedUnitPrice))}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(item.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Xóa món"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {item.note && (
                    <p className="text-xs text-muted-foreground italic bg-white/60 px-2 py-1 rounded border border-stone-200/50">
                      Ghi chú: {item.note}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="h-6 w-6 rounded p-0 bg-white"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-semibold min-w-5 text-center">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="h-6 w-6 rounded p-0 bg-white"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <span className="text-sm font-bold text-brand-800">
                      {formatPrice(String(item.calculatedUnitPrice * item.quantity))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer form */}
            <div className="pt-4 border-t border-border space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                Thông tin nhận hàng
              </h3>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tên người nhận <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                    className="pl-9"
                  />
                  <User className="h-4 w-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Số điện thoại <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    required
                    placeholder="VD: 0901234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-9"
                  />
                  <Phone className="h-4 w-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Pickup timing toggle */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Thời gian lấy món
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={!isScheduled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setIsScheduled(false)
                      setSelectedSlotTime('')
                    }}
                    className="text-xs"
                  >
                    ⚡ Lấy sớm nhất
                  </Button>
                  <Button
                    type="button"
                    variant={isScheduled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsScheduled(true)}
                    className="text-xs"
                  >
                    🕒 Hẹn giờ trước
                  </Button>
                </div>
              </div>

              {/* Slot selector when scheduled */}
              {isScheduled && (
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Chọn ngày nhận
                    </label>
                    <input
                      type="date"
                      value={pickupDate}
                      min={todayStr}
                      onChange={(e) => {
                        setPickupDate(e.target.value)
                        setSelectedSlotTime('')
                      }}
                      className="w-full text-xs p-2 rounded-lg border border-border bg-white"
                    />
                  </div>

                  {slotsQuery.isLoading && (
                    <p className="text-xs text-muted-foreground">Đang kiểm tra khung giờ…</p>
                  )}

                  {slotsQuery.data && !slotsQuery.data.enabled && (
                    <p className="text-xs text-destructive">
                      Quán hiện chưa mở nhận đặt theo khung giờ hẹn trước. Vui lòng chọn &quot;Lấy sớm nhất&quot;.
                    </p>
                  )}

                  {slotsQuery.data && slotsQuery.data.enabled && (
                    <div>
                      <span className="text-xs font-semibold text-foreground block mb-2">
                        Khung giờ khả dụng:
                      </span>
                      {slotsQuery.data.slots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Không có khung giờ trống trong ngày này.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                          {slotsQuery.data.slots.map((slot) => {
                            const timeStr = new Date(slot.pickupAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            const isSelected = selectedSlotTime === slot.pickupAt
                            const isFull = slot.remaining <= 0
                            return (
                              <button
                                key={slot.pickupAt}
                                type="button"
                                disabled={isFull}
                                onClick={() => setSelectedSlotTime(slot.pickupAt)}
                                className={cn(
                                  'p-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-0.5 border transition-all',
                                  isSelected
                                    ? 'bg-brand-800 text-white border-brand-800 shadow-xs'
                                    : isFull
                                      ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                                      : 'bg-white text-foreground border-stone-200 hover:border-brand-500',
                                )}
                              >
                                <span>{timeStr}</span>
                                <span className="text-[10px] font-normal opacity-85">
                                  {isFull ? 'Hết' : `Còn ${slot.remaining}`}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Turnstile verification if configured */}
              {turnstileSiteKey && (
                <div className="pt-2">
                  <Turnstile
                    siteKey={turnstileSiteKey}
                    action="online_order"
                    onToken={setTurnstileToken}
                  />
                </div>
              )}

              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-border bg-stone-50 mt-auto space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Tổng thanh toán:</span>
              <span className="text-xl font-bold text-brand-800">
                {formatPrice(String(subtotal))}
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-bold"
              disabled={submitMutation.isPending || cart.length === 0}
              isLoading={submitMutation.isPending}
            >
              Gửi đơn mang đi →
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Thanh toán tiền mặt trực tiếp khi nhận hàng tại quầy.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// VIEW 2: ORDER TRACKING VIEW (REAL-TIME STATUS + CANCEL + TELEGRAM)
// ============================================================================

function OrderTrackingView({
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
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
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
                      Nhân viên sẽ sớm tiếp nhận và chuyển quầy pha chế. Đơn hàng sẽ tự động hủy nếu không kịp xác nhận trước{' '}
                      {new Date(order.expiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}.
                    </p>
                  </div>
                </div>
              )}

              {order.fulfillmentStatus === 'READY' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="text-sm uppercase tracking-wide">MÓN CỦA BẠN ĐÃ SẴN SÀNG!</strong>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Mời bạn ghé quầy thu ngân, đọc mã <strong>#{order.requestId.slice(0, 8).toUpperCase()}</strong> để nhận món và thanh toán tiền mặt.
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

function OrderStatusBadge({
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

function OrderStepTimeline({
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

// ============================================================================
// VIEW 3: ORDER LOOKUP VIEW (IF CUSTOMER HAS PREVIOUS ORDER)
// ============================================================================

function OrderLookupView({
  onFound,
  onBack,
}: {
  onFound: (order: { requestId: string; accessToken: string }) => void
  onBack: () => void
}) {
  const [requestId, setRequestId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cleanId = requestId.trim().toLowerCase()
    const cleanToken = accessToken.trim().toLowerCase()

    if (!cleanId || !cleanToken) {
      setError('Vui lòng nhập đầy đủ Mã đơn hàng và Mã xác thực.')
      return
    }

    setLoading(true)
    try {
      await trackOnlineOrder(cleanId, cleanToken)
      onFound({ requestId: cleanId, accessToken: cleanToken })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 text-stone-600 gap-1.5 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Button>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-brand-900">Tra cứu đơn mang đi</CardTitle>
          <CardDescription>
            Nhập mã đơn hàng và mã bảo mật mà quán đã cung cấp khi đặt hàng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Mã đơn hàng
              </label>
              <Input
                type="text"
                required
                placeholder="VD: a1b2c3d4-..."
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Mã xác thực
              </label>
              <Input
                type="text"
                required
                placeholder="Mã 64 ký tự hex"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-bold"
              disabled={loading}
              isLoading={loading}
            >
              Tra cứu ngay
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
