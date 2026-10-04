import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react'
import {
  type InventoryItem,
  type ReorderAlertRow,
  importInventory,
  exportInventory,
  createInventoryItem,
  updateInventoryItem,
} from '../inventory.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Dialog, Input } from '../../../shared/ui'

// ============================================================================
// MODAL: IMPORT INVENTORY
// ============================================================================

export function ImportDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem | ReorderAlertRow
  onClose: () => void
  onSuccess: () => void
}) {
  const [quantity, setQuantity] = useState('10')
  const [unitPrice, setUnitPrice] = useState('50000')
  const [note, setNote] = useState('Nhập hàng định kỳ từ nhà cung cấp')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      importInventory(item.id, {
        quantity: quantity.trim(),
        unitPrice: unitPrice.trim(),
        note: note.trim(),
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (Number(quantity) <= 0) {
      setError('Số lượng nhập phải lớn hơn 0.')
      return
    }
    if (Number(unitPrice) < 0) {
      setError('Đơn giá không hợp lệ.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-emerald-700" />
            <h3 className="font-bold text-base text-foreground">Nhập kho nguyên liệu</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-foreground">Mặt hàng: {item.name}</p>
          <p className="text-muted-foreground">
            Tồn kho hiện tại: {Number(item.stock).toLocaleString('vi-VN')}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Số lượng nhập <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Đơn giá nhập (VND) <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          {unitPrice && Number(unitPrice) > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Ước tính: {formatPrice(String(Number(quantity || 0) * Number(unitPrice)))}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Ghi chú / Nguồn gốc <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={mutation.isPending} className="font-semibold">
            Xác nhận nhập kho
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: EXPORT INVENTORY
// ============================================================================

export function ExportDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('Xuất dùng pha chế quầy Barista')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      exportInventory(item.id, {
        quantity: quantity.trim(),
        note: note.trim(),
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (Number(quantity) <= 0) {
      setError('Số lượng xuất phải lớn hơn 0.')
      return
    }
    if (Number(quantity) > Number(item.stock)) {
      setError(`Số lượng xuất không thể lớn hơn tồn kho hiện tại (${item.stock}).`)
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-amber-700" />
            <h3 className="font-bold text-base text-foreground">Xuất kho / Báo hao hụt</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-foreground">Mặt hàng: {item.name}</p>
          <p className="text-muted-foreground">
            Tồn khả dụng: {Number(item.stock).toLocaleString('vi-VN')} {item.unit?.name}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Số lượng xuất <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Lý do xuất / Ghi chú <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            isLoading={mutation.isPending}
            className="font-semibold"
          >
            Xác nhận xuất kho
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: CREATE INVENTORY ITEM
// ============================================================================

export function CreateItemDialog({
  categories,
  units,
  onClose,
  onSuccess,
}: {
  categories: Array<{ id: string; name: string }>
  units: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [stock, setStock] = useState('0')
  const [initialUnitCost, setInitialUnitCost] = useState('0')
  const [reorderPoint, setReorderPoint] = useState('10')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createInventoryItem({
        name: name.trim(),
        categoryId,
        unitId,
        stock: Number(stock) || 0,
        initialUnitCost: Number(stock) > 0 ? Number(initialUnitCost) || 0 : undefined,
        reorderPoint: Number(reorderPoint) || 0,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Vui lòng nhập tên nguyên vật liệu.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Thêm nguyên vật liệu mới</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Tên nguyên liệu <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            placeholder="VD: Cà phê Robusta Đắk Lắk"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nhóm danh mục
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Đơn vị tính
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Số lượng ban đầu
            </label>
            <Input
              type="number"
              step="any"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Mức tối thiểu cảnh báo
            </label>
            <Input
              type="number"
              step="any"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </div>
        </div>

        {Number(stock) > 0 && (
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Giá vốn ban đầu (VND)
            </label>
            <Input
              type="number"
              value={initialUnitCost}
              onChange={(e) => setInitialUnitCost(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={mutation.isPending} className="font-semibold">
            Tạo nguyên liệu
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: EDIT INVENTORY ITEM
// ============================================================================

export function EditItemDialog({
  item,
  categories,
  units,
  onClose,
  onSuccess,
}: {
  item: InventoryItem
  categories: Array<{ id: string; name: string }>
  units: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(item.name)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [unitId, setUnitId] = useState(item.unitId)
  const [reorderPoint, setReorderPoint] = useState(String(item.reorderPoint ?? 10))
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateInventoryItem(item.id, {
        name: name.trim(),
        categoryId,
        unitId,
        reorderPoint: Number(reorderPoint) || 0,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Chỉnh sửa nguyên vật liệu</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Tên nguyên liệu <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nhóm danh mục
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Đơn vị tính
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Mức tối thiểu cảnh báo
          </label>
          <Input
            type="number"
            step="any"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={mutation.isPending} className="font-semibold">
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: DELETE INVENTORY ITEM
// ============================================================================

export function DeleteInventoryItemDialog({
  item,
  isPending,
  onClose,
  onConfirm,
}: {
  item: InventoryItem
  isPending: boolean
  onClose: () => void
  onConfirm: (id: string) => void
}) {
  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-bold text-destructive">
          Xóa nguyên vật liệu?
        </h3>
        <p className="text-sm text-muted-foreground">
          Bạn có chắc chắn muốn xóa nguyên vật liệu <strong>{item.name}</strong> không? Hành động này sẽ ngừng quản lý tồn kho mặt hàng này.
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Quay lại
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(item.id)}
            isLoading={isPending}
          >
            Xác nhận xóa
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
