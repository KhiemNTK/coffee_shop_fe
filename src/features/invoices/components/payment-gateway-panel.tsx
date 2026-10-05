import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { CreditCard, ExternalLink, QrCode, RefreshCw } from 'lucide-react'
import type { Session } from '../../auth/session'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { formatDateTime, formatPrice } from '../../../shared/lib/format'
import { Button } from '../../../shared/ui'
import { PaymentQr } from '../../../shared/ui/payment-qr'
import { createPaymentAttempt, getInvoiceById, getInvoicePaymentAttempts, getPaymentProviders, reconcilePaymentAttempt,
  type CreatePaymentAttemptPayload, type Invoice, type PaymentAttempt, type PaymentProvider } from '../invoices.api'
import { AttemptStatusBadge, PaymentStatusBadge } from './invoice-badges'

function stillPolling(attempt: PaymentAttempt) {
  return attempt.status === 'PENDING' && Date.now() < Date.parse(attempt.expiresAt) + 30_000
}

export function PaymentGatewayPanel({ invoiceId, onPaid }: {
  invoiceId: string; onPaid?: (invoice: Invoice) => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<PaymentProvider>('VNPAY')
  const [submitted, setSubmitted] = useState<CreatePaymentAttemptPayload | null>(null)
  const [now, setNow] = useState(Date.now)
  const flight = useRef(false)
  const notified = useRef(false)
  const invoiceKey = ['private', employee.id, 'invoice-detail', invoiceId]
  const attemptsKey = ['private', employee.id, 'invoice-attempts', invoiceId]
  const providers = useQuery({
    queryKey: ['private', employee.id, 'payment-providers'],
    queryFn: ({ signal }) => getPaymentProviders(signal),
    enabled: can('/payment-attempts_read'),
  })
  const selectedProvider = providers.data?.find(item => item.provider === provider && item.configured)?.provider
    ?? providers.data?.find(item => item.configured)?.provider
  const create = useMutation({
    mutationFn: (payload: CreatePaymentAttemptPayload) => createPaymentAttempt(invoiceId, payload),
    onSuccess: () => { setSubmitted(null) },
    onError: error => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 &&
        error.status !== 408 && error.status !== 429) setSubmitted(null)
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
    refetchInterval: query => query.state.data?.list.some(stillPolling) ? 4000 : false,
  })
  // Reads omit paymentUrl; retain only the link returned by this explicit creation.
  const history = attempts.data?.list ?? []
  const list = create.data && !history.some(attempt => attempt.id === create.data.id)
    ? [create.data, ...history] : history
  const nextExpiry = Math.min(...list.filter(attempt => attempt.status === 'PENDING')
    .map(attempt => Date.parse(attempt.expiresAt)).filter(expiry => expiry > now))
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 10)
    return () => window.clearTimeout(timer)
  }, [nextExpiry])
  const blocking = list.some(attempt => attempt.status === 'PENDING' || attempt.status === 'REQUIRES_REVIEW')
  const invoice = useQuery({
    queryKey: invoiceKey,
    queryFn: ({ signal }) => getInvoiceById(invoiceId, signal),
    enabled: can('/invoices_read'),
    staleTime: 0,
    refetchInterval: query => query.state.data?.paymentStatus === 'UNPAID' && list.some(stillPolling) ? 4000 : false,
  })
  const reconcile = useMutation({
    mutationFn: reconcilePaymentAttempt,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attemptsKey })
      void queryClient.invalidateQueries({ queryKey: invoiceKey })
    },
  })
  const terminalSnapshot = list.filter(attempt => attempt.status !== 'PENDING').map(attempt => `${attempt.id}:${attempt.status}`).join('|')
  useEffect(() => {
    if (terminalSnapshot) void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'invoice-detail', invoiceId] })
  }, [terminalSnapshot, invoiceId, employee.id, queryClient])
  useEffect(() => {
    if (invoice.data?.paymentStatus === 'PAID' && !notified.current) {
      notified.current = true
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'invoices'] })
      onPaid?.(invoice.data)
    }
  }, [invoice.data, onPaid, employee.id, queryClient])

  const busy = create.isPending || reconcile.isPending
  const failed = create.error ?? reconcile.error ?? attempts.error ?? invoice.error ?? providers.error
  const available = can('/payment-attempts_create') && can('/payment-attempts_read') &&
    invoice.data?.paymentStatus === 'UNPAID' && !attempts.isPending && !attempts.isError && !invoice.isError &&
    Boolean(selectedProvider) && !providers.isError
  function handleCreate() {
    if (flight.current || !available || (blocking && !submitted)) return
    flight.current = true
    const payload = submitted ?? { provider: selectedProvider!, locale: 'vn', closeSessionAfterPayment: true }
    setSubmitted(payload)
    create.mutate(payload)
  }

  return <section className="space-y-4" aria-label="Cổng thanh toán">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold">Thanh toán VNPay / MoMo</h3>
      <Button variant="outline" size="sm" disabled={!can('/payment-attempts_read') || !can('/invoices_read') || busy || attempts.isFetching || invoice.isFetching}
        onClick={() => { void attempts.refetch(); void invoice.refetch() }}><RefreshCw size={16} aria-hidden="true" />Kiểm tra trạng thái</Button>
    </div>
    {!can('/payment-attempts_read') || !can('/invoices_read')
      ? <p role="alert">Bạn cần quyền đọc hóa đơn và phiên thanh toán để kiểm tra kết quả.</p>
      : <>
        {invoice.isPending && <p role="status">Đang tải hóa đơn…</p>}
        {invoice.data && <p className="text-sm">Tổng hóa đơn: <strong>{formatPrice(invoice.data.totalAmount)}</strong> · <PaymentStatusBadge status={invoice.data.paymentStatus} /></p>}
        {failed && <p role="alert" className="break-words text-sm text-destructive">{errorMessage(failed)}</p>}
        {providers.data && !selectedProvider && <p role="status" className="text-sm">Chưa cấu hình cổng thanh toán. Liên hệ quản lý hoặc chọn thu tiền tại quầy.</p>}
        {submitted && !create.isPending && <p role="status" className="text-sm">Chưa xác nhận được lần tạo phiên. Kiểm tra lại cùng yêu cầu, không đổi cổng thanh toán.</p>}
        {blocking && !submitted && <p role="status" className="text-sm">Có phiên đang chờ hoặc cần đối soát. Kiểm tra kết quả trước khi thu tiền bằng cách khác.</p>}
        {can('/payment-attempts_create') && invoice.data?.paymentStatus === 'UNPAID' && <div className="space-y-3 border-y border-border py-4">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chọn cổng thanh toán">
            {(['VNPAY', 'MOMO'] as const).map(value => <Button key={value} type="button"
              variant={selectedProvider === value ? 'default' : 'outline'} aria-pressed={selectedProvider === value}
              disabled={busy || Boolean(submitted) || blocking || !providers.data?.some(item => item.provider === value && item.configured)} onClick={() => setProvider(value)}>
              {value === 'VNPAY' ? <CreditCard size={16} aria-hidden="true" /> : <QrCode size={16} aria-hidden="true" />}{value === 'VNPAY' ? 'VNPay' : 'MoMo'}
            </Button>)}
          </div>
          <Button type="button" className="w-full" isLoading={create.isPending}
            disabled={!available || reconcile.isPending || (blocking && !submitted)} onClick={handleCreate}>
            <QrCode size={16} aria-hidden="true" />{submitted ? 'Kiểm tra lại lần tạo phiên' : selectedProvider ? `Tạo phiên ${selectedProvider}` : 'Tạo phiên thanh toán'}
          </Button>
        </div>}
        <h4 className="text-sm font-semibold">Các phiên thanh toán</h4>
        {attempts.isPending && <p role="status">Đang tải các phiên…</p>}
        {!attempts.isPending && !attempts.isError && !list.length && <p className="text-sm text-muted-foreground">Chưa có phiên thanh toán.</p>}
        {list.map(attempt => {
          const link = attempt.paymentUrl ?? (create.data?.id === attempt.id ? create.data.paymentUrl : null)
          const linkActive = attempt.status === 'PENDING' && Date.parse(attempt.expiresAt) > now
          return <div key={attempt.id} className="space-y-3 border-b border-border py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><strong>{attempt.provider}</strong><AttemptStatusBadge status={attempt.status} /></div>
            <p className="break-all font-mono text-xs text-muted-foreground">{attempt.merchantReference}</p>
            <p className="text-xs text-muted-foreground">Hết hạn: {formatDateTime(attempt.expiresAt)}</p>
            {link && linkActive && <>
              <PaymentQr value={link} />
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold">
                <ExternalLink size={16} aria-hidden="true" />Mở thanh toán {attempt.provider}
              </a>
            </>}
            {attempt.status === 'PENDING' && !linkActive && <p role="status">Liên kết đã hết hạn. Cần kiểm tra kết quả trước khi tạo phiên mới.</p>}
            {can('/payment-reconciliation_manage') && (attempt.status === 'PENDING' || attempt.status === 'REQUIRES_REVIEW') &&
              <Button variant="outline" size="sm" disabled={busy} onClick={() => reconcile.mutate(attempt.id)}>
                <RefreshCw size={16} aria-hidden="true" />Đối soát {attempt.provider}
              </Button>}
          </div>
        })}
      </>}
  </section>
}
