import { moneySchema } from '@/shared/api/money'
import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { type InventoryItem, createInventoryItem, updateInventoryItem } from '../inventory.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Dialog, Input } from '../../../shared/ui'
import { quantitySchema } from '../quantity'

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
  const id = useId()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [stock, setStock] = useState('0')
  const [initialUnitCost, setInitialUnitCost] = useState('')
  const [reorderPoint, setReorderPoint] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createInventoryItem({
        name: name.trim(),
        categoryId,
        unitId,
        stock: stock.trim(),
        initialUnitCost: Number(stock) > 0 ? initialUnitCost.trim() : undefined,
        reorderPoint: reorderPoint.trim() || '0',
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
    const quantities = [stock.trim(), reorderPoint.trim() || '0']
    if (
      quantities.some((value) => !quantitySchema.safeParse(value).success || value.startsWith('-'))
    ) {
      setError('Số lượng không hợp lệ, tối đa 4 chữ số thập phân.')
      return
    }
    if (Number(stock) > 0 && !moneySchema.safeParse(initialUnitCost.trim()).success) {
      setError('Vui lòng nhập giá vốn ban đầu, tối đa 2 chữ số thập phân.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      maxWidth="sm"
      showCloseButton={false}
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Thêm nguyên vật liệu mới</h3>
          <Button
            type="button"
            aria-label="Đóng"
            variant="ghost"
            size="icon"
            disabled={mutation.isPending}
            onClick={onClose}
            className="size-11"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <fieldset
          disabled={mutation.isPending}
          className="grid gap-4 [&_input]:bg-card [&_input]:text-foreground"
        >
          <div>
            <label
              htmlFor={`${id}-name`}
              className="text-xs font-semibold text-foreground block mb-1"
            >
              Tên nguyên liệu <span className="text-destructive">*</span>
            </label>
            <Input
              id={`${id}-name`}
              type="text"
              required
              placeholder="VD: Cà phê Robusta Đắk Lắk"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${id}-category`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Nhóm danh mục
              </label>
              <select
                id={`${id}-category`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card p-2.5 text-xs text-foreground"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`${id}-unit`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Đơn vị tính
              </label>
              <select
                id={`${id}-unit`}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card p-2.5 text-xs text-foreground"
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
              <label
                htmlFor={`${id}-stock`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Số lượng ban đầu
              </label>
              <Input
                id={`${id}-stock`}
                type="number"
                step="any"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor={`${id}-threshold`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Mức tối thiểu cảnh báo
              </label>
              <Input
                id={`${id}-threshold`}
                type="number"
                step="any"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
              />
            </div>
          </div>

          {Number(stock) > 0 && (
            <div>
              <label
                htmlFor={`${id}-cost`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Giá vốn ban đầu (VND / đơn vị)
              </label>
              <Input
                id={`${id}-cost`}
                required
                type="number"
                step="0.01"
                value={initialUnitCost}
                onChange={(e) => setInitialUnitCost(e.target.value)}
              />
            </div>
          )}
        </fieldset>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={onClose}
          >
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
  const id = useId()
  const [name, setName] = useState(item.name)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [reorderPoint, setReorderPoint] = useState(String(item.reorderPoint ?? ''))
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateInventoryItem(item.id, {
        name: name.trim(),
        categoryId,
        reorderPoint: reorderPoint.trim() || '0',
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const threshold = reorderPoint.trim() || '0'
    if (!quantitySchema.safeParse(threshold).success || threshold.startsWith('-')) {
      setError('Ngưỡng tối thiểu không hợp lệ.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      maxWidth="sm"
      showCloseButton={false}
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Chỉnh sửa nguyên vật liệu</h3>
          <Button
            type="button"
            aria-label="Đóng"
            variant="ghost"
            size="icon"
            disabled={mutation.isPending}
            onClick={onClose}
            className="size-11"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <fieldset
          disabled={mutation.isPending}
          className="grid gap-4 [&_input]:bg-card [&_input]:text-foreground"
        >
          <div>
            <label
              htmlFor={`${id}-name`}
              className="text-xs font-semibold text-foreground block mb-1"
            >
              Tên nguyên liệu <span className="text-destructive">*</span>
            </label>
            <Input
              id={`${id}-name`}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${id}-category`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Nhóm danh mục
              </label>
              <select
                id={`${id}-category`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card p-2.5 text-xs text-foreground"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`${id}-unit`}
                className="text-xs font-semibold text-foreground block mb-1"
              >
                Đơn vị tính
              </label>
              <Input
                id={`${id}-unit`}
                aria-label="Đơn vị tính cố định"
                readOnly
                value={units.find((unit) => unit.id === item.unitId)?.name ?? item.unit?.name ?? ''}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`${id}-threshold`}
              className="text-xs font-semibold text-foreground block mb-1"
            >
              Mức tối thiểu cảnh báo
            </label>
            <Input
              id={`${id}-threshold`}
              type="number"
              step="any"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </div>
        </fieldset>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={onClose}
          >
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
  error,
  onClose,
  onConfirm,
}: {
  item: InventoryItem
  isPending: boolean
  error: unknown
  onClose: () => void
  onConfirm: (id: string) => void
}) {
  return (
    <Dialog open onClose={() => { if (!isPending) onClose() }} maxWidth="sm">
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-bold text-destructive">Xóa nguyên vật liệu?</h3>
        <p className="text-sm text-muted-foreground">
          Bạn có chắc chắn muốn xóa nguyên vật liệu <strong>{item.name}</strong> không? Hành động
          này sẽ ngừng quản lý tồn kho mặt hàng này.
        </p>
        {error != null && <p role="alert" className="text-sm text-destructive">{errorMessage(error)}</p>}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onClose}>
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
