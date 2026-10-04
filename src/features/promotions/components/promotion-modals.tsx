import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Trash2 } from 'lucide-react'
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  type Promotion,
  type DiscountType,
} from '../promotions.api'
import { formatPrice } from '../../../shared/lib/format'
import { errorMessage } from '../../../shared/api/client'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../../shared/ui'

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

function formatDiscountAmount(val: string | number) {
  return formatPrice(String(val))
}

// --- CREATE PROMOTION MODAL ---
export function CreatePromotionModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState<number>(10)
  const [maxDiscount, setMaxDiscount] = useState<string>('')

  // Default: Starts today, ends in 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return toDatetimeLocal(d)
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return toDatetimeLocal(d)
  })

  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => {
      const s = new Date(startDate)
      const e = new Date(endDate)
      return createPromotion({
        name: name.trim(),
        discountType,
        discountValue,
        maxDiscount:
          discountType === 'PERCENTAGE' && maxDiscount.trim()
            ? Number(maxDiscount)
            : null,
        startDate: s.toISOString(),
        endDate: e.toISOString(),
      })
    },
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Vui lòng nhập tên chương trình khuyến mãi.')
      return
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('Ngày kết thúc phải diễn ra sau ngày bắt đầu.')
      return
    }
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      setError('Tỷ lệ giảm giá theo phần trăm phải nằm trong khoảng từ 1% đến 100%.')
      return
    }
    if (discountType === 'FIXED_AMOUNT' && discountValue <= 0) {
      setError('Số tiền giảm giá phải lớn hơn 0.')
      return
    }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tạo chương trình khuyến mãi mới</DialogTitle>
            <DialogDescription>
              Cấu hình mã ưu đãi, hình thức chiết khấu và thời gian áp dụng trên hóa đơn.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Tên chương trình khuyến mãi <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="Ví dụ: Khai xuân rộn ràng - Giảm 20%"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Hình thức giảm giá <span className="text-red-500">*</span>
                </label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="PERCENTAGE">Theo phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {discountType === 'PERCENTAGE'
                    ? 'Tỷ lệ giảm (%) *'
                    : 'Số tiền giảm (₫) *'}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
              </div>
            </div>

            {discountType === 'PERCENTAGE' && (
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Số tiền giảm tối đa (₫) (Tùy chọn)
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Ví dụ: 50000 (để trống nếu không giới hạn)"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                />
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  Nếu hóa đơn giảm 20% vượt quá số tiền này thì chỉ giảm tối đa mức trên.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Ngày kết thúc <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-2">
                Xem trước hiển thị Voucher:
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-foreground">
                    {name.trim() || 'Tên chương trình ưu đãi'}
                  </h5>
                  <p className="text-xs text-emerald-800 font-medium">
                    {discountType === 'PERCENTAGE'
                      ? `Giảm ${discountValue || 0}%${maxDiscount ? ` (Tối đa ${formatDiscountAmount(maxDiscount)})` : ''}`
                      : `Giảm ${formatDiscountAmount(discountValue || 0)}`}
                  </p>
                </div>
                <Badge className="bg-emerald-700 text-white">Ưu đãi</Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {createMutation.isPending ? 'Đang tạo…' : 'Xác nhận tạo khuyến mãi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- EDIT PROMOTION MODAL ---
export function EditPromotionModal({
  promotion,
  onClose,
  onSuccess,
}: {
  promotion: Promotion | null
  onClose: () => void
  onSuccess: () => void
}) {
  if (!promotion) return null
  return <EditPromotionModalInner promotion={promotion} onClose={onClose} onSuccess={onSuccess} />
}

function EditPromotionModalInner({
  promotion,
  onClose,
  onSuccess,
}: {
  promotion: Promotion
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(promotion.name)
  const [discountType, setDiscountType] = useState<DiscountType>(promotion.discountType)
  const [discountValue, setDiscountValue] = useState<number>(Number(promotion.discountValue))
  const [maxDiscount, setMaxDiscount] = useState<string>(
    promotion.maxDiscount ? String(promotion.maxDiscount) : '',
  )
  const [startDate, setStartDate] = useState(() =>
    toDatetimeLocal(new Date(promotion.startDate)),
  )
  const [endDate, setEndDate] = useState(() =>
    toDatetimeLocal(new Date(promotion.endDate)),
  )
  const [error, setError] = useState<string | null>(null)

  const isFinancialLocked = (promotion.usageCount || 0) > 0

  const updateMutation = useMutation({
    mutationFn: () => {
      const s = new Date(startDate)
      const e = new Date(endDate)
      return updatePromotion(promotion.id, {
        name: name.trim(),
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        ...(isFinancialLocked
          ? {}
          : {
              discountType,
              discountValue,
              maxDiscount:
                discountType === 'PERCENTAGE' && maxDiscount.trim()
                  ? Number(maxDiscount)
                  : null,
            }),
      })
    },
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (new Date(endDate) <= new Date(startDate)) {
      setError('Ngày kết thúc phải diễn ra sau ngày bắt đầu.')
      return
    }
    updateMutation.mutate()
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cập nhật chương trình khuyến mãi</DialogTitle>
            <DialogDescription>
              Mã chương trình: {promotion.id.slice(0, 8)}…
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {isFinancialLocked && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Lưu ý bảo toàn số liệu tài chính:</strong> Chương trình này đã được áp dụng trên{' '}
                {promotion.usageCount} hóa đơn. Để đảm bảo tính toàn vẹn của sổ sách kế toán, các trường loại chiết khấu và giá trị giảm được khóa. Bạn chỉ có thể gia hạn thời gian hoặc sửa tên chương trình.
              </div>
            </div>
          )}

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Tên chương trình khuyến mãi
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Hình thức giảm giá
                </label>
                <select
                  disabled={isFinancialLocked}
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className={`w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700 ${
                    isFinancialLocked ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="PERCENTAGE">Theo phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {discountType === 'PERCENTAGE' ? 'Tỷ lệ giảm (%)' : 'Số tiền giảm (₫)'}
                </label>
                <Input
                  type="number"
                  disabled={isFinancialLocked}
                  min={1}
                  max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className={isFinancialLocked ? 'opacity-60 cursor-not-allowed' : ''}
                />
              </div>
            </div>

            {discountType === 'PERCENTAGE' && (
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Số tiền giảm tối đa (₫)
                </label>
                <Input
                  type="number"
                  disabled={isFinancialLocked}
                  min={0}
                  placeholder="Để trống nếu không giới hạn"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  className={isFinancialLocked ? 'opacity-60 cursor-not-allowed' : ''}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Ngày bắt đầu
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Ngày kết thúc
                </label>
                <Input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- DELETE PROMOTION MODAL ---
export function DeletePromotionModal({
  promotion,
  onClose,
  onSuccess,
}: {
  promotion: Promotion | null
  onClose: () => void
  onSuccess: () => void
}) {
  if (!promotion) return null
  return <DeletePromotionModalInner promotion={promotion} onClose={onClose} onSuccess={onSuccess} />
}

function DeletePromotionModalInner({
  promotion,
  onClose,
  onSuccess,
}: {
  promotion: Promotion
  onClose: () => void
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => deletePromotion(promotion.id),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Ngừng áp dụng khuyến mãi
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn ngừng áp dụng chương trình{' '}
            <strong>{promotion.name}</strong> không?
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="py-2 text-xs text-muted-foreground space-y-1">
          <p>• Chương trình sẽ được đánh dấu ngừng hoạt động và không thể áp dụng cho các đơn hàng mới.</p>
          <p>• Các hóa đơn cũ đã áp dụng voucher này trong quá khứ sẽ vẫn được bảo lưu nguyên vẹn.</p>
          <p>• Bạn có thể khôi phục lại chương trình này bất kỳ lúc nào.</p>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? 'Đang xóa…' : 'Xác nhận ngừng áp dụng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
