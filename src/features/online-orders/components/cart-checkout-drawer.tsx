import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, ArrowRight, Minus, Phone, Plus, ShoppingBag, Trash2, User, X } from 'lucide-react'
import { formatPrice, type MenuItem } from '../../menu/menu.api'
import { createOnlineOrder, getPickupSlots, type CreateOnlineOrderPayload } from '../online-orders.api'
import { getOnlineRecommendations } from '../../recommendations/recommendations.api'
import { Turnstile } from '../../auth/turnstile'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { findPendingOperationKey } from '../../../shared/api/idempotency'
import { Button, Dialog, Input, cn } from '../../../shared/ui'
import { ItemCustomizerModal } from './item-customizer-modal'
import { cartSubtotal, type CartItem } from '../cart'
import { formatLineAmount } from '../../../shared/lib/format'

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export function CartCheckoutDrawer({
  cart,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onAppendItems,
  onOrderCreated,
}: {
  cart: CartItem[]
  onClose: () => void
  onUpdateQuantity: (id: string, delta: number) => void
  onRemoveItem: (id: string) => void
  onAppendItems: (items: CartItem[]) => void
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
  const [review, setReview] = useState<{ payload: CreateOnlineOrderPayload; recommendations: MenuItem[]; warning: string | null } | null>(null)
  const [extras, setExtras] = useState<CartItem[]>([])
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [submittedPayload, setSubmittedPayload] = useState<CreateOnlineOrderPayload | null>(null)
  const flight = useRef(false)
  const uncertain = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const checkoutCart = [...cart, ...extras]
  const subtotal = cartSubtotal(checkoutCart)
  const locked = submittedPayload !== null
  function closeDrawer() {
    if (flight.current || locked) return
    onAppendItems(extras)
    onClose()
  }

  useEffect(() => { if (formError) errorRef.current?.focus() }, [formError])

  const reviewMutation = useMutation({
    mutationFn: async (payload: CreateOnlineOrderPayload) => {
      const pendingKey = await findPendingOperationKey('/online-orders/requests', { ...payload }, false)
      const clientRequestId = pendingKey ?? crypto.randomUUID()
      const menuItemIds = [...new Set(payload.items.map(item => item.menuItemId))]
      let recommendations: MenuItem[] = []
      let warning: string | null = null
      if (!pendingKey && menuItemIds.length <= 10) {
        try { recommendations = (await getOnlineRecommendations(clientRequestId, menuItemIds)).recommendations }
        catch { warning = 'Gợi ý tạm thời không khả dụng. Bạn vẫn có thể gửi đơn.' }
      }
      return { payload: { ...payload, clientRequestId }, recommendations, warning }
    },
    onSuccess: setReview,
    onError: error => setFormError(errorMessage(error)),
    onSettled: () => { flight.current = false },
  })

  // Fetch slots if scheduled pickup is selected
  const slotsQuery = useQuery({
    queryKey: ['pickup-slots', pickupDate],
    queryFn: ({ signal }) => getPickupSlots(pickupDate, signal),
    enabled: isScheduled,
  })

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
      if (!uncertain.current && err instanceof ApiError && err.status >= 400 && err.status < 500 &&
        err.status !== 408 && err.status !== 429) setSubmittedPayload(null)
      else uncertain.current = true
    },
    onSettled: () => {
      setTurnstileToken('')
      setCaptchaAttempt((value) => value + 1)
      flight.current = false
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (flight.current) return
    setFormError(null)

    if (review) {
      if (turnstileSiteKey && !turnstileToken) return
      if (import.meta.env.PROD && !turnstileSiteKey) return
      const payload = submittedPayload ?? {
        ...review.payload,
        maxSubtotal: subtotal,
        items: checkoutCart.map(item => ({
          menuItemId: item.menuItem.id, quantity: item.quantity,
          note: item.note || undefined,
          optionIds: item.selectedOptionIds.length ? item.selectedOptionIds : undefined,
        })),
      }
      flight.current = true
      try {
        const pendingKey = await findPendingOperationKey('/online-orders/requests', { ...payload }, false)
        uncertain.current ||= Boolean(pendingKey)
        if (pendingKey && pendingKey !== payload.clientRequestId) {
          setSubmittedPayload({ ...payload, clientRequestId: pendingKey })
          setFormError('Đã khôi phục lần gửi cùng nội dung chưa xác nhận. Bấm gửi lại để kiểm tra kết quả cũ.')
          flight.current = false
          return
        }
      } catch (error) {
        setFormError(errorMessage(error))
        flight.current = false
        return
      }
      setSubmittedPayload(payload)
      submitMutation.mutate({ ...payload, turnstileToken: turnstileToken || undefined })
      return
    }

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

    if (cart.length > 20 || cart.reduce((sum, item) => sum + item.quantity, 0) > 50) {
      setFormError('Mỗi đơn tối đa 20 dòng món và 50 phần. Vui lòng giảm số lượng.')
      return
    }

    const payload: CreateOnlineOrderPayload = {
      pickupName: cleanName,
      phoneNumber: cleanPhone,
      pickupAt: isScheduled ? selectedSlotTime : undefined,
      maxSubtotal: subtotal,
      items: cart.map((it) => ({
        menuItemId: it.menuItem.id,
        quantity: it.quantity,
        note: it.note || undefined,
        optionIds: it.selectedOptionIds.length > 0 ? it.selectedOptionIds : undefined,
      })),
    }

    flight.current = true
    reviewMutation.mutate(payload)
  }

  return (
    <Dialog open onClose={closeDrawer}
      maxWidth="md" showCloseButton={false} className="m-0 ml-auto w-full max-w-md h-dvh max-h-dvh rounded-none p-0">
      <div className="w-full h-full min-h-0 bg-card shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Giỏ hàng mang đi</h2>
              <p className="text-xs text-muted-foreground">{checkoutCart.length} món đã chọn</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label="Đóng giỏ hàng" disabled={submitMutation.isPending || reviewMutation.isPending || locked} onClick={closeDrawer} className="h-11 w-11 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-6 flex-1 min-h-0 overflow-y-auto">
            {/* Cart Items List */}
            <div className="space-y-3">
              {checkoutCart.map((item) => (
                <div
                  key={item.id}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="break-words font-semibold text-sm text-foreground">
                        {item.menuItem.name}
                      </h4>
                      <p className="text-xs font-semibold text-brand-700 mt-0.5">
                        {formatPrice(String(item.calculatedUnitPrice))}
                      </p>
                      {item.selectedOptionIds.length > 0 && <p className="break-words text-xs text-muted-foreground">
                        {item.menuItem.optionGroups.flatMap(group => group.options).filter(option => item.selectedOptionIds.includes(option.id)).map(option => option.name).join(', ')}
                      </p>}
                    </div>
                    {!review && <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={Boolean(review) || reviewMutation.isPending}
                      aria-label={'Xóa ' + item.menuItem.name}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Xóa món"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>}
                  </div>

                  {item.note && (
                    <p className="text-xs text-muted-foreground italic bg-white/60 px-2 py-1 rounded border border-stone-200/50">
                      Ghi chú: {item.note}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {!review ? <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        disabled={Boolean(review) || reviewMutation.isPending}
                        aria-label={'Giảm số lượng ' + item.menuItem.name}
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
                        disabled={Boolean(review) || reviewMutation.isPending || item.quantity >= 20}
                        aria-label={'Tăng số lượng ' + item.menuItem.name}
                        className="h-6 w-6 rounded p-0 bg-white"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div> : <span className="text-sm">Số lượng: {item.quantity}</span>}

                    <span className="text-sm font-bold text-brand-800">
                      {formatLineAmount(item.calculatedUnitPrice, item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer form */}
            {!review && <fieldset disabled={reviewMutation.isPending} className="pt-4 border-t border-border space-y-4 min-w-0">
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
                    <label htmlFor="pickup-date" className="text-xs font-semibold text-foreground block mb-1">
                      Chọn ngày nhận
                    </label>
                    <input
                      type="date"
                      id="pickup-date"
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
                              timeZone: 'Asia/Ho_Chi_Minh',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            const isSelected = selectedSlotTime === slot.pickupAt
                            const isFull = slot.remaining <= 0
                            return (
                              <button
                                key={slot.pickupAt}
                                type="button"
                                aria-pressed={isSelected}
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

            </fieldset>}

            {review && <section className="space-y-2 border-t border-border pt-4" aria-label="Thông tin nhận hàng">
              <h3 className="text-sm font-semibold">Thông tin nhận hàng</h3>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-muted-foreground">Tên người nhận</dt><dd className="break-words font-medium">{review.payload.pickupName}</dd></div>
                <div><dt className="text-muted-foreground">Số điện thoại</dt><dd>{review.payload.phoneNumber}</dd></div>
                <div><dt className="text-muted-foreground">Thời gian lấy món</dt><dd>{review.payload.pickupAt
                  ? new Date(review.payload.pickupAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Lấy sớm nhất'}</dd></div>
              </dl>
            </section>}

            {review && <section aria-label="Xem lại đơn" className="space-y-3 border-t border-border pt-4">
              <h3 className="text-base font-semibold">Xem lại đơn</h3>
              {review.warning && <p role="status" className="text-sm text-muted-foreground">{review.warning}</p>}
              {!locked && review.recommendations.some(item => !checkoutCart.some(line => line.menuItem.id === item.id)) &&
                <section aria-label="Gọi kèm" className="space-y-2">
                  <h4 className="text-sm font-semibold">Gọi kèm</h4>
                  {review.recommendations.filter(item => !checkoutCart.some(line => line.menuItem.id === item.id)).map(item =>
                    <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border py-2">
                      <div className="min-w-0"><p className="break-words text-sm font-medium">{item.name}</p><p className="text-sm">{formatPrice(item.price)}</p></div>
                      <Button type="button" variant="outline" size="sm" aria-label={'Thêm ' + item.name}
                        disabled={submitMutation.isPending || checkoutCart.length >= 20 || checkoutCart.reduce((sum, line) => sum + line.quantity, 0) >= 50}
                        onClick={() => setCustomizingItem(item)}><Plus size={16} aria-hidden="true" />Thêm</Button>
                    </div>)}
                </section>}
              {extras.length > 0 && !locked && <div className="flex flex-wrap gap-2">
                {extras.map(item => <Button key={item.id} type="button" variant="ghost" size="sm" disabled={submitMutation.isPending}
                  onClick={() => setExtras(previous => previous.filter(line => line.id !== item.id))}>
                  <X size={16} aria-hidden="true" />Bỏ {item.menuItem.name}</Button>)}
              </div>}
              {!locked && <Button type="button" variant="outline" disabled={submitMutation.isPending}
                onClick={() => { onAppendItems(extras); setReview(null); setExtras([]); setFormError(null) }}><ArrowLeft size={16} aria-hidden="true" />Chỉnh sửa đơn</Button>}
              {locked && !submitMutation.isPending && <p role="status" className="text-sm">Chưa xác nhận được kết quả. Gửi lại cùng đơn để kiểm tra; không tạo đơn mới.</p>}
            </section>}

              {turnstileSiteKey && review && (
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
                <div role="alert" tabIndex={-1} ref={errorRef} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-border bg-stone-50 mt-auto space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Tổng dự kiến:</span>
              <span className="text-xl font-bold text-brand-800">
                {formatPrice(String(subtotal))}
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-bold"
              disabled={submitMutation.isPending || reviewMutation.isPending || cart.length === 0 || Boolean(review && turnstileSiteKey && !turnstileToken) || (import.meta.env.PROD && !turnstileSiteKey)}
              isLoading={submitMutation.isPending || reviewMutation.isPending}
            >
              <ArrowRight size={16} aria-hidden="true" />{review ? (locked ? 'Gửi lại đơn' : 'Gửi đơn mang đi') : 'Xem lại đơn'}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Thanh toán tiền mặt trực tiếp khi nhận hàng tại quầy.
            </p>
          </div>
        </form>
        {customizingItem && <ItemCustomizerModal item={customizingItem} onClose={() => setCustomizingItem(null)}
          onConfirm={item => {
            if (checkoutCart.length >= 20 || checkoutCart.reduce((sum, line) => sum + line.quantity, 0) + item.quantity > 50) {
              setFormError('Mỗi đơn tối đa 20 dòng món và 50 phần.')
              setCustomizingItem(null)
              return
            }
            setExtras(previous => [...previous, item])
            setCustomizingItem(null)
          }} />}
      </div>
    </Dialog>
  )
}
