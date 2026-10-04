import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import type { Session } from '../../auth/session'
import {
  getSuppliers, saveSupplier, deleteSupplier, getReceipts, getReceipt,
  saveReceipt, getStocktakes, getStocktake, createStocktake, saveCounts,
  postDocument, cancelDocument,
  type Supplier, type ReceiptDetail, type StocktakeDetail,
} from '../procurement.api'
import { getInventoryItems } from '../inventory.api'
import { errorMessage } from '../../../shared/api/client'
import { formatPrice, formatDate } from '../../../shared/lib/format'
import { Button, Dialog, Input } from '../../../shared/ui'

type DocumentKind = 'purchase-receipts' | 'stocktakes'
const statusLabels = { DRAFT: 'Nháp', POSTED: 'Đã ghi sổ', CANCELLED: 'Đã hủy' }
const selectClass = 'w-full rounded-md border border-border bg-card p-2 text-sm'

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-end gap-3 py-3 text-sm">
    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</Button>
    <span>{page}/{Math.max(1, pages)}</span>
    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</Button>
  </div>
}

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
  function updated() {
    setDocument(null); setNewDocument(null); setSupplierForm(undefined); setConfirmation(null)
    void client.invalidateQueries({ queryKey: key })
    for (const name of ['inventory-items', 'inventory-reorder-alerts', 'inventory-transactions', 'public-menu']) {
      void client.invalidateQueries({ queryKey: [name] })
    }
  }
  const action = useMutation({
    mutationFn: ({ target, reason }: { target: NonNullable<typeof confirmation>; reason: string }) =>
      target.kind === 'suppliers' ? deleteSupplier(target.id)
        : target.action === 'post' ? postDocument(target.kind, target.id)
          : cancelDocument(target.kind, target.id, reason),
    onSuccess: updated,
  })
  const current = view === 'suppliers' ? suppliers : view === 'purchase-receipts' ? receipts : stocktakes
  const canReadView = can(`/inventory_${view === 'suppliers' ? 'suppliers' : view}_read`)
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {(['suppliers', 'purchase-receipts', 'stocktakes'] as const).map((kind) =>
        <Button key={kind} size="sm" variant={view === kind ? 'default' : 'outline'} aria-pressed={view === kind}
          onClick={() => { setView(kind); setPage(1) }}>
          {{ suppliers: 'Nhà cung cấp', 'purchase-receipts': 'Phiếu nhập', stocktakes: 'Kiểm kê' }[kind]}
        </Button>)}
      <Button size="sm" variant="outline" disabled={!can(`/inventory_${view === 'suppliers' ? 'suppliers_manage' : `${view}_create`}`)}
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
                  <Button size="sm" variant="outline" title="Xóa nhà cung cấp" aria-label="Xóa nhà cung cấp" disabled={!can('/inventory_suppliers_manage')} onClick={() => setConfirmation({ kind: 'suppliers', id: supplier.id, action: 'delete' })}><Trash2 size={16} /></Button>
                </div></td>
              </tr>)}
              {view === 'purchase-receipts' && receipts.data?.list.map((row) => <tr key={row.id} className="border-b border-border">
                <td className="p-2">{row.receiptNumber}</td><td className="p-2">{statusLabels[row.status]} · {formatPrice(row.totalAmount)} · {formatDate(row.receivedAt)}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => setDocument({ kind: view, id: row.id })}>Chi tiết</Button>
                  {row.status === 'DRAFT' && <DocumentActions kind={view} id={row.id} can={can} onAction={setConfirmation} />}</td>
              </tr>)}
              {view === 'stocktakes' && stocktakes.data?.list.map((row) => <tr key={row.id} className="border-b border-border">
                <td className="p-2">{row.stocktakeNumber}</td><td className="p-2">{statusLabels[row.status]} · {formatDate(row.createdAt)}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => setDocument({ kind: view, id: row.id })}>Chi tiết</Button>
                  {row.status === 'DRAFT' && <DocumentActions kind={view} id={row.id} can={can} onAction={setConfirmation} />}</td>
              </tr>)}
            </tbody>
          </table>{current.data?.totalItems === 0 && <p className="py-5 text-sm">Chưa có dữ liệu.</p>}
            <Pager page={page} pages={current.data?.totalPages ?? 0} onChange={setPage} />
          </div>}
    {supplierForm !== undefined && <SupplierForm initial={supplierForm} onClose={() => setSupplierForm(undefined)} onSaved={updated} />}
    {(newDocument === 'purchase-receipts' || (document?.kind === 'purchase-receipts' && receipt.data)) &&
      <ReceiptForm key={document?.id ?? 'new-receipt'} initial={document ? receipt.data : undefined}
        editable={can('/inventory_purchase-receipts_create')} onClose={() => { setDocument(null); setNewDocument(null) }} onSaved={updated} />}
    {(newDocument === 'stocktakes' || (document?.kind === 'stocktakes' && stocktake.data)) &&
      <StocktakeForm key={document?.id ?? 'new-stocktake'} initial={document ? stocktake.data : undefined}
        editable={can('/inventory_stocktakes_create')} onClose={() => { setDocument(null); setNewDocument(null) }} onSaved={updated} />}
    {document && !receipt.data && !stocktake.data && <Dialog open onClose={() => setDocument(null)}>
      <h2>Chi tiết chứng từ</h2><p role={receipt.error || stocktake.error ? 'alert' : 'status'}>{receipt.error || stocktake.error ? errorMessage(receipt.error || stocktake.error) : 'Đang tải…'}</p>
    </Dialog>}
    {confirmation && <Dialog open onClose={() => { if (!action.isPending) setConfirmation(null) }} maxWidth="sm">
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        if (!action.isPending) action.mutate({ target: confirmation, reason: String(new FormData(event.currentTarget).get('reason') ?? '').trim() })
      }}>
        <h2 className="pr-8 text-lg font-semibold">{confirmation.action === 'post' ? 'Xác nhận ghi sổ' : confirmation.action === 'delete' ? 'Xóa nhà cung cấp' : 'Hủy chứng từ'}</h2>
        {confirmation.action === 'post' && <p>Ghi sổ sẽ cập nhật tồn kho và khóa chỉnh sửa chứng từ.</p>}
        {confirmation.action === 'cancel' && <label className="block">Lý do hủy<Input name="reason" minLength={3} maxLength={500} required /></label>}
        {action.error && <p role="alert" className="text-sm text-destructive">{errorMessage(action.error)}</p>}
        <Button type="submit" isLoading={action.isPending}>Xác nhận</Button>
      </form>
    </Dialog>}
  </section>
}

