import { Ban, CheckCircle2, Clock, Phone, Users } from 'lucide-react'
import type {
  ReservationRequest,
  ReservationRequestStatus,
  PaginatedReservationRequests,
} from '../reservations.api'
import {
  formatReservationDate as formatDate,
  formatReservationDateTime as formatDateTime,
  formatReservationTime as formatTime,
} from '../reservation-time'
import { Pagination } from '../../../shared/ui/pagination'
import { Badge, Button } from '../../../shared/ui'

interface RequestsTabProps {
  requestsData?: PaginatedReservationRequests
  isLoading: boolean
  hasError: boolean
  reqStatus: ReservationRequestStatus | 'ALL'
  onReqStatusChange: (val: ReservationRequestStatus | 'ALL') => void
  reqPage: number
  onReqPageChange: (val: number | ((p: number) => number)) => void
  canCreate: boolean
  canUpdate: boolean
  onApproveClick: (req: ReservationRequest) => void
  onRejectClick: (req: ReservationRequest) => void
}

export function RequestsTab({
  requestsData,
  isLoading,
  hasError,
  reqStatus,
  onReqStatusChange,
  reqPage,
  onReqPageChange,
  canCreate,
  canUpdate,
  onApproveClick,
  onRejectClick,
}: RequestsTabProps) {
  const list = requestsData?.list ?? []
  return (
    <div className="space-y-4">
      <label className="block border-y border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        Bộ lọc trạng thái:
        <select
          aria-label="Lọc theo trạng thái yêu cầu"
          value={reqStatus}
          onChange={(event) => {
            onReqStatusChange(event.target.value as ReservationRequestStatus | 'ALL')
            onReqPageChange(1)
          }}
          className="mt-1 h-12 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
        >
          <option value="ALL">Tất cả yêu cầu</option>
          <option value="PENDING">Chờ duyệt (PENDING)</option>
          <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
          <option value="REJECTED">Đã từ chối (REJECTED)</option>
          <option value="CANCELLED">Khách tự hủy (CANCELLED)</option>
          <option value="EXPIRED">Đã hết hạn (EXPIRED)</option>
        </select>
      </label>
      {isLoading ? (
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách yêu cầu…
        </p>
      ) : hasError ? null : !list.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Không có yêu cầu đặt bàn nào
        </p>
      ) : (
        <div className="divide-y divide-border border-y border-border bg-card">
          {list.map((request) => (
            <article key={request.id} className="min-w-0 space-y-3 px-4 py-4">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 max-w-full break-words text-sm font-bold">
                  {request.customerName}
                </h3>
                <Badge
                  variant={
                    request.status === 'PENDING'
                      ? 'warning'
                      : request.status === 'APPROVED'
                        ? 'success'
                        : request.status === 'REJECTED' || request.status === 'EXPIRED'
                          ? 'destructive'
                          : 'outline'
                  }
                  className="rounded-md"
                >
                  {
                    {
                      PENDING: 'Chờ phê duyệt',
                      APPROVED: 'Đã duyệt',
                      REJECTED: 'Đã từ chối',
                      CANCELLED: 'Khách đã hủy',
                      EXPIRED: 'Quá hạn',
                    }[request.status]
                  }
                </Badge>
              </header>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <a
                  href={`tel:${request.phoneNumber}`}
                  className="flex min-h-8 items-center gap-1 text-primary"
                >
                  <Phone size={12} aria-hidden="true" />
                  {request.phoneNumber}
                </a>
                <span className="flex items-center gap-1">
                  <Users size={13} aria-hidden="true" />
                  {request.guestCount} người
                </span>
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <Clock size={14} aria-hidden="true" />
                {formatTime(request.startsAt)} – {formatTime(request.endsAt)}
                <span className="text-xs font-normal text-muted-foreground">
                  ({formatDate(request.startsAt)})
                </span>
              </p>
              {request.notes && (
                <p className="break-words border-l-2 border-amber-300 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                  {request.notes}
                </p>
              )}
              {request.rejectionReason && (
                <p className="break-words text-xs text-destructive">
                  Lý do từ chối: {request.rejectionReason}
                </p>
              )}
              {request.status === 'PENDING' && (canCreate || canUpdate) && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {canCreate && (
                    <Button className="min-h-11 flex-1" onClick={() => onApproveClick(request)}>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Duyệt & Xếp bàn
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      variant="outline"
                      className="min-h-11 text-destructive"
                      onClick={() => onRejectClick(request)}
                    >
                      <Ban size={16} aria-hidden="true" />
                      Từ chối
                    </Button>
                  )}
                </div>
              )}
              <p className="break-words text-xs text-muted-foreground" title={request.id}>
                #{request.id.slice(-8).toUpperCase()} · Gửi lúc: {formatDateTime(request.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
      {!hasError && requestsData && (requestsData.totalPages > 1 || reqPage > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            Trang {requestsData.currentPage} / {requestsData.totalPages} (Tổng{' '}
            {requestsData.totalItems} yêu cầu)
          </span>
          <Pagination
            page={reqPage}
            totalPages={requestsData.totalPages}
            onPage={onReqPageChange}
          />
        </div>
      )}
    </div>
  )
}
