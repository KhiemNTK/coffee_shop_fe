import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { formatPrice, type MenuItem } from '../../menu/menu.api'
import {
  createOnlineOrder,
  findPendingOnlineOrderKey,
  getPickupSlots,
  getOnlineAvailability,
  quoteOnlineOrder,
  type OnlineOrderQuote,
  type CreateOnlineOrderPayload,
} from '../online-orders.api'
import { getOnlineRecommendations } from '../../recommendations/recommendations.api'
import { Turnstile } from '../../auth/turnstile'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { customerKey, useCustomer } from '../../customers/customers.api'
import { Button, Dialog, Input, cn } from '../../../shared/ui'
import { ItemCustomizerModal } from './item-customizer-modal'
import { BasketQuotePreview } from './basket-quote-preview'
import { cartSubtotal, type CartItem } from '../cart'
import { formatLineAmount } from '../../../shared/lib/format'
import { minorAmount } from '../../../shared/lib/money'
import { displayLocale } from '../../../shared/i18n/index.js'
import { formatStoreDateTime } from '../../../shared/lib/store-time.js'
import type { OrderAccess } from '../order-access-storage'

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
  onOrderCreated: (order: OrderAccess) => void
}) {
  const { t: translate } = useTranslation()
  const customer = useCustomer()
  const client = useQueryClient()

  // Form fields
  const [pickupName, setPickupName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [todayStr] = useState(() =>
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }),
  )
  const [pickupDate, setPickupDate] = useState(todayStr)
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [review, setReview] = useState<{
    payload: CreateOnlineOrderPayload
    recommendations: MenuItem[]
    warning: string | null
  } | null>(null)
  const [extras, setExtras] = useState<CartItem[]>([])
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [submittedPayload, setSubmittedPayload] = useState<CreateOnlineOrderPayload | null>(null)
  const [quote, setQuote] = useState<{ basketKey: string; data: OnlineOrderQuote } | null>(null)
  const [checkingQuote, setCheckingQuote] = useState(false)
  const flight = useRef(false)
  const uncertain = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const checkoutCart = [...cart, ...extras]
  const items = checkoutCart.map((item) => ({
    menuItemId: item.menuItem.id,
    quantity: item.quantity,
    note: item.note || undefined,
    optionIds: item.selectedOptionIds.length ? item.selectedOptionIds : undefined,
  }))
  const basketKey = JSON.stringify(items)
  const activeQuote = quote?.basketKey === basketKey ? quote.data : null
  const subtotal = activeQuote?.subtotal ?? cartSubtotal(checkoutCart)
  const locked = submittedPayload !== null
  const availability = useQuery({
    queryKey: ['online-availability'],
    queryFn: ({ signal }) => getOnlineAvailability(signal),
    enabled: !locked,
    staleTime: 0,
    refetchInterval: 30_000,
  })
  const intakeReady =
    availability.isSuccess &&
    !availability.isError &&
    availability.data.acceptingOrders &&
    (isScheduled || availability.data.acceptingAsap)
  function closeDrawer() {
    if (flight.current || locked) return
    onAppendItems(extras)
    onClose()
  }

  useEffect(() => {
    if (formError) errorRef.current?.focus()
  }, [formError])

  const reviewMutation = useMutation({
    mutationFn: async (payload: CreateOnlineOrderPayload) => {
      const pendingKey = await findPendingOnlineOrderKey(payload)
      const clientRequestId = pendingKey ?? crypto.randomUUID()
      const menuItemIds = [...new Set(payload.items.map((item) => item.menuItemId))]
      let recommendations: MenuItem[] = []
      let warning: string | null = null
      if (!pendingKey && menuItemIds.length <= 10) {
        try {
          recommendations = (await getOnlineRecommendations(clientRequestId, menuItemIds))
            .recommendations
        } catch {
          warning = translate('takeaway.recommendationsUnavailable')
        }
      }
      return {
        payload: { ...payload, clientRequestId },
        recommendations,
        warning,
      }
    },
    onSuccess: setReview,
    onError: (error) => setFormError(errorMessage(error)),
    onSettled: () => {
      flight.current = false
    },
  })

  // Fetch slots if scheduled pickup is selected
  const slotsQuery = useQuery({
    queryKey: ['pickup-slots', pickupDate],
    queryFn: ({ signal }) => getPickupSlots(pickupDate, signal),
    enabled: isScheduled,
  })

  const submitMutation = useMutation({
    mutationFn: (payload: CreateOnlineOrderPayload) => createOnlineOrder(payload),
    onSuccess: (data, payload) => {
      if (payload.expectedCustomerId)
        void client.invalidateQueries({
          queryKey: ['customer', payload.expectedCustomerId, 'orders'],
        })
      onOrderCreated({
        customerId: payload.expectedCustomerId,
        requestId: data.requestId,
        accessToken: data.accessToken,
        accessExpiresAt: data.accessExpiresAt,
      })
    },
    onError: (err) => {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.code === 'CUSTOMER_SESSION_CHANGED')
      )
        void client.invalidateQueries({ queryKey: customerKey })
      setFormError(errorMessage(err))
      if (
        !uncertain.current &&
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      )
        setSubmittedPayload(null)
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
    if (customer.isPending || customer.isError) {
      setFormError(translate('customer.checkSession'))
      return
    }

    if (review) {
      if (turnstileSiteKey && !turnstileToken) return
      if (import.meta.env.PROD && !turnstileSiteKey) return
      const payload = submittedPayload ?? {
        ...review.payload,
        maxSubtotal: subtotal,
        items,
      }
      if ((payload.expectedCustomerId ?? null) !== (customer.data?.id ?? null)) {
        setFormError(translate('wishlist.accountChanged'))
        return
      }
      flight.current = true
      try {
        const pendingKey = await findPendingOnlineOrderKey(payload)
        uncertain.current ||= Boolean(pendingKey)
        if (pendingKey && pendingKey !== payload.clientRequestId) {
          setSubmittedPayload({ ...payload, clientRequestId: pendingKey })
          setFormError(translate('takeaway.restored'))
          flight.current = false
          return
        }
        // An uncertain write must replay its original body, even if stock or prices changed.
        if (!uncertain.current) {
          setCheckingQuote(true)
          const currentQuote = await quoteOnlineOrder(payload.items)
          if (
            currentQuote.items.length !== payload.items.length ||
            currentQuote.items.some((line, index) =>
              line.menuItemId !== payload.items[index]?.menuItemId ||
              line.quantity !== payload.items[index]?.quantity)
          ) throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
          if (!currentQuote.canFulfill) {
            setFormError(translate('error.insufficientStock'))
            flight.current = false
            return
          }
          setQuote({ basketKey, data: currentQuote })
          const pricesChanged = currentQuote.items.some((line, index) =>
            minorAmount(line.unitPrice) !== minorAmount(activeQuote?.items[index]?.unitPrice ?? checkoutCart[index]!.calculatedUnitPrice))
          if (pricesChanged || minorAmount(currentQuote.subtotal) !== minorAmount(payload.maxSubtotal!)) {
            setFormError(translate('takeaway.priceChanged'))
            flight.current = false
            return
          }
        }
      } catch (error) {
        setFormError(errorMessage(error))
        flight.current = false
        return
      } finally {
        setCheckingQuote(false)
      }
      if (!uncertain.current && !intakeReady) {
        setFormError(translate('takeaway.intakePaused'))
        flight.current = false
        return
      }
      setSubmittedPayload(payload)
      submitMutation.mutate({
        ...payload,
        turnstileToken: turnstileToken || undefined,
      })
      return
    }

    const cleanName = pickupName.trim()
    const cleanPhone = phoneNumber.trim()

    if (cleanName.length < 2) {
      setFormError(translate('takeaway.invalidName'))
      return
    }
    if (!/^\+?[0-9]{8,15}$/.test(cleanPhone)) {
      setFormError(translate('takeaway.invalidPhone'))
      return
    }

    if (isScheduled && !selectedSlotTime) {
      setFormError(translate('takeaway.chooseSlot'))
      return
    }

    if (cart.length === 0) {
      setFormError(translate('takeaway.emptyCart'))
      return
    }

    if (cart.length > 20 || cart.reduce((sum, item) => sum + item.quantity, 0) > 50) {
      setFormError(translate('takeaway.limitsExceeded'))
      return
    }

    const payload: CreateOnlineOrderPayload = {
      ...(customer.data ? { expectedCustomerId: customer.data.id } : {}),
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
    <Dialog
      open
      onClose={closeDrawer}
      maxWidth="md"
      showCloseButton={false}
      className="m-0 ml-auto w-full max-w-md h-dvh max-h-dvh rounded-none p-0"
    >
      <div className="w-full h-full min-h-0 bg-card shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{translate('takeaway.cart')}</h2>
              <p className="text-xs text-muted-foreground">
                {checkoutCart.length} {translate('takeaway.selectedItems')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={translate('takeaway.closeCart')}
            disabled={submitMutation.isPending || reviewMutation.isPending || checkingQuote || locked}
            onClick={closeDrawer}
            className="h-11 w-11 p-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-6 flex-1 min-h-0 overflow-y-auto">
            <section
              className="space-y-2 border-b border-border pb-4 text-sm"
              aria-label={translate('customer.account')}
            >
              {customer.isPending ? (
                <p role="status">{translate('common.loading')}</p>
              ) : customer.isError ? (
                <>
                  <p role="alert">{translate('customer.checkSession')}</p>
                  <Button type="button" variant="outline" onClick={() => void customer.refetch()}>
                    {translate('common.retry')}
                  </Button>
                </>
              ) : customer.data ? (
                <p className="break-words">
                  {translate('customer.checkoutAccount')}{' '}
                  <span className="break-all font-medium">{customer.data.email}</span>
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">{translate('customer.guestCheckout')}</p>
                  {!review && (
                    <Link
                      to="/customer/sign-in"
                      state={{ returnTo: '/cart' }}
                      className="inline-flex min-h-11 items-center font-medium text-primary underline"
                    >
                      {translate('wishlist.customerSignIn')}
                    </Link>
                  )}
                </>
              )}
            </section>
            {/* Cart Items List */}
            <div className="space-y-3">
              {checkoutCart.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <h4
                        className="break-words font-semibold text-sm text-foreground line-clamp-2 leading-snug"
                        title={item.menuItem.name}
                      >
                        {item.menuItem.name}
                      </h4>
                      <p className="text-xs font-semibold text-brand-700 mt-0.5 tabular-nums">
                        {formatPrice(activeQuote?.items[index]?.unitPrice ?? item.calculatedUnitPrice)}
                      </p>
                      {item.selectedOptionIds.length > 0 && (
                        <p className="break-words text-xs text-muted-foreground line-clamp-2">
                          {item.menuItem.optionGroups
                            .flatMap((group) => group.options)
                            .filter((option) => item.selectedOptionIds.includes(option.id))
                            .map((option) => option.name)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                    {!review && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={Boolean(review) || reviewMutation.isPending}
                        aria-label={translate('common.delete') + item.menuItem.name}
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={translate('takeaway.removeItem')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {item.note && (
                    <p className="text-xs text-muted-foreground italic bg-white/60 px-2 py-1 rounded border border-stone-200/50 break-words line-clamp-2">
                      {translate('common.notePrefix')} {item.note}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 gap-2">
                    {!review ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          disabled={Boolean(review) || reviewMutation.isPending}
                          aria-label={translate('common.decreaseQuantity') + item.menuItem.name}
                          className="h-6 w-6 rounded p-0 bg-white"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold min-w-5 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          disabled={
                            Boolean(review) || reviewMutation.isPending || item.quantity >= 20
                          }
                          aria-label={translate('common.increaseQuantity') + item.menuItem.name}
                          className="h-6 w-6 rounded p-0 bg-white"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm shrink-0">
                        {translate('takeaway.quantityPrefix')} {item.quantity}
                      </span>
                    )}

                    <span className="text-sm font-bold text-brand-800 tabular-nums shrink-0">
                      {formatLineAmount(activeQuote?.items[index]?.unitPrice ?? item.calculatedUnitPrice, item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {!locked && <BasketQuotePreview items={items} />}

            {/* Customer form */}
            {!review && (
              <fieldset
                disabled={reviewMutation.isPending}
                className="pt-4 border-t border-border space-y-4 min-w-0"
              >
                <h3 className="text-sm font-bold text-foreground">
                  {translate('takeaway.pickupDetails')}
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    <span id="pickup-name-label">{translate('common.recipient')}</span>{' '}
                    <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      aria-labelledby="pickup-name-label"
                      autoComplete="name"
                      minLength={2}
                      maxLength={80}
                      required
                      placeholder={translate('takeaway.recipientExample')}
                      value={pickupName}
                      onChange={(e) => setPickupName(e.target.value)}
                      className="pl-9"
                    />
                    <User className="h-4 w-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    <span id="pickup-phone-label">{translate('common.phone')}</span>{' '}
                    <span className="text-destructive">*</span>
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
                {availability.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorMessage(availability.error)}{' '}
                    <Button
                      type="button"
                      variant="link"
                      disabled={availability.isFetching}
                      onClick={() => void availability.refetch()}
                    >
                      {translate('common.retry')}
                    </Button>
                  </p>
                )}
                {availability.data && !availability.data.acceptingOrders && (
                  <p role="status" className="text-sm">
                    {translate('takeaway.intakePaused')}
                    {availability.data.reason && <span className="block break-words">{availability.data.reason}</span>}
                  </p>
                )}
                {availability.data?.acceptingOrders && !availability.data.acceptingAsap && (
                  <p role="status" className="text-sm">
                    {translate('takeaway.asapClosed', {
                      open: availability.data.asapOpenLocal,
                      close: availability.data.asapCloseLocal,
                    })}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {translate('takeaway.pickupTime')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={!isScheduled ? 'default' : 'outline'}
                      size="sm"
                      disabled={availability.data?.acceptingAsap === false}
                      onClick={() => {
                        setIsScheduled(false)
                        setSelectedSlotTime('')
                      }}
                      className="text-xs"
                    >
                      {translate('takeaway.asap')}
                    </Button>
                    <Button
                      type="button"
                      variant={isScheduled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsScheduled(true)}
                      className="text-xs"
                    >
                      {translate('takeaway.schedule')}
                    </Button>
                  </div>
                </div>

                {/* Slot selector when scheduled */}
                {isScheduled && (
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                    <div>
                      <label
                        htmlFor="pickup-date"
                        className="text-xs font-semibold text-foreground block mb-1"
                      >
                        {translate('takeaway.pickupDate')}
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
                      <p className="text-xs text-muted-foreground">
                        {translate('takeaway.checkingSlots')}
                      </p>
                    )}

                    {slotsQuery.data && !slotsQuery.data.enabled && (
                      <p className="text-xs text-destructive">
                        {translate('takeaway.scheduledDisabled')}
                      </p>
                    )}

                    {slotsQuery.data && slotsQuery.data.enabled && (
                      <div>
                        <span className="text-xs font-semibold text-foreground block mb-2">
                          {translate('takeaway.availableSlots')}
                        </span>
                        {slotsQuery.data.slots.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {translate('takeaway.noSlots')}
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                            {slotsQuery.data.slots.map((slot) => {
                              const timeStr = new Date(slot.pickupAt).toLocaleTimeString(
                                displayLocale(),
                                {
                                  timeZone: 'Asia/Ho_Chi_Minh',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )
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
                                    {isFull
                                      ? translate('takeaway.full')
                                      : translate('takeaway.remainingSlots', {
                                          count: slot.remaining,
                                        })}
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
              </fieldset>
            )}

            {review && (
              <section
                className="space-y-2 border-t border-border pt-4"
                aria-label={translate('takeaway.pickupDetails')}
              >
                <h3 className="text-sm font-semibold">{translate('takeaway.pickupDetails')}</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{translate('common.recipient')}</dt>
                    <dd className="break-words font-medium">{review.payload.pickupName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{translate('common.phone')}</dt>
                    <dd>{review.payload.phoneNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{translate('takeaway.pickupTime')}</dt>
                    <dd>
                      {review.payload.pickupAt
                        ? formatStoreDateTime(review.payload.pickupAt)
                        : translate('takeaway.asap')}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            {review && (
              <section
                aria-label={translate('takeaway.review')}
                className="space-y-3 border-t border-border pt-4"
              >
                <h3 className="text-base font-semibold">{translate('takeaway.review')}</h3>
                {review.warning && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {review.warning}
                  </p>
                )}
                {!locked &&
                  review.recommendations.some(
                    (item) => !checkoutCart.some((line) => line.menuItem.id === item.id),
                  ) && (
                    <section aria-label={translate('takeaway.addOn')} className="space-y-2">
                      <h4 className="text-sm font-semibold">{translate('takeaway.addOn')}</h4>
                      {review.recommendations
                        .filter(
                          (item) => !checkoutCart.some((line) => line.menuItem.id === item.id),
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 border-b border-border py-2"
                          >
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium">{item.name}</p>
                              <p className="text-sm">{formatPrice(item.price)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`${translate('common.add')} ${item.name}`}
                              disabled={
                                submitMutation.isPending ||
                                checkingQuote ||
                                checkoutCart.length >= 20 ||
                                checkoutCart.reduce((sum, line) => sum + line.quantity, 0) >= 50
                              }
                              onClick={() => setCustomizingItem(item)}
                            >
                              <Plus size={16} aria-hidden="true" />
                              {translate('common.add')}
                            </Button>
                          </div>
                        ))}
                    </section>
                  )}
                {extras.length > 0 && !locked && (
                  <div className="flex flex-wrap gap-2">
                    {extras.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={submitMutation.isPending || checkingQuote}
                        onClick={() =>
                          setExtras((previous) => previous.filter((line) => line.id !== item.id))
                        }
                      >
                        <X size={16} aria-hidden="true" />
                        {translate('common.remove')} {item.menuItem.name}
                      </Button>
                    ))}
                  </div>
                )}
                {!locked && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitMutation.isPending || checkingQuote}
                    onClick={() => {
                      onAppendItems(extras)
                      setReview(null)
                      setExtras([])
                      setFormError(null)
                    }}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {translate('takeaway.edit')}
                  </Button>
                )}
                {locked && !submitMutation.isPending && (
                  <p role="status" className="text-sm">
                    {translate('takeaway.uncertain')}
                  </p>
                )}
              </section>
            )}

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
              <div
                role="alert"
                tabIndex={-1}
                ref={errorRef}
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-border bg-stone-50 mt-auto space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                {translate('takeaway.quotedTotal')}
              </span>
              <span className="text-xl font-bold text-brand-800">
                {formatPrice(String(subtotal))}
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-bold"
              disabled={
                customer.isPending ||
                customer.isError ||
                submitMutation.isPending ||
                checkingQuote ||
                reviewMutation.isPending ||
                (!locked && !intakeReady) ||
                cart.length === 0 ||
                Boolean(review && turnstileSiteKey && !turnstileToken) ||
                (import.meta.env.PROD && !turnstileSiteKey)
              }
              isLoading={submitMutation.isPending || reviewMutation.isPending || checkingQuote}
            >
              <ArrowRight size={16} aria-hidden="true" />
              {review
                ? locked
                  ? translate('takeaway.resend')
                  : translate('takeaway.submit')
                : translate('takeaway.review')}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              {translate('takeaway.cashInfo')}
            </p>
          </div>
        </form>
        {customizingItem && (
          <ItemCustomizerModal
            item={customizingItem}
            onClose={() => setCustomizingItem(null)}
            onConfirm={(item) => {
              if (
                checkoutCart.length >= 20 ||
                checkoutCart.reduce((sum, line) => sum + line.quantity, 0) + item.quantity > 50
              ) {
                setFormError(translate('takeaway.limits'))
                setCustomizingItem(null)
                return
              }
              setExtras((previous) => [...previous, item])
              setCustomizingItem(null)
            }}
          />
        )}
      </div>
    </Dialog>
  )
}
