import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, RefreshCw } from 'lucide-react'
import type { Session } from './session'
import { visibleStaffDestinations } from './staff-navigation'
import { getCurrentShift } from '../cashier-shifts/cashier-shifts.api'
import { getKitchenWorkload, kitchenKeys } from '../kitchen/kitchen.api'
import { getPendingOnlineOrders, onlineOrderKeys } from '../online-orders/online-orders.api'
import { operationsApi } from '../operations/operations.api'
import { errorMessage } from '@/shared/api/client'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import { Button } from '@/shared/ui'

type ReadState = Pick<
  UseQueryResult,
  'isPending' | 'isError' | 'error' | 'isFetching' | 'dataUpdatedAt' | 'refetch'
>

function WorkSection({
  title,
  query,
  children,
}: {
  title: string
  query: ReadState
  children: ReactNode
}) {
  const { t: translate } = useTranslation()
  return (
    <section aria-label={title} className="space-y-3 border-t pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          title={`${translate('common.refresh')} ${title}`}
          aria-label={`${translate('common.refresh')} ${title}`}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(query.error)}
        </p>
      ) : query.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          {translate('common.loadingPlain')} {title.toLowerCase()}...
        </p>
      ) : (
        children
      )}
      {!query.isPending && !query.isError && (
        <p className="text-xs text-muted-foreground">
          {translate('common.update')}{' '}
          {formatStoreDateTime(new Date(query.dataUpdatedAt).toISOString())}
        </p>
      )}
    </section>
  )
}

export default function StaffHome() {
  const { t: translate } = useTranslation()
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const destinations = visibleStaffDestinations(authorization.permissionKeys)
  const shift = useQuery({
    queryKey: ['private', employee.id, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal),
    enabled: can('/cashier-shifts_current'),
    refetchInterval: 30_000,
  })
  const kitchen = useQuery({
    queryKey: kitchenKeys.workload(employee.id),
    queryFn: ({ signal }) => getKitchenWorkload(signal),
    enabled: can('/kitchen-tickets_read'),
    refetchInterval: 30_000,
  })
  const pending = useQuery({
    queryKey: [...onlineOrderKeys.all(employee.id), 'pending-summary'],
    queryFn: ({ signal }) => getPendingOnlineOrders({ page: 1, itemPerPage: 1 }, signal),
    enabled: can('/online-orders_read'),
    refetchInterval: 30_000,
  })
  const exceptions = useQuery({
    queryKey: ['management-exceptions-summary', employee.id],
    queryFn: ({ signal }) => operationsApi.getManagementExceptionsSummary(signal),
    enabled: can('/management-exceptions_read'),
    refetchInterval: 30_000,
  })
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold break-words">{employee.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee.position?.name ?? translate('common.staff')}
          </p>
        </div>
        <Link className="text-sm underline underline-offset-4" to="/staff/account">
          {translate('auth.myAccount')}
        </Link>
      </header>
      <section aria-labelledby="staff-workdesk" className="space-y-3">
        <h2 id="staff-workdesk" className="text-base font-semibold">
          {translate('nav.workdesk')}
        </h2>
        {destinations.length ? (
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <Link
                key={destination.path}
                to={'/staff/' + destination.path}
                className="flex min-h-12 min-w-0 items-center gap-3 border-b py-3 text-sm font-medium hover:text-primary"
              >
                <destination.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{translate(`nav.${destination.path}`)}</span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{translate('auth.noPermissions')}</p>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        {can('/cashier-shifts_current') && (
          <WorkSection title={translate('auth.myShift')} query={shift}>
            {shift.data ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{translate('common.status')}</dt>
                  <dd className="font-semibold">{translate('auth.shiftOpen')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{translate('auth.fund')}</dt>
                  <dd className="break-words">
                    {shift.data.fund?.name ?? translate('common.unavailable')}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{translate('auth.openedAt')}</dt>
                  <dd>{formatStoreDateTime(shift.data.openedAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm">{translate('auth.noOpenShift')}</p>
            )}
            <Link className="inline-flex items-center gap-2 text-sm underline" to="/staff/shifts">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {translate('auth.openShiftWork')}
            </Link>
          </WorkSection>
        )}
        {can('/online-orders_read') && (
          <WorkSection title={translate('auth.pendingTakeaway')} query={pending}>
            <p className="text-2xl font-semibold tabular-nums">{pending.data?.totalItems}</p>
            <Link
              className="inline-flex items-center gap-2 text-sm underline"
              to="/staff/online-orders?tab=pending"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {translate('auth.acceptOrders')}
            </Link>
          </WorkSection>
        )}
        {can('/kitchen-tickets_read') && (
          <WorkSection title={translate('auth.kitchenLoad')} query={kitchen}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{translate('auth.activeTickets')}</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {kitchen.data?.stations.reduce(
                    (total, station) => total + station.openTicketCount,
                    0,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{translate('auth.overdueTickets')}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-destructive">
                  {kitchen.data?.stations.reduce(
                    (total, station) => total + station.overdueTicketCount,
                    0,
                  )}
                </dd>
              </div>
            </dl>
            <ul className="divide-y text-sm">
              {kitchen.data?.stations
                .filter((station) => station.openTicketCount > 0)
                .map((station) => (
                  <li key={station.stationId}>
                    <Link
                      to={'/staff/kitchen?stationId=' + station.stationId}
                      className="flex items-center justify-between gap-3 py-2 hover:text-primary"
                    >
                      <span className="min-w-0 break-words">{station.stationName}</span>
                      <span className="shrink-0">
                        {station.openTicketCount} phiếu · {station.overdueTicketCount} trễ
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </WorkSection>
        )}
        {can('/management-exceptions_read') && (
          <WorkSection title={translate('auth.managerTasks')} query={exceptions}>
            <p className="text-2xl font-semibold tabular-nums">{exceptions.data?.total}</p>
            <Link
              className="inline-flex items-center gap-2 text-sm underline"
              to="/staff/operations"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {translate('auth.openOperations')}
            </Link>
          </WorkSection>
        )}
      </div>
    </div>
  )
}
