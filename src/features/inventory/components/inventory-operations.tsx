import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/shared/lib/format'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { z } from 'zod'
import { Check, Plus, Search, Trash2 } from 'lucide-react'
import type { Session } from '../../auth/session'
import { Button, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { pendingOperationPrefix } from '../../../shared/api/idempotency'
import { pendingIntentKey, readPendingIntent, writePendingIntent, isPendingIntentExpired, type PendingIntent } from '../../../shared/api/pending-intent'
import { getInventoryItems } from '../inventory.api'
import { bulkMoveStock, bulkMovementSchema, getInventoryWaste, type BulkMovement } from '../operations.api'

export function InventoryWasteTab() {
  useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('')
  const [invalid, setInvalid] = useState(false)
  const waste = useQuery({ queryKey: ['private', employee.id, 'inventory-waste', page, filter], queryFn: ({ signal }) => getInventoryWaste(page, filter || undefined, signal) })
  return <section aria-label="Hao hụt nguyên liệu" className="space-y-4">
    <form className="flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault(); const valid = !input.trim() || z.uuid().safeParse(input.trim()).success
      setInvalid(!valid); if (valid) { setFilter(input.trim()); setPage(1) }
    }}><Input className="min-w-0 flex-1" aria-label="Mã món trong đơn" value={input} onChange={e => setInput(e.target.value)} placeholder="Mã món trong đơn (UUID)" />
      <Button type="submit"><Search size={16} />Lọc hao hụt</Button></form>
    {invalid && <p role="alert">Mã món phải là UUID hợp lệ.</p>}
    {waste.isPending && <p role="status">Đang tải hao hụt…</p>}
    {waste.isError && <p role="alert">{errorMessage(waste.error)} <Button variant="outline" onClick={() => void waste.refetch()}>Thử lại</Button></p>}
    {!waste.isError && waste.data && <>
      {!waste.data.list.length && <p>Chưa có hao hụt trong bộ lọc này.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Nguyên liệu</th><th className="p-2">Số lượng</th><th className="p-2">Món / Phiên</th><th className="p-2">Lý do</th><th className="p-2">Người ghi nhận / Thời gian</th></tr></thead>
        <tbody>{waste.data.list.map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.snapshot.inventoryItemName}</td><td className="p-2 tabular-nums">{row.quantity} {row.snapshot.unitName}</td>
          <td className="p-2">{access.has('/orders_sessions_read') ? <Link className="underline" to={'/staff/pos/sessions/' + row.snapshot.orderItem.orderSessionId}>{row.snapshot.orderItem.menuItem.name}</Link> : row.snapshot.orderItem.menuItem.name}<p className="text-xs text-muted-foreground break-all">{row.orderItemId}</p></td>
          <td className="p-2 min-w-40 break-words">{row.reason}</td><td className="p-2">{row.employee.fullName}<p className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt, { seconds: true })}</p></td></tr>)}</tbody>
      </table></div>
      <Pagination page={page} totalPages={waste.data.totalPages} onPage={setPage} disabled={waste.isFetching} />
    </>}
  </section>
}

type DraftRow = { id: string; inventoryItemId: string; label: string; quantity: string; unitPrice: string; note: string }
const newRow = (): DraftRow => ({ id: crypto.randomUUID(), inventoryItemId: '', label: '', quantity: '', unitPrice: '', note: '' })
const bulkIntentSchema = z.object({ movement: bulkMovementSchema, labels: z.record(z.string(), z.string().max(500)) })
type BulkIntent = z.infer<typeof bulkIntentSchema>

