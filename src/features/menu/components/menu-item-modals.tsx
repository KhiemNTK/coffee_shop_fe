import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type AdminCategory, type AdminMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } from '../menu.admin.api'
import { errorMessage } from '../../../shared/api/client'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'

export function CreateMenuItemModal({
  categories,
  stations,
  onClose,
  onSuccess,
}: {
  categories: AdminCategory[]
  stations: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [kitchenStationId, setKitchenStationId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createMenuItem({
        name: name.trim(),
        price: price.trim(),
        categoryId,
        kitchenStationId: kitchenStationId || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên món')
    if (!price.trim() || isNaN(Number(price))) return setError('Giá món không hợp lệ')
    if (!categoryId) return setError('Vui lòng chọn danh mục món')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo món mới</DialogTitle>
          <DialogDescription>Thêm món ăn hoặc thức uống mới vào thực đơn.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên món *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cà phê Muối Cốt dừa"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Đơn giá (VNĐ) *</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="VD: 35000"
                min="0"
                step="1000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Danh mục *</label>
              <select
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Quầy chế biến phụ trách</label>
            <select
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              value={kitchenStationId}
              onChange={(e) => setKitchenStationId(e.target.value)}
            >
              <option value="">Không gán quầy cụ thể</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo món'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditMenuItemModal({
  item,
  categories,
  stations,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  categories: AdminCategory[]
  stations: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(String(item.price))
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [kitchenStationId, setKitchenStationId] = useState<string>(item.kitchenStationId ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateMenuItem(item.id, {
        name: name.trim(),
        price: price.trim(),
        categoryId,
        kitchenStationId: kitchenStationId || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên món')
    if (!price.trim() || isNaN(Number(price))) return setError('Giá món không hợp lệ')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật thông tin món</DialogTitle>
          <DialogDescription>Chỉnh sửa tên, giá và danh mục của món ăn.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên món *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cà phê Muối"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Đơn giá (VNĐ) *</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="1000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Danh mục *</label>
              <select
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Quầy chế biến phụ trách</label>
            <select
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              value={kitchenStationId}
              onChange={(e) => setKitchenStationId(e.target.value)}
            >
              <option value="">Không gán quầy cụ thể</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteMenuItemModal({
  item,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => deleteMenuItem(item.id),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Xác nhận xóa món</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xóa món <span className="font-bold text-foreground">"{item.name}"</span> khỏi thực đơn? Thao tác này sẽ ẩn món khỏi danh sách bán.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Đang xóa...' : 'Xóa món'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
