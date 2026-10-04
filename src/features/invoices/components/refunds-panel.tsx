import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { createRefund, getRefunds } from '../refunds.api'
import type { PaymentAttempt } from '../invoices.api'
import type { Session } from '../../auth/session'
import { errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../../shared/lib/format'
import { Button, Dialog, Input } from '../../../shared/ui'

const labels = {
  PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', SUCCEEDED: 'Đã hoàn tiền',
  FAILED: 'Thất bại', REJECTED: 'Đã từ chối', REQUIRES_REVIEW: 'Cần đối soát',
}

export function RefundsPanel({ attempts, onUpdated }: {
  attempts: PaymentAttempt[]; onUpdated: () => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const canCreate = authorization.permissionKeys.includes('/payment-refunds_create')
  const canRead = authorization.permissionKeys.includes('/payment-refunds_read')
  const eligible = attempts.filter((attempt) => attempt.provider === 'VNPAY' && attempt.status === 'SUCCEEDED')
  const [selectedId, setSelectedId] = useState('')
  const [page, setPage] = useState(1)
  const [confirmation, setConfirmation] = useState<{ amount: string; reason: string } | null>(null)
  const attemptId = selectedId || eligible[0]?.id || ''
  const refunds = useQuery({
    queryKey: ['private', employee.id, 'refunds', attemptId, page],
    queryFn: ({ signal }) => getRefunds(attemptId, page, signal),
    enabled: canRead && Boolean(attemptId),
    refetchInterval: (query) => query.state.data?.list.some((refund) =>
      refund.status === 'PENDING' || refund.status === 'PROCESSING') ? 5000 : false,
  })
  const mutation = useMutation({
    mutationFn: ({ amount, reason }: { amount: string; reason: string }) => createRefund(attemptId, amount, reason),
    onSuccess: () => { setConfirmation(null); void refunds.refetch(); onUpdated() },
  })
  if ((!canRead && !canCreate) || !eligible.length) return null

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-base font-semibold">Hoàn tiền VNPay</h3>
      <label className="block space-y-1 text-sm"><span>Giao dịch</span>
        <select className="w-full rounded-md border border-border p-2" value={attemptId}
          disabled={mutation.isPending || Boolean(confirmation)} onChange={(event) => { setSelectedId(event.target.value); setPage(1); mutation.reset() }}>
          {eligible.map((attempt) => <option key={attempt.id} value={attempt.id}>{attempt.merchantReference} · {formatPrice(attempt.amount)}</option>)}
        </select>
      </label>
      {canCreate && <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault()
        if (mutation.isPending) return
        const values = new FormData(event.currentTarget)
        mutation.reset()
        setConfirmation({ amount: String(values.get('amount')).trim(), reason: String(values.get('reason')).trim() })
      }}>
        <label className="block space-y-1 text-sm"><span>Số tiền hoàn (VND)</span>
          <Input name="amount" type="number" min="0.01" step="0.01" required disabled={mutation.isPending} />
        </label>
        <label className="block space-y-1 text-sm"><span>Lý do hoàn tiền</span>
          <Input name="reason" minLength={3} maxLength={500} required disabled={mutation.isPending} />
        </label>
        <Button type="submit" variant="outline" isLoading={mutation.isPending}>Yêu cầu hoàn tiền</Button>
      </form>}
      <Dialog open={Boolean(confirmation)} onClose={() => { if (!mutation.isPending) setConfirmation(null) }} maxWidth="sm">
        <h2 className="pr-8 text-lg font-semibold">Xác nhận yêu cầu hoàn tiền</h2>
        <p className="mt-3">{formatPrice(confirmation?.amount ?? '0')} · {confirmation?.reason}</p>
        {mutation.error && <p role="alert" className="mt-3 text-sm text-destructive">{errorMessage(mutation.error)}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmation(null)}>Hủy</Button>
          <Button isLoading={mutation.isPending} onClick={() => { if (confirmation && !mutation.isPending) mutation.mutate(confirmation) }}>Xác nhận hoàn tiền</Button>
        </div>
      </Dialog>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      {mutation.data && <p role="status">Yêu cầu: {labels[mutation.data.status]}</p>}
      {refunds.error && <p role="alert" className="text-sm text-destructive">{errorMessage(refunds.error)}</p>}
      {refunds.isLoading && <p role="status">Đang tải lịch sử hoàn tiền…</p>}
      {refunds.data?.list.map((refund) => <div key={refund.id} className="border-b border-border py-2 text-sm">
        <p>{formatPrice(refund.amount)} · {labels[refund.status]}</p><p>{refund.reason}</p>
      </div>)}
      {refunds.data && refunds.data.totalPages > 1 && <div className="flex items-center gap-3">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
        <span>{page}/{refunds.data.totalPages}</span>
        <Button variant="outline" disabled={page >= refunds.data.totalPages} onClick={() => setPage(page + 1)}>Sau</Button>
      </div>}
    </section>
  )
}
