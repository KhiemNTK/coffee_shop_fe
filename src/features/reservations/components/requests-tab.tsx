import { Ban, CheckCircle2, Clock, Phone, Sparkles, Users } from 'lucide-react'
import {
  type ReservationRequest,
  type ReservationRequestStatus,
  type PaginatedReservationRequests,
} from '../reservations.api'
import {
  formatReservationDate as formatDate,
  formatReservationDateTime as formatDateTime,
  formatReservationTime as formatTime,
} from '../reservation-time'
import { Pagination } from '../../../shared/ui/pagination'
import { Badge, Button, Card, CardContent } from '../../../shared/ui'

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
  const requestsList = requestsData?.list ?? []

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <section className="border-b border-border py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Bộ lọc trạng thái:
            </label>
            <select
              aria-label="Lọc theo trạng thái yêu cầu"
              value={reqStatus}
              onChange={(e) => {
                onReqStatusChange(e.target.value as ReservationRequestStatus | 'ALL')
                onReqPageChange(1)
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
        </div>
      </section>

      {/* Requests List */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Đang tải danh sách yêu cầu…
        </div>
      ) : hasError ? null : requestsList.length === 0 ? (
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
                  isPending ? 'border-amber-300 bg-amber-50/10 shadow-xs' : 'border-border bg-card'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 break-words">
                  {/* Left: Info */}
                  <div className="min-w-0 space-y-2">
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
                        <Badge className="bg-emerald-700 text-white">Đã duyệt</Badge>
                      )}
                      {req.status === 'REJECTED' && <Badge variant="destructive">Đã từ chối</Badge>}
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
                      <span className="text-xs">Gửi lúc: {formatDateTime(req.createdAt)}</span>
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
                        <span className="font-semibold">Lý do từ chối:</span> {req.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  {isPending && (canCreate || canUpdate) && (
                    <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                      {canCreate && (
                        <Button
                          size="sm"
                          onClick={() => onApproveClick(req)}
                          className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Duyệt & Xếp bàn
                        </Button>
                      )}
                      {canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRejectClick(req)}
                          className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                        >
                          <Ban className="h-4 w-4" />
                          Từ chối
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination for requests */}
      {!hasError && requestsData && (requestsData.totalPages > 1 || reqPage > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
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
