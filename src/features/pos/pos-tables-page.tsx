import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  Armchair,
  Coffee,
  Plus,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { ApiError, errorMessage } from '../../shared/api/client'
import { pendingIntentKey, readPendingIntent, writePendingIntent, isPendingIntentExpired, type PendingIntent } from '../../shared/api/pending-intent'
import { type Session } from '../auth/session'
import { getCurrentShift } from '../cashier-shifts/cashier-shifts.api'
import { ShiftRequiredLink } from '@/features/cashier-shifts/shift-required-link'
import { getDiningTables, getActiveSessions, openOrderSession, openSessionPayloadSchema, type OpenSessionPayload, type DiningTable } from './pos.api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Badge } from '../../shared/ui/badge'
import { Input } from '../../shared/ui/input'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui/dialog'
import { cn } from '../../shared/ui/utils'
import { posKeys } from './pos.keys'
import { TakeawayHandoffQueue } from './components/takeaway-handoff-queue'

export default function PosTablesPage() {
  const { t: translate } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [openingTableId, setOpeningTableId] = useState<string | null>(null)
  const [guestCount, setGuestCount] = useState<number>(2)
  const [actionError, setActionError] = useState<string | null>(null)
  const recoveryKey = pendingIntentKey(employee.id, 'orders.sessions.open')
  const [recovery] = useState(() => {
    try { return { intent: readPendingIntent(recoveryKey, openSessionPayloadSchema), error: false } }
    catch { return { intent: null, error: true } }
  })
  const [pendingOpen, setPendingOpen] = useState(recovery.intent)
  const openFlight = useRef(false)

  const can = access.has
  const canReadTables = can('/dining-tables_read')
  const canReadSessions = can('/orders_sessions_read')
  const canReadShift = can('/cashier-shifts_current')
  const canCreateSession =
    canReadSessions && access.has('/orders_sessions_create')

  const shiftQuery = useQuery({
    queryKey: ['private', employee.id, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal),
    enabled: canReadShift,
  })

  const tablesQuery = useQuery({
    queryKey: posKeys.tables(employee.id),
    queryFn: ({ signal }) => getDiningTables(signal),
    enabled: canReadTables,
    refetchInterval: 10_000,
  })

  const sessionsQuery = useQuery({
    queryKey: posKeys.sessions(employee.id),
    queryFn: ({ signal }) => getActiveSessions(signal),
    refetchInterval: 10_000,
    enabled: canReadSessions,
  })

  const openSessionMutation = useMutation({
    retry: false,
    mutationFn: async (intent: PendingIntent<OpenSessionPayload>) => {
      setActionError(null)
      return openOrderSession(intent.payload.tableId, intent.payload.guestCount, intent.idempotencyKey)
    },
    onSuccess: (session) => {
      sessionStorage.removeItem(recoveryKey)
      setPendingOpen(null)
      void queryClient.invalidateQueries({
        queryKey: posKeys.tables(employee.id),
      })
      void queryClient.invalidateQueries({
        queryKey: posKeys.sessions(employee.id),
      })
      navigate(`/staff/pos/sessions/${session.id}`)
    },
    onError: (err, intent) => {
      setActionError(errorMessage(err))
      if (!intent.uncertain && err instanceof ApiError && err.status >= 400 && err.status < 500 && ![408, 429].includes(err.status)) {
        sessionStorage.removeItem(recoveryKey)
        setPendingOpen(null)
      } else {
        const uncertain = { ...intent, uncertain: true }
        setPendingOpen(uncertain)
        try { writePendingIntent(recoveryKey, uncertain) }
        catch { setActionError(translate('pos.storageUncertain')) }
      }
    },
    onSettled: () => { openFlight.current = false },
  })

  function openSession(tableId: string | null) {
    if (!canCreateSession || openFlight.current || recovery.error) return
    if (pendingOpen && isPendingIntentExpired(pendingOpen)) {
      setActionError(translate('pos.openExpired'))
      return
    }
    const intent = pendingOpen ?? {
      payload: { tableId, ...(tableId ? { guestCount } : {}) },
      idempotencyKey: crypto.randomUUID(), createdAt: Date.now(),
    }
    try { writePendingIntent(recoveryKey, { ...intent, uncertain: true }) }
    catch { setActionError(translate('pos.openStorageFailed')); return }
    openFlight.current = true
    setPendingOpen(intent)
    setOpeningTableId(null)
    openSessionMutation.mutate(intent)
  }

  if (
    (canReadTables && tablesQuery.isPending) ||
    (canReadSessions && sessionsQuery.isPending) ||
    (canReadShift && shiftQuery.isPending)
  ) {
    return (
      <main
        className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground"
        role="status"
      >
        <p className="animate-pulse">{translate('pos.loadingTables')}</p>
      </main>
    )
  }

  const readError =
    (canReadTables && tablesQuery.error) ||
    (canReadSessions && sessionsQuery.error) ||
    (canReadShift && shiftQuery.error)
  if (readError) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-destructive font-semibold" role="alert">
          {errorMessage(readError)}
        </p>
        <Button
          onClick={() => {
            if (canReadTables) void tablesQuery.refetch()
            if (canReadSessions) void sessionsQuery.refetch()
            if (canReadShift) void shiftQuery.refetch()
          }}
          disabled={tablesQuery.isFetching || sessionsQuery.isFetching || shiftQuery.isFetching}
          className="mt-4"
        >
          {translate('common.retry')}
        </Button>
      </main>
    )
  }

  const tables = tablesQuery.data || []
  const activeSessions = sessionsQuery.data || []
  const currentShift = shiftQuery.data

  const takeawaySessions = activeSessions.filter((s) => s.table === null)
  const listedSessions = canReadTables ? takeawaySessions : activeSessions

  const sessionByTableId = new Map<string, (typeof activeSessions)[0]>()
  for (const s of activeSessions) {
    if (s.table?.id) {
      sessionByTableId.set(s.table.id, s)
    }
  }
  const displayTables = tables.map((table) => {
    const session = sessionByTableId.get(table.id)
    return { table, session, status: session ? 'OCCUPIED' : table.status }
  })
  const emptyCount = displayTables.filter(({ status }) => status === 'EMPTY').length
  const occupiedCount = displayTables.filter(({ status }) => status === 'OCCUPIED').length
  const reservedCount = displayTables.filter(({ status }) => status === 'RESERVED').length

  function handleTableClick(table: DiningTable) {
    if (!canReadSessions) {
      setActionError(translate('pos.noSessionPermission'))
      return
    }
    const existing = sessionByTableId.get(table.id)
    if (existing) {
      navigate(`/staff/pos/sessions/${existing.id}`)
      return
    }
    if (!canCreateSession) {
      setActionError(translate('pos.noCreatePermission'))
      return
    }
    if (pendingOpen || recovery.error) return
    setOpeningTableId(table.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {translate('pos.sales')}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {translate('pos.heading')}
          </h1>
        </div>

        {canCreateSession && (
          <Button
            type="button"
            onClick={() => openSession(null)}
            disabled={Boolean(pendingOpen) || recovery.error}
            isLoading={openSessionMutation.isPending}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <ShoppingBag className="h-4 w-4" />
            {translate('pos.openTakeaway')}
          </Button>
        )}
      </div>

      {(pendingOpen || recovery.error) && (
        <div role="alert" className="space-y-2 border-l-2 border-destructive p-3 text-sm">
          <p>{translate(recovery.error ? 'pos.openCorrupt' : isPendingIntentExpired(pendingOpen!) ? 'pos.openExpired' : 'pos.openUncertain')}</p>
          {pendingOpen && canCreateSession && (
            <Button variant="outline" disabled={openSessionMutation.isPending || isPendingIntentExpired(pendingOpen)} onClick={() => openSession(pendingOpen.payload.tableId)}>
              {translate('pos.recoverOpen')}
            </Button>
          )}
        </div>
      )}

      {canReadShift && shiftQuery.isSuccess && !currentShift && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <span className="text-sm">
              <strong>{translate('pos.notice')}</strong> {translate('pos.noShift')}
            </span>
          </div>
          <ShiftRequiredLink />
        </div>
      )}

      {actionError && (
        <div
          className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Thống kê nhanh */}
      {canReadTables && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {translate('pos.emptyTables')}
              </span>
              <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">{emptyCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {translate('pos.occupiedTables')}
              </span>
              <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">{occupiedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {translate('pos.reservedTables')}
              </span>
              <p className="mt-1 text-2xl font-bold text-sky-700 tabular-nums">{reservedCount}</p>
            </CardContent>
          </Card>
          {canReadSessions && (
            <Card className="border-l-4 border-l-primary shadow-xs">
              <CardContent className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {translate('nav.online-orders')}
                </span>
                <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
                  {takeawaySessions.length}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modal xác nhận số lượng khách khi mở bàn */}
      <Dialog
        open={Boolean(openingTableId)}
        onOpenChange={(open) => {
          if (!open) setOpeningTableId(null)
        }}
        maxWidth="sm"
      >
        <DialogHeader>
          <DialogTitle>{translate('pos.openTable')}</DialogTitle>
          <DialogDescription>
            {translate('pos.tablePrefix')}{' '}
            <strong className="text-foreground">
              {tables.find((t) => t.id === openingTableId)?.name}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          <label htmlFor="guestCountInput" className="block text-sm font-semibold text-foreground">
            {translate('pos.guestCount')}
          </label>
          <Input
            id="guestCountInput"
            type="number"
            min="1"
            max="50"
            value={guestCount}
            onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpeningTableId(null)}
            className="flex-1"
          >
            {translate('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              const id = openingTableId
              if (id) openSession(id)
            }}
            disabled={Boolean(pendingOpen) || recovery.error}
            isLoading={openSessionMutation.isPending}
            className="flex-2"
          >
            {translate('pos.confirmOpenTable')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Lưới sơ đồ bàn */}
      {canReadTables && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <UtensilsCrossed className="h-5 w-5 text-primary" /> {translate('pos.tableList')}
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {displayTables.map(({ table, session, status }) => {
              const isOccupied = status === 'OCCUPIED'
              const isReserved = status === 'RESERVED'
              return (
                <button
                  type="button"
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  disabled={isReserved || (isOccupied && !session)}
                  className={cn(
                    'group flex min-h-[128px] cursor-pointer flex-col justify-between rounded-xl border-2 p-3.5 sm:p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary overflow-hidden disabled:opacity-100! disabled:cursor-default',
                    isReserved
                      ? 'border-sky-400 bg-sky-50/70'
                      : isOccupied
                      ? 'border-amber-400 bg-amber-50/70 hover:border-amber-500 shadow-xs'
                      : 'border-emerald-500/60 bg-card hover:border-emerald-600 shadow-xs',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 min-w-0 w-full">
                    <div className="flex basis-24 items-center gap-2 min-w-0 flex-1">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs shadow-xs',
                          isReserved
                            ? 'bg-sky-100 text-sky-900 border border-sky-300'
                            : isOccupied
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300',
                        )}
                      >
                        <Armchair className="h-4 w-4" />
                      </div>
                      <span
                        className="text-sm sm:text-base font-bold text-foreground min-w-0 flex-1 break-words line-clamp-2 leading-tight"
                        title={table.name}
                      >
                        {table.name}
                      </span>
                    </div>
                    <Badge
                      variant={isOccupied ? 'warning' : isReserved ? 'secondary' : 'success'}
                      className={cn('text-[10px] sm:text-[11px] shrink-0 font-bold shadow-xs', isReserved && 'bg-sky-100 text-sky-900')}
                    >
                      {isReserved ? translate('pos.reserved') : isOccupied ? translate('pos.occupied') : translate('pos.empty')}
                    </Badge>
                  </div>

                  {session ? (
                    <div className="mt-3 space-y-1.5 text-xs font-medium">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Users className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <span className="font-semibold text-foreground">
                          {session.guestCount ?? 1} {translate('common.guestsLower')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Coffee className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <span className="font-semibold text-amber-800">
                          {session._count.orderItems} {translate('common.itemsLower')}
                        </span>
                      </div>
                    </div>
                  ) : isReserved || isOccupied ? (
                    <p className="mt-3 text-xs font-medium text-muted-foreground">
                      {translate(isReserved ? 'pos.reserved' : 'pos.waitingSession')}
                    </p>
                  ) : (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <Plus className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{translate('pos.readyToServe')}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <TakeawayHandoffQueue />
      {/* Danh sách đơn mang đi (Takeaway) */}
      {listedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShoppingBag className="h-4 w-4 text-primary" />{' '}
              {canReadTables ? translate('pos.activeTakeaways') : translate('pos.activeSessions')} (
              {listedSessions.length})
            </CardTitle>
            <CardDescription>{translate('pos.unpaidSessions')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listedSessions.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  onClick={() => navigate(`/staff/pos/sessions/${session.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3.5 text-left transition-colors hover:bg-muted/70 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {session.table?.name ?? `Đơn mang đi #${session.id.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session._count.orderItems} món •{' '}
                      {session.employee?.fullName ?? translate('common.staff')}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    {translate('pos.openOrder')}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