function DocumentActions({ kind, id, can, onAction }: {
  kind: DocumentKind; id: string; can: (key: string) => boolean
  onAction: (action: { kind: DocumentKind; id: string; action: 'post' | 'cancel' }) => void
}) {
  return <span className="ml-2 inline-flex gap-2">
    {can(`/inventory_${kind}_post`) && <Button variant="outline" size="sm" onClick={() => onAction({ kind, id, action: 'post' })}><Check size={16} /> Ghi sổ</Button>}
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
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const readOnly = !editable || Boolean(initial && initial.status !== 'DRAFT')
  const [lines, setLines] = useState(initial?.items.map((item) => ({
    inventoryItemId: item.inventoryItemId, quantity: item.quantity, unitPrice: item.unitPrice, name: item.inventoryItemName,
  })) ?? [{ inventoryItemId: '', quantity: '1', unitPrice: '0', name: '' }])
  const suppliers = useQuery({ queryKey: ['private', 'receipt-supplier-options', supplierSearch], queryFn: ({ signal }) => getSuppliers(1, supplierSearch, signal), enabled: !readOnly })
  const inventory = useQuery({ queryKey: ['private', 'receipt-item-options', itemSearch], queryFn: ({ signal }) => getInventoryItems({ keyword: itemSearch || undefined, itemPerPage: 100 }, signal), enabled: !readOnly })
  const mutation = useMutation({
    mutationFn: (note: string) => saveReceipt({ supplierId, note: note || undefined, items: lines.map(({ inventoryItemId, quantity, unitPrice }) => ({ inventoryItemId, quantity, unitPrice })) }, initial?.id),
    onSuccess: onSaved,
  })
  return <Dialog open onClose={() => { if (!mutation.isPending) onClose() }} maxWidth="lg">
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(String(new FormData(event.currentTarget).get('note') ?? '').trim()) }}>
      <h2 className="pr-8 text-lg font-semibold">{initial ? initial.receiptNumber : 'Tạo phiếu nhập nháp'}</h2>
      <fieldset disabled={readOnly || mutation.isPending} className="space-y-3">
        <label className="block text-sm">Tìm nhà cung cấp<Input type="search" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} /></label>
        <label className="block text-sm">Nhà cung cấp<select className={selectClass} required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          <option value="">Chọn nhà cung cấp</option>
          {initial && !suppliers.data?.list.some((supplier) => supplier.id === initial.supplierId) && <option value={initial.supplierId}>{initial.supplier.name}</option>}
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
      {!readOnly && <Button type="submit" isLoading={mutation.isPending}>Lưu phiếu nháp</Button>}
    </form>
  </Dialog>
}

