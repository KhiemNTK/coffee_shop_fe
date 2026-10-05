import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import type { Session } from '../../auth/session'
import {
  getSuppliers, saveSupplier, deleteSupplier, getReceipts, getReceipt,
  saveReceipt, getStocktakes, getStocktake, createStocktake, saveCounts,
  postDocument, cancelDocument,
  type Supplier, type ReceiptDetail, type ReceiptInput, type StocktakeDetail, type StocktakeCountInput,
} from '../procurement.api'
import { getInventoryItems, type InventoryItem } from '../inventory.api'
import { formatQuantity, quantityDifference } from '../quantity'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { formatPrice, formatDate } from '../../../shared/lib/format'
import { Button, Dialog, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

type DocumentKind = 'purchase-receipts' | 'stocktakes'
const statusLabels = { DRAFT: 'Nháp', POSTED: 'Đã ghi sổ', CANCELLED: 'Đã hủy' }
const selectClass = 'w-full rounded-md border border-border bg-card p-2 text-sm'

export function ProcurementTab() {
  const { employee, authorization } = useOutletContext<Session>()
  const client = useQueryClient()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const [view, setView] = useState<'suppliers' | DocumentKind>(() =>
    can('/inventory_suppliers_read') ? 'suppliers'
      : can('/inventory_purchase-receipts_read') ? 'purchase-receipts' : 'stocktakes')
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const search = useDeferredValue(keyword)
  const [supplierForm, setSupplierForm] = useState<Supplier | null>()
  const [newDocument, setNewDocument] = useState<DocumentKind | null>(null)
  const [document, setDocument] = useState<{ kind: DocumentKind; id: string } | null>(null)
  const [confirmation, setConfirmation] = useState<{ kind: DocumentKind | 'suppliers'; id: string; action: 'post' | 'cancel' | 'delete' } | null>(null)
  const key = ['private', employee.id, 'inventory-procurement'] as const
  const suppliers = useQuery({
    queryKey: [...key, 'suppliers', page, search], queryFn: ({ signal }) => getSuppliers(page, search, signal),
    enabled: view === 'suppliers' && can('/inventory_suppliers_read'),
  })
  const receipts = useQuery({
    queryKey: [...key, 'receipts', page], queryFn: ({ signal }) => getReceipts(page, signal),
    enabled: view === 'purchase-receipts' && can('/inventory_purchase-receipts_read'),
  })
  const stocktakes = useQuery({
    queryKey: [...key, 'stocktakes', page], queryFn: ({ signal }) => getStocktakes(page, signal),
    enabled: view === 'stocktakes' && can('/inventory_stocktakes_read'),
  })
  const receipt = useQuery({
    queryKey: [...key, 'receipt', document?.id],
    queryFn: ({ signal }) => getReceipt(document!.id, signal),
    enabled: document?.kind === 'purchase-receipts',
  })
  const stocktake = useQuery({
    queryKey: [...key, 'stocktake', document?.id],
    queryFn: ({ signal }) => getStocktake(document!.id, signal),
    enabled: document?.kind === 'stocktakes',
  })
  const postingStocktake = useQuery({
    queryKey: [...key, 'stocktake', confirmation?.id],
    queryFn: ({ signal }) => getStocktake(confirmation!.id, signal),
    enabled: confirmation?.kind === 'stocktakes' && confirmation.action === 'post' && can('/inventory_stocktakes_read'),
    staleTime: 0,
  })
  const stocktakePostReady = confirmation?.kind !== 'stocktakes' || (postingStocktake.isSuccess && !postingStocktake.isFetching
    && postingStocktake.data.status === 'DRAFT' && postingStocktake.data.items.length > 0
    && postingStocktake.data.items.every(item => item.countedQuantity !== null))
  function updated() {
    setDocument(null); setNewDocument(null); setSupplierForm(undefined); setConfirmation(null)
    void client.invalidateQueries({ queryKey: key })
    for (const name of ['inventory-items', 'inventory-reorder-alerts', 'inventory-transactions', 'public-menu']) {
      void client.invalidateQueries({ queryKey: [name] })
    }
    for (const name of ['receipt-item-options', 'receipt-supplier-options', 'stocktake-item-options']) {
      void client.invalidateQueries({ queryKey: ['private', employee.id, name] })
    }
  }
  const action = useMutation({
    mutationFn: ({ target, reason, expectedCounts }: { target: NonNullable<typeof confirmation>; reason: string; expectedCounts?: StocktakeCountInput[] }) =>
      target.kind === 'suppliers' ? deleteSupplier(target.id)
        : target.action === 'post' ? postDocument(target.kind, target.id, expectedCounts)
          : cancelDocument(target.kind, target.id, reason),
    onSuccess: updated,
  })
  const uncertainAction = action.isError && (!(action.error instanceof ApiError) || action.error.status >= 500)
  function openDocument(kind: DocumentKind, id: string) {
    client.removeQueries({ queryKey: [...key, kind === 'stocktakes' ? 'stocktake' : 'receipt', id], exact: true })
    setDocument({ kind, id })
  }
  function confirm(target: NonNullable<typeof confirmation>) {
    action.reset()
    setConfirmation(target)
  }
  const current = view === 'suppliers' ? suppliers : view === 'purchase-receipts' ? receipts : stocktakes
  const detail = document?.kind === 'stocktakes' ? stocktake : receipt
  const canReadView = can(`/inventory_${view === 'suppliers' ? 'suppliers' : view}_read`)
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {(['suppliers', 'purchase-receipts', 'stocktakes'] as const).map((kind) =>
        <Button key={kind} size="sm" variant={view === kind ? 'default' : 'outline'} aria-pressed={view === kind}
          onClick={() => { setView(kind); setPage(1) }}>
          {{ suppliers: 'Nhà cung cấp', 'purchase-receipts': 'Phiếu nhập', stocktakes: 'Kiểm kê' }[kind]}
        </Button>)}
      <Button size="sm" variant="outline" disabled={!can(`/inventory_${view === 'suppliers' ? 'suppliers_manage' : `${view}_create`}`)
        || (view === 'purchase-receipts' && !can('/inventory_suppliers_read')) || (view === 'stocktakes' && !can('/inventory_read'))}
        onClick={() => view === 'suppliers' ? setSupplierForm(null) : setNewDocument(view)}>
        <Plus size={16} aria-hidden="true" /> Tạo mới
      </Button>
    </div>
    {view === 'suppliers' && <label className="block max-w-sm text-sm">Tìm nhà cung cấp
      <Input value={keyword} type="search" onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
    </label>}
    {!canReadView ? <p role="alert">Bạn chưa có quyền đọc danh sách này.</p>
      : current.isLoading ? <p role="status">Đang tải…</p>
        : current.error ? <p role="alert" className="text-sm text-destructive">{errorMessage(current.error)}</p>
          : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border"><th className="p-2">Mã / Tên</th><th className="p-2">Thông tin</th><th className="p-2">Thao tác</th></tr></thead>
            <tbody>
              {view === 'suppliers' && suppliers.data?.list.map((supplier) => <tr key={supplier.id} className="border-b border-border">
                <td className="p-2">{supplier.code} · {supplier.name}</td><td className="p-2">{supplier.phoneNumber || supplier.email || '—'}</td>
                <td className="p-2"><div className="flex gap-2">
                  <Button size="sm" variant="outline" title="Sửa nhà cung cấp" aria-label="Sửa nhà cung cấp" disabled={!can('/inventory_suppliers_manage')} onClick={() => setSupplierForm(supplier)}><Pencil size={16} /></Button>
                  <Button size="sm" variant="outline" title="Xóa nhà cung cấp" aria-label="Xóa nhà cung cấp" disabled={!can('/inventory_suppliers_manage')} onClick={() => confirm({ kind: 'suppliers', id: supplier.id, action: 'delete' })}><Trash2 size={16} /></Button>
                </div></td>
              </tr>)}
              {view === 'purchase-receipts' && receipts.data?.list.map((row) => <tr key={row.id} className="border-b border-border">
                <td className="p-2">{row.receiptNumber}</td><td className="p-2">{statusLabels[row.status]} · {formatPrice(row.totalAmount)} · {formatDate(row.receivedAt)}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => openDocument(view, row.id)}>Chi tiết</Button>
                  {row.status === 'DRAFT' && <DocumentActions kind={view} id={row.id} can={can} onAction={confirm} />}</td>
              </tr>)}
              {view === 'stocktakes' && stocktakes.data?.list.map((row) => <tr key={row.id} className="border-b border-border">
                <td className="p-2">{row.stocktakeNumber}</td><td className="p-2">{statusLabels[row.status]} · {formatDate(row.createdAt)}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => openDocument(view, row.id)}>Chi tiết</Button>
                  {row.status === 'DRAFT' && <DocumentActions kind={view} id={row.id} can={can} onAction={confirm} />}</td>
              </tr>)}
            </tbody>
          </table>{current.data?.totalItems === 0 && <p className="py-5 text-sm">Chưa có dữ liệu.</p>}
            <Pagination page={page} totalPages={current.data?.totalPages ?? 0} onPage={setPage} disabled={current.isFetching} />
          </div>}
    {supplierForm !== undefined && <SupplierForm initial={supplierForm} onClose={() => setSupplierForm(undefined)} onSaved={updated} />}
    {(newDocument === 'purchase-receipts' || (document?.kind === 'purchase-receipts' && receipt.data)) &&
      <ReceiptForm key={document?.id ?? 'new-receipt'} initial={document ? receipt.data : undefined}
        editable={can('/inventory_purchase-receipts_create')} onClose={() => { setDocument(null); setNewDocument(null) }} onSaved={updated} />}
    {(newDocument === 'stocktakes' || (document?.kind === 'stocktakes' && stocktake.data)) &&
      <StocktakeForm key={document?.id ?? 'new-stocktake'} initial={document ? stocktake.data : undefined}
        editable={can('/inventory_stocktakes_create')} onClose={() => { setDocument(null); setNewDocument(null) }} onSaved={updated} />}
    {document && !detail.data && <Dialog open onClose={() => setDocument(null)}>
      <h2>Chi tiết chứng từ</h2><p role={detail.error ? 'alert' : 'status'}>{detail.error ? errorMessage(detail.error) : 'Đang tải…'}</p>
    </Dialog>}
    {confirmation && <Dialog open onClose={() => { if (!action.isPending) setConfirmation(null) }} maxWidth={confirmation.kind === 'stocktakes' && confirmation.action === 'post' ? 'lg' : 'sm'}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        if (action.isPending || (confirmation.action === 'post' && !stocktakePostReady)) return
        if (uncertainAction && action.variables) { action.mutate(action.variables); return }
        action.mutate({ target: confirmation, reason: String(new FormData(event.currentTarget).get('reason') ?? '').trim(),
          expectedCounts: confirmation.kind === 'stocktakes' && confirmation.action === 'post'
            ? postingStocktake.data!.items.map(item => ({ inventoryItemId: item.inventoryItemId, countedQuantity: item.countedQuantity! })) : undefined })
      }}>
        <h2 className="pr-8 text-lg font-semibold">{confirmation.action === 'post' ? 'Xác nhận ghi sổ' : confirmation.action === 'delete' ? 'Xóa nhà cung cấp' : 'Hủy chứng từ'}</h2>
        {confirmation.action === 'post' && <p>Ghi sổ sẽ cập nhật tồn kho và khóa chỉnh sửa chứng từ.</p>}
        {confirmation.kind === 'stocktakes' && confirmation.action === 'post' && <>
          {postingStocktake.isFetching ? <p role="status">Đang đối soát số đếm đã lưu…</p>
            : postingStocktake.error ? <><p role="alert">{errorMessage(postingStocktake.error)}</p><Button type="button" variant="outline" onClick={() => void postingStocktake.refetch()}>Tải lại phiếu</Button></>
              : postingStocktake.data && <><p className="font-medium">{postingStocktake.data.stocktakeNumber}</p><StocktakeSummary stocktake={postingStocktake.data} />
                {!stocktakePostReady && <p role="alert">Phiếu phải còn nháp và tất cả nguyên liệu phải có số đếm đã lưu.</p>}</>}
        </>}
        {confirmation.action === 'cancel' && <label className="block">Lý do hủy<Input name="reason" minLength={3} maxLength={500} required disabled={action.isPending || uncertainAction} /></label>}
        {action.error && <p role="alert" className="text-sm text-destructive">{errorMessage(action.error)}</p>}
        {confirmation.kind === 'stocktakes' && confirmation.action === 'post' && action.error instanceof ApiError && action.error.code === 'INVENTORY_STOCKTAKE_COUNTS_CHANGED'
          && <Button type="button" variant="outline" onClick={() => { action.reset(); void postingStocktake.refetch() }}>Tải lại phiếu</Button>}
        <Button type="submit" isLoading={action.isPending} disabled={confirmation.action === 'post' && !stocktakePostReady}>Xác nhận</Button>
      </form>
    </Dialog>}
  </section>
}

