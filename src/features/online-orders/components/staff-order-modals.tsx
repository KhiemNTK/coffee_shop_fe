import { useTranslation } from 'react-i18next'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, RefreshCw } from 'lucide-react'
import { collectOnlineOrder, trackOnlineOrder, type FulfillmentOrder } from '../online-orders.api'
import { decimalAmount, minorAmount } from '../cart'
import { formatPrice } from '../../../shared/lib/format'
import { ApiError, errorMessage } from '../../../shared/api/client'
import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '../../../shared/ui'

export function OrderReviewDialog({
  kind,
  name,
  onClose,
  onConfirm,
  isPending,
  blocked,
  error,
  onReview,
}: {
  kind: 'reject' | 'cancel' | 'no-show'
  name: string
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
  blocked: boolean
  error: string | null
  onReview: () => void
}) {
  const { t: translate } = useTranslation()
  const [reason, setReason] = useState('')
  const id = useId()
  const title = {
    reject: translate('takeaway.reject'),
    cancel: translate('takeaway.cancel'),
    'no-show': translate('takeaway.noShow'),
  }[kind]
  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="break-words">
          {title} {translate('takeaway.of')} {name}?
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!isPending && !blocked && (kind === 'no-show' || reason.trim().length >= 2))
            onConfirm(reason.trim())
        }}
      >
        {kind !== 'no-show' ? (
          <label htmlFor={id} className="block space-y-2">
            {translate('common.reason')}
            <Textarea
              id={id}
              required
              minLength={2}
              maxLength={200}
              value={reason}
              disabled={isPending || blocked}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        ) : (
          <p className="text-sm">{translate('takeaway.wasteWarning')}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {blocked && error && (
          <Button type="button" variant="outline" onClick={onReview}>
            <RefreshCw size={16} aria-hidden="true" />
            {translate('takeaway.reviewList')}
          </Button>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            {translate('common.back')}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="h-auto min-h-10 whitespace-normal"
            disabled={isPending || blocked || (kind !== 'no-show' && reason.trim().length < 2)}
          >
            {isPending ? translate('common.processing') : `Xác nhận ${title.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export function CollectOrderModal({
  order,
  onClose,
  onSuccess,
  onSettled,
}: {
  order: FulfillmentOrder
  onClose: () => void
  onSuccess: () => void
  onSettled: () => void
}) {
  const { t: translate } = useTranslation()
  const id = useId()
  const flight = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [accessToken, setAccessToken] = useState('')
  const [amountTendered, setAmountTendered] = useState(() =>
    decimalAmount(minorAmount(order.quotedSubtotal)),
  )
  const [submitted, setSubmitted] = useState<{
    accessToken: string
    amountTendered: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const validAmount = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(amountTendered.trim())
  const change = validAmount
    ? minorAmount(amountTendered.trim()) - minorAmount(order.quotedSubtotal)
    : 0n
  function showError(value: string) {
    setError(value)
    requestAnimationFrame(() => errorRef.current?.focus())
  }
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (payload: { accessToken: string; amountTendered: string }) =>
      collectOnlineOrder(order.id, payload),
    onError: (error) => {
      if (error instanceof ApiError && error.status < 500 && ![408, 409].includes(error.status))
        setSubmitted(null)
      showError(errorMessage(error))
    },
    onSettled: () => {
      flight.current = false
      onSettled()
    },
  })
  const recovery = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: () => trackOnlineOrder(order.id, submitted!.accessToken),
    onError: (error) => showError(errorMessage(error)),
    onSettled: () => {
      flight.current = false
    },
  })
  const resolved =
    recovery.isSuccess &&
    (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(recovery.data.status) ||
      recovery.data.fulfillmentStatus === 'COLLECTED')
  function close() {
    if (!flight.current && (!submitted || resolved)) onClose()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (flight.current || mutation.isSuccess || resolved) return
    let payload = submitted
    if (!payload) {
      const token = accessToken.trim().toLowerCase()
      if (!/^[0-9a-f]{64}$/.test(token)) {
        showError(translate('takeaway.invalidAccess'))
        return
      }
      if (!validAmount || change < 0n) {
        showError(translate('takeaway.invalidCash'))
        return
      }
      payload = {
        accessToken: token,
        amountTendered: decimalAmount(minorAmount(amountTendered.trim())),
      }
      setSubmitted(payload)
    }
    flight.current = true
    setError(null)
    recovery.reset()
    // The existing idempotency client recovers the key for this exact frozen body.
    mutation.mutate(payload)
  }
  return (
    <Dialog open onClose={mutation.isSuccess ? onSuccess : close} maxWidth="sm">
      <DialogHeader>
        <DialogTitle>{translate('takeaway.cashHeading')}</DialogTitle>
        <DialogDescription className="break-words">
          {order.pickupName} ({order.phoneNumber})
        </DialogDescription>
      </DialogHeader>
      {mutation.isSuccess ? (
        <div className="space-y-3">
          <p role="status">
            {translate('takeaway.collectedInvoice')} {mutation.data.invoiceNumber}
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>{translate('takeaway.totalDue')}</dt>
              <dd>{formatPrice(mutation.data.totalAmount)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>{translate('takeaway.cashReceived')}</dt>
              <dd>
                {mutation.data.amountTendered == null
                  ? translate('takeaway.unconfirmed')
                  : formatPrice(mutation.data.amountTendered)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>{translate('takeaway.change')}</dt>
              <dd>
                {mutation.data.changeAmount == null
                  ? translate('takeaway.unconfirmed')
                  : formatPrice(mutation.data.changeAmount)}
              </dd>
            </div>
          </dl>
          <Button onClick={onSuccess}>{translate('common.complete')}</Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-sm">
            {translate('takeaway.amountDuePrefix')}{' '}
            <strong>{formatPrice(order.quotedSubtotal)}</strong>
          </p>
          <fieldset disabled={mutation.isPending || Boolean(submitted)} className="space-y-3">
            <label htmlFor={`${id}-token`} className="block space-y-1">
              {translate('takeaway.customerAccess')}
              <Input
                id={`${id}-token`}
                type="password"
                autoComplete="off"
                required
                maxLength={64}
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
              />
            </label>
            <label htmlFor={`${id}-amount`} className="block space-y-1">
              {translate('takeaway.cashInput')}
              <Input
                id={`${id}-amount`}
                type="number"
                required
                min="0"
                step="0.01"
                value={amountTendered}
                onChange={(event) => setAmountTendered(event.target.value)}
              />
            </label>
          </fieldset>
          <p className="text-sm">
            {translate('takeaway.estimatedChange')}{' '}
            {formatPrice(decimalAmount(change > 0n ? change : 0n))}
          </p>
          {error && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {submitted && !mutation.isPending && (
            <>
              <p className="text-sm">
                {resolved
                  ? translate('takeaway.endedWarning')
                  : translate('takeaway.cashUncertain')}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-10 max-w-full whitespace-normal"
                disabled={recovery.isPending}
                onClick={() => {
                  if (!flight.current) {
                    flight.current = true
                    recovery.mutate()
                  }
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {translate('takeaway.reviewStatus')}
              </Button>
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                mutation.isPending || recovery.isPending || (Boolean(submitted) && !resolved)
              }
              onClick={close}
            >
              {translate('common.back')}
            </Button>
            <Button
              type="submit"
              className="h-auto min-h-10 whitespace-normal"
              disabled={mutation.isPending || recovery.isPending || resolved}
            >
              <Check size={16} aria-hidden="true" className="shrink-0" />
              {mutation.isPending
                ? translate('common.processing')
                : submitted
                  ? translate('takeaway.retryCash')
                  : translate('takeaway.confirmCollect')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
