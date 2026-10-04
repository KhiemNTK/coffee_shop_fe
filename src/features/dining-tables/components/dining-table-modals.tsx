import { useState } from 'react'
import { AlertCircle, ArrowRightLeft, RotateCcw, Trash2 } from 'lucide-react'
import { type UseMutationResult } from '@tanstack/react-query'
import { type DiningTableAdmin } from '../dining-tables.api'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../../shared/ui'

// --- CREATE TABLE MODAL ---
interface CreateTableModalProps {
  open: boolean
  onClose: () => void
  createMutation: UseMutationResult<DiningTableAdmin, Error, string>
  createError: string | null
  setCreateError: (err: string | null) => void
  keepCreating: boolean
  setKeepCreating: (val: boolean | ((prev: boolean) => boolean)) => void
  createName: string
  setCreateName: (val: string) => void
}

export function CreateTableModal({
  open,
  onClose,
  createMutation,
  createError,
  setCreateError,
  keepCreating,
  setKeepCreating,
  createName,
  setCreateName,
}: CreateTableModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Thêm bàn ăn mới
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Đặt tên định danh cho bàn ăn (ví dụ: Bàn 01, VIP 02, Sân vườn 3)
          </DialogDescription>
        </DialogHeader>

        {createError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{createError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!createName.trim()) {
              setCreateError('Vui lòng nhập tên bàn')
              return
            }
            createMutation.mutate(createName.trim())
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-foreground">
              Tên bàn <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="Nhập tên bàn (tối đa 50 ký tự)..."
              value={createName}
              onChange={(e) => {
                setCreateName(e.target.value)
                setCreateError(null)
              }}
              autoFocus
              maxLength={50}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="keepCreating"
              type="checkbox"
              checked={keepCreating}
              onChange={(e) => setKeepCreating(e.target.checked)}
              className="rounded border-border text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="keepCreating" className="text-xs text-muted-foreground cursor-pointer">
              Tiếp tục tạo thêm bàn khác sau khi lưu
            </label>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending || !createName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Lưu bàn mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- EDIT TABLE MODAL ---
interface EditTableModalProps {
  table: DiningTableAdmin | null
  onClose: () => void
  updateMutation: UseMutationResult<DiningTableAdmin, Error, { id: string; name: string }>
  editError: string | null
  setEditError: (err: string | null) => void
  editName: string
  setEditName: (val: string) => void
}

export function EditTableModal({
  table,
  onClose,
  updateMutation,
  editError,
  setEditError,
  editName,
  setEditName,
}: EditTableModalProps) {
  if (!table) return null

  return (
    <Dialog open={!!table} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Đổi tên bàn ăn
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Cập nhật tên định danh cho bàn ({table.name})
          </DialogDescription>
        </DialogHeader>

        {editError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{editError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!editName.trim()) {
              setEditError('Vui lòng nhập tên bàn')
              return
            }
            updateMutation.mutate({ id: table.id, name: editName.trim() })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-foreground">
              Tên bàn mới <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value)
                setEditError(null)
              }}
              autoFocus
              maxLength={50}
              className="mt-1"
            />
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={updateMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending || !editName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updateMutation.isPending ? 'Đang lưu...' : 'Cập nhật'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- DELETE TABLE MODAL ---
interface DeleteTableModalProps {
  table: DiningTableAdmin | null
  onClose: () => void
  deleteMutation: UseMutationResult<unknown, Error, string>
  deleteError: string | null
}

export function DeleteTableModal({
  table,
  onClose,
  deleteMutation,
  deleteError,
}: DeleteTableModalProps) {
  if (!table) return null

  return (
    <Dialog open={!!table} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-2">
            <Trash2 className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Xác nhận xóa bàn
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Bạn có chắc chắn muốn xóa bàn{' '}
            <span className="font-semibold text-foreground">{table.name}</span>? Thao tác
            này sẽ ẩn bàn khỏi sơ đồ phục vụ.
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => deleteMutation.mutate(table.id)}
            disabled={deleteMutation.isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- CLEAR TABLE MODAL ---
interface ClearTableModalProps {
  table: DiningTableAdmin | null
  onClose: () => void
  clearMutation: UseMutationResult<unknown, Error, string>
  clearError: string | null
}

export function ClearTableModal({
  table,
  onClose,
  clearMutation,
  clearError,
}: ClearTableModalProps) {
  if (!table) return null

  return (
    <Dialog open={!!table} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mb-2">
            <RotateCcw className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Dọn dẹp & Giải phóng bàn
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Xác nhận giải phóng bàn{' '}
            <span className="font-semibold text-foreground">{table.name}</span> về trạng
            thái <span className="font-semibold text-emerald-600">Trống</span>. Nếu có món chưa
            nấu hoặc chưa thanh toán, hệ thống sẽ tự động hủy phiên an toàn.
          </DialogDescription>
        </DialogHeader>

        {clearError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{clearError}</span>
          </div>
        )}

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={clearMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => clearMutation.mutate(table.id)}
            disabled={clearMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {clearMutation.isPending ? 'Đang xử lý...' : 'Xác nhận dọn bàn'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- TRANSFER TABLE MODAL ---
interface TransferTableModalProps {
  table: DiningTableAdmin | null
  onClose: () => void
  transferMutation: UseMutationResult<unknown, Error, { fromId: string; toId: string }>
  transferError: string | null
  setTransferError: (err: string | null) => void
  availableTargetTables: DiningTableAdmin[]
}

export function TransferTableModal({
  table,
  onClose,
  transferMutation,
  transferError,
  setTransferError,
  availableTargetTables,
}: TransferTableModalProps) {
  const [targetTableId, setTargetTableId] = useState('')

  if (!table) return null

  return (
    <Dialog open={!!table} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mb-2">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Chuyển bàn phục vụ
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Chuyển toàn bộ phiên order từ{' '}
            <span className="font-semibold text-foreground">{table.name}</span> sang
            bàn trống khác.
          </DialogDescription>
        </DialogHeader>

        {transferError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{transferError}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground">
              Chọn bàn đích (chỉ các bàn đang trống) <span className="text-destructive">*</span>
            </label>
            {availableTargetTables.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Hiện tại không có bàn trống nào để chuyển đến.
              </p>
            ) : (
              <select
                aria-label="Chọn bàn đích"
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Chọn bàn trống --</option>
                {availableTargetTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={transferMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!targetTableId) {
                  setTransferError('Vui lòng chọn bàn đích')
                  return
                }
                transferMutation.mutate({
                  fromId: table.id,
                  toId: targetTableId,
                })
              }}
              disabled={transferMutation.isPending || !targetTableId}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {transferMutation.isPending ? 'Đang chuyển...' : 'Xác nhận chuyển'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
