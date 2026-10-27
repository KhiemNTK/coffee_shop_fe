import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { z } from 'zod'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Coffee,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { apiGet, errorMessage } from '../../shared/api/client'
import { Button, buttonVariants, Card, CardContent, cn } from '../../shared/ui'
import { PaymentProviderMark } from './components/payment-provider-mark'
import { paymentProviderNames } from './payment-status'

const resultSchema = z.object({
  signatureValid: z.boolean(),
  attempt: z
    .object({
      id: z.string(),
      invoiceId: z.string(),
      status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REQUIRES_REVIEW']),
    })
    .nullable(),
})

export default function PaymentReturnPage() {
  const { t } = useTranslation()
  const { provider } = useParams<{ provider: string }>()
  const { search, pathname } = useLocation()
  const incomingState = new URLSearchParams(search).get('state')
  const rawState = incomingState ?? (search ? null : window.history.state?.payosReturnState)
  const payosState =
    typeof rawState === 'string' && /^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(rawState) ? rawState : null
  useEffect(() => {
    if (provider !== 'payos') return
    window.history.replaceState(
      { ...window.history.state, payosReturnState: payosState },
      '',
      pathname,
    )
  }, [provider, payosState, pathname])
  const returnQuery =
    provider === 'payos' ? (payosState ? `?state=${encodeURIComponent(payosState)}` : '') : search
  const [startedAt] = useState(Date.now)
  const supported = provider === 'vnpay' || provider === 'momo' || provider === 'payos'
  const result = useQuery({
    queryKey: ['payment-return', provider, returnQuery],
    queryFn: ({ signal }) =>
      apiGet(`/payments/${provider}/return${returnQuery}`, resultSchema, signal),
    enabled: supported,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) =>
      query.state.data?.attempt?.status === 'PENDING' && Date.now() - startedAt < 30_000
        ? 3000
        : false,
  })
  const status = result.data?.attempt?.status
  const message = !supported
    ? t('payment.return.unsupported')
    : result.isPending
      ? t('payment.return.checking')
      : result.isError
        ? errorMessage(result.error)
        : !result.data.signatureValid
          ? t('payment.return.unverified')
          : !result.data.attempt
            ? t('payment.return.notFound')
            : status === 'SUCCEEDED'
              ? t('payment.return.succeeded')
              : status === 'PENDING'
                ? t('payment.return.pending')
                : status === 'EXPIRED'
                  ? t('payment.return.expired')
                  : status === 'REQUIRES_REVIEW'
                    ? t('payment.return.review')
                    : t('payment.return.ended')

  const isSuccess = result.data?.signatureValid === true && status === 'SUCCEEDED'
  const isPending =
    supported &&
    (result.isPending || (result.data?.signatureValid === true && status === 'PENDING'))
  const isReview = result.data?.signatureValid === true && status === 'REQUIRES_REVIEW'
  const gateway =
    provider === 'vnpay'
      ? 'VNPAY'
      : provider === 'momo'
        ? 'MOMO'
        : provider === 'payos'
          ? 'PAYOS'
          : null
  const StatusIcon = isSuccess
    ? CheckCircle2
    : isPending
      ? Clock3
      : isReview
        ? TriangleAlert
        : XCircle
  const statusTone = isSuccess
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    : isPending || isReview
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-foreground">
            <Coffee className="size-5" aria-hidden="true" />
            <span>Coffee Homes</span>
          </Link>
          {gateway && (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <PaymentProviderMark provider={gateway} />
              {paymentProviderNames[gateway]}
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-lg overflow-hidden rounded-lg border-border text-center shadow-sm">
          <CardContent className="grid gap-6 p-5 sm:p-8">
            <div
              className={cn(
                'mx-auto flex size-16 items-center justify-center rounded-lg border',
                statusTone,
              )}
            >
              <StatusIcon className="size-8" aria-hidden="true" />
            </div>

            <div className="grid gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {t('payment.return.title')}
              </h1>
              <p
                role={result.isError ? 'alert' : 'status'}
                className={cn('rounded-md border px-4 py-3 text-sm leading-relaxed', statusTone)}
              >
                {message}
              </p>
            </div>

            {result.data?.attempt && (
              <dl className="grid min-w-0 gap-4 border-y border-dashed border-border py-4 text-left text-xs tabular-nums">
                <div className="flex min-w-0 flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">{t('payment.return.attemptId')}</dt>
                  <dd
                    className="break-all font-mono font-medium text-foreground"
                    title={result.data.attempt.id}
                  >
                    {result.data.attempt.id.slice(0, 12)}…
                  </dd>
                </div>
                <div className="flex min-w-0 flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">{t('payment.return.invoiceId')}</dt>
                  <dd
                    className="break-all font-mono font-medium text-foreground"
                    title={result.data.attempt.invoiceId}
                  >
                    {result.data.attempt.invoiceId.slice(0, 12)}…
                  </dd>
                </div>
              </dl>
            )}

            <div className="grid gap-3">
              {supported && (
                <Button
                  variant="outline"
                  disabled={result.isFetching}
                  onClick={() => void result.refetch()}
                  className="min-h-11 w-full gap-2 font-semibold"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn('size-4', result.isFetching && 'motion-safe:animate-spin')}
                  />
                  {t('payment.checkStatus')}
                </Button>
              )}
              <Link
                to="/menu"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'min-h-11 w-full gap-2 font-semibold',
                )}
              >
                {t('payment.return.menu')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <span>Coffee Homes · {t('payment.return.footer')}</span>
      </footer>
    </div>
  )
}
