import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getReorderTemplate,
  createOnlineOrder,
  recoverOnlineOrder,
  findPendingOnlineOrderKey,
  revokeReorderKey,
  getOnlineAvailability,
  type CreateOnlineOrderPayload,
} from './online-orders.api'
import { ApiError, errorMessage } from '../../shared/api/client'
import { customerKey, useCustomer } from '../customers/customers.api'
import { getCustomerReorderTemplate } from '../customers/customer-orders.api'
import { CustomerSignIn } from '../customers/customer-sign-in'
import { OrderTrackingView } from './components/order-tracking-view'
import { rememberOrder } from './order-access-storage'
import { formatPrice } from '../../shared/lib/format'
import { Button, Input } from '../../shared/ui'
import { authConfig } from '../auth/auth.config'
import { Turnstile } from '../auth/turnstile'

export default function ReorderPage() {
  const { t: translate } = useTranslation()
  const customer = useCustomer()
  const client = useQueryClient()
  const { orderId } = useParams()
  const customerId = !customer.isError ? (customer.data?.id ?? '') : ''
  const customerTemplate = useQuery({
    queryKey: ['customer', customerId, 'reorder', orderId],
    queryFn: ({ signal }) => getCustomerReorderTemplate(customerId, orderId!, signal),
    enabled: Boolean(customerId && orderId),
    retry: false,
    staleTime: 0,
    gcTime: 60000,
  })
  useEffect(() => {
    const error = customerTemplate.error
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.code === 'CUSTOMER_SESSION_CHANGED')
    )
      void client.invalidateQueries({ queryKey: customerKey })
  }, [client, customerTemplate.error])
  const initial = new URLSearchParams(window.location.hash.slice(1))
  const [requestId, setRequestId] = useState(() => initial.get('requestId') ?? '')
  const [reorderToken, setReorderToken] = useState(() => initial.get('key') ?? '')
  const [captcha, setCaptcha] = useState('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const [submitted, setSubmitted] = useState<CreateOnlineOrderPayload | null>(null)
  const [recoveryMissing, setRecoveryMissing] = useState(false)
  const recovering = Boolean(submitted) && !recoveryMissing
  const [formError, setFormError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)
  const flight = useRef(false)
  const uncertain = useRef(false)
  const navigate = useNavigate()
  const template = useMutation({
    mutationFn: () => getReorderTemplate(requestId.trim(), reorderToken.trim()),
  })
  const templateData = orderId ? customerTemplate.data : template.data
  const templatePending = orderId ? customerTemplate.isFetching : template.isPending
  const templateError = orderId ? customerTemplate.error : template.error
  const revoke = useMutation({
    mutationFn: () => revokeReorderKey(requestId.trim(), reorderToken.trim()),
    onSuccess: () => {
      template.reset()
      setReorderToken('')
      window.history.replaceState(window.history.state, '', '/reorder')
    },
  })
  const order = useMutation({
    mutationFn: ({ payload, recoverOnly }: { payload: CreateOnlineOrderPayload; recoverOnly: boolean }) =>
      recoverOnly ? recoverOnlineOrder(payload) : createOnlineOrder(payload),
    onSuccess: (result, { payload }) => {
      if (payload.expectedCustomerId)
        void client.invalidateQueries({
          queryKey: ['customer', payload.expectedCustomerId, 'orders'],
        })
      if (payload.expectedCustomerId) {
        navigate(`/account/orders/${result.requestId}`)
        return
      }
      try {
        rememberOrder({
          requestId: result.requestId,
          accessToken: result.accessToken,
          accessExpiresAt: result.accessExpiresAt,
        })
      } catch {
        setStorageWarning(true)
        return
      }
      navigate('/order')
    },
    onError: (error) => {
      setRecoveryMissing(error instanceof ApiError && error.code === 'ONLINE_ORDER_RECOVERY_NOT_FOUND')
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.code === 'CUSTOMER_SESSION_CHANGED')
      )
        void client.invalidateQueries({ queryKey: customerKey })
      if (
        !uncertain.current &&
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      )
        setSubmitted(null)
      else uncertain.current = true
    },
    onSettled: () => {
      flight.current = false
      setCaptcha('')
      setCaptchaAttempt((attempt) => attempt + 1)
    },
  })
  const unavailable = import.meta.env.PROD && !authConfig.turnstileSiteKey
  const locked = order.isPending || Boolean(submitted)
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
    availability.data.acceptingAsap
  async function submit(values: FormData) {
    if (
      flight.current ||
      customer.isPending ||
      customer.isError ||
      (!recovering && unavailable) ||
      !templateData?.quote.canSubmit ||
      (!recovering && authConfig.turnstileSiteKey && !captcha)
    )
      return
    flight.current = true
    setFormError(null)
    const payload = submitted ?? {
      ...(customer.data ? { expectedCustomerId: customer.data.id } : {}),
      pickupName: String(values.get('name')).trim(),
      phoneNumber: String(values.get('phone')).trim(),
      items: templateData.items,
      maxSubtotal: templateData.quote.currentSubtotal!,
    }
    try {
      if ((payload.expectedCustomerId ?? null) !== (customer.data?.id ?? null))
        throw new ApiError(409, 'CUSTOMER_SESSION_CHANGED')
      const pendingKey = await findPendingOnlineOrderKey(payload)
      uncertain.current ||= Boolean(pendingKey)
      if (!uncertain.current && !intakeReady) {
        setFormError(translate('takeaway.intakePaused'))
        flight.current = false
        return
      }
      const intent = {
        ...payload,
        clientRequestId: pendingKey ?? payload.clientRequestId ?? crypto.randomUUID(),
      }
      setSubmitted(intent)
      order.mutate({
        payload: { ...intent, ...(captcha ? { turnstileToken: captcha } : {}) },
        recoverOnly: recovering,
      })
    } catch (error) {
      setFormError(errorMessage(error))
      flight.current = false
    }
  }
  if (orderId && !customerId && !customer.isError)
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <CustomerSignIn returnTo={`/account/orders/${orderId}/reorder`} />
      </main>
    )
  if (storageWarning && order.data)
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p role="alert">{translate('takeaway.reorderStorageWarning')}</p>
        <OrderTrackingView orderAuth={order.data} onNewOrder={() => navigate('/order')} />
      </main>
    )
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <Link to="/" className="font-semibold text-primary">
        Coffee Shop
      </Link>
      <h1 className="text-2xl font-bold">{translate('takeaway.reorderHeading')}</h1>
      {orderId ? (
        <Link
          to={`/account/orders/${orderId}`}
          className="inline-flex min-h-11 items-center text-sm text-primary underline"
        >
          {translate('customer.orderDetail')}
        </Link>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!flight.current && !locked && !templatePending && !revoke.isPending)
              template.mutate()
          }}
        >
          <label className="block text-sm">
            {translate('takeaway.orderCode')}
            <Input
              value={requestId}
              required
              disabled={locked || templatePending || revoke.isPending}
              onChange={(event) => {
                setRequestId(event.target.value)
                template.reset()
              }}
            />
          </label>
          <label className="block text-sm">
            {translate('takeaway.reorderKey')}
            <Input
              value={reorderToken}
              required
              type="password"
              autoComplete="off"
              pattern="[0-9a-f]{64}"
              disabled={locked || templatePending || revoke.isPending}
              onChange={(event) => {
                setReorderToken(event.target.value)
                template.reset()
              }}
            />
          </label>
          <Button type="submit" isLoading={templatePending} disabled={locked || revoke.isPending}>
            {translate('takeaway.checkCurrentPrices')}
          </Button>
        </form>
      )}
      {(customer.isPending || (orderId && customerTemplate.isPending)) && (
        <p role="status">{translate('common.loading')}</p>
      )}
      {customer.isError && (
        <>
          <p role="alert">{errorMessage(customer.error)}</p>
          <Button onClick={() => void customer.refetch()}>{translate('common.retry')}</Button>
        </>
      )}
      {orderId && customerTemplate.isError && (
        <Button
          disabled={customerTemplate.isFetching}
          onClick={() => void customerTemplate.refetch()}
        >
          {translate('common.retry')}
        </Button>
      )}
      {(templateError || order.error || revoke.error) && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(templateError || order.error || revoke.error)}
        </p>
      )}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {submitted && !order.isPending && (
        <p role="status">{translate('takeaway.reorderUncertain')}</p>
      )}
      {templateData && (
        <section className="space-y-4 border-t border-border pt-4">
          {templateData.quote.stockAvailable === false && (
            <p role="status" className="text-sm text-destructive">
              {translate('error.insufficientStock')}
            </p>
          )}
          <ul className="space-y-2">
            {templateData.quote.lines.map((line, index) => (
              <li key={line.lineNumber} className="border-b border-border py-2 text-sm">
                <p>
                  {line.currentName ?? line.previousName} × {templateData?.items[index]?.quantity}
                </p>
                <p>
                  {line.available
                    ? formatPrice(line.currentUnitPrice)
                    : translate('takeaway.unavailableItem')}
                </p>
                {line.currentUnitPrice !== line.previousUnitPrice && (
                  <p>
                    {translate('takeaway.previousPrice')} {formatPrice(line.previousUnitPrice)}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {templateData.quote.canSubmit ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void submit(new FormData(event.currentTarget))
              }}
            >
              <p className="font-semibold">
                {translate('takeaway.currentTotal')}{' '}
                {formatPrice(templateData.quote.currentSubtotal)}
              </p>
              <label className="block text-sm">
                {translate('common.recipient')}
                <Input
                  name="name"
                  minLength={2}
                  maxLength={80}
                  required
                  autoComplete="name"
                  disabled={locked}
                />
              </label>
              <label className="block text-sm">
                {translate('common.phoneShort')}
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  pattern="[+]?[0-9]{8,15}"
                  required
                  disabled={locked}
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
              {unavailable && !recovering && <p role="alert">{translate('takeaway.orderingUnavailable')}</p>}
              {availability.isError && (
                <p role="alert">
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
              {availability.data && !intakeReady && !locked && (
                <p role="status">
                  {availability.data.acceptingOrders
                    ? translate('takeaway.asapClosed', {
                        open: availability.data.asapOpenLocal,
                        close: availability.data.asapCloseLocal,
                      })
                    : translate('takeaway.intakePaused')}{' '}
                  <Link to="/order" className="underline">
                    {translate('takeaway.schedule')}
                  </Link>
                </p>
              )}
              <Button
                type="submit"
                isLoading={order.isPending}
                disabled={
                  customer.isPending ||
                  customer.isError ||
                  (!recovering && unavailable) ||
                  (!locked && !intakeReady) ||
                  templatePending ||
                  revoke.isPending ||
                  Boolean(!recovering && authConfig.turnstileSiteKey && !captcha)
                }
              >
                {submitted
                  ? translate('takeaway.checkSubmitted')
                  : translate('takeaway.reorderCod')}
              </Button>
            </form>
          ) : (
            <Link to="/order" className="font-semibold text-primary">
              {translate('takeaway.chooseOther')}
            </Link>
          )}
          {!orderId && (
            <Button
              variant="outline"
              isLoading={revoke.isPending}
              disabled={locked || templatePending}
              onClick={() => {
                if (!flight.current && window.confirm(translate('takeaway.revokeReorderInfo')))
                  revoke.mutate()
              }}
            >
              {translate('takeaway.revokeReorder')}
            </Button>
          )}
        </section>
      )}
    </main>
  )
}
