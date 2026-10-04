import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type AdminCategory, createCategory, updateCategory, deleteCategory } from '../menu.admin.api'
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

export function CreateCategoryModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createCategory({
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên danh mục')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm danh mục mới</DialogTitle>
          <DialogDescription>Tạo nhóm phân loại cho các món trong quán.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên danh mục *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cà phê Truyền thống"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Mô tả (tùy chọn)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Các món cà phê pha phin nguyên chất..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo danh mục'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditCategoryModal({
  category,
  onClose,
  onSuccess,
}: {
  category: AdminCategory
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateCategory(category.id, {
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên danh mục')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa danh mục</DialogTitle>
          <DialogDescription>Cập nhật tên hoặc mô tả phân loại món.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên danh mục *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Mô tả</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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

export function DeleteCategoryModal({
  category,
  onClose,
  onSuccess,
}: {
  category: AdminCategory
  onClose: () => void
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => deleteCategory(category.id),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Xóa danh mục</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xóa danh mục <span className="font-bold text-foreground">"{category.name}"</span>?
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
            {mutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
