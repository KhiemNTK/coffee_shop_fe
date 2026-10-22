import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Banknote, CheckCircle2, RefreshCw } from 'lucide-react'
import type { Session } from '../../auth/session'
import type { Invoice } from '../invoices.api'
import { cashRefundInputSchema, createCashRefund, getCashRefunds, type CashRefundInput } from '../aftersales.api'
import { useAftersalesCommand } from '../use-aftersales-command'
import { getCurrentShift } from '../../cashier-shifts/cashier-shifts.api'
import { minorAmount, decimalAmount } from '../../../shared/lib/money'
import { formatPrice } from '../../../shared/lib/format'
import { formatStoreDateTime } from '../../../shared/lib/store-time'
import { errorMessage } from '../../../shared/api/client'
import { Button, Dialog, DialogFooter, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

export function CashRefundsPanel({ invoice, active, blocked, onUpdated, onLockChange }: {
  invoice: Invoice; active: boolean; blocked: boolean; onUpdated: () => void; onLockChange: (locked: boolean) => void
}) {
  const { employee, access } = useOutletContext<Session>()
  const canRead = access.has('/payment-refunds_read')
  const canCreate = access.has('/cash-refunds_create')
  const canReadShift = access.has('/cashier-shifts_current')
  const [page, setPage] = useState(1)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState<CashRefundInput | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const refunds = useQuery({
    queryKey: ['private', employee.id, 'cash-refunds', invoice.id, page],
    queryFn: ({ signal }) => getCashRefunds(invoice.id, page, signal), enabled: canRead && active,
  })
  const shift = useQuery({
    queryKey: ['private', employee.id, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal), enabled: canCreate && canReadShift && active,
  })
  const command = useAftersalesCommand({
    employeeId: employee.id, operation: `cash-refund:${invoice.id}`, schema: cashRefundInputSchema,
    execute: (payload, key) => createCashRefund(invoice.id, payload, key),
    onSuccess: () => { setConfirmation(null); setAmount(''); setReason('') },
    onUpdated: () => { if (canRead) void refunds.refetch(); onUpdated() },
  })
  useEffect(() => { onLockChange(command.locked); return () => onLockChange(false) }, [command.locked, onLockChange])
  const paid = invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'PARTIALLY_REFUNDED'
  const handedOff = invoice.orderItems.length > 0 && invoice.orderItems.every(item => item.serveStatus === 'SERVED')
  const cashShift = shift.data?.status === 'OPEN' && shift.data.employeeId === employee.id && shift.data.fund?.type === 'CASH'
  const canStart = canCreate && canRead && paid && handedOff && cashShift && !blocked &&
    refunds.isSuccess && !refunds.isError && !refunds.isFetching && shift.isSuccess && !shift.isError && !shift.isFetching
  // A paginated history is not a total. Only calculate with the full history present.
  const remaining = refunds.isSuccess && refunds.data.totalItems === refunds.data.list.length
    ? minorAmount(invoice.totalAmount) - refunds.data.list.reduce((sum, refund) => sum + minorAmount(refund.amount), 0n) : null
  const review = command.submitted?.payload ?? confirmation
  return <section aria-label="Hoàn tiền mặt" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold"><Banknote size={18} aria-hidden="true" />Hoàn tiền mặt</h3>
      {canRead && <Button variant="ghost" size="sm" title="Làm mới lịch sử hoàn tiền" aria-label="Làm mới lịch sử hoàn tiền" disabled={refunds.isFetching || command.mutation.isPending} onClick={() => void refunds.refetch()}><RefreshCw size={16} aria-hidden="true" /></Button>}
    </div>
    <dl className="grid grid-cols-2 gap-4 border-y border-border py-3 text-sm">
      <div><dt className="text-muted-foreground">Đã thu ban đầu</dt><dd className="mt-1 font-semibold tabular-nums">{formatPrice(invoice.totalAmount)}</dd></div>
      {remaining !== null && <div><dt className="text-muted-foreground">Còn có thể hoàn</dt><dd className="mt-1 font-semibold tabular-nums">{formatPrice(decimalAmount(remaining))}</dd></div>}
    </dl>
    {canCreate && paid && <>
      {!handedOff && <p role="status" className="text-sm text-amber-800">Cần giao đủ món của hóa đơn trước khi hoàn tiền.</p>}
      {!canRead && <p role="status" className="text-sm text-amber-800">Cần quyền đọc lịch sử hoàn tiền.</p>}
      {!canReadShift && <p role="status" className="text-sm text-amber-800">Cần quyền kiểm tra ca thu ngân.</p>}
      {shift.isSuccess && !cashShift && <p role="status" className="text-sm text-amber-800">Bạn cần một ca tiền mặt đang mở để chi hoàn tiền.</p>}
      {shift.error && <p role="alert" className="text-sm text-destructive">{errorMessage(shift.error)}</p>}
      <form className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]" onSubmit={event => {
        event.preventDefault()
        if (!canStart || command.locked) return
        const parsed = cashRefundInputSchema.safeParse({ amount: amount.trim(), reason })
        if (!parsed.success) { setFormError('Nhập số tiền dương, tối đa 2 chữ số thập phân và lý do từ 3 đến 500 ký tự.'); return }
        if (minorAmount(parsed.data.amount) > (remaining ?? minorAmount(invoice.totalAmount))) { setFormError('Số tiền vượt mức có thể hoàn.'); return }
        if (shift.data?.fund && minorAmount(parsed.data.amount) > minorAmount(shift.data.fund.balance)) { setFormError('Số dư quỹ không đủ để chi hoàn tiền.'); return }
        setFormError(null); setConfirmation(parsed.data); command.mutation.reset()
      }}>
        <label className="space-y-1 text-sm"><span>Số tiền hoàn (VND)</span><Input type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} disabled={!canStart || command.locked || Boolean(confirmation)} /></label>
        <label className="space-y-1 text-sm"><span>Lý do hoàn tiền mặt</span><Input required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={!canStart || command.locked || Boolean(confirmation)} /></label>
        {formError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{formError}</p>}
        <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={!canStart || command.locked}><Banknote size={16} aria-hidden="true" />Chi hoàn tiền</Button></div>
      </form>
    </>}
    {command.submitted && <div role="status" className="border-l-2 border-amber-500 pl-3 text-sm">
      <p>Chưa xác nhận kết quả · {formatPrice(command.submitted.payload.amount)}</p>
      <Button className="mt-2" variant="outline" size="sm" disabled={!canCreate || !command.canRecover} onClick={() => command.submit(command.submitted!.payload)}><RefreshCw size={16} aria-hidden="true" />Kiểm tra lại cùng yêu cầu</Button>
    </div>}
    {command.error && <p role="alert" className="text-sm text-destructive">{command.error}</p>}
    {command.mutation.data && !command.submitted && <p role="status" className="flex gap-2 text-sm text-emerald-800"><CheckCircle2 size={16} aria-hidden="true" />Đã ghi nhận hoàn {formatPrice(command.mutation.data.amount)}.</p>}
    {canRead && <div className="border-t border-border pt-4">
      <h4 className="text-sm font-semibold">Lịch sử chi hoàn tiền</h4>
      {refunds.isPending && <p role="status" className="mt-3 text-sm text-muted-foreground">Đang tải lịch sử…</p>}
      {refunds.error && <p role="alert" className="mt-3 text-sm text-destructive">{errorMessage(refunds.error)}</p>}
      {refunds.isSuccess && !refunds.data.list.length && <p className="mt-3 text-sm text-muted-foreground">Chưa có khoản hoàn tiền mặt.</p>}
      <ul className="divide-y divide-border">{refunds.data?.list.map(refund => <li key={refund.id} className="py-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong className="tabular-nums">{formatPrice(refund.amount)}</strong><span className="text-xs text-muted-foreground">{formatStoreDateTime(refund.completedAt)}</span></div>
        <p className="mt-1 break-words">{refund.reason}</p><p className="mt-1 text-xs text-muted-foreground">{refund.requestedBy.fullName} · Ca {refund.cashTransaction.shiftId?.slice(0, 8) ?? '—'}</p>
      </li>)}</ul>
      {refunds.data && refunds.data.totalPages > 1 && <Pagination page={page} totalPages={refunds.data.totalPages} onPage={setPage} disabled={refunds.isFetching || command.locked} />}
    </div>}
    <Dialog open={Boolean(confirmation)} label="Xác nhận chi hoàn tiền mặt" maxWidth="sm" showCloseButton={!command.locked} onClose={() => { if (!command.locked) setConfirmation(null) }}>
      <h2 className="pr-8 text-lg font-semibold">Xác nhận chi hoàn tiền mặt</h2>
      <p className="mt-4 text-2xl font-semibold tabular-nums">{formatPrice(review?.amount ?? '0')}</p>
      <p className="mt-2 break-words text-sm">{review?.reason}</p>
      <p className="mt-3 text-sm text-muted-foreground">Khoản chi trừ quỹ ca hiện tại. Không lập thêm phiếu chi cho khoản này.</p>
      {command.error && <p role="alert" className="mt-3 text-sm text-destructive">{command.error}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={command.locked} onClick={() => setConfirmation(null)}>Quay lại</Button>
        <Button isLoading={command.mutation.isPending} disabled={!canCreate || (!command.submitted && !canStart)} onClick={() => { if (review) command.submit(review) }}><Banknote size={16} aria-hidden="true" />{command.submitted ? 'Kiểm tra lại cùng yêu cầu' : 'Xác nhận chi tiền'}</Button>
      </DialogFooter>
    </Dialog>
  </section>
}
