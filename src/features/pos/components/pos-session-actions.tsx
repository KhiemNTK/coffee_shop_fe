import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { CheckCircle2, GitMerge, Split } from 'lucide-react'
import type { Session } from '../../auth/session'
import { getDiningTables, splitSession, type SessionDetail } from '../pos.api'
import { mergeTables } from '../../dining-tables/dining-tables.api'
import { posKeys } from '../pos.keys'
import { kitchenKeys } from '../../kitchen/kitchen.api'
import { errorMessage } from '@/shared/api/client'
import { Button, Dialog, Input } from '@/shared/ui'

export function PosSessionActions({ session, disabled }: { session: SessionDetail; disabled: boolean }) {
  const { authorization } = useOutletContext<Session>()
  const [mode, setMode] = useState<'merge' | 'split' | null>(null)
  const can = (key: string) => authorization.permissionKeys.includes(key)
  if (!session.table || session.sessionStatus !== 'ACTIVE') return null
  return <>
    {can('/orders_tables_merge') && <Button variant="outline" disabled={disabled} onClick={() => setMode('merge')}><GitMerge className="h-4 w-4" />Gộp bàn</Button>}
    {can('/orders_tables_split') && <Button variant="outline" disabled={disabled} onClick={() => setMode('split')}><Split className="h-4 w-4" />Tách món</Button>}
    {mode && <SessionActionDialog mode={mode} session={session} onClose={() => setMode(null)} />}
  </>
}

function SessionActionDialog({ mode, session, onClose }: { mode: 'merge' | 'split'; session: SessionDetail; onClose: () => void }) {
  const { employee } = useOutletContext<Session>()
  const navigate = useNavigate()
  const client = useQueryClient()
  // Freeze original quantities while the parent continues polling.
  const [snapshot] = useState(() => session.orderItems.filter(item => !item.isPaid && !item.invoiceId && item.serveStatus !== 'CANCELLED'))
  const [target, setTarget] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [review, setReview] = useState(false)
  const tables = useQuery({ queryKey: posKeys.tables(employee.id), queryFn: ({ signal }) => getDiningTables(signal) })
  const choices = tables.data?.filter(table => table.id !== session.table?.id && table.status === (mode === 'merge' ? 'OCCUPIED' : 'EMPTY')) ?? []
  const items = snapshot.filter(item => Number(quantities[item.id] || 0) > 0).map(item => ({
    orderItemId: item.id, expectedOriginalQuantity: item.quantity, quantityToMove: Number(quantities[item.id]),
  }))
  const invalid = snapshot.some(item => {
    const value = Number(quantities[item.id] || 0)
    return !Number.isInteger(value) || value < 0 || value > item.quantity ||
      (value > 0 && value < item.quantity && item.serveStatus !== 'PENDING')
  })
  const eligible = mode === 'split' ? items.length > 0 && !invalid :
    !session.orderItems.some(item => item.isPaid || item.invoiceId)
  const mutation = useMutation({
    mutationFn: () => mode === 'merge' ? mergeTables([session.table!.id], target) :
      splitSession({ sourceOrderSessionId: session.id, destinationTableId: target, itemsToMove: items }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: posKeys.tables(employee.id) })
      void client.invalidateQueries({ queryKey: ['private', employee.id, 'orders'] })
      void client.invalidateQueries({ queryKey: kitchenKeys.all(employee.id) })
      onClose()
      navigate('/staff/pos')
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ['private', employee.id, 'orders'] })
      void tables.refetch()
    },
  })
  return <Dialog open maxWidth="lg" onClose={() => { if (!mutation.isPending) onClose() }}>
    <form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); if (review) mutation.mutate(); else setReview(true) }}>
      <h2 className="pr-8 text-lg font-semibold">{mode === 'merge' ? 'Gộp bàn' : 'Tách món'} · {session.table?.name}</h2>
      <fieldset disabled={mutation.isPending || review} className="space-y-4">
        <label className="block">Bàn đích<select required className="mt-1 block w-full rounded border p-2" value={target} onChange={e => setTarget(e.target.value)}>
          <option value="">Chọn bàn</option>{choices.map(table => <option key={table.id} value={table.id}>{table.name}</option>)}
        </select></label>
        {tables.isError && <p role="alert">{errorMessage(tables.error)}</p>}
        {mode === 'split' && snapshot.map(item => <label key={item.id} className="flex items-center justify-between gap-3 border-b py-2">
          <span className="min-w-0 break-words">{item.menuItem.name} · hiện có {item.quantity}{item.serveStatus !== 'PENDING' && ' · Chỉ chuyển cả dòng'}</span>
          <Input className="w-24 shrink-0" aria-label={'Số lượng tách ' + item.menuItem.name} type="number" min={0} max={item.quantity} step={item.serveStatus === 'PENDING' ? 1 : item.quantity}
            value={quantities[item.id] ?? '0'} onChange={e => setQuantities({ ...quantities, [item.id]: e.target.value })} />
        </label>)}
      </fieldset>
      {mode === 'merge' && !eligible && <p role="alert">Không gộp phiên đã có món được lập hóa đơn hoặc thanh toán.</p>}
      {review && <p>Xác nhận chuyển {mode === 'merge' ? 'toàn bộ món' : items.reduce((sum, item) => sum + item.quantityToMove, 0) + ' phần'} sang {choices.find(table => table.id === target)?.name}?</p>}
      {mutation.isError && <p role="alert" className="text-destructive">{errorMessage(mutation.error)} Kiểm tra lại các phiên bàn trước khi gửi lại.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!target || !eligible || mutation.isPending || mutation.isError}><CheckCircle2 className="h-4 w-4" />{review ? 'Xác nhận' : 'Kiểm tra trước khi chuyển'}</Button>
        {review && !mutation.isPending && <Button type="button" variant="outline" onClick={() => setReview(false)}>Quay lại</Button>}
        {mutation.isError && <Button type="button" variant="outline" onClick={onClose}>Đóng để kiểm tra phiên</Button>}
      </div>
    </form>
  </Dialog>
}
