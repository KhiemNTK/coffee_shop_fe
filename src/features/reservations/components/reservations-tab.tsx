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
import type { Reservation, ReservationStatus, PaginatedReservations } from '../reservations.api'
import type { DiningTable } from '../../pos/pos.api'
import {
  formatReservationDate as formatDate,
  formatReservationTime as formatTime,
} from '../reservation-time'
import { Pagination } from '../../../shared/ui/pagination'
import { Badge, Button, Input } from '../../../shared/ui'

interface ReservationsTabProps {
  reservationsData?: PaginatedReservations
  isLoading: boolean
  hasError: boolean
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
  canReadTables: boolean
  canReadPos: boolean
  onCheckInClick: (res: Reservation) => void
  onCreateClick: () => void
  onEditClick: (res: Reservation) => void
  onCancelClick: (res: Reservation) => void
}

export function ReservationsTab({
  reservationsData,
  isLoading,
  hasError,
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
  canReadTables,
  canReadPos,
  onCheckInClick,
  onCreateClick,
  onEditClick,
  onCancelClick,
}: ReservationsTabProps) {
  const navigate = useNavigate()
  const list = reservationsData?.list ?? []
  return (
    <div className="space-y-4">
      <section
        aria-label="Bộ lọc lịch đặt bàn"
        className="grid gap-3 border-y border-border bg-card px-4 py-3 sm:grid-cols-2"
      >
        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs text-muted-foreground">Khung thời gian</legend>
          <div className="flex rounded-md border border-input p-0.5">
            {(['today', 'tomorrow', 'all'] as const).map((value, index) => (
              <button
                key={value}
                type="button"
                aria-pressed={dateFilter === value}
                onClick={() => onDateFilterChange(value)}
                className={`min-h-11 flex-1 rounded px-2 text-xs font-medium transition-colors ${dateFilter === value ? 'bg-primary text-white' : 'hover:bg-muted'}`}
              >
                {['Hôm nay', 'Ngày mai', 'Tất cả'][index]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="min-w-0 text-xs text-muted-foreground">
          Trạng thái
          <select
            aria-label="Lọc theo trạng thái đặt bàn"
            value={resStatus}
            onChange={(event) => {
              onResStatusChange(event.target.value as ReservationStatus | 'ALL')
              onResPageChange(1)
            }}
            className="mt-1 h-12 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ đón khách (PENDING)</option>
            <option value="ARRIVED">Đã đón vào bàn (ARRIVED)</option>
            <option value="CANCELLED">Đã hủy (CANCELLED)</option>
            <option value="NO_SHOW">Vắng mặt (NO_SHOW)</option>
          </select>
        </label>
        <label className="min-w-0 text-xs text-muted-foreground">
          Bàn phục vụ
          <select
            aria-label="Lọc theo bàn phục vụ"
            disabled={!canReadTables}
            value={resTableId}
            onChange={(event) => {
              onResTableIdChange(event.target.value)
              onResPageChange(1)
            }}
            className="mt-1 h-12 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
          >
            <option value="ALL">Tất cả các bàn</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-xs text-muted-foreground">
          Số điện thoại khách
          <span className="relative mt-1 block">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Số điện thoại khách"
              maxLength={20}
              placeholder="Tìm theo số điện thoại..."
              value={resSearchPhone}
              onChange={(event) => onResSearchPhoneChange(event.target.value)}
              className="h-12 pl-9 text-sm"
            />
          </span>
        </label>
      </section>
      {isLoading ? (
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          Đang tải lịch đặt bàn…
        </p>
      ) : hasError ? null : !list.length ? (
        <div className="py-12 text-center">
          <CalendarDays
            size={32}
            aria-hidden="true"
            className="mx-auto mb-3 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold">Không có lịch đặt bàn nào phù hợp</h3>
          {canCreate && (
            <Button className="mt-4 min-h-11" onClick={onCreateClick}>
              <Plus size={16} aria-hidden="true" />
              Tạo đặt bàn mới
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border bg-card">
          {list.map((reservation) => (
            <article
              key={reservation.id}
              className="grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[100px_minmax(0,1fr)]"
            >
              <div className="flex items-center gap-2 sm:block">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  <Clock size={14} aria-hidden="true" />
                  {formatTime(reservation.startsAt)}
                </p>
                <p className="text-xs text-muted-foreground sm:mt-1">
                  – {formatTime(reservation.endsAt)}
                </p>
                <p className="text-xs text-muted-foreground sm:mt-2">
                  {formatDate(reservation.startsAt)}
                </p>
              </div>
              <div className="min-w-0 space-y-3">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 max-w-full break-words text-base font-bold">
                    {reservation.table?.name ?? 'Chưa gán bàn'}
                  </h3>
                  <Badge
                    variant={
                      reservation.status === 'PENDING'
                        ? 'warning'
                        : reservation.status === 'ARRIVED'
                          ? 'success'
                          : reservation.status === 'NO_SHOW'
                            ? 'destructive'
                            : 'outline'
                    }
                    className="rounded-md"
                  >
                    {
                      {
                        PENDING: 'Chờ đón khách',
                        ARRIVED: 'Đã đón vào bàn',
                        CANCELLED: 'Đã hủy',
                        NO_SHOW: 'Vắng mặt',
                      }[reservation.status]
                    }
                  </Badge>
                </header>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <strong className="min-w-0 max-w-full break-words">
                    {reservation.customerName || 'Khách vãng lai'}
                  </strong>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users size={13} aria-hidden="true" />
                    {reservation.guestCount} người
                  </span>
                  <a
                    href={`tel:${reservation.phoneNumber}`}
                    className="inline-flex min-h-8 items-center gap-1 text-xs text-primary"
                  >
                    <Phone size={12} aria-hidden="true" />
                    {reservation.phoneNumber}
                  </a>
                </div>
                {reservation.notes && (
                  <p className="break-words border-l-2 border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    {reservation.notes}
                  </p>
                )}
                {reservation.cancellationReason && (
                  <p className="break-words text-xs text-destructive">
                    Lý do hủy: {reservation.cancellationReason}
                  </p>
                )}
                <footer className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    #{reservation.id}
                    {reservation.employee ? ` · ${reservation.employee.fullName}` : ''}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {reservation.status === 'PENDING' && (
                      <>
                        {canCheckIn && (
                          <Button className="min-h-11" onClick={() => onCheckInClick(reservation)}>
                            <LogIn size={16} aria-hidden="true" />
                            Đón khách
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => onEditClick(reservation)}
                            title="Đổi giờ hoặc bàn"
                            aria-label="Đổi giờ hoặc bàn"
                          >
                            <Edit2 size={16} aria-hidden="true" />
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-destructive"
                            onClick={() => onCancelClick(reservation)}
                            title="Hủy đặt bàn"
                            aria-label="Hủy đặt bàn"
                          >
                            <XCircle size={16} aria-hidden="true" />
                          </Button>
                        )}
                      </>
                    )}
                    {reservation.status === 'ARRIVED' &&
                      canReadPos &&
                      reservation.orderSessionId && (
                        <Button
                          variant="outline"
                          className="min-h-11"
                          onClick={() =>
                            navigate(`/staff/pos/sessions/${reservation.orderSessionId}`)
                          }
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          Xem phiên POS bàn này
                        </Button>
                      )}
                  </div>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
      {!hasError && reservationsData && (reservationsData.totalPages > 1 || resPage > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            Trang {reservationsData.currentPage} / {reservationsData.totalPages} (Tổng{' '}
            {reservationsData.totalItems} lịch đặt)
          </span>
          <Pagination
            page={resPage}
            totalPages={reservationsData.totalPages}
            onPage={onResPageChange}
          />
        </div>
      )}
    </div>
  )
}
