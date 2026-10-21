import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  Coffee,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  UserRound,
  X,
} from 'lucide-react'
import { useSession, type Session } from './session'
import { visibleGroupedStaffDestinations, visibleStaffDestinations } from './staff-navigation'
import { authCommand, ApiError, errorMessage } from '../../shared/api/client'
import { announceSessionChange, clearIdentity } from '../../app/query-client'
import { clearPrivatePendingOperations } from '../../shared/api/idempotency'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { cn } from '../../shared/ui/utils'

export function PermissionGate({
  permission,
  anyOf,
}: {
  permission?: string
  anyOf?: readonly string[]
}) {
  const { t: translate } = useTranslation()
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
      <h2 className="text-lg font-bold text-destructive">{translate('auth.forbidden')}</h2>
      <Link to="/staff" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
        {translate('auth.backToWorkdesk')}
      </Link>
    </div>
  )
}

export function StaffLayout() {
  const { t: translate } = useTranslation()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [logoutError, setLogoutError] = useState<unknown>()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
        <h1 className="text-xl font-bold text-foreground">{translate('auth.signOut')}</h1>
        {logoutError ? (
          <div className="mt-4 space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {translate('auth.logoutUncertain')} {errorMessage(logoutError)}
            </p>
            <Button onClick={() => void logout()}>{translate('auth.retryLogout')}</Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground animate-pulse" role="status">
            {translate('auth.endingSession')}
          </p>
        )}
      </main>
    )
  }

  if (session.isPending) {
    return (
      <main
        className="flex min-h-screen items-center justify-center p-6 text-muted-foreground"
        role="status"
      >
        <p className="animate-pulse">{translate('auth.checkingSession')}</p>
      </main>
    )
  }

  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401)
      return <Navigate to="/sign-in" replace />
    return (
      <main className="mx-auto my-12 max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <h1 className="text-lg font-bold text-destructive">
          {translate('auth.sessionUnavailable')}
        </h1>
        <p className="mt-2 text-sm text-destructive" role="alert">
          {errorMessage(session.error)}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button onClick={() => void session.refetch()} disabled={session.isFetching}>
            {translate('common.retry')}
          </Button>
          <Link to="/sign-in" className={buttonVariants({ variant: 'outline' })}>
            {translate('auth.backToSignIn')}
          </Link>
        </div>
      </main>
    )
  }

  const permissions = session.data.authorization.permissionKeys
  const groupedNav = visibleGroupedStaffDestinations(permissions)
  const flatVisible = visibleStaffDestinations(permissions)

  const workdeskItem = {
    to: '/staff',
    end: true,
    label: translate('nav.workdesk'),
    icon: LayoutDashboard,
  }

  const accountItem = {
    to: '/staff/account',
    end: true,
    label: translate('nav.account'),
    icon: UserRound,
  }

  return (
    <div className="staff-workspace min-h-screen">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-xs sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Mở danh mục điều hướng"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link to="/staff" className="flex items-center gap-2 text-base font-bold text-primary">
            <Coffee className="h-5 w-5" />
            <span>Coffee Homes</span>
          </Link>

          <span className="hidden sm:inline text-xs text-muted-foreground/40">|</span>
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={translate('auth.openCustomerMenu')}
          >
            <ExternalLink className="h-3 w-3" />
            {translate('auth.customerMenu')}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground/80 hover:bg-muted transition-colors">
            <Store className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Chi nhánh trung tâm</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>

          <div className="hidden sm:inline-flex items-center gap-2">
            <div className="relative inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 cursor-pointer" title="Thông báo">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-card" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-xs">
              {session.data.employee.fullName
                ? session.data.employee.fullName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'NV'}
            </div>
          </div>

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-foreground leading-tight">
              {session.data.employee.fullName}
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              {session.data.employee.position?.name || translate('common.staff')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            className="flex items-center gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>{translate('auth.signOut')}</span>
          </Button>
        </div>
      </header>

      {/* Mobile Horizontal Quick-Nav with smooth scrolling and nowrap pills */}
      <nav
        className="flex md:hidden overflow-x-auto whitespace-nowrap scrollbar-none border-b border-border bg-card px-3 py-2 gap-1.5 sticky top-14 z-20 shadow-2xs"
        aria-label={translate('auth.mobileNavigation')}
      >
        <NavLink
          to={workdeskItem.to}
          end={workdeskItem.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <workdeskItem.icon className="h-3.5 w-3.5 shrink-0" />
          <span>{workdeskItem.label}</span>
        </NavLink>
        {flatVisible.map((item) => (
          <NavLink
            key={item.path}
            to={'/staff/' + item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span>{translate(`nav.${item.path}`)}</span>
          </NavLink>
        ))}
        <NavLink
          to={accountItem.to}
          end={accountItem.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <accountItem.icon className="h-3.5 w-3.5 shrink-0" />
          <span>{accountItem.label}</span>
        </NavLink>
      </nav>

      {/* Mobile Slide-out Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-card border-r border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex h-14 items-center justify-between border-b border-border px-4 bg-muted/30">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Coffee className="h-5 w-5" />
                <span>Coffee Homes</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Employee Card in Drawer */}
            <div className="p-3.5 border-b border-border bg-card">
              <p className="text-xs font-bold text-foreground">{session.data.employee.fullName}</p>
              <p className="text-[11px] text-muted-foreground">
                {session.data.employee.position?.name || translate('common.staff')}
              </p>
            </div>

            {/* Nav items in Drawer */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Menu di động">
              {/* Workdesk */}
              <div>
                <NavLink
                  to={workdeskItem.to}
                  end={workdeskItem.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <workdeskItem.icon className="h-4 w-4 shrink-0" />
                  <span>{workdeskItem.label}</span>
                </NavLink>
              </div>

              {/* Grouped sections */}
              {groupedNav.map((group) => (
                <div key={group.key} className="space-y-1">
                  <div className="px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={'/staff/' + item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{translate(`nav.${item.path}`)}</span>
                    </NavLink>
                  ))}
                </div>
              ))}

              {/* Account */}
              <div className="pt-2 border-t border-border">
                <NavLink
                  to={accountItem.to}
                  end={accountItem.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <accountItem.icon className="h-4 w-4 shrink-0" />
                  <span>{accountItem.label}</span>
                </NavLink>
              </div>
            </nav>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-border bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void logout()}
                className="w-full flex items-center justify-center gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>{translate('auth.signOut')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="mx-auto flex max-w-[1920px]">
        {/* Desktop Sidebar (Grouped SaaS structure) */}
        <aside
          className={cn(
            'staff-sidebar hidden shrink-0 self-start overflow-y-auto border-r p-3 md:sticky md:top-14 md:block md:min-h-[calc(100vh-3.5rem)] md:max-h-[calc(100vh-3.5rem)]',
            sidebarCollapsed ? 'w-[68px]' : 'w-[240px]',
          )}
        >
          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mb-3 flex h-11 w-11 items-center justify-center rounded-md text-white hover:bg-white/10"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
          <nav className="space-y-4" aria-label={translate('common.staff')}>
            {/* Primary Workdesk Dashboard */}
            <div>
              <NavLink
                to={workdeskItem.to}
                end={workdeskItem.end}
                title={workdeskItem.label}
                aria-label={workdeskItem.label}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <workdeskItem.icon className="h-4 w-4 shrink-0" />
                <span className={sidebarCollapsed ? 'sr-only' : ''}>{workdeskItem.label}</span>
              </NavLink>
            </div>

            {/* Grouped Operational Sections */}
            {groupedNav.map((group) => (
              <div key={group.key} className="space-y-1">
                <div
                  className={cn(
                    'staff-sidebar-label px-3 pt-1 text-[11px] font-bold uppercase select-none',
                    sidebarCollapsed && 'sr-only',
                  )}
                >
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={'/staff/' + item.path}
                    title={translate(`nav.${item.path}`)}
                    aria-label={translate(`nav.${item.path}`)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={sidebarCollapsed ? 'sr-only' : ''}>
                      {translate(`nav.${item.path}`)}
                    </span>
                  </NavLink>
                ))}
              </div>
            ))}

            {/* System / Account */}
            <div className="pt-2 border-t border-border">
              <NavLink
                to={accountItem.to}
                end={accountItem.end}
                title={accountItem.label}
                aria-label={accountItem.label}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <accountItem.icon className="h-4 w-4 shrink-0" />
                <span className={sidebarCollapsed ? 'sr-only' : ''}>{accountItem.label}</span>
              </NavLink>
            </div>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="min-w-0 max-w-[1680px] flex-1 p-4 md:p-5 lg:p-7">
          <Outlet context={session.data} />
        </main>
      </div>
    </div>
  )
}
