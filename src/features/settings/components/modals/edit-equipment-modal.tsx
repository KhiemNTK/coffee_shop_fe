import { AlertCircle } from 'lucide-react'
import type {
  EquipmentItem,
  UpdateEquipmentInput,
} from '@/features/settings/settings.api'
import {
  Button,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface EditEquipmentModalProps {
  equipment: EquipmentItem | null
  onClose: () => void
  formData: UpdateEquipmentInput
  setFormData: (data: UpdateEquipmentInput) => void
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function EditEquipmentModal({
  equipment,
  onClose,
  formData,
  setFormData,
  error,
  isPending,
  onSubmit,
}: EditEquipmentModalProps) {
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
              Chỉnh sửa thông tin thiết bị
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Cập nhật thông tin chi tiết cho thiết bị {equipment.name} ({equipment.assetCode})
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
                Tên thiết bị
              </label>
              <Input
                type="text"
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Số Serial
                </label>
                <Input
                  type="text"
                  value={formData.serialNumber || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      serialNumber: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  Vị trí lắp đặt
                </label>
                <Input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Số lượng
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity || 1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  Đơn giá mua (VND)
                </label>
                <Input
                  type="text"
                  value={formData.unitPrice || '0'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unitPrice: e.target.value,
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
                {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </>
      )}
    </Dialog>
  )
}