function DocumentActions({ kind, id, can, onAction }: {
  kind: DocumentKind; id: string; can: (key: string) => boolean
  onAction: (action: { kind: DocumentKind; id: string; action: 'post' | 'cancel' }) => void
}) {
  return <span className="ml-2 inline-flex gap-2">
    {can(`/inventory_${kind}_post`) && <Button variant="outline" size="sm" disabled={kind === 'stocktakes' && !can('/inventory_stocktakes_read')} onClick={() => onAction({ kind, id, action: 'post' })}><Check size={16} /> Ghi sổ</Button>}
    {can(`/inventory_${kind}_create`) && <Button variant="outline" size="sm" onClick={() => onAction({ kind, id, action: 'cancel' })}><X size={16} /> Hủy</Button>}
  </span>
}

function SupplierForm({ initial, onClose, onSaved }: { initial: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const mutation = useMutation({ mutationFn: (data: FormData) => saveSupplier({
    code: String(data.get('code')).trim(), name: String(data.get('name')).trim(),
    phoneNumber: String(data.get('phoneNumber')).trim() || null,
    email: String(data.get('email')).trim() || null,
    address: String(data.get('address')).trim() || null,
  }, initial?.id), onSuccess: onSaved })
  return <Dialog open onClose={() => { if (!mutation.isPending) onClose() }}>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(new FormData(event.currentTarget)) }}>
      <h2 className="pr-8 text-lg font-semibold">{initial ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h2>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <label className="block text-sm">Mã nhà cung cấp<Input name="code" defaultValue={initial?.code} minLength={2} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" required /></label>
        <label className="block text-sm">Tên<Input name="name" defaultValue={initial?.name} maxLength={160} required /></label>
        <label className="block text-sm">Điện thoại<Input name="phoneNumber" type="tel" defaultValue={initial?.phoneNumber ?? ''} minLength={6} maxLength={32} /></label>
        <label className="block text-sm">Email<Input name="email" type="email" defaultValue={initial?.email ?? ''} maxLength={254} /></label>
        <label className="block text-sm">Địa chỉ<Input name="address" defaultValue={initial?.address ?? ''} maxLength={300} /></label>
      </fieldset>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      <Button type="submit" isLoading={mutation.isPending}>Lưu nhà cung cấp</Button>
    </form>
  </Dialog>
}

