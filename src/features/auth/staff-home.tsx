import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Coins,
  RefreshCw,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import type { Session } from './session'
import { visibleStaffDestinations } from './staff-navigation'
import { getCurrentShift } from '../cashier-shifts/cashier-shifts.api'
import { getKitchenWorkload, kitchenKeys } from '../kitchen/kitchen.api'
import { getPendingOnlineOrders, onlineOrderKeys } from '../online-orders/online-orders.api'
import { operationsApi } from '../operations/operations.api'
import { errorMessage } from '@/shared/api/client'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import { Badge, Button, Card, CardContent } from '@/shared/ui'
import { cn } from '@/shared/ui/utils'

type ReadState = Pick<
  UseQueryResult,
  'isPending' | 'isError' | 'error' | 'isFetching' | 'dataUpdatedAt' | 'refetch'
>

function WorkSection({
  title,
  query,
  children,
  className,
}: {
  title: string
  query: ReadState
  children: ReactNode
  className?: string
}) {
  const { t: translate } = useTranslation()
  return (
    <section
      aria-label={title}
      className={cn(
        'rounded-[16px] border border-border/80 bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-all hover:border-primary/30',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground truncate">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          title={`${translate('common.refresh')} ${title}`}
          aria-label={`${translate('common.refresh')} ${title}`}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')} aria-hidden="true" />
        </Button>
      </header>

      <div className="flex-1">
        {query.isError ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {errorMessage(query.error)}
          </p>
        ) : query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground animate-pulse py-2">
            {translate('common.loadingPlain')} {title.toLowerCase()}...
          </p>
        ) : (
          children
        )}
      </div>

      {!query.isPending && !query.isError && (
        <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{translate('common.update')}</span>
          <span className="tabular-nums font-mono">
            {formatStoreDateTime(new Date(query.dataUpdatedAt).toISOString())}
          </span>
        </div>
      )}
    </section>
  )
}

