import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import {
  createOnlineOrder,
  readOnlineOrderRecovery,
  recoverOnlineOrderByKey,
  type CreateOrderResponse,
} from './online-orders.api'
import { useCustomer } from '../customers/customers.api'
import { ApiError, errorMessage } from '../../shared/api/client'
import { Button, Input } from '../../shared/ui'
import { authConfig } from '../auth/auth.config'
import { Turnstile } from '../auth/turnstile'
import { rememberOrder, type OrderAccess } from './order-access-storage'
import { OrderTrackingView } from '@/features/online-orders/order-tracking-view'
import { useCart } from './cart'
import { SiteHeader } from '@/features/storefront/site-header'

export default function OnlineOrderRecoveryGate() {
  const location = useLocation()
  return <RecoveryGate key={location.key} />
}

function RecoveryGate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cart = useCart()
  const [saved] = useState(() => {
    try {
      return { intent: readOnlineOrderRecovery(), invalid: false }
    } catch {
      return { intent: null, invalid: true }
    }
  })
  const [recovered, setRecovered] = useState<OrderAccess | null>(null)
  const [captcha, setCaptcha] = useState('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const customer = useCustomer()
  const proof = saved.intent?.payload
  const mismatch = Boolean(
    proof?.expectedCustomerId && proof.expectedCustomerId !== customer.data?.id,
  )
  function success(result: CreateOrderResponse) {
    for (const item of cart.items)
      if (
        proof?.draft?.items.some(
          (line) =>
            line.menuItemId === item.menuItem.id &&
            line.quantity === item.quantity &&
            (line.note?.trim() ?? '') === item.note.trim() &&
            [...(line.optionIds ?? [])].sort().join(',') ===
              [...item.selectedOptionIds].sort().join(','),
        )
      )
        cart.removeItem(item.id)
    if (proof?.expectedCustomerId) {
      navigate(`/account/orders/${result.requestId}`, { replace: true })
      return
    }
    const access = {
      requestId: result.requestId,
      accessToken: result.accessToken,
      accessExpiresAt: result.accessExpiresAt,
    }
    setRecovered(access)
    try {
      rememberOrder(access)
    } catch {
      /* The receipt remains visible for download. */
    }
  }
  const recovery = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: () => recoverOnlineOrderByKey(proof!),
    onSuccess: success,
  })
  const resend = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: (values: FormData) =>
      createOnlineOrder({
        ...proof!.draft!,
        clientRequestId: proof!.clientRequestId,
        expectedCustomerId: proof!.expectedCustomerId,
        pickupName: String(values.get('pickupName')).trim(),
        phoneNumber: String(values.get('phoneNumber')).trim(),
        turnstileToken: captcha || undefined,
      }),
    onSuccess: success,
    onSettled: () => {
      setCaptcha('')
      setCaptchaAttempt((value) => value + 1)
    },
  })
  const missing =
    recovery.error instanceof ApiError && recovery.error.code === 'ONLINE_ORDER_RECOVERY_NOT_FOUND'
  const blocked =
    Boolean(proof?.expectedCustomerId && (customer.isPending || customer.isError || mismatch)) ||
    resend.isPending ||
    recovery.isPending
  if (!saved.intent && !saved.invalid) return <Outlet />
  if (recovered)
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <OrderTrackingView
            orderAuth={recovered}
            onNewOrder={() => navigate('/cart', { replace: true })}
          />
        </main>
      </>
    )
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl space-y-4 px-4 py-8">
        <h1 className="text-xl font-semibold">{t('takeaway.pendingRecovery')}</h1>
        <p role="status" className="text-sm text-muted-foreground">
          {t('takeaway.pendingRecoveryInfo')}
        </p>
        {saved.invalid ? (
          <p role="alert">{t('takeaway.invalidRecovery')}</p>
        ) : (
          <>
            {mismatch && !customer.isPending && <p role="alert">{t('wishlist.accountChanged')}</p>}
            {customer.isError && (
              <Button variant="outline" onClick={() => void customer.refetch()}>
                {t('common.retry')}
              </Button>
            )}
            <Button
              disabled={blocked}
              isLoading={recovery.isPending}
              onClick={() => recovery.mutate()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {t('takeaway.checkSubmitted')}
            </Button>
            {recovery.isError && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(recovery.error)}
              </p>
            )}
            {missing && proof?.draft && (
              <form
                className="space-y-3 border-t border-border pt-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (
                    !blocked &&
                    (!import.meta.env.PROD || authConfig.turnstileSiteKey) &&
                    (!authConfig.turnstileSiteKey || captcha)
                  )
                    resend.mutate(new FormData(event.currentTarget))
                }}
              >
                <p className="text-sm">{t('takeaway.recoveryResendInfo')}</p>
                <label className="block space-y-1 text-sm">
                  {t('common.recipient')}
                  <Input
                    name="pickupName"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    disabled={blocked}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  {t('common.phone')}
                  <Input
                    name="phoneNumber"
                    type="tel"
                    required
                    pattern="[+]?[0-9]{8,15}"
                    autoComplete="tel"
                    disabled={blocked}
                  />
                </label>
                {authConfig.turnstileSiteKey && (
                  <Turnstile
                    key={captchaAttempt}
                    siteKey={authConfig.turnstileSiteKey}
                    action="online_order"
                    onToken={setCaptcha}
                  />
                )}
                {import.meta.env.PROD && !authConfig.turnstileSiteKey && (
                  <p role="alert">{t('auth.verificationUnavailable')}</p>
                )}
                {resend.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorMessage(resend.error)}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    blocked ||
                    Boolean(authConfig.turnstileSiteKey && !captcha) ||
                    (import.meta.env.PROD && !authConfig.turnstileSiteKey)
                  }
                  isLoading={resend.isPending}
                >
                  {t('takeaway.resend')}
                </Button>
              </form>
            )}
          </>
        )}
        <Link
          to="/account"
          className="inline-flex min-h-11 items-center text-sm text-primary underline"
        >
          {t('customer.account')}
        </Link>
      </main>
    </>
  )
}
