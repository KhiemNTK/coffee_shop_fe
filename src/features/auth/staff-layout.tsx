import { useRef, useState } from 'react'
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  ChefHat,
  Coffee,
  Coins,
  Cpu,
  LogOut,
  LayoutGrid,
  Printer,
  Receipt,
  ScrollText,
  ShoppingBag,
  Ticket,
  UserRound,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useSession, type Session } from './session'
import { GoogleAccount } from './google-account'
import { authCommand, ApiError, errorMessage } from '../../shared/api/client'
import { announceSessionChange, clearIdentity } from '../../app/query-client'
import { clearPrivatePendingOperations } from '../../shared/api/idempotency'
import { Card, CardHeader, CardTitle, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Badge } from '../../shared/ui/badge'
import { cn } from '../../shared/ui/utils'

export function PermissionGate({
  permission,
  anyOf,
}: {
  permission?: string
  anyOf?: string[]
}) {
  const session = useOutletContext<Session>()
  const hasPermission = permission
    ? session.authorization.permissionKeys.includes(permission)
    : anyOf
      ? anyOf.some((key) => session.authorization.permissionKeys.includes(key))
      : true

  return hasPermission ? (
    <Outlet context={session} />
  ) : (
    <div
      className="mx-auto my-12 max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
      role="alert"
    >
      <h2 className="text-lg font-bold text-destructive">Không có quyền truy cập</h2>
      <Link to="/staff" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
        Về tài khoản
      </Link>
    </div>
  )
}

