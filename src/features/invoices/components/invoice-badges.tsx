import { Coins, CreditCard, QrCode } from 'lucide-react'
import { type PaymentMethod, type PaymentStatus } from '../invoices.api'
import { Badge } from '../../../shared/ui'

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === 'PAID') {
    return <Badge variant="success">Đã thanh toán</Badge>
  }
  if (status === 'UNPAID') {
    return <Badge variant="warning">Chờ thanh toán</Badge>
  }
  if (status === 'VOIDED') {
    return <Badge variant="destructive">Đã hủy</Badge>
  }
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return (
      <Badge variant="secondary" className="bg-purple-50 text-purple-800 border-purple-200">
        Hoàn trả
      </Badge>
    )
  }
  return <Badge variant="outline">{status}</Badge>
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  if (method === 'CASH') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
        <Coins className="h-3 w-3 text-amber-700" /> Tiền mặt
      </span>
    )
  }
  if (method === 'TRANSFER') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
        <QrCode className="h-3 w-3 text-sky-600" /> Chuyển khoản
      </span>
    )
  }
  if (method === 'CARD') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
        <CreditCard className="h-3 w-3 text-indigo-600" /> Thẻ
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{method}</span>
}

export function AttemptStatusBadge({ status }: { status: string }) {
  if (status === 'SUCCEEDED') {
    return <Badge variant="success">Thành công</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="warning">Chờ quét mã</Badge>
  }
  if (status === 'FAILED') {
    return <Badge variant="destructive">Thất bại</Badge>
  }
  if (status === 'EXPIRED') {
    return <Badge variant="secondary">Hết hạn</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}
