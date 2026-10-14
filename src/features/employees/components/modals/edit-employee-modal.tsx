import { AlertCircle } from 'lucide-react'
import type {
  EmployeeListItem,
  PositionDropdownItem,
  UpdateEmployeeInput,
} from '@/features/employees/employees.api'
import {
  Button,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface EditEmployeeModalProps {
  employee: EmployeeListItem | null
  onClose: () => void
  positionsDropdown: PositionDropdownItem[]
  formData: UpdateEmployeeInput
  setFormData: (data: UpdateEmployeeInput) => void
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function EditEmployeeModal({
  employee,
  onClose,
  positionsDropdown,
  formData,
  setFormData,
  error,
  isPending,
  onSubmit,
}: EditEmployeeModalProps) {
  return (
    <Dialog
      open={!!employee}
      onOpenChange={(open) => !open && onClose()}
      className="max-h-[90vh] overflow-y-auto"
    >
      {employee && (
        <>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Cập nhật thông tin nhân viên
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Điều chỉnh thông tin hồ sơ và trạng thái tài khoản của{' '}
              {employee.fullName}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="text-xs font-medium text-foreground">
                Họ và tên
              </label>
              <Input
                type="text"
                value={formData.fullName || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fullName: e.target.value,
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Vị trí công việc
                </label>
                <select
                  aria-label="Chọn vị trí công việc"
                  value={formData.positionId || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      positionId: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="">-- Chưa xếp vị trí --</option>
                  {positionsDropdown.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  Trạng thái làm việc
                </label>
                <select
                  aria-label="Trạng thái làm việc"
                  value={formData.isActive ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isActive: e.target.value === 'true',
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="true">Đang làm việc (Hoạt động)</option>
                  <option value="false">Tạm khóa tài khoản</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Số điện thoại
                </label>
                <Input
                  type="tel"
                  value={formData.phoneNumber || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phoneNumber: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  Đổi mật khẩu mới (Tùy chọn)
                </label>
                <Input
                  type="password"
                  placeholder="Để trống nếu không đổi"
                  value={formData.password || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value || undefined,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

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
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </>
      )}
    </Dialog>
  )
}