function StocktakeForm({ initial, editable, onClose, onSaved }: {
  initial?: StocktakeDetail; editable: boolean; onClose: () => void; onSaved: () => void
}) {
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const inventory = useQuery({ queryKey: ['private', 'stocktake-item-options', keyword], queryFn: ({ signal }) => getInventoryItems({ keyword, itemPerPage: 100 }, signal), enabled: !initial })
  const readOnly = !editable || Boolean(initial && initial.status !== 'DRAFT')
  const mutation = useMutation({
    mutationFn: (values: FormData) => initial
      ? saveCounts(initial.id, initial.items.map((item) => ({ inventoryItemId: item.inventoryItemId, countedQuantity: String(values.get(item.inventoryItemId)).trim() })))
      : createStocktake(selected, String(values.get('note') ?? '').trim() || undefined),
    onSuccess: onSaved,
  })
  return <Dialog open onClose={() => { if (!mutation.isPending) onClose() }} maxWidth="lg">
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(new FormData(event.currentTarget)) }}>
      <h2 className="pr-8 text-lg font-semibold">{initial ? initial.stocktakeNumber : 'Tạo phiếu kiểm kê'}</h2>
      <fieldset className="space-y-3" disabled={readOnly || mutation.isPending}>
        {initial ? initial.items.map((item) => <label key={item.inventoryItemId} className="grid gap-2 border-b border-border pb-2 text-sm sm:grid-cols-2">
          <span>{item.inventoryItemName} ({item.unitName}) · Sổ sách: {item.expectedQuantity}</span>
          <Input aria-label={`Số lượng thực đếm ${item.inventoryItemName}`} name={item.inventoryItemId} type="number" min="0" step="0.0001" defaultValue={item.countedQuantity ?? ''} required />
        </label>) : <>
          <label className="block text-sm">Tìm nguyên liệu<Input value={keyword} type="search" onChange={(event) => setKeyword(event.target.value)} /></label>
          <p className="text-sm">Đã chọn: {selected.length}/100</p>
          <div className="max-h-72 overflow-y-auto">
            {inventory.data?.list.map((item) => <label key={item.id} className="flex items-center gap-2 border-b border-border py-2 text-sm">
              <input type="checkbox" checked={selected.includes(item.id)} disabled={!selected.includes(item.id) && selected.length >= 100}
                onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />
              {item.name} · {item.stock} {item.unit?.name}
            </label>)}
          </div>
          <label className="block text-sm">Ghi chú<Input name="note" maxLength={500} /></label>
        </>}
      </fieldset>
      {(mutation.error || inventory.error) && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error || inventory.error)}</p>}
      {!readOnly && <Button type="submit" isLoading={mutation.isPending} disabled={!initial && !selected.length}>{initial ? 'Lưu số đếm' : 'Tạo phiếu kiểm kê'}</Button>}
    </form>
  </Dialog>
}
