import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Receipt,
  Coins,
  UserCheck,
  MessageSquareWarning,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import {
  settingsApi,
  type ManagementExceptionsSummary,
} from '@/features/settings/settings.api'
import { formatVnd, formatDate } from '@/shared/lib/format'
import {
  Button,
  Badge,
  Card,
} from '@/shared/ui'

export interface ManagementExceptionsTabProps {
  summary?: ManagementExceptionsSummary
}

export function ManagementExceptionsTab({ summary }: ManagementExceptionsTabProps) {
  const [exceptionKind, setExceptionKind] = useState<
    'PAYMENT' | 'CASH_EXPENSE' | 'CASH_HANDOVER' | 'FEEDBACK'
  >('PAYMENT')

  const {
    data: exceptionsListData,
    isLoading: isLoadingExceptions,
  } = useQuery({
    queryKey: ['management-exceptions-list', exceptionKind],
    queryFn: ({ signal }) =>
      settingsApi.getManagementExceptions({ kind: exceptionKind, itemPerPage: 20 }, signal),
  })

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <Card
          onClick={() => setExceptionKind('PAYMENT')}
          className={`border p-4 shadow-xs cursor-pointer transition-all ${
            exceptionKind === 'PAYMENT'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-border/80 hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Đối soát Cổng TT</span>
            <Receipt className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary?.counts.PAYMENT ?? 0}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">sự cố lệch thanh toán</p>
        </Card>

        <Card
          onClick={() => setExceptionKind('CASH_EXPENSE')}
          className={`border p-4 shadow-xs cursor-pointer transition-all ${
            exceptionKind === 'CASH_EXPENSE'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-border/80 hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Chi quỹ tiền mặt</span>
            <Coins className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary?.counts.CASH_EXPENSE ?? 0}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">phiếu chi cần duyệt</p>
        </Card>

        <Card
          onClick={() => setExceptionKind('CASH_HANDOVER')}
          className={`border p-4 shadow-xs cursor-pointer transition-all ${
            exceptionKind === 'CASH_HANDOVER'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-border/80 hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Bàn giao ca</span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary?.counts.CASH_HANDOVER ?? 0}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">chờ quản lý xác nhận</p>
        </Card>

        <Card
          onClick={() => setExceptionKind('FEEDBACK')}
          className={`border p-4 shadow-xs cursor-pointer transition-all ${
            exceptionKind === 'FEEDBACK'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-border/80 hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Khiếu nại khách</span>
            <MessageSquareWarning className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-2 text-2xl font-bold text-destructive">
            {summary?.counts.FEEDBACK ?? 0}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">đánh giá thấp &lt;= 2 sao</p>
        </Card>
      </div>

      {/* Exceptions List */}
      {isLoadingExceptions ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Đang tải danh sách ngoại lệ quản trị...</p>
        </div>
      ) : !exceptionsListData?.list || exceptionsListData.list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mb-2" />
          <h3 className="text-base font-semibold text-foreground">
            Không có ngoại lệ tồn đọng
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Tất cả các nghiệp vụ trong mục {exceptionKind} đều đang ở trạng thái chuẩn mực, không
            có phát sinh cần can thiệp.
          </p>
        </div>
      ) : (
        <Card className="border border-border/80 overflow-hidden shadow-xs">
          <div className="divide-y divide-border">
            {exceptionsListData.list.map((item: any, idx) => (
              <div
                key={item.id || idx}
                className="p-4 hover:bg-muted/30 transition-colors flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {item.title ||
                        item.description ||
                        item.comment ||
                        (item.rating ? `Đánh giá ${item.rating} sao` : undefined) ||
                        item.reason ||
                        `Sự cố #${idx + 1}`}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.status || (item.rating ? `${item.rating} ⭐` : 'PENDING')}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                    {item.comment && item.title ? <span>{item.comment}</span> : null}
                    {item.amount ? <span>Số tiền: {formatVnd(item.amount)}</span> : null}
                    {item.invoiceId ? <span>Hóa đơn: {item.invoiceId}</span> : null}
                    {item.paymentAttemptId ? <span>Cổng TT: {item.paymentAttemptId}</span> : null}
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground font-mono">
                    Thời điểm: {formatDate(item.createdAt || item.detectedAt)}
                  </div>
                </div>

                <Button size="sm" variant="outline" className="text-xs h-7">
                  Chi tiết
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
