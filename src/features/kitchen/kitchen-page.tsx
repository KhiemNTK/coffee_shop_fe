import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ChefHat,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  Radio,
  RefreshCw,
  Sparkles,
  Utensils,
} from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import { type Session } from '../auth/session'
import {
  getKitchenStations,
  getKitchenTickets,
  getKitchenWorkload,
  updateOrderItemStatus,
  type KitchenTicketItem,
} from './kitchen.api'
import { useKitchenSse } from './use-kitchen-sse'
import { Card, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Badge } from '../../shared/ui/badge'
import { cn } from '../../shared/ui/utils'

export default function KitchenPage() {
  const { authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const canUpdateStatus = authorization.permissionKeys.includes(
    '/orders_items_update-status',
  )

  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // Real-time SSE connection
  const { status: sseStatus, lastRefreshedAt } = useKitchenSse(true)

  // Queries
  const stationsQuery = useQuery({
    queryKey: ['kitchen', 'stations'],
    queryFn: ({ signal }) => getKitchenStations(signal),
  })

  const workloadQuery = useQuery({
    queryKey: ['kitchen', 'workload'],
    queryFn: ({ signal }) => getKitchenWorkload(signal),
    refetchInterval: 15_000,
  })

  const ticketsQuery = useQuery({
    queryKey: ['kitchen', 'tickets', { stationId: selectedStationId, includeCompleted }],
    queryFn: ({ signal }) =>
      getKitchenTickets(selectedStationId || undefined, includeCompleted, signal),
    refetchInterval: sseStatus !== 'connected' ? 6_000 : false,
  })

  const statusMutation = useMutation({
    mutationFn: async ({
      orderItemId,
      status,
    }: {
      orderItemId: string
      status: 'COOKING' | 'READY' | 'SERVED' | 'CANCELLED'
    }) => {
      setActionError(null)
      return updateOrderItemStatus(orderItemId, status)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'workload'] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const stations = stationsQuery.data || []
  const workload = workloadQuery.data
  const tickets = ticketsQuery.data || []

  // Aggregate workload numbers
  const totalOpenTickets = workload?.stations.reduce(
    (acc, s) => acc + s.openTicketCount,
    0,
  ) ?? 0
  const totalOpenUnits = workload?.stations.reduce(
    (acc, s) => acc + s.openUnitCount,
    0,
  ) ?? 0
  const totalOverdue = workload?.stations.reduce(
    (acc, s) => acc + s.overdueTicketCount,
    0,
  ) ?? 0
  const totalDueSoon = workload?.stations.reduce(
    (acc, s) => acc + s.dueSoonTicketCount,
    0,
  ) ?? 0

  function formatTimeDiff(dueAtStr: string) {
    const diffMs = new Date(dueAtStr).getTime() - nowMs
    const diffMins = Math.round(diffMs / 60_000)
    if (diffMins < 0) {
      return `Quá hạn ${Math.abs(diffMins)} ph`
    }
    return `Còn ${diffMins} ph`
  }

  function advanceItemStatus(item: KitchenTicketItem) {
    if (!canUpdateStatus) {
      setActionError('Bạn không có quyền cập nhật trạng thái món (/orders_items_update-status).')
      return
    }
    if (item.serveStatus === 'PENDING') {
      statusMutation.mutate({ orderItemId: item.orderItemId, status: 'COOKING' })
    } else if (item.serveStatus === 'COOKING') {
      statusMutation.mutate({ orderItemId: item.orderItemId, status: 'READY' })
    } else if (item.serveStatus === 'READY') {
      statusMutation.mutate({ orderItemId: item.orderItemId, status: 'SERVED' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Trạng thái SSE thời gian thực */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">KHU VỰC BẾP & PHA CHẾ</p>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <ChefHat className="h-7 w-7 text-primary" /> Điều phối bếp & pha chế (KDS)
          </h1>
        </div>

        {/* SSE Indicator */}
        <div className="flex items-center gap-2.5">
          <Badge
            variant={sseStatus === 'connected' ? 'success' : 'warning'}
            className="gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            <Radio className={cn('h-3.5 w-3.5', sseStatus === 'connected' && 'animate-pulse')} />
            {sseStatus === 'connected' ? 'Realtime Live' : 'Đang kết nối lại'}
          </Badge>

          {lastRefreshedAt && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              Cập nhật: {lastRefreshedAt}
            </span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['kitchen'] })
            }}
            title="Làm mới thủ công"
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {actionError && (
        <div
          className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tóm tắt tải lượng (Workload Summary Bar) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Utensils className="h-3.5 w-3.5" /> Món cần làm
            </span>
            <p className="mt-1 text-2xl font-bold text-primary">
              {totalOpenUnits}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Vé đang chờ
            </span>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {totalOpenTickets}
            </p>
          </CardContent>
        </Card>

        <Card className={cn('border-l-4', totalOverdue > 0 ? 'border-l-red-500 bg-red-50/20' : 'border-l-slate-300')}>
          <CardContent className="p-4">
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider',
                totalOverdue > 0 ? 'text-red-700' : 'text-muted-foreground',
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Quá giờ SLA
            </span>
            <p
              className={cn(
                'mt-1 text-2xl font-bold',
                totalOverdue > 0 ? 'text-red-600' : 'text-foreground',
              )}
            >
              {totalOverdue}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Flame className="h-3.5 w-3.5" /> Sắp tới hạn
            </span>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {totalDueSoon}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Thanh bộ lọc Quầy Bếp (Station Filter) & Trạng thái hoàn thành */}
      <Card className="p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" /> Quầy:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStationId('')}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-semibold transition-colors',
                selectedStationId === ''
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              Tất cả quầy
            </button>
            {stations.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStationId(s.id)}
                className={cn(
                  'rounded-full px-3.5 py-1 text-xs font-semibold transition-colors',
                  selectedStationId === s.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                {s.name} ({s.code})
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            Xem cả món đã xong
          </label>
        </div>
      </Card>

      {/* Lưới hiển thị các thẻ vé bếp (Kitchen Tickets) */}
      {ticketsQuery.isPending ? (
        <main className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground" role="status">
          <p className="animate-pulse">Đang tải danh sách vé bếp…</p>
        </main>
      ) : ticketsQuery.isError ? (
        <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="font-semibold text-destructive" role="alert">{errorMessage(ticketsQuery.error)}</p>
          <Button
            onClick={() => void ticketsQuery.refetch()}
            disabled={ticketsQuery.isFetching}
            className="mt-4"
          >
            Thử lại
          </Button>
        </main>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <h2 className="text-lg font-bold text-primary mb-1">
            Bếp đang rảnh rỗi!
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Không có món nào đang chờ chế biến. Các món mới khi order sẽ xuất hiện tức thì tại đây qua kết nối realtime.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => {
            const isCompletedTicket = ticket.state === 'COMPLETED'
            const isOverdue = ticket.isOverdue

            return (
              <div
                key={ticket.id}
                className={cn(
                  'flex flex-col justify-between overflow-hidden rounded-xl border-2 bg-card transition-all',
                  isOverdue
                    ? 'border-red-500 shadow-md shadow-red-500/10'
                    : isCompletedTicket
                      ? 'border-emerald-300'
                      : ticket.state === 'IN_PROGRESS'
                        ? 'border-sky-400'
                        : 'border-border',
                )}
              >
                {/* Header vé */}
                <div
                  className={cn(
                    'flex items-center justify-between border-b px-4 py-3',
                    isOverdue ? 'bg-red-50/50 border-red-100' : 'bg-muted/40 border-border',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-lg font-bold text-foreground">
                        #{ticket.ticketNumber}
                      </strong>
                      <Badge variant={ticket.table ? 'secondary' : 'default'} className="text-[11px] font-bold">
                        {ticket.table ? `Bàn: ${ticket.table.name}` : 'Mang đi'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Quầy: {ticket.station.name}
                    </span>
                  </div>

                  <div className="text-right">
                    <div
                      className={cn(
                        'flex items-center gap-1 text-xs font-bold justify-end',
                        isOverdue ? 'text-red-600' : 'text-muted-foreground',
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimeDiff(ticket.dueAt)}
                    </div>
                    <small className="text-[11px] text-muted-foreground">
                      Gọi: {new Date(ticket.createdAt).toLocaleTimeString('vi-VN')}
                    </small>
                  </div>
                </div>

                {/* Danh sách món trong vé */}
                <div className="space-y-2.5 p-4">
                  {ticket.items.map((item) => {
                    const isPending = item.serveStatus === 'PENDING'
                    const isCooking = item.serveStatus === 'COOKING'
                    const isReady = item.serveStatus === 'READY'
                    const isServed = item.serveStatus === 'SERVED'

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors',
                          isReady
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : isCooking
                              ? 'border-sky-200 bg-sky-50/50'
                              : 'border-border bg-muted/20',
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-foreground">
                              {item.quantity}x {item.itemName}
                            </span>
                          </div>

                          {/* Topping / Options / Ghi chú */}
                          {item.note && (
                            <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Ghi chú: {item.note}
                            </p>
                          )}
                        </div>

                        {/* Nút hành động trạng thái món (Step workflow) */}
                        <div>
                          {isPending && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => advanceItemStatus(item)}
                              disabled={statusMutation.isPending}
                              className="h-8 bg-sky-600 hover:bg-sky-700 text-xs font-semibold"
                            >
                              Bắt đầu làm
                            </Button>
                          )}

                          {isCooking && (
                            <Button
                              type="button"
                              size="sm"
                              variant="success"
                              onClick={() => advanceItemStatus(item)}
                              disabled={statusMutation.isPending}
                              className="h-8 text-xs font-semibold"
                            >
                              Xong món
                            </Button>
                          )}

                          {isReady && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => advanceItemStatus(item)}
                              disabled={statusMutation.isPending}
                              title="Bấm để xác nhận đã lên bàn / giao khách"
                              className="h-8 border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Lên bàn
                            </Button>
                          )}

                          {isServed && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã lên món
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

