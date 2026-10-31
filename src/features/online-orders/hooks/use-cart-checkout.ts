import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRetryAfter } from '@/shared/api/use-retry-after'
import { ApiError } from '@/shared/api/client'
import { minorAmount } from '@/shared/lib/money'
import type { MenuItem } from '@/features/menu/menu.api'
import { customerKey, useCustomer } from '@/features/customers/customers.api'
import { getOnlineRecommendations } from '@/features/recommendations/recommendations.api'
import {
  createOnlineOrder, recoverOnlineOrder, findPendingOnlineOrderKey, getPickupSlots,
  getOnlineAvailability, quoteOnlineOrder, type OnlineOrderQuote, type CreateOnlineOrderPayload,
} from '../online-orders.api'
import { cartSubtotal, type CartItem } from '../cart'
import type { CartCheckoutProps } from '../online-orders.types'

const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

export function useCartCheckout({ cart, onClose, onAppendItems, onOrderCreated }:
  Pick<CartCheckoutProps, 'cart' | 'onClose' | 'onAppendItems' | 'onOrderCreated'>) {
  const { t: translate } = useTranslation()
  const customer = useCustomer()
  const client = useQueryClient()

  // Form fields
  const [pickupName, setPickupName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [todayStr] = useState(() =>
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  )
  const [pickupDate, setPickupDate] = useState(todayStr)
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const [formError, setFormError] = useState<unknown>(null)
  const retryWait = useRetryAfter(formError)
  const [review, setReview] = useState<{
    payload: CreateOnlineOrderPayload
    allowRecommendations: boolean
  } | null>(null)
  const [extras, setExtras] = useState<CartItem[]>([])
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [submittedPayload, setSubmittedPayload] = useState<CreateOnlineOrderPayload | null>(null)
  const [recoveryMissing, setRecoveryMissing] = useState(false)
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
  const recovering = locked && !recoveryMissing
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
      return {
        payload: { ...payload, clientRequestId },
        allowRecommendations: !pendingKey,
      }
    },
    onSuccess: (result) => {
      setReview(result)
      if (!result.allowRecommendations) {
        uncertain.current = true
        setSubmittedPayload(result.payload)
        setRecoveryMissing(false)
      }
    },
    onError: (error) => setFormError(error),
    onSettled: () => {
      flight.current = false
    },
  })

  const recommendationItemIds = [
    ...new Set(review?.payload.items.map((item) => item.menuItemId) ?? []),
  ]
  const offers = useQuery({
    queryKey: ['online-recommendations', review?.payload.clientRequestId],
    queryFn: ({ signal }) =>
      getOnlineRecommendations(review!.payload.clientRequestId!, recommendationItemIds, signal),
    enabled: query =>
      Boolean(review?.allowRecommendations) &&
      recommendationItemIds.length <= 10 &&
      !locked &&
      query.state.status !== 'error' &&
      query.state.data?.variant !== 'CONTROL',
    retry: false,
    staleTime: 30_000,
    gcTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
  const recommendations = offers.isError ? [] : offers.data?.recommendations ?? []

  // Fetch slots if scheduled pickup is selected
  const slotsQuery = useQuery({
    queryKey: ['pickup-slots', pickupDate],
    queryFn: ({ signal }) => getPickupSlots(pickupDate, signal),
    enabled: isScheduled,
  })

  const submitMutation = useMutation({
    mutationFn: ({
      payload,
      recoverOnly,
    }: {
      payload: CreateOnlineOrderPayload
      recoverOnly: boolean
    }) => (recoverOnly ? recoverOnlineOrder(payload) : createOnlineOrder(payload)),
    onSuccess: (data, { payload }) => {
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
      setRecoveryMissing(err instanceof ApiError && err.code === 'ONLINE_ORDER_RECOVERY_NOT_FOUND')
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.code === 'CUSTOMER_SESSION_CHANGED')
      )
        void client.invalidateQueries({ queryKey: customerKey })
      setFormError(err)
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (retryWait || flight.current) return
    setFormError(null)
    if (customer.isPending || customer.isError) {
      setFormError(translate('customer.checkSession'))
      return
    }

    if (review) {
      if (!recovering && turnstileSiteKey && !turnstileToken) return
      if (!recovering && import.meta.env.PROD && !turnstileSiteKey) return
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
            currentQuote.items.some(
              (line, index) =>
                line.menuItemId !== payload.items[index]?.menuItemId ||
                line.quantity !== payload.items[index]?.quantity
            )
          )
            throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
          if (!currentQuote.canFulfill) {
            setFormError(translate('error.insufficientStock'))
            flight.current = false
            return
          }
          setQuote({ basketKey, data: currentQuote })
          const pricesChanged = currentQuote.items.some(
            (line, index) =>
              minorAmount(line.unitPrice) !==
              minorAmount(
                activeQuote?.items[index]?.unitPrice ?? checkoutCart[index]!.calculatedUnitPrice
              )
          )
          if (
            pricesChanged ||
            minorAmount(currentQuote.subtotal) !== minorAmount(payload.maxSubtotal!)
          ) {
            setFormError(translate('takeaway.priceChanged'))
            flight.current = false
            return
          }
        }
      } catch (error) {
        setFormError(error)
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
        payload: { ...payload, turnstileToken: turnstileToken || undefined },
        recoverOnly: recovering,
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

  return {
    translate,
    customer,
    pickupName,
    setPickupName,
    phoneNumber,
    setPhoneNumber,
    isScheduled,
    setIsScheduled,
    todayStr,
    pickupDate,
    setPickupDate,
    selectedSlotTime,
    setSelectedSlotTime,
    turnstileToken,
    setTurnstileToken,
    captchaAttempt,
    formError,
    setFormError,
    retryWait,
    review,
    setReview,
    extras,
    setExtras,
    customizingItem,
    setCustomizingItem,
    checkingQuote,
    errorRef,
    checkoutCart,
    items,
    activeQuote,
    subtotal,
    locked,
    recovering,
    availability,
    intakeReady,
    closeDrawer,
    reviewMutation,
    offers,
    recommendations,
    slotsQuery,
    submitMutation,
    handleSubmit,
    turnstileSiteKey,
  }
}
