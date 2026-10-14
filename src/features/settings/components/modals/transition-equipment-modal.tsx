import { AlertCircle } from 'lucide-react'
import type {
  EquipmentItem,
  EquipmentStatus,
  TransitionEquipmentInput,
} from '@/features/settings/settings.api'
import { ALLOWED_EQUIPMENT_TRANSITIONS } from '../equipment.constants'
import {
  Button,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface TransitionEquipmentModalProps {
  equipment: EquipmentItem | null
  onClose: () => void
  formData: TransitionEquipmentInput
  setFormData: (data: TransitionEquipmentInput) => void
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function TransitionEquipmentModal({
  equipment,
  onClose,
  formData,
  setFormData,
  error,
  isPending,
  onSubmit,
}: TransitionEquipmentModalProps) {
  return (
    <Dialog
      open={!!equipment}
      onOpenChange={(open) => !open && onClose()}
      className="max-h-[90vh] overflow-y-auto"
    >
      {equipment && (
        <>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Chuyển trạng thái: {equipment.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Trạng thái hiện tại:{' '}
              <span className="font-semibold">{equipment.status}</span>
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
                Trạng thái mục tiêu <span className="text-destructive">*</span>
              </label>
              <select
                aria-label="Chọn trạng thái mục tiêu"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as EquipmentStatus,
                  })
                }
                required
                className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                {ALLOWED_EQUIPMENT_TRANSITIONS[equipment.status].map((s) => (
                  <option key={s} value={s}>
                    {s === 'IN_USE' && 'IN_USE - Đang hoạt động tốt'}
                    {s === 'MAINTENANCE' &&
                      'MAINTENANCE - Đang bảo trì / Sửa chữa'}
                    {s === 'BROKEN' && 'BROKEN - Hỏng hóc'}
                    {s === 'LIQUIDATED' && 'LIQUIDATED - Thanh lý tài sản'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">
                Lý do chuyển trạng thái <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="VD: Thay gioăng cao su định kỳ, sửa bơm nước..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reason: e.target.value,
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Chi phí phát sinh (VND)
                </label>
                <Input
                  type="text"
                  placeholder="0"
                  value={formData.cost || '0'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  Lịch bảo trì tiếp theo (tùy chọn)
                </label>
                <Input
                  type="date"
                  value={formData.nextMaintenanceAt || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nextMaintenanceAt: e.target.value,
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
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending ? 'Đang chuyển...' : 'Xác nhận chuyển'}
              </Button>
            </DialogFooter>
          </form>
        </>
      )}
    </Dialog>
  )
}
