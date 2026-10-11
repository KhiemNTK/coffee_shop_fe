import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, RefreshCw, RotateCcw } from 'lucide-react'
import type { Session } from '../../auth/session'
import type { Invoice } from '../invoices.api'
import { remakeInputSchema, remakeOrderItem } from '../aftersales.api'
import { useAftersalesCommand } from '../use-aftersales-command'
import { Badge, Button, Dialog, DialogFooter, Input } from '../../../shared/ui'

export function RemakesPanel({ invoice, blocked, onUpdated, onLockChange }: {
  invoice: Invoice; blocked: boolean; onUpdated: () => void; onLockChange: (locked: boolean) => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const canCreate = authorization.permissionKeys.includes('/orders_items_remake')
  const [itemId, setItemId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [discarded, setDiscarded] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const command = useAftersalesCommand({
    employeeId: employee.id, operation: `remake:${invoice.id}`, schema: remakeInputSchema,
    execute: remakeOrderItem, onUpdated,
    onSuccess: () => { setItemId(null); setReason(''); setDiscarded(false) },
  })
  useEffect(() => { onLockChange(command.locked); return () => onLockChange(false) }, [command.locked, onLockChange])
  const eligibleSession = invoice.orderSession && invoice.orderSession.sessionStatus !== 'CANCELLED' &&
    (!invoice.orderSession.tableId || invoice.orderSession.sessionStatus === 'ACTIVE')
  const selected = invoice.orderItems.find(item => item.id === (command.submitted?.payload.itemId ?? itemId))
  function eligible(id: string) {
    const item = invoice.orderItems.find(line => line.id === id)
    return Boolean(canCreate && !blocked && invoice.paymentStatus === 'PAID' && eligibleSession &&
      item?.serveStatus === 'SERVED' && item.isPaid && !item.originalRemake)
  }
  if (!canCreate && !invoice.orderItems.some(item => item.originalRemake)) return null
  return <section aria-label="Làm lại món" className="space-y-4 border-t border-border pt-5">
    <h3 className="flex items-center gap-2 text-base font-semibold"><RotateCcw size={18} aria-hidden="true" />Làm lại món</h3>
    {!eligibleSession && canCreate && <p className="text-sm text-muted-foreground">Phiên tại bàn đã đóng hoặc bị hủy; không thể gửi món làm lại vào bàn cũ.</p>}
    <ul className="divide-y divide-border">{invoice.orderItems.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 text-sm"><p className="font-medium">{item.quantity} × {item.menuItem?.name ?? 'Món'}</p>
        {item.originalRemake && <><Badge variant="secondary" className="mt-1">Đã yêu cầu làm lại</Badge><p className="mt-1 break-words text-xs text-muted-foreground">{item.originalRemake.reason}</p></>}
        {!item.originalRemake && item.serveStatus !== 'SERVED' && <p className="mt-1 text-xs text-muted-foreground">Chưa giao món</p>}
      </div>
      {canCreate && !item.originalRemake && <Button variant="outline" size="sm" disabled={!eligible(item.id) || command.locked} onClick={() => { setItemId(item.id); setReason(''); setDiscarded(false); setFormError(null); command.mutation.reset() }}><RotateCcw size={16} aria-hidden="true" />Làm lại</Button>}
    </li>)}</ul>
    {command.submitted && <div role="status" className="border-l-2 border-amber-500 pl-3 text-sm">
      <p>Chưa xác nhận yêu cầu làm lại · {selected?.menuItem?.name ?? command.submitted.payload.itemId}</p>
      <p className="mt-1 break-words">{command.submitted.payload.reason}</p>
      <Button className="mt-2" variant="outline" size="sm" disabled={!canCreate || !command.canRecover} onClick={() => command.submit(command.submitted!.payload)}><RefreshCw size={16} aria-hidden="true" />Kiểm tra lại cùng yêu cầu làm lại</Button>
    </div>}
    {command.error && <p role="alert" className="text-sm text-destructive">{command.error}</p>}
    {command.mutation.data && !command.submitted && <p role="status" className="flex gap-2 text-sm text-emerald-800"><CheckCircle2 size={16} aria-hidden="true" />Đã gửi món làm lại vào bếp, không thu thêm tiền.</p>}
    <Dialog open={Boolean(itemId)} label="Xác nhận làm lại món" maxWidth="sm" showCloseButton={!command.locked} onClose={() => { if (!command.locked) setItemId(null) }}>
      <form onSubmit={event => {
        event.preventDefault()
        if (!canCreate || (!command.submitted && (!itemId || !eligible(itemId)))) return
        const parsed = remakeInputSchema.safeParse({ itemId, reason })
        if (!command.submitted && (!parsed.success || !discarded)) { setFormError('Nhập lý do từ 3 đến 500 ký tự và xác nhận món lỗi đã bỏ.'); return }
        setFormError(null)
        if (command.submitted) command.submit(command.submitted.payload)
        else if (parsed.success) command.submit(parsed.data)
      }}>
        <h2 className="pr-8 text-lg font-semibold">Xác nhận làm lại món</h2>
        <p className="mt-4 font-semibold">{selected?.quantity} × {selected?.menuItem?.name ?? 'Món'}</p>
        <p className="mt-2 text-sm text-muted-foreground">Làm lại toàn bộ dòng món một lần, giữ nguyên tùy chọn và không thu thêm tiền.</p>
        <label className="mt-4 block space-y-1 text-sm"><span>Lý do làm lại</span><Input required minLength={3} maxLength={500} value={command.submitted?.payload.reason ?? reason} disabled={command.locked} onChange={event => setReason(event.target.value)} /></label>
        <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" required checked={discarded} disabled={command.locked} onChange={event => setDiscarded(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span>Tôi xác nhận toàn bộ dòng món gốc bị lỗi và đã bỏ. Không hoàn nguyên liệu vào kho.</span></label>
        {(formError || command.error) && <p role="alert" className="mt-3 text-sm text-destructive">{formError ?? command.error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={command.locked} onClick={() => setItemId(null)}>Quay lại</Button>
          <Button type="submit" isLoading={command.mutation.isPending} disabled={!canCreate || (!command.submitted && (!discarded || !itemId || !eligible(itemId)))}><RotateCcw size={16} aria-hidden="true" />{command.submitted ? 'Kiểm tra lại cùng yêu cầu làm lại' : 'Xác nhận gửi bếp'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  </section>
}
