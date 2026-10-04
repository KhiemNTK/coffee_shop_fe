import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Ban, CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  createReservation,
  updateReservation,
  cancelReservation,
  approveReservationRequest,
  rejectReservationRequest,
  type Reservation,
  type ReservationRequest,
  type CheckInResult,
} from '../reservations.api'
import { type DiningTable } from '../../pos/pos.api'
import { errorMessage } from '../../../shared/api/client'
import { formatDate } from '../../../shared/lib/format'
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

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

// Convert Date object to datetime-local input string format (YYYY-MM-DDTHH:mm)
function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

// --- CREATE RESERVATION MODAL ---
export function CreateReservationModal({
  open,
  tables,
  onClose,
  onSuccess,
}: {
  open: boolean
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [tableId, setTableId] = useState(tables[0]?.id || '')
  const [guestCount, setGuestCount] = useState(2)
  const [notes, setNotes] = useState('')

  const [startsAt, setStartsAt] = useState(() => {
    const now = new Date()
    const defaultStart = new Date(now.getTime() + 30 * 60 * 1000)
    return toDatetimeLocal(defaultStart)
  })
  const [endsAt, setEndsAt] = useState(() => {
    const now = new Date()
    const defaultStart = new Date(now.getTime() + 30 * 60 * 1000)
    const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000)
    return toDatetimeLocal(defaultEnd)
  })
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => {
      const startDate = new Date(startsAt)
      const endDate = new Date(endsAt)
      return createReservation({
        customerName: customerName.trim() || undefined,
        phoneNumber: phoneNumber.trim(),
        tableId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        guestCount,
        notes: notes.trim() || undefined,
      })
    },
    onSuccess,
    onError: (err) => {
      setError(errorMessage(err))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!phoneNumber.trim()) {
      setError('Vui lòng nhập số điện thoại khách hàng.')
      return
    }
    if (!tableId) {
      setError('Vui lòng chọn một bàn ăn hợp lệ.')
      return
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.')
      return
    }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tạo đặt bàn mới tại quầy / điện thoại</DialogTitle>
            <DialogDescription>
              Điền thông tin khách hàng, số lượng người và khung giờ đặt bàn.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 text-sm">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Tên khách hàng
              </label>
              <Input
                type="text"
                placeholder="Nguyễn Văn A"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                required
                placeholder="0912345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Chọn bàn ăn <span className="text-red-500">*</span>
              </label>
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                required
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status === 'EMPTY' ? 'Bàn trống' : t.status === 'OCCUPIED' ? 'Đang có khách' : 'Đã đặt'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Số lượng khách (người) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={50}
                required
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Giờ bắt đầu <span className="text-red-500">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Giờ kết thúc dự kiến <span className="text-red-500">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-medium text-foreground block mb-1">
                Ghi chú thêm
              </label>
              <Input
                type="text"
                placeholder="Ví dụ: Cần ghế trẻ em, chuẩn bị bàn họp..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
              {createMutation.isPending ? 'Đang lưu…' : 'Xác nhận đặt bàn'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- EDIT RESERVATION MODAL ---
export function EditReservationModal({
  reservation,
  tables,
  onClose,
  onSuccess,
}: {
  reservation: Reservation | null
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}) {
  if (!reservation) return null
  return (
    <EditReservationModalInner
      reservation={reservation}
      tables={tables}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

function EditReservationModalInner({
  reservation,
  tables,
  onClose,
  onSuccess,
}: {
  reservation: Reservation
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [customerName, setCustomerName] = useState(reservation.customerName || '')
  const [phoneNumber, setPhoneNumber] = useState(reservation.phoneNumber)
  const [tableId, setTableId] = useState(reservation.tableId)
  const [guestCount, setGuestCount] = useState(reservation.guestCount)
  const [notes, setNotes] = useState(reservation.notes || '')
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(new Date(reservation.startsAt)))
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(new Date(reservation.endsAt)))
  const [error, setError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: () => {
      const startDate = new Date(startsAt)
      const endDate = new Date(endsAt)
      return updateReservation(reservation.id, {
        customerName: customerName.trim() || undefined,
        phoneNumber: phoneNumber.trim(),
        tableId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        guestCount,
        notes: notes.trim() || undefined,
      })
    },
    onSuccess,
    onError: (err) => {
      setError(errorMessage(err))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.')
      return
    }
    updateMutation.mutate()
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Điều chỉnh lịch đặt bàn #{reservation.id}</DialogTitle>
            <DialogDescription>
              Đổi bàn ăn, dời giờ hoặc cập nhật thông tin số lượng khách.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 text-sm">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Tên khách hàng
              </label>
              <Input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Số điện thoại
              </label>
              <Input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Đổi bàn phục vụ
              </label>
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                required
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status === 'EMPTY' ? 'Bàn trống' : t.status === 'OCCUPIED' ? 'Đang có khách' : 'Đã đặt'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Số lượng khách
              </label>
              <Input
                type="number"
                min={1}
                max={50}
                required
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Giờ bắt đầu
              </label>
              <Input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Giờ kết thúc
              </label>
              <Input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-medium text-foreground block mb-1">
                Ghi chú
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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

// --- APPROVE REQUEST MODAL ---
export function ApproveRequestModal({
  request,
  tables,
  onClose,
  onSuccess,
}: {
  request: ReservationRequest | null
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}) {
  if (!request) return null
  return (
    <ApproveRequestModalInner
      request={request}
      tables={tables}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

function ApproveRequestModalInner({
  request,
  tables,
  onClose,
  onSuccess,
}: {
  request: ReservationRequest
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [tableId, setTableId] = useState(tables[0]?.id || '')
  const [error, setError] = useState<string | null>(null)

  const approveMutation = useMutation({
    mutationFn: () => approveReservationRequest(request.id, tableId),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            Phê duyệt & Xếp bàn cho yêu cầu
          </DialogTitle>
          <DialogDescription>
            Chọn bàn phục vụ phù hợp với số lượng khách ({request.guestCount} người).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3 py-2 text-sm">
          <div className="bg-muted/40 p-3 rounded-lg space-y-1 text-xs">
            <p>
              <span className="font-semibold text-muted-foreground">Khách hàng:</span>{' '}
              <span className="font-bold text-foreground">{request.customerName}</span> ({request.phoneNumber})
            </p>
            <p>
              <span className="font-semibold text-muted-foreground">Khung giờ:</span>{' '}
              {formatTime(request.startsAt)} - {formatTime(request.endsAt)} (
              {formatDate(request.startsAt)})
            </p>
            {request.notes && (
              <p>
                <span className="font-semibold text-muted-foreground">Yêu cầu:</span>{' '}
                {request.notes}
              </p>
            )}
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1 text-xs">
              Gán bàn phục vụ <span className="text-red-500">*</span>
            </label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status === 'EMPTY' ? 'Bàn trống' : t.status === 'OCCUPIED' ? 'Đang có khách' : 'Đã đặt'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || !tableId}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {approveMutation.isPending ? 'Đang duyệt…' : 'Xác nhận duyệt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- REJECT REQUEST MODAL ---
export function RejectRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: ReservationRequest | null
  onClose: () => void
  onSuccess: () => void
}) {
  if (!request) return null
  return <RejectRequestModalInner request={request} onClose={onClose} onSuccess={onSuccess} />
}

function RejectRequestModalInner({
  request,
  onClose,
  onSuccess,
}: {
  request: ReservationRequest
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const rejectMutation = useMutation({
    mutationFn: () => rejectReservationRequest(request.id, reason.trim()),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do từ chối yêu cầu đặt bàn.')
      return
    }
    rejectMutation.mutate()
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Từ chối yêu cầu đặt bàn
            </DialogTitle>
            <DialogDescription>
              Khách hàng: {request.customerName} ({request.phoneNumber}).
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="py-2 text-sm">
            <label className="font-medium text-foreground block mb-1 text-xs">
              Lý do từ chối <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              placeholder="Ví dụ: Quán đã hết bàn vào khung giờ này..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Đang xử lý…' : 'Xác nhận từ chối'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- CANCEL RESERVATION MODAL ---
export function CancelReservationModal({
  reservation,
  onClose,
  onSuccess,
}: {
  reservation: Reservation | null
  onClose: () => void
  onSuccess: () => void
}) {
  if (!reservation) return null
  return <CancelReservationModalInner reservation={reservation} onClose={onClose} onSuccess={onSuccess} />
}

function CancelReservationModalInner({
  reservation,
  onClose,
  onSuccess,
}: {
  reservation: Reservation
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cancelMutation = useMutation({
    mutationFn: () => cancelReservation(reservation.id, reason.trim()),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy đặt bàn.')
      return
    }
    cancelMutation.mutate()
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Hủy lịch đặt bàn #{reservation.id}
            </DialogTitle>
            <DialogDescription>
              Bàn {reservation.table?.name} - Khách: {reservation.customerName || reservation.phoneNumber}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="py-2 text-sm">
            <label className="font-medium text-foreground block mb-1 text-xs">
              Lý do hủy <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              placeholder="Ví dụ: Khách gọi điện báo bận không đến được..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Đang hủy…' : 'Xác nhận hủy lịch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- CHECK-IN SUCCESS MODAL ---
export function CheckInSuccessModal({
  checkInSuccess,
  onClose,
}: {
  checkInSuccess: CheckInResult | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  if (!checkInSuccess) return null

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            Đón khách vào bàn thành công!
          </DialogTitle>
          <DialogDescription>
            Hệ thống đã tự động kích hoạt phiên phục vụ (Session POS) cho bàn này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-lg space-y-1 text-emerald-950">
            <div className="flex justify-between">
              <span>Mã đặt bàn:</span>
              <span className="font-bold">#{checkInSuccess.reservation.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Mã phiên POS:</span>
              <span className="font-mono text-xs">{checkInSuccess.orderSession.id}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Bạn có thể chuyển ngay sang màn hình Bán hàng (POS) để gọi món nước và đồ ăn cho khách.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ở lại trang này
          </Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
            onClick={() => {
              const sid = checkInSuccess.orderSession.id
              onClose()
              navigate(`/staff/pos/sessions/${sid}`)
            }}
          >
            Mở phiên POS ngay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