export function InventoryBulkTab() {
  const { t } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const storageKey = pendingIntentKey(employee.id, 'inventory.bulk')
  const [recovery] = useState(() => {
    try {
      const intent = readPendingIntent(storageKey, bulkIntentSchema)
      const legacy = !intent && Object.keys(sessionStorage).some(key =>
        key.startsWith(`${pendingOperationPrefix}private:/inventory/imports/bulk:`) ||
        key.startsWith(`${pendingOperationPrefix}private:/inventory/exports/bulk:`))
      return { intent, error: legacy }
    } catch { return { intent: null, error: true } }
  })
  const [pending, setPending] = useState(recovery.intent)
  const [type, setType] = useState<'IMPORT' | 'EXPORT'>(recovery.intent?.payload.movement.type ?? 'IMPORT')
  const [rows, setRows] = useState<DraftRow[]>(() => recovery.intent
    ? recovery.intent.payload.movement.items.map(item => ({ ...item, id: crypto.randomUUID(), unitPrice: 'unitPrice' in item ? item.unitPrice : '', label: recovery.intent!.payload.labels[item.inventoryItemId] ?? item.inventoryItemId }))
    : [newRow()])
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [review, setReview] = useState<BulkMovement | null>(recovery.intent?.payload.movement ?? null)
  const [validation, setValidation] = useState('')
  const client = useQueryClient()
  const flight = useRef(false)
  const canAdjust = access.has('/inventory_stock_adjust')
  const options = useQuery({ queryKey: ['private', employee.id, 'inventory-bulk-options', keyword], queryFn: ({ signal }) => getInventoryItems({ itemPerPage: 100, keyword: keyword || undefined }, signal), enabled: canAdjust && !pending && !recovery.error })
  const mutation = useMutation({
    retry: false,
    mutationFn: (intent: PendingIntent<BulkIntent>) => bulkMoveStock(intent.payload.movement, intent.idempotencyKey),
    onSuccess: () => { sessionStorage.removeItem(storageKey); setPending(null) },
    onError: (error, intent) => {
      if (!intent.uncertain && error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        sessionStorage.removeItem(storageKey); setPending(null); setReview(null)
      } else {
        const unknown = { ...intent, uncertain: true }
        setPending(unknown)
        try { writePendingIntent(storageKey, unknown) } catch { setValidation(t('inventory.movement.storageFailed')) }
      }
    },
    onSettled: () => {
      flight.current = false
      for (const key of ['inventory-items', 'inventory-transactions', 'inventory-reorder-alerts']) void client.invalidateQueries({ queryKey: [key] })
    },
  })
  const edit = (id: string, change: Partial<DraftRow>) => setRows(rows.map(row => row.id === id ? { ...row, ...change } : row))
  if (!canAdjust) return null
  if (recovery.error) return <p role="alert" className="border-l-2 border-destructive p-3 text-sm text-destructive">{t('inventory.movement.corrupt')}</p>
  const expired = pending && isPendingIntentExpired(pending)
  return <section aria-label="Nhập xuất nhiều nguyên liệu" className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <label className="flex items-center gap-2"><input type="radio" name="movement-type" checked={type === 'IMPORT'} disabled={Boolean(review)} onChange={() => setType('IMPORT')} />Nhập kho</label>
      <label className="flex items-center gap-2"><input type="radio" name="movement-type" checked={type === 'EXPORT'} disabled={Boolean(review)} onChange={() => setType('EXPORT')} />Xuất kho</label>
    </div>
    {!review && <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setKeyword(search.trim()) }}>
      <Input className="min-w-0 flex-1" value={search} onChange={e => setSearch(e.target.value)} aria-label="Tìm nguyên liệu cho lô" />
      <Button type="submit" variant="outline"><Search size={16} />Tìm nguyên liệu</Button>
    </form>}
    {options.isError && <p role="alert">{errorMessage(options.error)}</p>}
    <form className="space-y-4" onSubmit={e => {
      e.preventDefault()
      if (flight.current || mutation.isPending || mutation.isSuccess) return
      if (pending && isPendingIntentExpired(pending)) { setValidation(t('inventory.movement.expired')); return }
      if (review) {
        const intent = pending ?? { payload: bulkIntentSchema.parse({ movement: review, labels: Object.fromEntries(rows.map(row => [row.inventoryItemId, row.label])) }), idempotencyKey: crypto.randomUUID(), createdAt: Date.now() }
        try { writePendingIntent(storageKey, { ...intent, uncertain: true }) }
        catch { setValidation(t('inventory.movement.storageFailed')); return }
        setPending(intent); setValidation(''); flight.current = true; mutation.mutate(intent); return
      }
      const parsed = bulkMovementSchema.safeParse({ type, items: rows.map(({ inventoryItemId, quantity, unitPrice, note }) => ({ inventoryItemId, quantity, note, ...(type === 'IMPORT' ? { unitPrice } : {}) })) })
      if (parsed.success) { mutation.reset(); setReview(parsed.data); setValidation('') } else setValidation(parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ')
    }}>
      <fieldset disabled={Boolean(review) || Boolean(pending) || mutation.isPending} className="space-y-3">
        {rows.map((row, index) => <div key={row.id} className="grid gap-3 border-b border-border py-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Nguyên liệu {index + 1}<select aria-label={`Nguyên liệu ${index + 1}`} required className="mt-1 block h-10 w-full rounded border border-border p-2" value={row.inventoryItemId} onChange={e => {
            const item = options.data?.list.find(item => item.id === e.target.value)
            edit(row.id, { inventoryItemId: e.target.value, label: item ? item.name + ' (' + (item.unit?.name ?? '') + ')' : '' })
          }}><option value="">Chọn nguyên liệu</option>
            {row.inventoryItemId && !options.data?.list.some(item => item.id === row.inventoryItemId) && <option value={row.inventoryItemId}>{row.label}</option>}
            {options.data?.list.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit?.name})</option>)}
          </select></label>
          <label className="text-sm">Số lượng {index + 1}<Input required inputMode="decimal" value={row.quantity} onChange={e => edit(row.id, { quantity: e.target.value })} /></label>
          {type === 'IMPORT' && <label className="text-sm">Đơn giá {index + 1}<Input required inputMode="decimal" value={row.unitPrice} onChange={e => edit(row.id, { unitPrice: e.target.value })} /></label>}
          <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">Lý do {index + 1}<Input required minLength={3} maxLength={500} value={row.note} onChange={e => edit(row.id, { note: e.target.value })} /></label>
            <Button type="button" variant="outline" aria-label={'Xóa dòng ' + (index + 1)} title="Xóa dòng" disabled={rows.length === 1} onClick={() => setRows(rows.filter(item => item.id !== row.id))}><Trash2 size={16} /></Button>
          </div>
        </div>)}
        <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => setRows([...rows, newRow()])}><Plus size={16} />Thêm dòng</Button>
      </fieldset>
      {validation && <p role="alert">{validation}</p>}
      {review && <p role="status">{type === 'IMPORT' ? 'Nhập' : 'Xuất'} {review.items.length} nguyên liệu. Xác nhận số lượng và lý do bên trên.</p>}
      {pending && <p role="alert">{t(expired ? 'inventory.movement.expired' : 'inventory.movement.uncertain')}</p>}
      {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
      {mutation.isSuccess ? <>
        <p role="status">Đã ghi nhận {mutation.data.length} giao dịch kho.</p>
        <Button type="button" variant="outline" onClick={() => { mutation.reset(); setReview(null); setRows([newRow()]) }}>Lô mới</Button>
      </> : <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending || Boolean(expired) || (!pending && (options.isPending || options.isError))}><Check size={16} />{pending ? 'Gửi lại cùng lô' : review ? 'Xác nhận ghi sổ' : 'Kiểm tra lô'}</Button>
        {review && !pending && !mutation.isPending && !mutation.isError && <Button type="button" variant="outline" onClick={() => setReview(null)}>Sửa lô</Button>}
      </div>}
    </form>
  </section>
}
