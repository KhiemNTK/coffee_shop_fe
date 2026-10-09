import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { createRefund, getRefunds } from '../refunds.api'
import type { PaymentAttempt, PaymentStatus } from '../invoices.api'
import type { Session } from '../../auth/session'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../../shared/lib/format'
import { minorAmount } from '../../../shared/lib/money'
import { moneySchema } from '../../menu/menu.api'
import { Button, Dialog, Input } from '../../../shared/ui'
import { RefreshCw } from 'lucide-react'

const labels = {
  PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', SUCCEEDED: 'Đã hoàn tiền',
  FAILED: 'Thất bại', REJECTED: 'Đã từ chối', REQUIRES_REVIEW: 'Cần đối soát',
}

export function RefundsPanel({ attempts, invoiceStatus, onUpdated, onLockChange }: {
  attempts: PaymentAttempt[]; invoiceStatus: PaymentStatus; onUpdated: () => void
  onLockChange: (locked: boolean) => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const canCreate = authorization.permissionKeys.includes('/payment-refunds_create')
  const canRead = authorization.permissionKeys.includes('/payment-refunds_read')
  const eligible = attempts.filter((attempt) => attempt.provider === 'VNPAY' && attempt.status === 'SUCCEEDED')
  const [selectedId, setSelectedId] = useState('')
  const [page, setPage] = useState(1)
  const [confirmation, setConfirmation] = useState<{ amount: string; reason: string } | null>(null)
  const [submitted, setSubmitted] = useState<{ attemptId: string; amount: string; reason: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const flight = useRef(false)
  const attemptId = selectedId || eligible[0]?.id || ''
  const refunds = useQuery({
    queryKey: ['private', employee.id, 'refunds', attemptId, page],
    queryFn: ({ signal }) => getRefunds(attemptId, page, signal),
    enabled: canRead && Boolean(attemptId),
    refetchInterval: (query) => query.state.data?.list.some((refund) =>
      refund.status === 'PENDING' || refund.status === 'PROCESSING') ? 5000 : false,
  })
  const mutation = useMutation({
    mutationFn: ({ attemptId, amount, reason }: { attemptId: string; amount: string; reason: string }) => createRefund(attemptId, amount, reason),
    retry: false,
    onSuccess: () => { setConfirmation(null); setSubmitted(null); onUpdated() },
    onError: error => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429)
        setSubmitted(null)
    },
    onSettled: () => { flight.current = false; void refunds.refetch() },
  })
  const locked = mutation.isPending || Boolean(submitted)
  const refundable = invoiceStatus === 'PAID' || invoiceStatus === 'PARTIALLY_REFUNDED'
  const canStart = canCreate && canRead && refundable && refunds.isSuccess && !refunds.isError && !refunds.isFetching
  useEffect(() => {
    onLockChange(locked)
    return () => onLockChange(false)
  }, [locked, onLockChange])

  function confirmRefund() {
    if (flight.current || (!submitted && !canStart)) return
    const intent = submitted ?? (confirmation ? { attemptId, ...confirmation } : null)
    if (!intent || !canCreate) return
    flight.current = true
    setSubmitted(intent)
    mutation.mutate(intent)
  }
  if ((!canRead && !canCreate) || !eligible.length) return null

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-base font-semibold">Hoàn tiền VNPay</h3>
      {!canRead && <p role="status">Cần quyền đọc lịch sử hoàn tiền trước khi tạo yêu cầu.</p>}
      <label className="block space-y-1 text-sm"><span>Giao dịch</span>
        <select className="w-full rounded-md border border-border p-2" value={attemptId}
          disabled={locked || Boolean(confirmation)} onChange={(event) => { setSelectedId(event.target.value); setPage(1); mutation.reset(); setFormError(null) }}>
          {eligible.map((attempt) => <option key={attempt.id} value={attempt.id}>{attempt.merchantReference} · {formatPrice(attempt.amount)}</option>)}
        </select>
      </label>
      {canCreate && canRead && refundable && <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault()
        if (flight.current || locked || !canStart) return
        const values = new FormData(event.currentTarget)
        const amount = String(values.get('amount')).trim()
        const reason = String(values.get('reason')).trim()
        const parsed = moneySchema.safeParse(amount)
        if (!parsed.success || minorAmount(parsed.data) <= 0n || reason.length < 3) {
          setFormError('Nhập số tiền dương, tối đa 2 chữ số thập phân và lý do ít nhất 3 ký tự.')
          return
        }
        setFormError(null)
        mutation.reset()
        setConfirmation({ amount: parsed.data, reason })
      }}>
        <label className="block space-y-1 text-sm"><span>Số tiền hoàn (VND)</span>
          <Input name="amount" type="number" min="0.01" step="0.01" required disabled={locked || Boolean(confirmation)} />
        </label>
        <label className="block space-y-1 text-sm"><span>Lý do hoàn tiền</span>
          <Input name="reason" minLength={3} maxLength={500} required disabled={locked || Boolean(confirmation)} />
        </label>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" variant="outline" disabled={locked || !canStart}>Yêu cầu hoàn tiền</Button>
      </form>}
      <Dialog open={Boolean(confirmation)} onClose={() => { if (!flight.current && !locked) setConfirmation(null) }} showCloseButton={!locked} maxWidth="sm" label="Xác nhận yêu cầu hoàn tiền">
        <h2 className="pr-8 text-lg font-semibold">Xác nhận yêu cầu hoàn tiền</h2>
        <p className="mt-3">{formatPrice(confirmation?.amount ?? '0')} · {confirmation?.reason}</p>
        {mutation.error && <p role="alert" className="mt-3 text-sm text-destructive">{errorMessage(mutation.error)}</p>}
        {submitted && !mutation.isPending && <p role="status" className="mt-3 text-sm">Chưa xác nhận được yêu cầu. Kiểm tra lại cùng số tiền và lý do; không tạo yêu cầu hoàn tiền khác.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={locked} onClick={() => setConfirmation(null)}>Hủy</Button>
          <Button isLoading={mutation.isPending} disabled={!canCreate || (!submitted && !canStart)} onClick={confirmRefund}>
            {submitted ? 'Kiểm tra lại yêu cầu hoàn tiền' : 'Xác nhận hoàn tiền'}
          </Button>
        </div>
      </Dialog>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      {mutation.data && <p role="status">Yêu cầu: {labels[mutation.data.status]}</p>}
      {refunds.error && <p role="alert" className="text-sm text-destructive">{errorMessage(refunds.error)}</p>}
      {canRead && <Button variant="outline" size="sm" disabled={refunds.isFetching || mutation.isPending} onClick={() => void refunds.refetch()}>
        <RefreshCw size={16} aria-hidden="true" />Làm mới lịch sử hoàn tiền
      </Button>}
      {refunds.isLoading && <p role="status">Đang tải lịch sử hoàn tiền…</p>}
      {refunds.data?.list.map((refund) => <div key={refund.id} className="border-b border-border py-2 text-sm">
        <p>{formatPrice(refund.amount)} · {labels[refund.status]}</p><p>{refund.reason}</p>
      </div>)}
      {refunds.data && refunds.data.totalPages > 1 && <div className="flex items-center gap-3">
        <Button variant="outline" disabled={locked || page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
        <span>{page}/{refunds.data.totalPages}</span>
        <Button variant="outline" disabled={locked || page >= refunds.data.totalPages} onClick={() => setPage(page + 1)}>Sau</Button>
      </div>}
    </section>
  )
}
