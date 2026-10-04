import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit2,
  LogIn,
  Phone,
  Plus,
  Search,
  Users,
  XCircle,
} from 'lucide-react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  type CheckInResult,
  type Reservation,
  type ReservationStatus,
  type PaginatedReservations,
} from '../reservations.api'
import { type DiningTable } from '../../pos/pos.api'
import { formatDate } from '../../../shared/lib/format'
import { Badge, Button, Card, CardContent, Input } from '../../../shared/ui'

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

interface ReservationsTabProps {
  reservationsData?: PaginatedReservations
  isLoading: boolean
  tables: DiningTable[]
  dateFilter: 'today' | 'tomorrow' | 'all'
  onDateFilterChange: (val: 'today' | 'tomorrow' | 'all') => void
  resStatus: ReservationStatus | 'ALL'
  onResStatusChange: (val: ReservationStatus | 'ALL') => void
  resTableId: string
  onResTableIdChange: (val: string) => void
  resSearchPhone: string
  onResSearchPhoneChange: (val: string) => void
  resPage: number
  onResPageChange: (val: number | ((p: number) => number)) => void
  canCreate: boolean
  canUpdate: boolean
  canCancel: boolean
  canCheckIn: boolean
  checkInMutation: UseMutationResult<CheckInResult, Error, number>
  onCreateClick: () => void
  onEditClick: (res: Reservation) => void
  onCancelClick: (res: Reservation) => void
}

export function ReservationsTab({
  reservationsData,
  isLoading,
  tables,
  dateFilter,
  onDateFilterChange,
  resStatus,
  onResStatusChange,
  resTableId,
  onResTableIdChange,
  resSearchPhone,
  onResSearchPhoneChange,
  resPage,
  onResPageChange,
  canCreate,
  canUpdate,
  canCancel,
  canCheckIn,
  checkInMutation,
  onCreateClick,
  onEditClick,
  onCancelClick,
}: ReservationsTabProps) {
  const navigate = useNavigate()
  const reservationsList = reservationsData?.list ?? []

  return (
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
                  onClick={() => onDateFilterChange('today')}
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
                  onClick={() => onDateFilterChange('tomorrow')}
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
                  onClick={() => onDateFilterChange('all')}
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
                aria-label="Lọc theo trạng thái đặt bàn"
                value={resStatus}
                onChange={(e) => {
                  onResStatusChange(e.target.value as ReservationStatus | 'ALL')
                  onResPageChange(1)
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
                aria-label="Lọc theo bàn phục vụ"
                value={resTableId}
                onChange={(e) => {
                  onResTableIdChange(e.target.value)
                  onResPageChange(1)
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
                    onResSearchPhoneChange(e.target.value)
                    onResPageChange(1)
                  }}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reservations Grid / Cards */}
      {isLoading ? (
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
                onClick={onCreateClick}
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
                            onClick={() => onEditClick(res)}
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
                            onClick={() => onCancelClick(res)}
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
              onClick={() => onResPageChange((p: number) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={resPage >= reservationsData.totalPages}
              onClick={() => onResPageChange((p: number) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
