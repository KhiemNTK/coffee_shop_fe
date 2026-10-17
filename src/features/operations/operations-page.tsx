import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Activity, ChefHat, Clock, CreditCard, RefreshCw } from 'lucide-react'
import type { Session } from '../auth/session'
import { errorMessage } from '@/shared/api/client'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import { Button, OperationsHeader, OperationsSummary } from '@/shared/ui'
import { operationsApi } from './operations.api'
import { ManagementExceptionsTab } from './exception-queue'

export default function OperationsPage() {
  const { employee } = useOutletContext<Session>()
  const summary = useQuery({
    queryKey: ['management-exceptions-summary', employee.id],
    queryFn: ({ signal }) => operationsApi.getManagementExceptionsSummary(signal),
    refetchInterval: 30_000,
  })
  return (
    <div className="admin-page space-y-5">
      <OperationsHeader
        title="Trung tâm vận hành"
        meta={
          summary.isSuccess
            ? `${summary.data.total} việc cần xử lý · ${formatStoreDateTime(summary.data.asOf)} · Giờ Việt Nam`
            : undefined
        }
        actions={
          <Button
            variant="outline"
            size="icon"
            aria-label="Làm mới tổng quan"
            title="Làm mới tổng quan"
            className="h-10 w-10"
            disabled={summary.isFetching}
            onClick={() => void summary.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />
      {summary.isPending && <p role="status">Đang tải tổng quan vận hành...</p>}
      {summary.isError && <p role="alert">{errorMessage(summary.error)}</p>}
      <OperationsSummary
        label="Tổng quan ngoại lệ"
        variant="cards"
        metrics={[
          {
            label: 'Tổng việc cần xử lý',
            value: summary.isSuccess ? summary.data.total : '—',
            icon: Activity,
          },
          {
            label: 'Đối soát cổng thanh toán',
            value: summary.isSuccess ? summary.data.counts.PAYMENT : '—',
            icon: CreditCard,
          },
          {
            label: 'Phiếu bếp trễ',
            value: summary.isSuccess ? summary.data.counts.KITCHEN_OVERDUE : '—',
            icon: ChefHat,
          },
          {
            label: 'Đơn quá giờ hẹn',
            value: summary.isSuccess ? summary.data.counts.ONLINE_PICKUP_LATE : '—',
            icon: Clock,
          },
        ]}
      />
      <ManagementExceptionsTab summary={summary.isError ? undefined : summary.data} />
    </div>
  )
}
