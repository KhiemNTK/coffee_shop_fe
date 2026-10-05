import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react'
import { settingsApi, type ManagementExceptionsSummary, type ManagementExceptionItem } from '../settings.api'
import type { Session } from '../../auth/session'
import { closeIncident, resolveFeedback } from '../../reconciliation/reconciliation.api'
import { reconcilePaymentAttempt } from '../../invoices/invoices.api'
import { errorMessage } from '@/shared/api/client'
import { formatVnd, formatDate } from '@/shared/lib/format'
import { Button, Badge, Dialog, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'

const kinds = [
  { id: 'PAYMENT', label: 'Đối soát Cổng TT' }, { id: 'CASH_EXPENSE', label: 'Chi quỹ tiền mặt' },
  { id: 'CASH_HANDOVER', label: 'Bàn giao ca' }, { id: 'FEEDBACK', label: 'Khiếu nại khách' },
] as const
type Kind = typeof kinds[number]['id']

export function ManagementExceptionsTab({ summary }: { summary?: ManagementExceptionsSummary }) {
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const client = useQueryClient()
  const [kind, setKind] = useState<Kind>('PAYMENT')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ManagementExceptionItem | null>(null)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<'RESOLVE' | 'IGNORE' | null>(null)
  const query = useQuery({
    queryKey: ['management-exceptions-list', employee.id, kind, page],
    queryFn: ({ signal }) => settingsApi.getManagementExceptions({ kind, page, itemPerPage: 20 }, signal),
  })
  const action = useMutation({
    mutationFn: async (command: 'RESOLVE' | 'IGNORE' | 'RECONCILE') => {
      if (!selected) throw new Error('Chưa chọn ngoại lệ.')
      if (command === 'RECONCILE' && selected.paymentAttemptId) return reconcilePaymentAttempt(selected.paymentAttemptId)
      if (kind === 'FEEDBACK') return resolveFeedback(selected.id, note.trim())
      return closeIncident(selected.id, command === 'IGNORE' ? 'IGNORE' : 'RESOLVE', note.trim())
    },
    onSuccess: (_data, command) => {
      setConfirm(null)
      if (command !== 'RECONCILE') setSelected(null)
      void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
      void client.invalidateQueries({ queryKey: ['management-exceptions-summary'] })
      void client.invalidateQueries({ queryKey: ['private', employee.id, 'reconciliation'] })
    },
  })
  const close = () => { if (!action.isPending) { setSelected(null); setConfirm(null) } }
  return <section className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kinds.map(entry => <button key={entry.id} type="button" aria-pressed={kind === entry.id}
        onClick={() => { setKind(entry.id); setPage(1); setSelected(null) }}
        className={'rounded-lg border p-4 text-left ' + (kind === entry.id ? 'border-primary bg-primary/5' : 'border-border')}>
        <span className="block text-sm font-semibold">{entry.label}</span>
        <span className="text-2xl">{summary ? summary.counts[entry.id] : '—'}</span>
      </button>)}
    </div>
    {query.isError ? <div role="alert" className="space-y-2 border-l-4 border-destructive p-4">
      <p>{errorMessage(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" />Thử lại</Button>
    </div> : query.isPending ? <p role="status">Đang tải danh sách ngoại lệ quản trị...</p> :
      query.data.list.length === 0 ? <div className="flex items-center gap-2 py-8"><CheckCircle2 className="h-5 w-5" />Không có ngoại lệ tồn đọng</div> :
        <div className="divide-y border-y">{query.data.list.map(item => <div key={item.id} className="flex items-start justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="break-words font-semibold">{item.title || item.description || item.comment || 'Phiếu ' + item.id}</p>
            <Badge variant="outline">{item.status || (item.rating ? item.rating + ' sao' : 'PENDING')}</Badge>
            <p className="text-sm text-muted-foreground">{formatDate(item.createdAt || item.detectedAt)}</p>
            {item.amount !== undefined && <p>{formatVnd(item.amount)}</p>}
          </div>
          <Button variant="outline" onClick={() => { setSelected(item); setNote(''); setConfirm(null); action.reset() }}>Chi tiết</Button>
        </div>)}</div>}
    {query.data && <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} disabled={query.isFetching} />}
    {selected && <Dialog open onClose={close} label="Chi tiết ngoại lệ">
      <div className="space-y-4 p-5">
        <h2 id="exception-title" className="pr-8 text-lg font-semibold">Chi tiết ngoại lệ</h2>
        <p className="break-words">{selected.title || selected.description || selected.comment || selected.id}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-2 text-sm">
          <dt>Mã phiếu</dt><dd className="break-all">{selected.id}</dd>
          {selected.amount !== undefined && <><dt>Số tiền</dt><dd>{formatVnd(selected.amount)}</dd></>}
          {selected.varianceAmount !== undefined && <><dt>Chênh lệch</dt><dd>{formatVnd(selected.varianceAmount)}</dd></>}
          {selected.shiftId && <><dt>Ca</dt><dd className="break-all">{selected.shiftId}</dd></>}
          {selected.paymentAttemptId && <><dt>Payment attempt</dt><dd className="break-all">{selected.paymentAttemptId}</dd></>}
          {selected.invoiceId && <><dt>Hóa đơn</dt><dd className="break-all">{selected.invoiceId}</dd></>}
        </dl>
        {action.isError && <p role="alert" className="text-destructive">{errorMessage(action.error)}</p>}
        {action.isSuccess && <p role="status">Đã kiểm tra lại trạng thái thanh toán.</p>}
        {kind === 'PAYMENT' && can('/payment-reconciliation_manage') && <Button variant="outline" disabled={action.isPending}
          onClick={() => action.mutate('RECONCILE')}><RefreshCw className="h-4 w-4" />Đối soát lại payment</Button>}
        {((kind === 'PAYMENT' && can('/payment-reconciliation_manage')) || (kind === 'FEEDBACK' && can('/feedback_resolve'))) &&
          <><label className="block text-sm">Ghi chú xử lý<Input value={note} maxLength={500} disabled={action.isPending}
            onChange={e => { setNote(e.target.value); setConfirm(null) }} /></label>
          {confirm ? <div className="space-y-2 border-t pt-3"><p>Xác nhận {confirm === 'IGNORE' ? 'bỏ qua' : 'đóng'} ngoại lệ này?</p>
            <Button disabled={action.isPending || note.trim().length < 3} onClick={() => action.mutate(confirm)}><CheckCircle2 className="h-4 w-4" />Xác nhận</Button>
            <Button variant="outline" disabled={action.isPending} onClick={() => setConfirm(null)}>Quay lại</Button>
          </div> : <div className="flex gap-2"><Button disabled={note.trim().length < 3 || action.isPending} onClick={() => setConfirm('RESOLVE')}>Đánh dấu đã xử lý</Button>
            {kind === 'PAYMENT' && <Button variant="outline" disabled={note.trim().length < 3 || action.isPending} onClick={() => setConfirm('IGNORE')}>Bỏ qua có lý do</Button>}</div>}</>}
        {((kind === 'CASH_EXPENSE' && can('/cashier-shifts_expenses-review')) || (kind === 'CASH_HANDOVER' && can('/cash-handovers_read'))) && <Link className="inline-flex items-center gap-2 underline" to={'/staff/shifts?tab=' + (kind === 'CASH_EXPENSE' ? 'expenses' : 'handovers')}><ExternalLink className="h-4 w-4" />Mở nghiệp vụ ca và quỹ</Link>}
        {kind === 'PAYMENT' && can('/payment-reconciliation_read') && <Link className="block underline" to="/staff/reconciliation">Mở danh sách đối soát</Link>}
      </div>
    </Dialog>}
  </section>
}
