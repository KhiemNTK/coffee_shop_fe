import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  User,
} from 'lucide-react'
import { formatPrice, getMenu, type MenuItem } from '../menu/menu.api'
import { useCart } from './cart'
import {
  createOnlineOrder,
  getPickupSlots,
  type CreateOnlineOrderPayload,
} from './online-orders.api'
import { rememberOrder } from './order-access-storage'
import { errorMessage } from '../../shared/api/client'
import { Button, Card, CardContent, Input, cn } from '../../shared/ui'
import { SiteHeader } from '@/shared/components/site-header'
import { Turnstile } from '../auth/turnstile'

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export default function CartPage() {
  const navigate = useNavigate()
  const { items, totalCount, subtotal, updateQuantity, removeItem, clearCart, addItem } =
    useCart()

  // Form states
  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [note, setNote] = useState('')
  const [orderMode, setOrderMode] = useState<'takeaway' | 'delivery'>('takeaway')
  const [timeMode, setTimeMode] = useState<'asap' | 'scheduled'>('asap')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0] ?? '')

  // Query menu items for cross-sell recommendations
  const menuQuery = useQuery({
    queryKey: ['public-menu', 'cart-cross-sell'],
    queryFn: ({ signal }) =>
      getMenu({ page: 1, keyword: '', categoryId: '' }, signal),
  })

  // Pickup slots for scheduled pickup
  const slotsQuery = useQuery({
    queryKey: ['pickup-slots', todayDate],
    queryFn: ({ signal }) => getPickupSlots(todayDate, signal),
    enabled: timeMode === 'scheduled',
  })

  // Packaging fee
  const packagingFee = items.length > 0 ? 3000 : 0
  const subtotalNum = Number(subtotal)
  const grandTotal = subtotalNum + packagingFee

  // Mutation to create online takeaway order
  const mutation = useMutation({
    mutationFn: (payload: CreateOnlineOrderPayload) => {
      return createOnlineOrder(payload)
    },
    onSuccess: (data) => {
      rememberOrder(data)
      clearCart()
      navigate('/order')
    },
  })

  function handleCheckout() {
    if (items.length === 0 || mutation.isPending) return
    if (!customerName.trim() || !phoneNumber.trim()) {
      alert('Vui lòng nhập họ tên và số điện thoại nhận hàng.')
      return
    }

    const payload: CreateOnlineOrderPayload = {
      pickupName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      pickupAt: timeMode === 'scheduled' ? selectedSlot : undefined,
      turnstileToken: captchaToken || undefined,
      items: items.map((it) => ({
        menuItemId: it.menuItem.id,
        quantity: it.quantity,
        note: it.note || undefined,
        optionIds: it.selectedOptionIds,
      })),
    }

    mutation.mutate(payload)
  }

  function handleQuickAddCrossSell(item: MenuItem) {
    addItem({
      id: `${item.id}-${crypto.randomUUID()}`,
      menuItem: item,
      quantity: 1,
      note: '',
      selectedOptionIds: [],
      calculatedUnitPrice: item.price,
    })
  }

  const crossSellItems = menuQuery.data?.list.slice(0, 4) ?? []

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 flex-1 w-full">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-foreground">Giỏ hàng &amp; Thanh toán</span>
        </div>

        {items.length === 0 ? (
          /* Empty Cart State */
          <div className="rounded-[18px] border border-dashed border-border bg-card p-12 text-center max-w-xl mx-auto my-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Giỏ hàng của bạn đang trống
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hãy khám phá các thức uống cà phê mộc và món ngon yêu thích trong thực đơn!
            </p>
            <Link
              to="/menu"
              className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-bold text-white shadow-xs hover:bg-primary-hover transition-all"
            >
              <span>Khám phá thực đơn</span>
            </Link>
          </div>
        ) : (
          /* 2-Column Cart & Checkout Layout (Panel 4) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Items & Cross-sell (65% width = 7.5 cols on 12-col grid) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8">
              {/* Cart Items List */}
              <div className="rounded-[16px] border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-border/80">
                  <h1 className="text-xl font-extrabold text-foreground">
                    Giỏ hàng ({totalCount} món)
                  </h1>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="divide-y divide-border/60">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="py-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-16 w-16 shrink-0 rounded-[12px] border border-border overflow-hidden bg-surface-muted">
                          <img
                            src={item.menuItem.imageUrl || '/iced-coffee.jpg'}
                            alt={item.menuItem.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/iced-coffee.jpg'
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-foreground line-clamp-1">
                            {item.menuItem.name}
                          </h3>
                          {item.note && (
                            <p className="text-xs text-muted-foreground italic line-clamp-1 mt-0.5">
                              &ldquo;{item.note}&rdquo;
                            </p>
                          )}
                          <p className="text-sm font-extrabold text-primary tabular-nums mt-1">
                            {formatPrice(item.calculatedUnitPrice)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Stepper */}
                        <div className="flex items-center rounded-[8px] border border-border bg-card p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                            title="Giảm 1"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                            title="Tăng 1"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Remove trash button */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          title="Xóa món"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-end">
                  <Link
                    to="/menu"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm món khác</span>
                  </Link>
                </div>
              </div>

              {/* Cross-sell Shelf: "Có thể bạn sẽ thích" */}
              {crossSellItems.length > 0 && (
                <div className="rounded-[16px] border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
                  <h3 className="text-base font-bold text-foreground mb-4">
                    Có thể bạn sẽ thích
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {crossSellItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[12px] border border-border/70 p-2.5 flex flex-col justify-between hover:border-primary/40 transition-colors"
                      >
                        <div className="aspect-square w-full rounded-lg overflow-hidden bg-surface-muted mb-2">
                          <img
                            src={item.imageUrl || '/iced-coffee.jpg'}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/iced-coffee.jpg'
                            }}
                          />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground line-clamp-1">
                            {item.name}
                          </h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-extrabold text-primary tabular-nums">
                              {formatPrice(item.price)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickAddCrossSell(item)}
                              className="h-6 w-6 rounded-md bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors"
                              title="Thêm vào giỏ"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Order Summary & Checkout Form (35% width = 4.5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <Card className="rounded-[16px] border border-border/80 bg-card shadow-xs sticky top-20">
                <CardContent className="p-5 sm:p-6 space-y-5">
                  <h2 className="text-lg font-extrabold text-foreground border-b border-border/80 pb-3">
                    Thông tin đơn hàng
                  </h2>

                  {/* Order Mode Pills */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-2">
                      Hình thức nhận hàng
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOrderMode('takeaway')}
                        className={cn(
                          'py-2 px-3 rounded-[10px] text-xs font-bold border transition-all cursor-pointer',
                          orderMode === 'takeaway'
                            ? 'border-primary bg-primary text-white shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                        )}
                      >
                        ● Đặt mang đi
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderMode('delivery')}
                        className={cn(
                          'py-2 px-3 rounded-[10px] text-xs font-bold border transition-all cursor-pointer',
                          orderMode === 'delivery'
                            ? 'border-primary bg-primary text-white shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                        )}
                      >
                        ○ Giao tận nơi
                      </button>
                    </div>
                  </div>

                  {/* Pickup Time Mode Pills */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-2">
                      Thời gian nhận hàng
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTimeMode('asap')}
                        className={cn(
                          'py-2 px-3 rounded-[10px] text-xs font-semibold border transition-all cursor-pointer',
                          timeMode === 'asap'
                            ? 'border-primary bg-primary-light text-primary font-bold'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                        )}
                      >
                        Ngay bây giờ (15-20p)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeMode('scheduled')}
                        className={cn(
                          'py-2 px-3 rounded-[10px] text-xs font-semibold border transition-all cursor-pointer',
                          timeMode === 'scheduled'
                            ? 'border-primary bg-primary-light text-primary font-bold'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                        )}
                      >
                        Chọn giờ khác
                      </button>
                    </div>

                    {timeMode === 'scheduled' && (
                      <div className="mt-2">
                        <select
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-primary"
                        >
                          <option value="">-- Chọn khung giờ nhận hàng --</option>
                          {slotsQuery.data?.slots.map((slot) => {
                            const timeStr = new Date(slot.pickupAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            return (
                              <option key={slot.pickupAt} value={slot.pickupAt}>
                                {timeStr} (còn {slot.remaining} suất)
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Customer Info Form */}
                  <div className="space-y-3 pt-2 border-t border-border/80">
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Họ và tên người nhận *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Nguyễn Văn A"
                          className="pl-9 text-xs rounded-[10px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Số điện thoại nhận hàng *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="0912 345 678"
                          className="pl-9 text-xs rounded-[10px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Ghi chú đơn hàng (tùy chọn)
                      </label>
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ví dụ: Lấy nhiều đá riêng, gọi trước khi đến..."
                        className="w-full rounded-[10px] border border-border bg-card p-2.5 text-xs text-foreground focus:outline-primary placeholder:text-muted-foreground resize-none"
                      />
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-2 pt-3 border-t border-border/80 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tạm tính</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatPrice(subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Phí đóng gói</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatPrice(packagingFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-foreground pt-2 border-t border-border">
                      <span>Tổng cộng</span>
                      <span className="text-base text-primary tabular-nums">
                        {formatPrice(grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Cloudflare Turnstile Verification if configured */}
                  {turnstileSiteKey && (
                    <div className="pt-2">
                      <Turnstile
                        siteKey={turnstileSiteKey}
                        onToken={setCaptchaToken}
                      />
                    </div>
                  )}

                  {mutation.isError && (
                    <p className="text-xs text-destructive font-semibold">
                      {errorMessage(mutation.error)}
                    </p>
                  )}

                  {/* Checkout CTA */}
                  <Button
                    type="button"
                    onClick={handleCheckout}
                    disabled={mutation.isPending}
                    className="w-full h-11 rounded-[10px] bg-primary text-white hover:bg-primary-hover font-bold text-sm shadow-md"
                  >
                    {mutation.isPending
                      ? 'Đang gửi đơn hàng…'
                      : 'Tiến hành thanh toán'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
