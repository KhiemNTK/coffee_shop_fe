import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { Coffee, ExternalLink, LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { useSession, type Session } from './session'
import { visibleStaffDestinations } from './staff-navigation'
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

  const navItems = [
    { to: '/staff', end: true, label: translate('nav.workdesk'), icon: LayoutDashboard },
    ...visibleStaffDestinations(permissions).map((item) => ({
      to: '/staff/' + item.path,
      end: false,
      label: translate(`nav.${item.path}`),
      icon: item.icon,
    })),
    { to: '/staff/account', end: true, label: translate('nav.account'), icon: UserRound },
  ]

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-xs md:sticky md:top-0 md:z-40">
        <div className="flex items-center gap-3">
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
            className="flex items-center gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {translate('auth.signOut')}
          </Button>
        </div>
      </header>

      {/* Thanh điều hướng ngang cho mobile */}
      <nav
        className="flex md:hidden overflow-x-auto border-b border-border bg-card px-3 py-2 gap-1.5"
        aria-label={translate('auth.mobileNavigation')}
      >
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
          <nav className="space-y-1" aria-label={translate('common.staff')}>
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
