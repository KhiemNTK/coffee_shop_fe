import { AlertCircle } from 'lucide-react'
import type { PositionDropdownItem, CreateEmployeeInput } from '@/features/employees/employees.api'
import {
  Button,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface CreateEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  positionsDropdown: PositionDropdownItem[]
  formData: CreateEmployeeInput
  setFormData: (data: CreateEmployeeInput) => void
  error: string | null
  setError: (err: string | null) => void
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function CreateEmployeeModal({
  isOpen,
  onClose,
  positionsDropdown,
  formData,
  setFormData,
  error,
  setError,
  isPending,
  onSubmit,
}: CreateEmployeeModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="max-h-[90vh] overflow-y-auto"
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-foreground">
          Thêm nhân viên mới
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Khởi tạo tài khoản nhân sự và liên kết vị trí làm việc
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!formData.positionId) {
            setError('Vui lòng chọn vị trí công việc')
            return
          }
          onSubmit(e)
        }}
        className="mt-4 space-y-3.5"
      >
        <div>
          <label className="text-xs font-medium text-foreground">
            Họ và tên <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            placeholder="Ví dụ: Nguyễn Văn An"
            value={formData.fullName}
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
              Email đăng nhập <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              placeholder="nhanvien@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value,
                })
              }
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Tên đăng nhập (Username){' '}
              <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="nguyenvanan"
              value={formData.username}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  username: e.target.value,
                })
              }
              required
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground">
              Mật khẩu ban đầu <span className="text-destructive">*</span>
            </label>
            <Input
              type="password"
              placeholder="Tối thiểu 12 ký tự"
              minLength={12}
              maxLength={72}
              value={formData.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  password: e.target.value,
                })
              }
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Vị trí công việc <span className="text-destructive">*</span>
            </label>
            <select
              aria-label="Chọn vị trí công việc"
              value={formData.positionId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  positionId: e.target.value,
                })
              }
              required
              className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Chọn vị trí --</option>
              {positionsDropdown.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
              placeholder="0912345678"
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
              Địa chỉ
            </label>
            <Input
              type="text"
              placeholder="Địa chỉ cư trú"
              value={formData.address || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: e.target.value,
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
            {isPending ? 'Đang tạo...' : 'Lưu nhân viên'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