function ReceiptForm({ initial, editable, onClose, onSaved }: {
  initial?: ReceiptDetail; editable: boolean; onClose: () => void; onSaved: () => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const canReadSuppliers = authorization.permissionKeys.includes('/inventory_suppliers_read')
  const [supplier, setSupplier] = useState<Supplier | null>(initial?.supplier ?? null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const deferredSupplierSearch = useDeferredValue(supplierSearch)
  const deferredItemSearch = useDeferredValue(itemSearch)
  const [uncertain, setUncertain] = useState(false)
  const readOnly = !editable || Boolean(initial && initial.status !== 'DRAFT')
  const [lines, setLines] = useState(initial?.items.map((item) => ({
    inventoryItemId: item.inventoryItemId, quantity: item.quantity, unitPrice: item.unitPrice, name: item.inventoryItemName,
  })) ?? [{ inventoryItemId: '', quantity: '1', unitPrice: '0', name: '' }])
  const suppliers = useQuery({ queryKey: ['private', employee.id, 'receipt-supplier-options', deferredSupplierSearch], queryFn: ({ signal }) => getSuppliers(1, deferredSupplierSearch, signal), enabled: !readOnly && canReadSuppliers })
  const inventory = useQuery({ queryKey: ['private', employee.id, 'receipt-item-options', deferredItemSearch], queryFn: ({ signal }) => getInventoryItems({ keyword: deferredItemSearch.trim() || undefined, itemPerPage: 100 }, signal), enabled: !readOnly })
  const mutation = useMutation({
    mutationFn: (payload: ReceiptInput) => saveReceipt(payload, initial?.id),
    onSuccess: onSaved,
    onError: (error) => {
      const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500
        && error.status !== 408 && error.status !== 429
      // A new receipt must reconcile the original request before another can be created.
      if (!rejected) setUncertain(true)
      else if (initial) setUncertain(false)
    },
  })
  const locked = mutation.isPending || uncertain
  return <Dialog open onClose={() => { if (!mutation.isPending && (!uncertain || initial)) onClose() }} maxWidth="lg">
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault()
      if (mutation.isPending || readOnly) return
      if (uncertain && mutation.variables) { mutation.mutate(mutation.variables); return }
      mutation.mutate({ supplierId: supplier?.id ?? '', note: String(new FormData(event.currentTarget).get('note') ?? '').trim() || null,
        items: lines.map(({ inventoryItemId, quantity, unitPrice }) => ({ inventoryItemId, quantity, unitPrice })) })
    }}>
      <h2 className="pr-8 text-lg font-semibold">{initial ? initial.receiptNumber : 'Tạo phiếu nhập nháp'}</h2>
      <fieldset disabled={readOnly || locked} className="space-y-3">
        <label className="block text-sm">Tìm nhà cung cấp<Input type="search" disabled={!canReadSuppliers} value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} /></label>
        <label className="block text-sm">Nhà cung cấp<select className={selectClass} required disabled={!canReadSuppliers} value={supplier?.id ?? ''} onChange={(event) => setSupplier(suppliers.data?.list.find((entry) => entry.id === event.target.value) ?? null)}>
          <option value="">Chọn nhà cung cấp</option>
          {supplier && !suppliers.data?.list.some((entry) => entry.id === supplier.id) && <option value={supplier.id}>{supplier.name}</option>}
          {suppliers.data?.list.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>)}
        </select></label>
        <label className="block text-sm">Tìm nguyên liệu<Input type="search" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} /></label>
        {lines.map((line, index) => <div key={index} className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="text-sm">Nguyên liệu<select className={selectClass} required value={line.inventoryItemId} onChange={(event) => {
            const item = inventory.data?.list.find((row) => row.id === event.target.value)
            setLines(lines.map((entry, i) => i === index ? { ...entry, inventoryItemId: event.target.value, name: item?.name ?? '' } : entry))
          }}><option value="">Chọn nguyên liệu</option>
            {line.inventoryItemId && !inventory.data?.list.some((item) => item.id === line.inventoryItemId) && <option value={line.inventoryItemId}>{line.name}</option>}
            {inventory.data?.list.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit?.name}</option>)}
          </select></label>
          <label className="text-sm">Số lượng<Input type="number" min="0.0001" step="0.0001" required value={line.quantity} onChange={(event) => setLines(lines.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} /></label>
          <label className="text-sm">Đơn giá<Input type="number" min="0" step="0.01" required value={line.unitPrice} onChange={(event) => setLines(lines.map((entry, i) => i === index ? { ...entry, unitPrice: event.target.value } : entry))} /></label>
          <Button type="button" variant="outline" size="sm" aria-label="Xóa dòng" title="Xóa dòng" disabled={lines.length <= 1} onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 size={16} /></Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" disabled={lines.length >= 100} onClick={() => setLines([...lines, { inventoryItemId: '', quantity: '1', unitPrice: '0', name: '' }])}><Plus size={16} /> Thêm dòng</Button>
        <label className="block text-sm">Ghi chú<Input name="note" maxLength={500} defaultValue={initial?.note ?? ''} /></label>
      </fieldset>
      {(mutation.error || suppliers.error || inventory.error) && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error || suppliers.error || inventory.error)}</p>}
      {initial && <p>Tổng tiền: {formatPrice(initial.totalAmount)} · {statusLabels[initial.status]}</p>}
      {!readOnly && <Button type="submit" isLoading={mutation.isPending}>{uncertain ? 'Thử lại phiếu đã gửi' : 'Lưu phiếu nháp'}</Button>}
    </form>
  </Dialog>
}