export function StaffLayout() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [logoutError, setLogoutError] = useState<unknown>()
  const session = useSession(!leaving)
  const submitting = useRef(false)

  async function logout() {
    if (submitting.current) return
    submitting.current = true
    setLeaving(true)
    setLogoutError(undefined)
    try {
      await authCommand('/auth/logout', {})
      clearPrivatePendingOperations()
      clearIdentity()
      announceSessionChange()
      navigate('/sign-in', { replace: true })
    } catch (error) {
      setLogoutError(error)
    } finally {
      submitting.current = false
    }
  }

  if (leaving) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Đăng xuất</h1>
        {logoutError ? (
          <div className="mt-4 space-y-3">
            <p role="alert" className="text-sm text-destructive">
              Chưa xác nhận được đăng xuất. {errorMessage(logoutError)}
            </p>
            <Button onClick={() => void logout()}>Thử lại đăng xuất</Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground animate-pulse" role="status">
            Đang kết thúc phiên…
          </p>
        )}
      </main>
    )
  }

  if (session.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-muted-foreground" role="status">
        <p className="animate-pulse">Đang kiểm tra phiên…</p>
      </main>
    )
  }

  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401)
      return <Navigate to="/sign-in" replace />
    return (
      <main className="mx-auto my-12 max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <h1 className="text-lg font-bold text-destructive">Chưa mở được phiên làm việc</h1>
        <p className="mt-2 text-sm text-destructive" role="alert">{errorMessage(session.error)}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            onClick={() => void session.refetch()}
            disabled={session.isFetching}
          >
            Thử lại
          </Button>
          <Link to="/sign-in" className={buttonVariants({ variant: 'outline' })}>
            Về đăng nhập
          </Link>
        </div>
      </main>
    )
  }

  const permissions = session.data.authorization.permissionKeys

  const navItems = [
    { to: '/staff/reconciliation', end: false, label: 'Đối soát & Khiếu nại', icon: Receipt,
      visible: permissions.some(key => ['/payment-reconciliation_read', '/bank-reconciliation_read', '/reports_read'].includes(key)) },
    { to: '/staff', end: true, label: 'Tài khoản', icon: UserRound, visible: true },
    {
      to: '/staff/reservations',
      end: false,
      label: 'Đặt bàn',
      icon: CalendarDays,
      visible: permissions.includes('/reservations_read'),
    },
    {
      to: '/staff/pos',
      end: false,
      label: 'Bán hàng (POS)',
      icon: UtensilsCrossed,
      visible: permissions.some((k) => ['/dining-tables_read', '/orders_sessions_read'].includes(k)),
    },
    {
      to: '/staff/tables',
      end: false,
      label: 'Sơ đồ bàn',
      icon: LayoutGrid,
      visible: permissions.includes('/dining-tables_read'),
    },
    {
      to: '/staff/kitchen',
      end: false,
      label: 'Bếp & Pha chế',
      icon: ChefHat,
      visible: permissions.some((k) => ['/kitchen-tickets_read', '/kitchen-stations_read'].includes(k)),
    },
    {
      to: '/staff/online-orders',
      end: false,
      label: 'Đơn mang đi',
      icon: ShoppingBag,
      visible: permissions.includes('/online-orders_read'),
    },
    {
      to: '/staff/shifts',
      end: false,
      label: 'Ca & Quỹ tiền mặt',
      icon: Coins,
      visible: permissions.some((k) =>
        [
          '/cashier-shifts_current',
          '/cashier-shifts_read',
          '/cashier-shifts_open',
          '/cash-handovers_read',
          '/cash-handovers_create',
          '/funds_read',
        ].includes(k),
      ),
    },
    {
      to: '/staff/invoices',
      end: false,
      label: 'Hóa đơn & TT',
      icon: Receipt,
      visible: permissions.includes('/invoices_read'),
    },
    {
      to: '/staff/inventory',
      end: false,
      label: 'Kho hàng',
      icon: Boxes,
      visible: permissions.includes('/inventory_read'),
    },
    {
      to: '/staff/menu',
      end: false,
      label: 'Thực đơn',
      icon: BookOpen,
      visible: permissions.includes('/menu_read'),
    },
    {
      to: '/staff/promotions',
      end: false,
      label: 'Khuyến mãi',
      icon: Ticket,
      visible: permissions.includes('/promotions_read'),
    },
    {
      to: '/staff/reports',
      end: false,
      label: 'Báo cáo',
      icon: BarChart3,
      visible: permissions.includes('/reports_read'),
    },
    {
      to: '/staff/employees',
      end: false,
      label: 'Nhân sự',
      icon: Users,
      visible: permissions.some((k) =>
        ['/employees_read', '/positions_read', '/roles_read'].includes(k),
      ),
    },
    {
      to: '/staff/settings',
      end: false,
      label: 'Cài đặt & Thiết bị',
      icon: Cpu,
      visible: permissions.some((k) =>
        ['/equipment_read', '/system-settings_read', '/management-exceptions_read'].includes(k),
      ),
    },
    {
      to: '/staff/audit-logs',
      end: false,
      label: 'Nhật ký kiểm toán',
      icon: ScrollText,
      visible: permissions.includes('/audit-logs_read'),
    },
    {
      to: '/staff/printing',
      end: false,
      label: 'Máy in & Lệnh in',
      icon: Printer,
      visible: permissions.some((k) =>
        ['/print-devices_read', '/print-jobs_read', '/receipts_reprint'].includes(k),
      ),
    },
  ].filter((item) => item.visible)

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-xs md:sticky md:top-0 md:z-40">
        <Link to="/" className="flex items-center gap-2 text-base font-bold text-primary">
          <Coffee className="h-5 w-5" />
          Coffee Shop
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          className="flex items-center gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </header>

      {/* Thanh điều hướng ngang cho mobile */}
      <nav className="flex md:hidden overflow-x-auto border-b border-border bg-card px-3 py-2 gap-1.5" aria-label="Nhân viên di động">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mx-auto flex max-w-7xl">
        <aside className="w-60 shrink-0 border-r border-border bg-card p-4 hidden md:block min-h-[calc(100vh-3.5rem)]">
          <nav className="space-y-1" aria-label="Nhân viên">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet context={session.data} />
        </main>
      </div>
    </div>
  )
}

export function StaffHome() {
  const { employee, authorization } = useOutletContext<Session>()
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">TÀI KHOẢN</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{employee.fullName}</h1>
      </div>
      <GoogleAccount linked={employee.googleLinked} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-foreground">Thông tin nhân sự</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3.5">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{employee.email}</dd>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3.5">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chức danh</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{employee.position?.name ?? 'Chưa có'}</dd>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3.5">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vai trò</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{authorization.roleNames.join(', ') || 'Chưa được gán'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-bold text-foreground">
            Quyền hạn được cấp ({authorization.permissionKeys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {authorization.permissionKeys.length ? (
            <div className="flex flex-wrap gap-2">
              {authorization.permissionKeys.map((key) => (
                <Badge key={key} variant="secondary" className="font-mono text-xs">
                  {key}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Chưa được cấp quyền nghiệp vụ.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
