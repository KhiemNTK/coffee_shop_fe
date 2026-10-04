import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import {
  type FulfillmentOrder,
  type PendingOrder,
  collectOnlineOrder,
} from '../online-orders.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '../../../shared/ui'

// ============================================================================
// REJECT DIALOG COMPONENT
// ============================================================================

export function RejectOrderDialog({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: PendingOrder
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')
  const quickReasons = [
    'Quán đang quá tải giờ cao điểm',
    'Hết nguyên liệu pha chế',
    'Quán sắp đóng cửa',
    'Không liên hệ được khách hàng',
  ]

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="text-red-700">
          Từ chối đơn của {order.pickupName}
        </DialogTitle>
        <DialogDescription>
          Vui lòng chọn hoặc nhập lý do từ chối để thông báo cho khách hàng:
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 my-4">
        <div className="flex flex-wrap gap-1.5">
          {quickReasons.map((r) => (
            <Button
              key={r}
              type="button"
              variant={reason === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReason(r)}
              className="text-xs h-7"
            >
              {r}
            </Button>
          ))}
        </div>

        <Textarea
          rows={3}
          required
          placeholder="Nhập lý do cụ thể (tối thiểu 2 ký tự)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Quay lại
        </Button>
        <Button
          variant="destructive"
          disabled={reason.trim().length < 2 || isPending}
          isLoading={isPending}
          onClick={() => onConfirm(reason.trim())}
        >
          Xác nhận từ chối
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

// ============================================================================
// COLLECT ORDER MODAL (CUSTOMER TOKEN VERIFICATION + CASH TENDERED)
// ============================================================================

export function CollectOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: FulfillmentOrder
  onClose: () => void
  onSuccess: () => void
}) {
  const [accessToken, setAccessToken] = useState('')
  const [amountTendered, setAmountTendered] = useState(() =>
    String(Math.ceil(Number(order.quotedSubtotal))),
  )
  const [modalError, setModalError] = useState<string | null>(null)

  const totalNumber = Number(order.quotedSubtotal)
  const tenderedNumber = Number(amountTendered) || 0
  const changeAmount = Math.max(0, tenderedNumber - totalNumber)

  const collectMutation = useMutation({
    mutationFn: () =>
      collectOnlineOrder(order.id, {
        accessToken: accessToken.trim().toLowerCase(),
        amountTendered: Number(amountTendered).toFixed(2),
      }),
    onSuccess: () => {
      onSuccess()
    },
    onError: (err) => {
      setModalError(errorMessage(err))
    },
  })

  function handleCollectSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalError(null)

    const cleanToken = accessToken.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(cleanToken)) {
      setModalError(
        'Mã xác thực khách hàng (Access Token) phải là chuỗi 64 ký tự hex.',
      )
      return
    }

    if (tenderedNumber < totalNumber) {
      setModalError('Tiền khách đưa không được nhỏ hơn tổng tiền đơn hàng.')
      return
    }

    collectMutation.mutate()
  }

  return (
    <Dialog open={true} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle>Bàn giao món & Thu tiền mặt</DialogTitle>
        <DialogDescription>
          Khách hàng: {order.pickupName} ({order.phoneNumber})
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleCollectSubmit} className="space-y-4 my-2">
        <div>
          <label className="block text-xs font-semibold text-[#202d29] mb-1">
            Mã xác thực khách hàng (Access Token 64 hex) <span className="text-red-600">*</span>
          </label>
          <Input
            type="text"
            required
            placeholder="Dán hoặc nhập mã 64 ký tự từ màn hình khách..."
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="font-mono text-xs"
          />
          <span className="text-[11px] text-[#68776f] mt-1 block">
            Khách hàng bấm nút sao chép mã nhận hàng trên điện thoại để cung cấp.
          </span>
        </div>

        <div className="rounded-lg border border-[#dce5df] bg-[#f8faf9] p-3.5 space-y-3 text-sm">
          <div className="flex justify-between items-baseline">
            <span className="text-[#68776f]">Cần thanh toán:</span>
            <strong className="text-lg text-[#174f3f]">
              {formatPrice(order.quotedSubtotal)}
            </strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202d29] mb-1">
              Tiền khách đưa (VNĐ)
            </label>
            <Input
              type="number"
              step="1000"
              min={totalNumber}
              required
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
              className="text-base font-bold"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {[totalNumber, 50000, 100000, 200000, 500000]
              .filter((amt) => amt >= totalNumber)
              .map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountTendered(String(amt))}
                  className="h-7 text-xs"
                >
                  {formatPrice(String(amt))}
                </Button>
              ))}
          </div>

          <div className="flex justify-between items-baseline border-t border-dashed border-[#cbd7cf] pt-2">
            <span className="text-xs text-[#4b6155]">Tiền thối lại:</span>
            <strong
              className={`text-base ${
                changeAmount > 0 ? 'text-amber-700' : 'text-[#174f3f]'
              }`}
            >
              {formatPrice(String(changeAmount))}
            </strong>
          </div>
        </div>

        {modalError && (
          <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
            {modalError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="success"
            type="submit"
            disabled={collectMutation.isPending}
            isLoading={collectMutation.isPending}
          >
            <Check size={16} />
            Xác nhận thu tiền & Giao
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// ============================================================================
// CANCEL ACCEPTED DIALOG COMPONENT
// ============================================================================

export function CancelAcceptedDialog({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: FulfillmentOrder
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="text-red-700">
          Hủy đơn hàng #{order.id.slice(0, 8)}?
        </DialogTitle>
        <DialogDescription>
          Nhập lý do hủy đơn (VD: Khách gọi điện báo hủy, sự cố pha chế...):
        </DialogDescription>
      </DialogHeader>

      <div className="my-3">
        <Textarea
          rows={3}
          required
          placeholder="Nhập lý do..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Quay lại
        </Button>
        <Button
          variant="destructive"
          disabled={reason.trim().length < 2 || isPending}
          isLoading={isPending}
          onClick={() => onConfirm(reason.trim())}
        >
          Xác nhận hủy
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
