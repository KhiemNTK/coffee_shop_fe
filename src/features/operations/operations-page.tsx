import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Activity, RefreshCw } from 'lucide-react'
import type { Session } from '../auth/session'
import { errorMessage } from '@/shared/api/client'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import { Button } from '@/shared/ui'
import { operationsApi } from './operations.api'
import { ManagementExceptionsTab } from './exception-queue'

export default function OperationsPage() {
  const { employee } = useOutletContext<Session>()
  const summary = useQuery({
    queryKey: ['management-exceptions-summary', employee.id],
    queryFn: ({ signal }) =>
      operationsApi.getManagementExceptionsSummary(signal),
    refetchInterval: 30_000,
  })
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Activity className="h-6 w-6 shrink-0" aria-hidden="true" />
            Trung tâm vận hành
          </h1>
          {summary.isSuccess && (
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.data.total} việc cần xử lý ·{' '}
              {formatStoreDateTime(summary.data.asOf)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Làm mới tổng quan"
          title="Làm mới tổng quan"
          disabled={summary.isFetching}
          onClick={() => void summary.refetch()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>
      {summary.isPending && <p role="status">Đang tải tổng quan vận hành...</p>}
      {summary.isError && <p role="alert">{errorMessage(summary.error)}</p>}
      <ManagementExceptionsTab
        summary={summary.isError ? undefined : summary.data}
      />
    </div>
  )
}
