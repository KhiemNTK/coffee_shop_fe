import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Coffee,
  ArrowLeft,
  Search,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  createPublicReservationRequest,
  trackPublicReservationRequest,
  cancelPublicReservationRequest,
  type PublicTrackResponse,
} from './reservations.api'
import { errorMessage } from '../../shared/api/client'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
} from '../../shared/ui'

const LOCAL_STORAGE_KEY = 'coffee_shop_reservation_access_token'

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

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

// Convert Date object to datetime-local input string format
function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

export function PublicReservationsPage() {
  const [tokenInput, setTokenInput] = useState('')
  const [activeAccessToken, setActiveAccessToken] = useState<string | null>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY)
  })

  // Booking Form State
  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [guestCount, setGuestCount] = useState(2)
  const [durationHours, setDurationHours] = useState(1.5)
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Default start: tomorrow 18:00
  const [startsAt, setStartsAt] = useState(() => {
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0, 0)
    return toDatetimeLocal(defaultStart)
  })

  // Track Query
  const {
    data: trackingData,
    isLoading: isTracking,
    refetch: refetchTrack,
    error: trackError,
  } = useQuery<PublicTrackResponse>({
    queryKey: ['public', 'track-reservation', activeAccessToken],
    queryFn: () => {
      if (!activeAccessToken) throw new Error('No token')
      return trackPublicReservationRequest(activeAccessToken)
    },
    enabled: Boolean(activeAccessToken),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'PENDING' ? 5000 : false
    },
  })

  // Mutation: Create
  const createMutation = useMutation({
    mutationFn: () => {
      const startDate = new Date(startsAt)
      const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000)

      return createPublicReservationRequest({
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        guestCount,
        notes: notes.trim() || undefined,
      })
    },
    onSuccess: (res) => {
      setFormError(null)
      localStorage.setItem(LOCAL_STORAGE_KEY, res.accessToken)
      setActiveAccessToken(res.accessToken)
    },
    onError: (err) => {
      setFormError(errorMessage(err))
    },
  })

  // Mutation: Cancel
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!activeAccessToken) throw new Error('No token')
      return cancelPublicReservationRequest(activeAccessToken)
    },
    onSuccess: () => {
      void refetchTrack()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!customerName.trim()) {
      setFormError('Vui lòng nhập họ và tên của bạn.')
      return
    }
    if (!phoneNumber.trim()) {
      setFormError('Vui lòng nhập số điện thoại để quán liên hệ đón tiếp.')
      return
    }
    const startDate = new Date(startsAt)
    if (startDate <= new Date()) {
      setFormError('Thời gian đặt bàn phải trong tương lai.')
      return
    }
    createMutation.mutate()
  }

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    localStorage.setItem(LOCAL_STORAGE_KEY, trimmed)
    setActiveAccessToken(trimmed)
  }

  const handleBookAnother = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    setActiveAccessToken(null)
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-emerald-800">
            <Coffee className="h-5 w-5 text-emerald-700" />
            Coffee Shop
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/order"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Đặt mang đi
            </Link>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Xem thực đơn
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Dịch vụ Đặt bàn trực tuyến
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Đặt Chỗ Trước Tại Quán
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Đặt bàn họp nhóm, làm việc hoặc sum họp gia đình. Quán sẽ chuẩn bị sẵn chỗ ngồi tốt nhất dành riêng cho bạn.
          </p>
        </div>

        {/* SECTION 1: IF HAS ACTIVE TRACKING ACCESS TOKEN */}
        {activeAccessToken && (
          <Card className="border-emerald-200 bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-emerald-700" />
                    Trạng thái yêu cầu đặt bàn của bạn
                  </CardTitle>
                  <CardDescription>
                    Mã truy cập cá nhân: <span className="font-mono text-xs">{activeAccessToken.slice(0, 16)}…</span>
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBookAnother}
                  className="text-xs"
                >
                  Đặt thêm yêu cầu khác
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              {isTracking ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Đang đồng bộ trạng thái từ quán…
                </div>
              ) : trackError ? (
                <div className="py-6 text-center text-sm text-red-600 space-y-2">
                  <p>Không tìm thấy thông tin đặt bàn hoặc mã truy cập không chính xác.</p>
                  <Button variant="outline" size="sm" onClick={handleBookAnother}>
                    Nhập lại mã hoặc Đặt bàn mới
                  </Button>
                </div>
              ) : trackingData ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      trackingData.status === 'PENDING'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : trackingData.status === 'APPROVED'
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : trackingData.status === 'REJECTED'
                            ? 'bg-red-50/80 border-red-200 text-red-900'
                            : 'bg-muted/40 border-border text-foreground'
                    }`}
                  >
                    {trackingData.status === 'PENDING' && (
                      <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
                    )}
                    {trackingData.status === 'APPROVED' && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {trackingData.status === 'REJECTED' && (
                      <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-1">
                      <div className="font-bold text-sm">
                        {trackingData.status === 'PENDING' && 'Yêu cầu đang chờ quán xác nhận'}
                        {trackingData.status === 'APPROVED' && 'Đã xác nhận thành công! Bàn đã sẵn sàng'}
                        {trackingData.status === 'REJECTED' && 'Rất tiếc, yêu cầu chưa được chấp thuận'}
                        {trackingData.status === 'CANCELLED' && 'Yêu cầu đặt bàn này đã được hủy'}
                        {trackingData.status === 'EXPIRED' && 'Yêu cầu đặt bàn đã quá hạn xác nhận'}
                      </div>
                      <p className="text-xs opacity-90">
                        {trackingData.status === 'PENDING' &&
                          'Nhân viên quán đang kiểm tra sơ đồ bàn và sẽ xác nhận ngay trong ít phút.'}
                        {trackingData.status === 'APPROVED' &&
                          'Vui lòng đến đúng giờ để nhận bàn. Khi đến quầy, bạn chỉ cần đọc số điện thoại đã đăng ký.'}
                        {trackingData.status === 'REJECTED' &&
                          'Khung giờ hoặc loại bàn bạn chọn hiện đã kín chỗ. Mong bạn thông cảm.'}
                      </p>
                    </div>
                  </div>

                  {/* Summary details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-2">
                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <span className="text-xs text-muted-foreground block mb-0.5">Ngày hẹn:</span>
                      <span className="font-semibold text-foreground">
                        {formatDate(trackingData.startsAt)}
                      </span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <span className="text-xs text-muted-foreground block mb-0.5">Khung giờ:</span>
                      <span className="font-semibold text-foreground">
                        {formatTime(trackingData.startsAt)} - {formatTime(trackingData.endsAt)}
                      </span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border">
                      <span className="text-xs text-muted-foreground block mb-0.5">Số lượng:</span>
                      <span className="font-semibold text-foreground">
                        {trackingData.guestCount} người
                      </span>
                    </div>
                  </div>

                  {/* Cancellation option if PENDING */}
                  {trackingData.status === 'PENDING' && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate()}
                        className="text-xs text-destructive hover:bg-destructive/10"
                      >
                        {cancelMutation.isPending ? 'Đang hủy…' : 'Hủy yêu cầu đặt bàn này'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: BOOKING FORM (IF NO ACTIVE BOOKING OR WANT TO BOOK) */}
        {!activeAccessToken && (
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Điền thông tin đặt bàn</CardTitle>
              <CardDescription>
                Vui lòng cung cấp số điện thoại chính xác để quán liên hệ xác nhận khi cần.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Họ và tên của bạn <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Số điện thoại liên hệ <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      required
                      placeholder="0912 345 678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Ngày và giờ đến <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="datetime-local"
                      required
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Thời lượng sử dụng dự kiến
                    </label>
                    <select
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                    >
                      <option value={1}>1 giờ</option>
                      <option value={1.5}>1 giờ 30 phút</option>
                      <option value={2}>2 giờ</option>
                      <option value={3}>3 giờ</option>
                      <option value={4}>4 giờ</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Số lượng khách <span className="text-red-500">*</span>
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
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Yêu cầu đặc biệt
                    </label>
                    <Input
                      type="text"
                      placeholder="Ví dụ: Ghế em bé, bàn gần cửa sổ..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-base shadow-sm"
                  >
                    {createMutation.isPending ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu đặt bàn ngay'}
                  </Button>
                </div>
              </form>

              {/* Lookup by existing token */}
              <div className="mt-8 pt-6 border-t border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Đã có mã truy cập đặt bàn trước đó?
                </h4>
                <form onSubmit={handleLookup} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Dán mã truy cập (Access Token) vào đây..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <Button type="submit" variant="outline" size="sm" className="shrink-0 gap-1">
                    <Search className="h-3.5 w-3.5" />
                    Tra cứu
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
export default PublicReservationsPage
