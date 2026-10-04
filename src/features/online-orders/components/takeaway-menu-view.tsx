import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { formatPrice, getMenu, getCategories, type MenuItem } from '../../menu/menu.api'
import {
  createOnlineOrder,
  getPickupSlots,
  type CreateOnlineOrderPayload,
} from '../online-orders.api'
import { Turnstile } from '../../auth/turnstile'
import { errorMessage } from '../../../shared/api/client'
import { Badge, Button, Card, CardContent, Dialog, Input, cn } from '../../../shared/ui'

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export interface CartItem {
  id: string
  menuItem: MenuItem
  quantity: number
  note: string
  selectedOptionIds: string[]
  calculatedUnitPrice: number
}

// ============================================================================
// ITEM CUSTOMIZER MODAL
// ============================================================================

export function ItemCustomizerModal({
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
              Giá cơ bản:{' '}
              <span className="font-semibold text-brand-700">{formatPrice(item.price)}</span>
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
              <span className="text-base font-bold min-w-6 text-center">{quantity}</span>
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

export function CartCheckoutDrawer({
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

  // Form fields
  const [pickupName, setPickupName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [todayStr] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }))
  const [pickupDate, setPickupDate] = useState(todayStr)
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
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
    onSettled: () => {
      setTurnstileToken('')
      setCaptchaAttempt((value) => value + 1)
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
    <Dialog open onClose={() => { if (!submitMutation.isPending) onClose() }}
      maxWidth="md" className="m-0 ml-auto h-dvh max-h-dvh rounded-none p-0">
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
          <Button type="button" variant="ghost" size="sm" aria-label="Đóng giỏ hàng" disabled={submitMutation.isPending} onClick={onClose} className="h-8 w-8 p-0 rounded-full">
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
              <h3 className="text-sm font-bold text-foreground">Thông tin nhận hàng</h3>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  <span id="pickup-name-label">Tên người nhận</span> <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    aria-labelledby="pickup-name-label"
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
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
                  <span id="pickup-phone-label">Số điện thoại</span> <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    aria-labelledby="pickup-phone-label"
                    autoComplete="tel"
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
                    Lấy sớm nhất
                  </Button>
                  <Button
                    type="button"
                    variant={isScheduled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsScheduled(true)}
                    className="text-xs"
                  >
                    Hẹn giờ trước
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
                      Quán hiện chưa mở nhận đặt theo khung giờ hẹn trước. Vui lòng chọn &quot;Lấy
                      sớm nhất&quot;.
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
                    key={captchaAttempt}
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
              disabled={submitMutation.isPending || cart.length === 0 || Boolean(turnstileSiteKey && !turnstileToken) || (import.meta.env.PROD && !turnstileSiteKey)}
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
    </Dialog>
  )
}

// ============================================================================
// MAIN VIEW: TAKEAWAY MENU VIEW
// ============================================================================

export function TakeawayMenuView({
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