export default function StaffHome() {
  const { t: translate } = useTranslation()
  const { employee, authorization, access } = useOutletContext<Session>()
  const can = access.has
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

  const isRefreshingAll =
    shift.isFetching || kitchen.isFetching || pending.isFetching || exceptions.isFetching

  function handleRefreshAll() {
    if (can('/cashier-shifts_current')) void shift.refetch()
    if (can('/kitchen-tickets_read')) void kitchen.refetch()
    if (can('/online-orders_read')) void pending.refetch()
    if (can('/management-exceptions_read')) void exceptions.refetch()
  }

  // Derive operational metrics
  const activeKitchenTickets =
    kitchen.data?.stations.reduce((sum, s) => sum + s.openTicketCount, 0) ?? 0
  const overdueKitchenTickets =
    kitchen.data?.stations.reduce((sum, s) => sum + s.overdueTicketCount, 0) ?? 0
  const totalExceptions = exceptions.data?.total ?? 0
  const isShiftClosed = !shift.data && !shift.isPending && !shift.isError

  // Attention strip signals
  const hasUrgentIssues =
    overdueKitchenTickets > 0 || totalExceptions > 0 || (can('/cashier-shifts_current') && isShiftClosed)

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Page Header (SaaS Standard) */}
      <header className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-lg shadow-sm">
            {employee.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight break-words">
                {employee.fullName}
              </h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary font-bold text-xs">
                {employee.position?.name ?? translate('common.staff')}
              </Badge>
              {authorization.roleNames.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border/60"
                >
                  {role}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Bàn làm việc · Tổng quan vận hành theo thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshingAll}
            className="gap-1.5 h-9 text-xs font-semibold rounded-xl cursor-pointer"
            title="Làm mới toàn bộ chỉ số vận hành"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshingAll && 'animate-spin')} />
            <span>Làm mới</span>
          </Button>

          <Link
            to="/staff/account"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors h-9"
          >
            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{translate('auth.myAccount')}</span>
          </Link>
        </div>
      </header>

      {/* 2. Critical Attention Strip (Rendered ONLY if genuine actionable signals exist) */}
      {hasUrgentIssues && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-amber-400/60 bg-amber-50/70 p-4 dark:border-amber-700/60 dark:bg-amber-950/30 text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-2xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Cần chú ý vận hành
              </p>
              <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5">
                {overdueKitchenTickets > 0 && (
                  <span>{overdueKitchenTickets} phiếu bếp quá hạn</span>
                )}
                {overdueKitchenTickets > 0 && totalExceptions > 0 && <span> · </span>}
                {totalExceptions > 0 && (
                  <span>{totalExceptions} việc cần xử lý ở trung tâm vận hành</span>
                )}
                {isShiftClosed && can('/cashier-shifts_current') && (
                  <span>
                    {(overdueKitchenTickets > 0 || totalExceptions > 0) && ' · '}
                    Ca thu ngân chưa mở
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {overdueKitchenTickets > 0 && can('/kitchen-tickets_read') && (
              <Link
                to="/staff/kitchen"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 bg-amber-100 dark:bg-amber-900/60 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span>Xử lý bếp</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {totalExceptions > 0 && can('/management-exceptions_read') && (
              <Link
                to="/staff/operations"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 bg-amber-100 dark:bg-amber-900/60 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span>Mở trung tâm vận hành</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3. 4-Column KPI Grid (First Viewport Operational Signals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ca thu ngân */}
        {can('/cashier-shifts_current') ? (
          <WorkSection title={translate('auth.myShift')} query={shift}>
            {shift.data ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{translate('auth.shiftOpen')}</span>
                  </span>
                  <Coins className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{translate('auth.fund')}</p>
                  <p className="text-base font-bold text-foreground truncate" title={shift.data.fund?.name}>
                    {shift.data.fund?.name ?? translate('common.unavailable')}
                  </p>
                </div>
                <Link
                  to="/staff/shifts"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
                >
                  <span>{translate('auth.openShiftWork')}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Chưa mở ca</span>
                  </span>
                  <Coins className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {translate('auth.noOpenShift')}
                </p>
                <Link
                  to="/staff/shifts"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
                >
                  <span>{translate('auth.openShiftWork')}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </WorkSection>
        ) : (
          <Card className="rounded-[16px] border border-border/80 bg-card p-5 opacity-70">
            <CardContent className="p-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ca thu ngân
              </span>
              <p className="text-xs text-muted-foreground mt-3">Không có quyền truy cập ca.</p>
            </CardContent>
          </Card>
        )}

        {/* KPI 2: Đơn mang đi */}
        {can('/online-orders_read') ? (
          <WorkSection title={translate('auth.pendingTakeaway')} query={pending}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-foreground tabular-nums">
                  {pending.data?.totalItems ?? 0}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium">Đơn đang chờ tiếp nhận</p>
              <Link
                to="/staff/online-orders?tab=pending"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
              >
                <span>{translate('auth.acceptOrders')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </WorkSection>
        ) : (
          <Card className="rounded-[16px] border border-border/80 bg-card p-5 opacity-70">
            <CardContent className="p-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Đơn mang đi
              </span>
              <p className="text-xs text-muted-foreground mt-3">Không có quyền xem đơn online.</p>
            </CardContent>
          </Card>
        )}

        {/* KPI 3: Bếp & Pha chế */}
        {can('/kitchen-tickets_read') ? (
          <WorkSection title={translate('auth.kitchenLoad')} query={kitchen}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-foreground tabular-nums">
                  {activeKitchenTickets}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ChefHat className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Phiếu đang chế biến</span>
                {overdueKitchenTickets > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                    {overdueKitchenTickets} trễ
                  </span>
                )}
              </div>
              <Link
                to="/staff/kitchen"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
              >
                <span>Mở màn hình KDS</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </WorkSection>
        ) : (
          <Card className="rounded-[16px] border border-border/80 bg-card p-5 opacity-70">
            <CardContent className="p-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bếp & Pha chế
              </span>
              <p className="text-xs text-muted-foreground mt-3">Không có quyền xem bếp.</p>
            </CardContent>
          </Card>
        )}

        {/* KPI 4: Việc cần quản lý xử lý */}
        {can('/management-exceptions_read') ? (
          <WorkSection title={translate('auth.managerTasks')} query={exceptions}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-foreground tabular-nums">
                  {exceptions.data?.total ?? 0}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium">Sự cố & Ngoại lệ cần duyệt</p>
              <Link
                to="/staff/operations"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
              >
                <span>{translate('auth.openOperations')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </WorkSection>
        ) : (
          <Card className="rounded-[16px] border border-border/80 bg-card p-5 opacity-70">
            <CardContent className="p-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Việc quản lý
              </span>
              <p className="text-xs text-muted-foreground mt-3">Không có quyền xem quản lý.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4. 2-Column Operational Panels (7/5 Split on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Việc cần xử lý / Priority Action Queue */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-foreground">Hàng đợi việc cần xử lý</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tập hợp các sự cố và nhiệm vụ vận hành cần giải quyết ngay
                </p>
              </div>
              {can('/management-exceptions_read') && (
                <Link
                  to="/staff/operations"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>Xem tất cả</span>
                  <span>&rarr;</span>
                </Link>
              )}
            </div>

            <div className="space-y-2.5">
              {/* Overdue kitchen tickets banner item */}
              {overdueKitchenTickets > 0 && can('/kitchen-tickets_read') && (
                <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[11px] font-bold text-destructive shrink-0">
                      Quá hạn
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {overdueKitchenTickets} phiếu chế biến trễ thời gian cam kết
                      </p>
                      <p className="text-[11px] text-muted-foreground">Ưu tiên hoàn tất cho khách tại quầy & giao đi</p>
                    </div>
                  </div>
                  <Link
                    to="/staff/kitchen"
                    className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-white hover:bg-destructive/90 transition-colors ml-2"
                  >
                    Xem KDS
                  </Link>
                </div>
              )}

              {/* Unopened cashier shift item */}
              {isShiftClosed && can('/cashier-shifts_current') && (
                <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50/50 p-3.5 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900 shrink-0">
                      Chờ mở ca
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                        Chưa có ca thu ngân nào đang mở
                      </p>
                      <p className="text-[11px] text-muted-foreground">Khai báo tiền mặt ban đầu để bắt đầu bán hàng POS</p>
                    </div>
                  </div>
                  <Link
                    to="/staff/shifts"
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors ml-2"
                  >
                    Mở ca
                  </Link>
                </div>
              )}

              {/* Pending online orders item */}
              {(pending.data?.totalItems ?? 0) > 0 && can('/online-orders_read') && (
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3.5 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary shrink-0">
                      Đơn online
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {pending.data?.totalItems} đơn hàng mang đi cần duyệt
                      </p>
                      <p className="text-[11px] text-muted-foreground">Kiểm tra nguyên liệu và xác nhận thời gian nhận món</p>
                    </div>
                  </div>
                  <Link
                    to="/staff/online-orders?tab=pending"
                    className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors ml-2"
                  >
                    Tiếp nhận
                  </Link>
                </div>
              )}

              {/* Zero incidents empty state */}
              {!overdueKitchenTickets && !totalExceptions && !isShiftClosed && (pending.data?.totalItems ?? 0) === 0 && (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/80">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
                  <p className="text-sm font-bold text-foreground">Mọi vận hành đang trơn tru</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Không có phiếu trễ hoặc ngoại lệ nào cần xử lý lúc này.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Vận hành chi tiết theo trạm & ca */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-border/60 pb-3">
              <h3 className="text-base font-extrabold text-foreground">Tải lượng bếp theo trạm</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Số lượng phiếu đang chuẩn bị tại từng vị trí pha chế
              </p>
            </div>

            {can('/kitchen-tickets_read') ? (
              kitchen.data?.stations && kitchen.data.stations.length > 0 ? (
                <ul className="divide-y divide-border/60 text-xs sm:text-sm">
                  {kitchen.data.stations.map((station) => (
                    <li key={station.stationId}>
                      <Link
                        to={'/staff/kitchen?stationId=' + station.stationId}
                        className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-xl hover:bg-muted/60 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChefHat className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {station.stationName}
                          </span>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums text-foreground">
                          {station.openTicketCount} phiếu · {station.overdueTicketCount} trễ
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Không có trạm pha chế nào đang hoạt động.
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                Không có quyền xem chi tiết tải lượng bếp.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Quick Actions / Shortcuts (Compact & Accessible) */}
      <section aria-labelledby="staff-workdesk" className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h2 id="staff-workdesk" className="text-base font-extrabold text-foreground">
              {translate('nav.workdesk')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lối tắt điều hướng nhanh tới các phân hệ nghiệp vụ theo quyền được cấp
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {destinations.length} phân hệ khả dụng
          </span>
        </div>

        {destinations.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {destinations.map((destination) => (
              <Link
                key={destination.path}
                to={'/staff/' + destination.path}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/50 hover:bg-primary/5 text-center transition-all group cursor-pointer shadow-2xs"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform mb-2">
                  <destination.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 break-words">
                  {translate(`nav.${destination.path}`)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {translate('auth.noPermissions')}
          </p>
        )}
      </section>
    </div>
  )
}
