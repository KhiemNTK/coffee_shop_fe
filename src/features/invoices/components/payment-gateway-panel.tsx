import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  Check,
  Clock3,
  ExternalLink,
  Info,
  QrCode,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { Session } from '../../auth/session'
import { ApiError } from '../../../shared/api/client'
import { ApiErrorAlert } from '../../../shared/ui/api-error-alert'
import { useRetryAfter } from '../../../shared/api/use-retry-after'
import { formatDateTime, formatPrice } from '../../../shared/lib/format'
import { Button } from '../../../shared/ui'
import { PaymentQr } from '../../../shared/ui/payment-qr'
import {
  createPaymentAttempt,
  getInvoiceById,
  getInvoicePaymentAttempts,
  getPaymentProviders,
  reconcilePaymentAttempt,
  recoverPaymentLink,
  type CreatePaymentAttemptPayload,
  type Invoice,
  type PaymentAttempt,
  type PaymentProvider,
} from '../invoices.api'
import { AttemptStatusBadge, PaymentStatusBadge } from './invoice-badges'
import { isUnresolvedPayment, paymentProviderNames } from '../payment-status'
import { enableNotificationSound, playNotificationChime } from '../../../shared/lib/sound'
import { PaymentProviderMark } from './payment-provider-mark'

const soundedPayments = new Set<string>()
let paymentSoundEnabled = false

function stillPolling(attempt: PaymentAttempt) {
  return attempt.status === 'PENDING' && Date.now() < Date.parse(attempt.expiresAt) + 30_000
}

