import { Trash2, AlertCircle } from 'lucide-react'
import type { EmployeeListItem } from '@/features/employees/employees.api'
import {
  Button,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface DeleteEmployeeModalProps {
  employee: EmployeeListItem | null
  onClose: () => void
  error: string | null
  isPending: boolean
  onConfirm: () => void
}

export function DeleteEmployeeModal({
  employee,
  onClose,
  error,
  isPending,
  onConfirm,
}: DeleteEmployeeModalProps) {
  return (
    <Dialog
      open={!!employee}
      onOpenChange={(open) => !open && onClose()}
    >
      {employee && (
        <>
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-2">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Xác nhận xóa nhân viên
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Bạn có chắc chắn muốn xóa nhân viên{' '}
              <span className="font-semibold text-foreground">
                {employee.fullName}
              </span>{' '}
              (@{employee.username})? Toàn bộ phiên đăng nhập của nhân
              viên này sẽ bị thu hồi ngay lập tức.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