function StocktakeForm({ initial, editable, onClose, onSaved }: {
  initial?: StocktakeDetail; editable: boolean; onClose: () => void; onSaved: () => void
}) {
  const { employee, authorization } = useOutletContext<Session>()
  const [keyword, setKeyword] = useState('')
  const search = useDeferredValue(keyword)
  const [selected, setSelected] = useState<InventoryItem[]>([])
  const [snapshot, setSnapshot] = useState(initial)
  const [counts, setCounts] = useState(() => Object.fromEntries(initial?.items.map(item => [item.inventoryItemId, item.countedQuantity ?? '']) ?? []))
  const [uncertain, setUncertain] = useState(false)
  const inventory = useQuery({ queryKey: ['private', employee.id, 'stocktake-item-options', search], queryFn: ({ signal }) => getInventoryItems({ keyword: search, itemPerPage: 100 }, signal), enabled: !initial && authorization.permissionKeys.includes('/inventory_read') })
  const readOnly = !editable || Boolean(initial && initial.status !== 'DRAFT')
  const mutation = useMutation({
    mutationFn: (payload: { inventoryItemIds: string[]; note?: string } | StocktakeCountInput[]) =>
      Array.isArray(payload) ? saveCounts(initial!.id, payload) : createStocktake(payload.inventoryItemIds, payload.note),
    onSuccess: onSaved,
    onError: error => setUncertain(!(error instanceof ApiError) || error.status >= 500),
  })
  const reload = useMutation({ mutationFn: () => getStocktake(initial!.id), onSuccess: result => {
    setSnapshot(result); setCounts(Object.fromEntries(result.items.map(item => [item.inventoryItemId, item.countedQuantity ?? ''])))
    mutation.reset(); setUncertain(false)
  } })
  const locked = mutation.isPending || reload.isPending || uncertain
  return <Dialog open onClose={() => { if (!mutation.isPending && !reload.isPending && (!uncertain || initial)) onClose() }} maxWidth="lg">
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault()
      if (mutation.isPending || readOnly || snapshot?.status === 'POSTED' || snapshot?.status === 'CANCELLED') return
      if (uncertain) { if (!initial && mutation.variables) mutation.mutate(mutation.variables); return }
      mutation.mutate(initial ? initial.items.map(item => ({ inventoryItemId: item.inventoryItemId, countedQuantity: counts[item.inventoryItemId]!.trim() }))
        : { inventoryItemIds: selected.map(item => item.id), note: String(new FormData(event.currentTarget).get('note') ?? '').trim() || undefined })
    }}>
      <h2 className="pr-8 text-lg font-semibold">{initial ? initial.stocktakeNumber : 'Tạo phiếu kiểm kê'}</h2>
      {snapshot && <><p className="text-sm">{statusLabels[snapshot.status]} · Snapshot: {formatDate(snapshot.createdAt)}</p>
        {snapshot.note && <p className="break-words text-sm">{snapshot.note}</p>}
        {snapshot.cancellationReason && <p className="break-words text-sm">Lý do hủy: {snapshot.cancellationReason}</p>}
        <StocktakeSummary stocktake={snapshot} /></>}
      <fieldset className="space-y-3" disabled={readOnly || locked || (snapshot && snapshot.status !== 'DRAFT')}>
        {snapshot ? !readOnly && snapshot.status === 'DRAFT' && snapshot.items.map(item => <label key={item.inventoryItemId} className="grid gap-2 border-b border-border pb-2 text-sm sm:grid-cols-2">
          <span>{item.inventoryItemName} ({item.unitName})</span>
          <Input aria-label={`Số lượng thực đếm ${item.inventoryItemName}`} name={item.inventoryItemId} type="number" min="0" max="99999999999999.9999" step="0.0001" value={counts[item.inventoryItemId] ?? ''} onChange={event => setCounts({ ...counts, [item.inventoryItemId]: event.target.value })} required />
        </label>) : <>
          <label className="block text-sm">Tìm nguyên liệu<Input value={keyword} type="search" onChange={(event) => setKeyword(event.target.value)} /></label>
          <p className="text-sm">Đã chọn: {selected.length}/100</p>
          {selected.length > 0 && <ul aria-label="Nguyên liệu đã chọn" className="space-y-1 text-sm">{selected.map(item => <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="break-words">{item.name} · {item.unit?.name}</span><Button type="button" variant="outline" size="sm" title={`Bỏ chọn ${item.name}`} aria-label={`Bỏ chọn ${item.name}`} onClick={() => setSelected(selected.filter(row => row.id !== item.id))}><X size={16} /></Button>
          </li>)}</ul>}
          <div className="max-h-72 overflow-y-auto" aria-busy={inventory.isFetching}>
            {inventory.isLoading && <p role="status">Đang tải nguyên liệu…</p>}
            {inventory.data?.list.length === 0 && <p>Không có nguyên liệu khớp bộ lọc.</p>}
            {inventory.data?.list.map((item) => <label key={item.id} className="flex items-center gap-2 border-b border-border py-2 text-sm">
              <input type="checkbox" checked={selected.some(row => row.id === item.id)} disabled={!selected.some(row => row.id === item.id) && selected.length >= 100}
                onChange={(event) => setSelected(event.target.checked ? [...selected, item] : selected.filter(row => row.id !== item.id))} />
              {item.name} · {formatQuantity(item.stock)} {item.unit?.name}
            </label>)}
          </div>
          <label className="block text-sm">Ghi chú<Input name="note" maxLength={500} /></label>
        </>}
      </fieldset>
      {(mutation.error || reload.error || inventory.error) && <p role="alert" className="text-sm text-destructive">{errorMessage(reload.error || mutation.error || inventory.error)}</p>}
      {inventory.error && <Button type="button" variant="outline" disabled={locked} isLoading={inventory.isFetching} onClick={() => void inventory.refetch()}>Tải lại nguyên liệu</Button>}
      {uncertain && initial ? <Button type="button" isLoading={reload.isPending} onClick={() => reload.mutate()}>Đọc lại phiếu</Button>
        : !readOnly && (!snapshot || snapshot.status === 'DRAFT') && <Button type="submit" isLoading={mutation.isPending} disabled={!initial && !selected.length}>{uncertain ? 'Thử lại phiếu đã gửi' : initial ? 'Lưu số đếm' : 'Tạo phiếu kiểm kê'}</Button>}
    </form>
  </Dialog>
}

