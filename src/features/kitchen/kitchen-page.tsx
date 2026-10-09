import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, ChefHat, Radio, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import { type Session } from '../auth/session'
import {
  getKitchenStations,
  getKitchenTickets,
  getKitchenWorkload,
  updateOrderItemStatus,
  kitchenKeys,
  type KitchenTicketItem,
} from './kitchen.api'
import { useKitchenSse } from './use-kitchen-sse'
import { Button } from '../../shared/ui/button'
import { Badge } from '../../shared/ui/badge'
import { cn } from '../../shared/ui/utils'
import { KitchenWorkloadKpis } from './components/kitchen-workload-kpis'
import { KitchenStationsBar } from './components/kitchen-stations-bar'
import { KitchenTicketsGrid } from './components/kitchen-tickets-grid'
import { Pagination } from '../../shared/ui/pagination'
import { KitchenStationsManagement } from './components/kitchen-stations-management'

export default function KitchenPage() {
  const { authorization, employee } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const canReadTickets = authorization.permissionKeys.includes('/kitchen-tickets_read')
  const canReadStations = authorization.permissionKeys.includes('/kitchen-stations_read')
  const canUpdateStatus = authorization.permissionKeys.includes('/orders_items_update-status')

  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(false)
  const [page, setPage] = useState(1)
  const [management, setManagement] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const flight = useRef(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('coffee_kds_sound') !== 'false'
  })

  // Real-time SSE connection
  const { status: sseStatus, lastRefreshedAt } = useKitchenSse(
    employee.id,
    canReadTickets && !management,
    { soundEnabled },
  )

  // Queries
  const stationsQuery = useQuery({
    queryKey: kitchenKeys.stations(employee.id),
    queryFn: ({ signal }) => getKitchenStations(signal),
    enabled: canReadStations && !management,
  })

  const workloadQuery = useQuery({
    queryKey: kitchenKeys.workload(employee.id),
    queryFn: ({ signal }) => getKitchenWorkload(signal),
    enabled: canReadTickets && !management,
    refetchInterval: 15_000,
  })

  const ticketsQuery = useQuery({
    queryKey: [
      ...kitchenKeys.tickets(employee.id),
      { stationId: selectedStationId, includeCompleted, page },
    ],
    queryFn: ({ signal }) =>
      getKitchenTickets(selectedStationId || undefined, includeCompleted, signal, page),
    enabled: canReadTickets && !management,
    refetchInterval: sseStatus !== 'connected' ? 6_000 : 60_000,
  })

  const statusMutation = useMutation({
    retry: false,
    mutationFn: async ({
      orderItemId,
      status,
    }: {
      orderItemId: string
      status: 'COOKING' | 'READY' | 'SERVED'
    }) => {
      setActionError(null)
      return updateOrderItemStatus(orderItemId, status)
    },
    onSettled: () => {
      flight.current = false
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.tickets(employee.id) })
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.workload(employee.id) })
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'orders'] })
      for (const name of [
        'inventory-items',
        'inventory-transactions',
        'inventory-reorder-alerts',
      ]) {
        void queryClient.invalidateQueries({ queryKey: [name] })
      }
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'admin-menu-stock'] })
    },
    onError: (err) => {
      setReviewRequired(true)
      setActionError(errorMessage(err))
    },
  })

  function advanceItemStatus(item: KitchenTicketItem) {
    if (flight.current || reviewRequired || ticketsQuery.isFetching || !ticketsQuery.isSuccess)
      return
    if (!canUpdateStatus) {
      setActionError('Bạn không có quyền cập nhật trạng thái món (/orders_items_update-status).')
      return
    }
    if (item.serveStatus === 'PENDING') {
      flight.current = true
      statusMutation.mutate({
        orderItemId: item.orderItemId,
        status: 'COOKING',
      })
    } else if (item.serveStatus === 'COOKING') {
      flight.current = true
      statusMutation.mutate({
        orderItemId: item.orderItemId,
        status: item.currentTable ? 'SERVED' : 'READY',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Trạng thái SSE thời gian thực */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            KHU VỰC BẾP & PHA CHẾ
          </p>
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
            {!canReadTickets
              ? 'Không có quyền xem vé bếp'
              : sseStatus === 'connected'
                ? 'Realtime Live'
                : 'Đang kết nối lại'}
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
              setSoundEnabled((prev) => {
                const next = !prev
                localStorage.setItem('coffee_kds_sound', String(next))
                return next
              })
            }}
            title={soundEnabled ? 'Tắt âm báo vé mới' : 'Bật âm báo vé mới'}
            aria-label={soundEnabled ? 'Tắt âm báo vé mới' : 'Bật âm báo vé mới'}
            className={cn('h-8 w-8 cursor-pointer', !soundEnabled && 'text-muted-foreground opacity-60')}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-primary" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: kitchenKeys.all(employee.id) })
            }}
            title="Làm mới thủ công"
            aria-label="Làm mới màn hình bếp"
            className="h-8 w-8 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {actionError && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{actionError}</span>
          {reviewRequired && (
            <Button
              variant="outline"
              size="sm"
              disabled={ticketsQuery.isFetching}
              onClick={async () => {
                const current = await ticketsQuery.refetch()
                if (current.isSuccess) {
                  setReviewRequired(false)
                  setActionError(null)
                }
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Đối chiếu vé bếp
            </Button>
          )}
        </div>
      )}

      {canReadStations && (
        <Button variant="outline" onClick={() => setManagement(!management)}>
          {management ? 'Về màn hình bếp' : 'Trạm bếp & SLA'}
        </Button>
      )}
      {management ? (
        <KitchenStationsManagement />
      ) : (
        <>
          {/* Tóm tắt tải lượng (Workload Summary Bar) */}
          {canReadTickets && workloadQuery.isSuccess && !workloadQuery.isError && (
            <KitchenWorkloadKpis workload={workloadQuery.data} />
          )}
          {canReadTickets && workloadQuery.isPending && (
            <p role="status">Đang tải tải lượng bếp…</p>
          )}
          {workloadQuery.isError && <p role="alert">{errorMessage(workloadQuery.error)}</p>}
          {stationsQuery.isError && <p role="alert">{errorMessage(stationsQuery.error)}</p>}

          {/* Thanh bộ lọc Quầy Bếp (Station Filter) & Trạng thái hoàn thành */}
          <KitchenStationsBar
            stations={stationsQuery.data || []}
            selectedStationId={selectedStationId}
            onSelectStation={(id) => {
              setSelectedStationId(id)
              setPage(1)
            }}
            includeCompleted={includeCompleted}
            onToggleIncludeCompleted={(value) => {
              setIncludeCompleted(value)
              setPage(1)
            }}
          />

          {/* Lưới hiển thị các thẻ vé bếp (Kitchen Tickets) */}
          {canReadTickets && (
            <KitchenTicketsGrid
              tickets={ticketsQuery.data?.list || []}
              isLoading={ticketsQuery.isPending}
              isError={ticketsQuery.isError}
              error={ticketsQuery.error}
              onRetry={() => void ticketsQuery.refetch()}
              nowMs={nowMs}
              onAdvanceItemStatus={advanceItemStatus}
              isUpdatingStatus={
                !canUpdateStatus ||
                statusMutation.isPending ||
                reviewRequired ||
                ticketsQuery.isFetching
              }
            />
          )}
          {ticketsQuery.isSuccess && (
            <Pagination
              page={page}
              totalPages={ticketsQuery.data.totalPages}
              onPage={setPage}
              disabled={ticketsQuery.isFetching}
            />
          )}
          {ticketsQuery.isSuccess && page > Math.max(1, ticketsQuery.data.totalPages) && (
            <Button variant="outline" onClick={() => setPage(1)}>
              Về trang đầu
            </Button>
          )}
        </>
      )}
    </div>
  )
}
