import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Users,
  Phone,
  CheckCircle2,
  XCircle,
  Ban,
  Plus,
  RefreshCw,
  Edit2,
  LogIn,
  Search,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import {
  getReservations,
  getReservationRequests,
  createReservation,
  updateReservation,
  cancelReservation,
  checkInReservation,
  approveReservationRequest,
  rejectReservationRequest,
  type Reservation,
  type ReservationRequest,
  type ReservationStatus,
  type ReservationRequestStatus,
  type CheckInResult,
} from './reservations.api'
import { getDiningTables, type DiningTable } from '../pos/pos.api'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui'

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('vi-VN', {
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

function formatDateTime(iso: string) {
  return `${formatTime(iso)} ${formatDate(iso)}`
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

export default function StaffReservationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const session = useOutletContext<Session | undefined>()
  const permissions = session?.authorization.permissionKeys ?? []

  const canCreate = permissions.includes('/reservations_create')
  const canUpdate = permissions.includes('/reservations_update')
  const canCancel = permissions.includes('/reservations_cancel')
  const canCheckIn = permissions.includes('/reservations_check-in')

  const [activeTab, setActiveTab] = useState<'reservations' | 'requests'>('reservations')

  // Filters for Reservations tab
  const [resPage, setResPage] = useState(1)
  const [resStatus, setResStatus] = useState<ReservationStatus | 'ALL'>('ALL')
  const [resTableId, setResTableId] = useState<string>('ALL')
  const [resSearchPhone, setResSearchPhone] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'all'>('today')

  // Filters for Requests tab
  const [reqPage, setReqPage] = useState(1)
  const [reqStatus, setReqStatus] = useState<ReservationRequestStatus | 'ALL'>('PENDING')

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editReservation, setEditReservation] = useState<Reservation | null>(null)
  const [cancelReservationTarget, setCancelReservationTarget] = useState<Reservation | null>(null)
  const [approveRequestTarget, setApproveRequestTarget] = useState<ReservationRequest | null>(null)
  const [rejectRequestTarget, setRejectRequestTarget] = useState<ReservationRequest | null>(null)
  const [checkInSuccess, setCheckInSuccess] = useState<CheckInResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [now] = useState(() => new Date())
  // Calculate startsFrom / startsTo based on dateFilter
  const { startsFrom, startsTo } = useMemo(() => {
    if (dateFilter === 'all') return { startsFrom: undefined, startsTo: undefined }
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { startsFrom: start.toISOString(), startsTo: end.toISOString() }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999)
    return { startsFrom: start.toISOString(), startsTo: end.toISOString() }
  }, [dateFilter, now])

  // Fetch dining tables for selection
  const { data: tables = [] } = useQuery({
    queryKey: ['private', 'dining-tables'],
    queryFn: ({ signal }) => getDiningTables(signal),
    staleTime: 60_000,
  })

  // Query: Reservations
  const {
    data: reservationsData,
    isLoading: isLoadingReservations,
    refetch: refetchReservations,
  } = useQuery({
    queryKey: [
      'private',
      'reservations',
      resPage,
      resStatus,
      resTableId,
      resSearchPhone,
      startsFrom,
      startsTo,
    ],
    queryFn: ({ signal }) =>
      getReservations(
        {
          page: resPage,
          itemPerPage: 15,
          status: resStatus === 'ALL' ? undefined : resStatus,
          tableId: resTableId === 'ALL' ? undefined : resTableId,
          phoneNumber: resSearchPhone.trim() || undefined,
          startsFrom,
          startsTo,
        },
        signal,
      ),
    staleTime: 15_000,
  })

  // Query: Public requests
  const {
    data: requestsData,
    isLoading: isLoadingRequests,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['private', 'reservation-requests', reqPage, reqStatus],
    queryFn: ({ signal }) =>
      getReservationRequests(
        {
          page: reqPage,
          itemPerPage: 15,
          status: reqStatus === 'ALL' ? undefined : reqStatus,
        },
        signal,
      ),
    staleTime: 15_000,
  })

  // Mutation: Check in
  const checkInMutation = useMutation({
    mutationFn: (id: number) => checkInReservation(id),
    onSuccess: (data) => {
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'dining-tables'] })
      setCheckInSuccess(data)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const reservationsList = reservationsData?.list ?? []
  const requestsList = requestsData?.list ?? []
  const pendingRequestsCount =
    requestsList.filter((r) => r.status === 'PENDING').length || 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CalendarDays className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Quản lý Đặt bàn
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiếp nhận yêu cầu trực tuyến, điều phối sơ đồ bàn và đón khách vào phiên phục vụ POS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchReservations()
              void refetchRequests()
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Plus className="h-4 w-4" />
              Tạo đặt bàn mới
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-600 hover:underline font-medium text-xs"
          >
            Bỏ qua
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('reservations')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'reservations'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Lịch đặt bàn tại quán
          {reservationsData?.totalItems ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {reservationsData.totalItems}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Yêu cầu từ khách online
          {pendingRequestsCount > 0 ? (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-xs font-bold animate-pulse">
              {pendingRequestsCount} mới
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB 1: RESERVATIONS LIST */}
      {activeTab === 'reservations' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Date Quick Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Khung thời gian
                  </label>
                  <div className="flex rounded-md border border-input p-0.5 bg-muted/20">
                    <button
                      type="button"
                      onClick={() => setDateFilter('today')}
                      className={`flex-1 text-xs py-1.5 px-2 rounded font-medium transition-colors ${
                        dateFilter === 'today'
                          ? 'bg-card text-emerald-800 font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter('tomorrow')}
                      className={`flex-1 text-xs py-1.5 px-2 rounded font-medium transition-colors ${
                        dateFilter === 'tomorrow'
                          ? 'bg-card text-emerald-800 font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Ngày mai
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter('all')}
                      className={`flex-1 text-xs py-1.5 px-2 rounded font-medium transition-colors ${
                        dateFilter === 'all'
                          ? 'bg-card text-emerald-800 font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tất cả
                    </button>
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Trạng thái
                  </label>
                  <select
                    value={resStatus}
                    onChange={(e) => {
                      setResStatus(e.target.value as ReservationStatus | 'ALL')
                      setResPage(1)
                    }}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING">Chờ đón khách (PENDING)</option>
                    <option value="ARRIVED">Đã đón vào bàn (ARRIVED)</option>
                    <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                    <option value="NO_SHOW">Vắng mặt (NO_SHOW)</option>
                  </select>
                </div>

                {/* Table Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Bàn phục vụ
                  </label>
                  <select
                    value={resTableId}
                    onChange={(e) => {
                      setResTableId(e.target.value)
                      setResPage(1)
                    }}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  >
                    <option value="ALL">Tất cả các bàn</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.status === 'EMPTY' ? 'Trống' : t.status === 'OCCUPIED' ? 'Đang có khách' : 'Đã đặt'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Search */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Số điện thoại khách
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm theo số điện thoại..."
                      value={resSearchPhone}
                      onChange={(e) => {
                        setResSearchPhone(e.target.value)
                        setResPage(1)
                      }}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reservations Grid / Cards */}
          {isLoadingReservations ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Đang tải lịch đặt bàn…
            </div>
          ) : reservationsList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold text-foreground">
                  Không có lịch đặt bàn nào phù hợp
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Thử thay đổi bộ lọc ngày, trạng thái hoặc tạo mới lịch đặt bàn cho khách gọi điện tới.
                </p>
                {canCreate && (
                  <Button
                    onClick={() => setCreateModalOpen(true)}
                    className="mt-4 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo đặt bàn mới
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reservationsList.map((res) => {
                const isPending = res.status === 'PENDING'
                const isArrived = res.status === 'ARRIVED'

                return (
                  <Card
                    key={res.id}
                    className={`relative overflow-hidden border transition-all shadow-xs hover:shadow-sm ${
                      isPending
                        ? 'border-emerald-200 bg-card'
                        : isArrived
                          ? 'border-blue-200 bg-blue-50/20'
                          : 'border-border bg-muted/10 opacity-80'
                    }`}
                  >
                    <div className="p-4 sm:p-5 space-y-3">
                      {/* Card Header: Table + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Mã #{res.id}
                          </span>
                          <h4 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                            {res.table?.name || 'Chưa gán bàn'}
                          </h4>
                        </div>

                        <div>
                          {res.status === 'PENDING' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                              Chờ đón khách
                            </Badge>
                          )}
                          {res.status === 'ARRIVED' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">
                              Đã đón vào bàn
                            </Badge>
                          )}
                          {res.status === 'CANCELLED' && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                              Đã hủy
                            </Badge>
                          )}
                          {res.status === 'NO_SHOW' && (
                            <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">
                              Vắng mặt
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Time Window */}
                      <div className="flex items-center gap-2 text-sm text-foreground bg-muted/40 px-2.5 py-1.5 rounded-md">
                        <Clock className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span className="font-semibold">{formatTime(res.startsAt)}</span>
                        <span className="text-muted-foreground">đến</span>
                        <span className="font-semibold">{formatTime(res.endsAt)}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDate(res.startsAt)}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Khách hàng:</span>
                          <span className="font-medium text-foreground">
                            {res.customerName || 'Khách vãng lai'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Điện thoại:
                          </span>
                          <a
                            href={`tel:${res.phoneNumber}`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {res.phoneNumber}
                          </a>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> Số khách:
                          </span>
                          <span className="font-medium text-foreground">
                            {res.guestCount} người
                          </span>
                        </div>
                        {res.employee && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                            <span>Người tạo:</span>
                            <span>{res.employee.fullName}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes / Reasons */}
                      {res.notes && (
                        <div className="text-xs bg-amber-50/50 border border-amber-200/60 p-2 rounded text-amber-900">
                          <span className="font-semibold">Ghi chú:</span> {res.notes}
                        </div>
                      )}
                      {res.cancellationReason && (
                        <div className="text-xs bg-red-50 border border-red-200 p-2 rounded text-red-800">
                          <span className="font-semibold">Lý do hủy:</span> {res.cancellationReason}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-border flex items-center gap-2">
                        {isPending && (
                          <>
                            {canCheckIn && (
                              <Button
                                size="sm"
                                onClick={() => checkInMutation.mutate(res.id)}
                                disabled={checkInMutation.isPending}
                                className="flex-1 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                              >
                                <LogIn className="h-4 w-4" />
                                Đón khách
                              </Button>
                            )}

                            {canUpdate && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditReservation(res)}
                                className="px-2.5 text-muted-foreground hover:text-foreground"
                                title="Đổi giờ hoặc bàn"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}

                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCancelReservationTarget(res)}
                                className="px-2.5 text-destructive hover:bg-destructive/10"
                                title="Hủy đặt bàn"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}

                        {isArrived && res.orderSessionId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/staff/pos/sessions/${res.orderSessionId}`)
                            }
                            className="w-full gap-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            Xem phiên POS bàn này
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {reservationsData && reservationsData.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Trang {reservationsData.currentPage} / {reservationsData.totalPages} (Tổng{' '}
                {reservationsData.totalItems} lịch đặt)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resPage <= 1}
                  onClick={() => setResPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resPage >= reservationsData.totalPages}
                  onClick={() => setResPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ONLINE REQUESTS LIST */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Bộ lọc trạng thái:
                  </label>
                  <select
                    value={reqStatus}
                    onChange={(e) => {
                      setReqStatus(e.target.value as ReservationRequestStatus | 'ALL')
                      setReqPage(1)
                    }}
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  >
                    <option value="ALL">Tất cả yêu cầu</option>
                    <option value="PENDING">Chờ duyệt (PENDING)</option>
                    <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
                    <option value="REJECTED">Đã từ chối (REJECTED)</option>
                    <option value="CANCELLED">Khách tự hủy (CANCELLED)</option>
                    <option value="EXPIRED">Đã hết hạn (EXPIRED)</option>
                  </select>
                </div>

                <div className="text-xs text-muted-foreground">
                  Yêu cầu từ khách online qua trang đặt bàn công khai.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Requests List */}
          {isLoadingRequests ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Đang tải danh sách yêu cầu…
            </div>
          ) : requestsList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold text-foreground">
                  Không có yêu cầu đặt bàn nào
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Khách hàng đặt bàn trực tuyến sẽ hiển thị tại đây để nhân viên xếp bàn và phê duyệt.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requestsList.map((req) => {
                const isPending = req.status === 'PENDING'

                return (
                  <Card
                    key={req.id}
                    className={`border transition-all ${
                      isPending
                        ? 'border-amber-300 bg-amber-50/10 shadow-xs'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-foreground">
                            {req.customerName}
                          </span>
                          <Badge variant="outline" className="gap-1 font-mono text-xs">
                            <Phone className="h-3 w-3" />
                            {req.phoneNumber}
                          </Badge>
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Users className="h-3 w-3" />
                            {req.guestCount} người
                          </Badge>

                          {req.status === 'PENDING' && (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                              Chờ phê duyệt
                            </Badge>
                          )}
                          {req.status === 'APPROVED' && (
                            <Badge className="bg-emerald-700 text-white">
                              Đã duyệt
                            </Badge>
                          )}
                          {req.status === 'REJECTED' && (
                            <Badge variant="destructive">Đã từ chối</Badge>
                          )}
                          {req.status === 'CANCELLED' && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Khách đã hủy
                            </Badge>
                          )}
                          {req.status === 'EXPIRED' && (
                            <Badge variant="outline" className="text-red-700 border-red-200">
                              Quá hạn
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-emerald-700" />
                            <span>
                              {formatTime(req.startsAt)} - {formatTime(req.endsAt)} (
                              {formatDate(req.startsAt)})
                            </span>
                          </div>
                          <span className="text-xs">
                            Gửi lúc: {formatDateTime(req.createdAt)}
                          </span>
                        </div>

                        {req.notes && (
                          <p className="text-xs text-foreground bg-muted/40 p-2 rounded max-w-xl">
                            <span className="font-semibold text-muted-foreground">
                              Yêu cầu đặc biệt:
                            </span>{' '}
                            {req.notes}
                          </p>
                        )}

                        {req.rejectionReason && (
                          <p className="text-xs text-red-800 bg-red-50 p-2 rounded max-w-xl">
                            <span className="font-semibold">Lý do từ chối:</span>{' '}
                            {req.rejectionReason}
                          </p>
                        )}
                      </div>

                      {/* Right: Actions */}
                      {isPending && canCreate && (
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <Button
                            size="sm"
                            onClick={() => setApproveRequestTarget(req)}
                            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Duyệt & Xếp bàn
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRejectRequestTarget(req)}
                            className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                          >
                            <Ban className="h-4 w-4" />
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Pagination for requests */}
          {requestsData && requestsData.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Trang {requestsData.currentPage} / {requestsData.totalPages} (Tổng{' '}
                {requestsData.totalItems} yêu cầu)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reqPage <= 1}
                  onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reqPage >= requestsData.totalPages}
                  onClick={() => setReqPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE RESERVATION */}
      {createModalOpen && (
        <CreateReservationModal
          open={createModalOpen}
          tables={tables}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false)
            void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
          }}
        />
      )}

      {/* MODAL 2: EDIT RESERVATION */}
      {editReservation && (
        <EditReservationModal
          reservation={editReservation}
          tables={tables}
          onClose={() => setEditReservation(null)}
          onSuccess={() => {
            setEditReservation(null)
            void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
          }}
        />
      )}

      {/* MODAL 3: APPROVE REQUEST */}
      {approveRequestTarget && (
        <ApproveRequestModal
          request={approveRequestTarget}
          tables={tables}
          onClose={() => setApproveRequestTarget(null)}
          onSuccess={() => {
            setApproveRequestTarget(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', 'reservation-requests'],
            })
            void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
          }}
        />
      )}

      {/* MODAL 4: REJECT REQUEST */}
      {rejectRequestTarget && (
        <RejectRequestModal
          request={rejectRequestTarget}
          onClose={() => setRejectRequestTarget(null)}
          onSuccess={() => {
            setRejectRequestTarget(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', 'reservation-requests'],
            })
          }}
        />
      )}

      {/* MODAL 5: CANCEL RESERVATION */}
      {cancelReservationTarget && (
        <CancelReservationModal
          reservation={cancelReservationTarget}
          onClose={() => setCancelReservationTarget(null)}
          onSuccess={() => {
            setCancelReservationTarget(null)
            void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
          }}
        />
      )}

      {/* MODAL 6: CHECK-IN SUCCESS */}
      {checkInSuccess && (
        <Dialog open={true} onClose={() => setCheckInSuccess(null)} maxWidth="sm">
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
            <Button variant="outline" onClick={() => setCheckInSuccess(null)}>
              Ở lại trang này
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
              onClick={() => {
                const sid = checkInSuccess.orderSession.id
                setCheckInSuccess(null)
                navigate(`/staff/pos/sessions/${sid}`)
              }}
            >
              Mở phiên POS ngay
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}

// ================= MODAL COMPONENTS =================

interface CreateModalProps {
  open: boolean
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}

function CreateReservationModal({ open, tables, onClose, onSuccess }: CreateModalProps) {
  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [tableId, setTableId] = useState(tables[0]?.id || '')
  const [guestCount, setGuestCount] = useState(2)
  const [notes, setNotes] = useState('')

  // Default start: now + 30 mins, end: start + 2 hours
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
    onSuccess: () => {
      onSuccess()
    },
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
    <Dialog open={open} onClose={onClose} maxWidth="md">
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

        <DialogFooter>
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
    </Dialog>
  )
}

interface EditModalProps {
  reservation: Reservation
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}

function EditReservationModal({ reservation, tables, onClose, onSuccess }: EditModalProps) {
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
    onSuccess: () => {
      onSuccess()
    },
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
    <Dialog open={true} onClose={onClose} maxWidth="md">
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

        <DialogFooter>
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
    </Dialog>
  )
}

interface ApproveModalProps {
  request: ReservationRequest
  tables: DiningTable[]
  onClose: () => void
  onSuccess: () => void
}

function ApproveRequestModal({ request, tables, onClose, onSuccess }: ApproveModalProps) {
  const [tableId, setTableId] = useState(tables[0]?.id || '')
  const [error, setError] = useState<string | null>(null)

  const approveMutation = useMutation({
    mutationFn: () => approveReservationRequest(request.id, tableId),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm">
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
    </Dialog>
  )
}

interface RejectModalProps {
  request: ReservationRequest
  onClose: () => void
  onSuccess: () => void
}

function RejectRequestModal({ request, onClose, onSuccess }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const rejectMutation = useMutation({
    mutationFn: () => rejectReservationRequest(request.id, reason.trim()),
    onSuccess: () => onSuccess(),
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
    <Dialog open={true} onClose={onClose} maxWidth="sm">
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

        <DialogFooter>
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
    </Dialog>
  )
}

interface CancelModalProps {
  reservation: Reservation
  onClose: () => void
  onSuccess: () => void
}

function CancelReservationModal({ reservation, onClose, onSuccess }: CancelModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cancelMutation = useMutation({
    mutationFn: () => cancelReservation(reservation.id, reason.trim()),
    onSuccess: () => onSuccess(),
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
    <Dialog open={true} onClose={onClose} maxWidth="sm">
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

        <DialogFooter>
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
    </Dialog>
  )
}