function StocktakeSummary({ stocktake }: { stocktake: StocktakeDetail }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">Số đếm đã lưu và chênh lệch kiểm kê</caption>
    <thead className="hidden sm:table-header-group"><tr className="border-b border-border"><th className="p-2">Nguyên liệu</th><th className="p-2">Sổ sách</th><th className="p-2">Đã đếm</th><th className="p-2">Chênh lệch</th></tr></thead>
    <tbody>{stocktake.items.map(item => <tr key={item.inventoryItemId} className="grid border-b border-border pb-2 sm:table-row sm:pb-0">
      <td className="break-words p-2 font-medium sm:font-normal">{item.inventoryItemName} ({item.unitName})</td>
      <td className="flex justify-between gap-2 px-2 py-1 tabular-nums sm:table-cell sm:p-2"><span className="sm:hidden">Sổ sách</span><span className="break-all">{formatQuantity(item.expectedQuantity)}</span></td>
      <td className="flex justify-between gap-2 px-2 py-1 tabular-nums sm:table-cell sm:p-2"><span className="sm:hidden">Đã đếm</span><span className="break-all">{item.countedQuantity === null ? 'Chưa đếm' : formatQuantity(item.countedQuantity)}</span></td>
      <td className="flex justify-between gap-2 px-2 py-1 tabular-nums sm:table-cell sm:p-2"><span className="sm:hidden">Chênh lệch</span><span className="break-all">{item.differenceQuantity !== null ? formatQuantity(item.differenceQuantity)
        : item.countedQuantity === null ? '—' : formatQuantity(quantityDifference(item.countedQuantity, item.expectedQuantity))}</span></td>
    </tr>)}</tbody>
  </table></div>
}