export function PaymentGatewayPanel({
  invoiceId,
  onPaid,
  onLockChange,
}: {
  invoiceId: string
  onPaid?: (invoice: Invoice) => void
  onLockChange?: (locked: boolean) => void
}) {
  const { t: translate, i18n } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const can = access.has
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<PaymentProvider>('VNPAY')
  const [submitted, setSubmitted] = useState<CreatePaymentAttemptPayload | null>(null)
  const [now, setNow] = useState(Date.now)
  const [soundEnabled, setSoundEnabled] = useState(() => paymentSoundEnabled)
  const [soundFailed, setSoundFailed] = useState(false)
  const flight = useRef(false)
  const notified = useRef(false)
  const observedUnpaid = useRef<string | null>(null)
  const qrFrame = useRef<HTMLDivElement>(null)
  const invoiceKey = ['private', employee.id, 'invoice-detail', invoiceId]
  const attemptsKey = ['private', employee.id, 'invoice-attempts', invoiceId]
  const providers = useQuery({
    queryKey: ['private', employee.id, 'payment-providers'],
    queryFn: ({ signal }) => getPaymentProviders(signal),
    enabled: can('/payment-attempts_read'),
  })
  const selectedProvider =
    providers.data?.find((item) => item.provider === provider && item.configured)?.provider ??
    providers.data?.find((item) => item.configured)?.provider
  const create = useMutation({
    mutationFn: (payload: CreatePaymentAttemptPayload) => createPaymentAttempt(invoiceId, payload),
    onSuccess: () => {
      setSubmitted(null)
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      )
        setSubmitted(null)
    },
    onSettled: () => {
      flight.current = false
      void queryClient.invalidateQueries({ queryKey: attemptsKey })
    },
  })
  const attempts = useQuery({
    queryKey: attemptsKey,
    queryFn: ({ signal }) => getInvoicePaymentAttempts(invoiceId, signal),
    enabled: can('/payment-attempts_read'),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.list.some(stillPolling) ? 4000 : false),
  })
  // Ordinary reads omit paymentUrl; keep links from explicit creation or recovery only.
  const history = attempts.data?.list ?? []
  const list =
    create.data && !history.some((attempt) => attempt.id === create.data.id)
      ? [create.data, ...history]
      : history
  const nextExpiry = Math.min(
    ...list
      .filter((attempt) => attempt.status === 'PENDING')
      .map((attempt) => Date.parse(attempt.expiresAt))
      .filter((expiry) => expiry > now),
  )
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextExpiry - Date.now()) + 10,
    )
    return () => window.clearTimeout(timer)
  }, [nextExpiry])
  const blocking = list.some((attempt) => isUnresolvedPayment(attempt.status))
  const invoice = useQuery({
    queryKey: invoiceKey,
    queryFn: ({ signal }) => getInvoiceById(invoiceId, signal),
    enabled: can('/invoices_read'),
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.paymentStatus === 'UNPAID' && list.some(stillPolling) ? 4000 : false,
  })
  const reconcile = useMutation({
    mutationFn: reconcilePaymentAttempt,
    onSettled: () => {
      flight.current = false
      void queryClient.invalidateQueries({ queryKey: attemptsKey })
      void queryClient.invalidateQueries({ queryKey: invoiceKey })
    },
  })
  const recovery = useMutation({
    mutationFn: recoverPaymentLink,
    retry: false,
    onSettled: () => {
      flight.current = false
      void queryClient.invalidateQueries({ queryKey: attemptsKey })
      void queryClient.invalidateQueries({ queryKey: invoiceKey })
    },
  })
  const terminalSnapshot = list
    .filter((attempt) => attempt.status !== 'PENDING')
    .map((attempt) => `${attempt.id}:${attempt.status}`)
    .join('|')
  useEffect(() => {
    if (create.data?.paymentUrl || recovery.data?.paymentUrl)
      qrFrame.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [create.data?.paymentUrl, recovery.data?.paymentUrl])
  useEffect(() => {
    if (terminalSnapshot)
      void queryClient.invalidateQueries({
        queryKey: ['private', employee.id, 'invoice-detail', invoiceId],
      })
  }, [terminalSnapshot, invoiceId, employee.id, queryClient])
  useEffect(() => {
    if (invoice.isError || invoice.isFetching) return
    if (invoice.data?.paymentStatus === 'UNPAID') observedUnpaid.current = invoiceId
    if (!invoice.isError && invoice.data?.paymentStatus === 'PAID' && !notified.current) {
      notified.current = true
      const soundKey = `${employee.id}:${invoiceId}`
      if (
        soundEnabled &&
        paymentSoundEnabled &&
        observedUnpaid.current === invoiceId &&
        invoice.data.paymentMethod === 'TRANSFER' &&
        !soundedPayments.has(soundKey)
      ) {
        if (playNotificationChime()) {
          soundedPayments.add(soundKey)
          if (soundedPayments.size > 100)
            soundedPayments.delete(soundedPayments.values().next().value!)
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'invoices'] })
      onPaid?.(invoice.data)
    }
  }, [
    invoice.data,
    invoice.isError,
    invoice.isFetching,
    invoiceId,
    onPaid,
    employee.id,
    queryClient,
    soundEnabled,
  ])

  const unresolvedSubmission =
    submitted &&
    (create.isPending ||
      !invoice.isSuccess ||
      invoice.isError ||
      invoice.data.paymentStatus === 'UNPAID')
      ? submitted
      : null
  useEffect(() => {
    onLockChange?.(
      create.isPending ||
        reconcile.isPending ||
        recovery.isPending ||
        Boolean(unresolvedSubmission),
    )
    return () => onLockChange?.(false)
  }, [
    create.isPending,
    reconcile.isPending,
    recovery.isPending,
    unresolvedSubmission,
    onLockChange,
  ])

  const busy = create.isPending || reconcile.isPending || recovery.isPending
  const failed =
    create.error ??
    reconcile.error ??
    recovery.error ??
    attempts.error ??
    invoice.error ??
    providers.error
  const retryWait = useRetryAfter(failed)
  const available =
    retryWait === 0 &&
    can('/payment-attempts_create') &&
    can('/payment-attempts_read') &&
    invoice.data?.paymentStatus === 'UNPAID' &&
    !attempts.isPending &&
    !attempts.isError &&
    !invoice.isError &&
    !attempts.isFetching &&
    !invoice.isFetching &&
    !providers.isFetching &&
    Boolean(selectedProvider) &&
    !providers.isError
  function handleCreate() {
    if (flight.current || busy || !available || (blocking && !unresolvedSubmission)) return
    flight.current = true
    const payload = unresolvedSubmission ?? {
      provider: selectedProvider!,
      locale: i18n.resolvedLanguage === 'en' ? 'en' : 'vn',
      closeSessionAfterPayment: true,
    }
    setSubmitted(payload)
    create.mutate(payload)
  }
  function handleReconcile(attemptId: string) {
    if (retryWait || flight.current || busy) return
    flight.current = true
    reconcile.mutate(attemptId)
  }

  return (
    <section className="grid min-w-0 gap-5" aria-label={translate('payment.gatewayTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <QrCode size={20} aria-hidden="true" className="shrink-0" />
          {translate('payment.gatewayTitle')}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-pressed={soundEnabled}
            aria-label={translate(soundEnabled ? 'payment.soundOff' : 'payment.soundOn')}
            title={translate(soundEnabled ? 'payment.soundOff' : 'payment.soundOn')}
            onClick={() => {
              if (soundEnabled) {
                paymentSoundEnabled = false
                setSoundEnabled(false)
                return
              }
              void enableNotificationSound().then((enabled) => {
                paymentSoundEnabled = enabled
                setSoundEnabled(enabled)
                setSoundFailed(!enabled)
                if (enabled) playNotificationChime()
              })
            }}
          >
            {soundEnabled ? (
              <Volume2 size={18} aria-hidden="true" />
            ) : (
              <VolumeX size={18} aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !can('/payment-attempts_read') ||
              !can('/invoices_read') ||
              retryWait > 0 ||
              busy ||
              attempts.isFetching ||
              invoice.isFetching
            }
            onClick={() => {
              void attempts.refetch()
              void invoice.refetch()
            }}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={
                attempts.isFetching || invoice.isFetching ? 'motion-safe:animate-spin' : ''
              }
            />
            {translate('payment.checkStatus')}
          </Button>
        </div>
      </div>
      {soundFailed && (
        <p role="status" className="text-sm text-muted-foreground">
          {translate('payment.soundUnavailable')}
        </p>
      )}
      {!can('/payment-attempts_read') || !can('/invoices_read') ? (
        <p role="alert">{translate('payment.readRequired')}</p>
      ) : (
        <>
          {invoice.isPending && <p role="status">{translate('payment.loadingInvoice')}</p>}
          {invoice.data && (
            <div
              role="group"
              aria-label={translate('payment.summary')}
              className="grid gap-3 border-y border-border bg-muted/30 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{translate('payment.invoiceTotal')}</p>
                <PaymentStatusBadge status={invoice.data.paymentStatus} />
              </div>
              <strong className="break-words text-2xl font-semibold tabular-nums text-foreground">
                {formatPrice(invoice.data.totalAmount)}
              </strong>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {invoice.data.invoiceNumber}
              </p>
            </div>
          )}
          {failed && <ApiErrorAlert error={failed} />}
          {providers.data && !selectedProvider && (
            <p role="status" className="text-sm">
              {translate('payment.notConfigured')}
            </p>
          )}
          {unresolvedSubmission && !create.isPending && (
            <p
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {translate('payment.unknownCreation')}
            </p>
          )}
          {blocking && !unresolvedSubmission && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              {translate('payment.unresolved')}
            </p>
          )}
          {can('/payment-attempts_create') &&
            invoice.data?.paymentStatus === 'UNPAID' &&
            (!blocking || unresolvedSubmission) && (
              <div className="grid gap-3">
                <p className="text-sm font-medium">{translate('payment.selectProvider')}</p>
                <div
                  className="grid grid-cols-3 gap-2"
                  role="group"
                  aria-label={translate('payment.selectProvider')}
                >
                  {(['VNPAY', 'MOMO', 'PAYOS'] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      className={`relative h-24 min-w-0 flex-col gap-2 px-1 py-3 transition-colors ${selectedProvider === value ? 'border-foreground bg-muted ring-1 ring-foreground' : 'bg-card'}`}
                      aria-pressed={selectedProvider === value}
                      disabled={
                        busy ||
                        Boolean(unresolvedSubmission) ||
                        blocking ||
                        !providers.data?.some((item) => item.provider === value && item.configured)
                      }
                      onClick={() => setProvider(value)}
                    >
                      {selectedProvider === value && (
                        <Check
                          size={13}
                          aria-hidden="true"
                          className="absolute right-1.5 top-1.5"
                        />
                      )}
                      <PaymentProviderMark provider={value} />
                      <span>{paymentProviderNames[value]}</span>
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  className="min-h-11 w-full"
                  isLoading={create.isPending}
                  disabled={
                    !available || reconcile.isPending || (blocking && !unresolvedSubmission)
                  }
                  onClick={handleCreate}
                >
                  <QrCode size={16} aria-hidden="true" />
                  {unresolvedSubmission
                    ? translate('payment.recoverCreation')
                    : selectedProvider
                      ? translate('payment.createProvider', { provider: selectedProvider })
                      : translate('payment.createAttempt')}
                </Button>
              </div>
            )}
          <h4 className="text-sm font-semibold">{translate('payment.attempts')}</h4>
          {attempts.isPending && <p role="status">{translate('common.loading')}</p>}
          {!attempts.isPending && !attempts.isError && !list.length && (
            <p className="text-sm text-muted-foreground">{translate('payment.noAttempts')}</p>
          )}
          {list.map((attempt) => {
            const link =
              attempt.paymentUrl ??
              (create.data?.id === attempt.id ? create.data.paymentUrl : null) ??
              (recovery.data?.id === attempt.id ? recovery.data.paymentUrl : null)
            const linkActive =
              attempt.status === 'PENDING' &&
              Date.parse(attempt.expiresAt) > now &&
              !attempts.isError &&
              !invoice.isError &&
              invoice.data?.paymentStatus === 'UNPAID'
            return (
              <article
                key={attempt.id}
                aria-label={translate('payment.attemptReference', {
                  reference: attempt.merchantReference,
                })}
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <PaymentProviderMark provider={attempt.provider} />
                    <strong>{paymentProviderNames[attempt.provider]}</strong>
                  </div>
                  <AttemptStatusBadge status={attempt.status} />
                </header>
                <div className="grid min-w-0 gap-4 p-4">
                  {link && linkActive && (
                    <div className="grid min-w-0 gap-4">
                      <div className="text-center">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {translate('payment.amountDue')}
                        </p>
                        <p className="break-words text-2xl font-semibold tabular-nums">
                          {formatPrice(attempt.amount)}
                        </p>
                      </div>
                      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] items-center gap-4">
                        <div
                          ref={qrFrame}
                          className="mx-auto w-fit max-w-full rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                        >
                          <PaymentQr value={link} />
                        </div>
                        <div className="grid min-w-0 gap-4">
                          <p
                            role="status"
                            className="flex items-center justify-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200"
                          >
                            <span
                              aria-hidden="true"
                              className="size-2 shrink-0 rounded-full bg-amber-500 motion-safe:animate-pulse"
                            />
                            {translate('payment.awaitingConfirmation')}
                          </p>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground"
                          >
                            <ExternalLink size={16} aria-hidden="true" />
                            {translate('payment.openProvider', {
                              provider: paymentProviderNames[attempt.provider],
                            })}
                          </a>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {translate('payment.qrLinkHint')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <dl className="grid min-w-0 gap-3 border-t border-dashed border-border pt-3 text-xs">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <dt className="text-muted-foreground">{translate('payment.reference')}</dt>
                      <dd className="min-w-0 break-all font-mono text-foreground">
                        {attempt.merchantReference}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 size={13} aria-hidden="true" />
                        {translate('payment.expiresAt')}
                      </dt>
                      <dd className="text-foreground">{formatDateTime(attempt.expiresAt)}</dd>
                    </div>
                  </dl>
                  {!link && linkActive && can('/payment-attempts_create') && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={retryWait > 0 || busy || attempts.isFetching || invoice.isFetching}
                      isLoading={recovery.isPending && recovery.variables === attempt.id}
                      onClick={() => {
                        if (retryWait || flight.current || busy) return
                        flight.current = true
                        recovery.mutate(attempt.id)
                      }}
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                      {translate('payment.recoverLink')}
                    </Button>
                  )}
                  {((attempt.status === 'PENDING' && Date.parse(attempt.expiresAt) <= now) ||
                    attempt.status === 'EXPIRED') && (
                    <p
                      role="status"
                      className="rounded-md bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {translate('payment.expiredLink')}
                    </p>
                  )}
                  {can('/payment-reconciliation_manage') && isUnresolvedPayment(attempt.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryWait > 0 || busy}
                      onClick={() => handleReconcile(attempt.id)}
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                      {translate('payment.reconcileProvider', {
                        provider: paymentProviderNames[attempt.provider],
                      })}
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </>
      )}
    </section>
  )
}
