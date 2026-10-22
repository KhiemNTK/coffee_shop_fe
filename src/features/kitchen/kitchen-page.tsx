import { startTransition, useEffect, useOptimistic, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { AlertCircle, Radio, RefreshCw, Settings2, Volume2, VolumeX } from 'lucide-react'
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
import { enableNotificationSound } from '../../shared/lib/sound'
import { Button } from '../../shared/ui/button'
import { Badge } from '../../shared/ui/badge'
import { KitchenWorkloadKpis } from './components/kitchen-workload-kpis'
import { KitchenStationsBar } from './components/kitchen-stations-bar'
import { KitchenTicketsGrid } from './components/kitchen-tickets-grid'
import { Pagination } from '../../shared/ui/pagination'
import { KitchenStationsManagement } from './components/kitchen-stations-management'
import { OperationsHeader } from '../../shared/ui'

export default function KitchenPage() {
  const { t: translate, i18n } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const canReadTickets = access.has('/kitchen-tickets_read')
  const canReadStations = access.has('/kitchen-stations_read')
  const canUpdateStatus = access.has('/orders_items_update-status')

  const [params, setParams] = useSearchParams()
  const selectedStationId = z.uuid().safeParse(params.get('stationId')).data ?? ''
  const includeCompleted = params.get('includeCompleted') === 'true'
  const includeScheduled = params.get('includeScheduled') === 'true'
  const [displayIncludeScheduled, setDisplayIncludeScheduled] = useOptimistic(includeScheduled)
  const [displayIncludeCompleted, setDisplayIncludeCompleted] = useOptimistic(includeCompleted)
  const page =
    z.coerce
      .number()
      .int()
      .min(1)
      .max(100_000)
      .safeParse(params.get('page') ?? 1).data ?? 1
  function setFilters(changes: Record<string, string | null>) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next
    })
  }
  const setPage = (value: number) => setFilters({ page: value === 1 ? null : String(value) })
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
    try {
      return localStorage.getItem('coffee_kds_sound') !== 'false'
    } catch {
      return false
    }
  })

  // Real-time SSE connection
  const { status: sseStatus } = useKitchenSse(employee.id, canReadTickets && !management, {
    soundEnabled,
    stationId: selectedStationId,
  })

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
    refetchInterval: sseStatus !== 'connected' ? 15_000 : 60_000,
  })

  const ticketsQuery = useQuery({
    queryKey: [
      ...kitchenKeys.tickets(employee.id),
      { stationId: selectedStationId, includeCompleted, includeScheduled, page },
    ],
    queryFn: ({ signal }) =>
      getKitchenTickets(
        { stationId: selectedStationId || undefined, includeCompleted, includeScheduled, page },
        signal,
      ),
    enabled: canReadTickets && !management,
    refetchInterval: sseStatus !== 'connected' ? 6_000 : 60_000,
  })
  const lastRefreshedAt = ticketsQuery.dataUpdatedAt
    ? new Date(ticketsQuery.dataUpdatedAt).toLocaleTimeString(i18n.resolvedLanguage)
    : null

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
      void queryClient.invalidateQueries({ queryKey: ['management-exceptions-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['management-exceptions-list'] })
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
    if (
      ticketsQuery.data?.list.some(
        (ticket) => ticket.isScheduled && ticket.items.some((line) => line.id === item.id),
      )
    )
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
      <OperationsHeader
        title={translate('ops.kitchen.title')}
        meta={
          lastRefreshedAt ? translate('ops.kitchen.updated', { time: lastRefreshedAt }) : undefined
        }
        actions={
          <>
            {!management && (
              <Badge
                role="status"
                aria-atomic="true"
                variant={sseStatus === 'connected' ? 'success' : 'warning'}
                className="rounded-md"
              >
                <Radio size={13} aria-hidden="true" />
                {!canReadTickets
                  ? translate('ops.kitchen.noAccess')
                  : translate(
                      sseStatus === 'connected'
                        ? 'ops.kitchen.live'
                        : sseStatus === 'connecting'
                          ? 'ops.kitchen.connecting'
                          : 'ops.kitchen.polling',
                    )}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-pressed={soundEnabled}
              title={translate(soundEnabled ? 'ops.kitchen.soundOff' : 'ops.kitchen.soundOn')}
              aria-label={translate(soundEnabled ? 'ops.kitchen.soundOff' : 'ops.kitchen.soundOn')}
              onClick={() => {
                const next = !soundEnabled
                if (next) void enableNotificationSound()
                setSoundEnabled(next)
                try {
                  localStorage.setItem('coffee_kds_sound', String(next))
                } catch {
                  /* Sound still works in this tab. */
                }
              }}
            >
              {soundEnabled ? (
                <Volume2 size={18} aria-hidden="true" />
              ) : (
                <VolumeX size={18} aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11"
              title={translate('ops.kitchen.refresh')}
              aria-label={translate('ops.kitchen.refresh')}
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: kitchenKeys.all(employee.id) })
              }
            >
              <RefreshCw size={18} aria-hidden="true" />
            </Button>
            {canReadStations && (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setManagement(!management)}
              >
                <Settings2 size={16} aria-hidden="true" />
                {translate(management ? 'ops.kitchen.back' : 'ops.kitchen.stationSettings')}
              </Button>
            )}
          </>
        }
      />

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
            stations={
              stationsQuery.data ??
              workloadQuery.data?.stations.map((station) => ({
                id: station.stationId,
                name: station.stationName,
                code: station.stationCode,
              })) ??
              []
            }
            selectedStationId={selectedStationId}
            onSelectStation={(id) => {
              setFilters({ stationId: id || null, page: null })
            }}
            includeCompleted={displayIncludeCompleted}
            includeScheduled={displayIncludeScheduled}
            onToggleIncludeScheduled={(value) =>
              startTransition(() => {
                setDisplayIncludeScheduled(value)
                setFilters({ includeScheduled: value ? 'true' : null, page: null })
              })
            }
            onToggleIncludeCompleted={(value) => {
              startTransition(() => {
                setDisplayIncludeCompleted(value)
                setFilters({ includeCompleted: value ? 'true' : null, page: null })
              })
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
              dueSoonWindowSeconds={
                workloadQuery.isSuccess ? workloadQuery.data.dueSoonWindowSeconds : undefined
              }
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
