import { AlertCircle } from 'lucide-react'
import type { CreateEquipmentInput } from '@/features/settings/settings.api'
import {
  Button,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface CreateEquipmentModalProps {
  isOpen: boolean
  onClose: () => void
  formData: CreateEquipmentInput
  setFormData: (data: CreateEquipmentInput) => void
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function CreateEquipmentModal({
  isOpen,
  onClose,
  formData,
  setFormData,
  error,
  isPending,
  onSubmit,
}: CreateEquipmentModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="max-h-[90vh] overflow-y-auto"
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-foreground">
          Thêm thiết bị / máy móc mới
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Đăng ký tài sản máy móc vào hệ thống quán để theo dõi bảo trì và
          khấu hao
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground">
              Mã tài sản <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="VD: EQ-ESP-01"
              value={formData.assetCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  assetCode: e.target.value,
                })
              }
              required
              className="mt-1 uppercase font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Số Serial (nếu có)
            </label>
            <Input
              type="text"
              placeholder="SN-12345678"
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
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">
            Tên thiết bị <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            placeholder="VD: Máy pha cà phê La Marzocco Linea PB 2 Group"
            value={formData.name}
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
              Số lượng
            </label>
            <Input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value, 10) || 1,
                })
              }
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Đơn giá mua (VND)
            </label>
            <Input
              type="text"
              placeholder="250000000"
              value={formData.unitPrice}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unitPrice: e.target.value,
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
              Ngày mua <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={formData.purchaseDate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  purchaseDate: e.target.value,
                })
              }
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">
              Vị trí lắp đặt
            </label>
            <Input
              type="text"
              placeholder="Quầy bar chính, Bếp bánh..."
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
            {isPending ? 'Đang tạo...' : 'Lưu thiết bị'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
