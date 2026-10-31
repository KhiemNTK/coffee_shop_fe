import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Coffee, Eye, EyeOff, LockKeyhole, LogIn, Mail } from 'lucide-react'
import { authCommand } from '../../shared/api/client'
import { ApiErrorAlert } from '../../shared/ui/api-error-alert'
import { useRetryAfter } from '../../shared/api/use-retry-after'
import { announceSessionChange, clearIdentity } from '@/shared/api/query-client'
import { Turnstile } from './turnstile'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Input } from '../../shared/ui/input'
import { cn } from '../../shared/ui/utils'
import { authConfig } from './auth.config'
import { GoogleButton } from './google-button'
import { SignInScene } from './sign-in-scene'
import { ThemeToggle } from '../../shared/theme'
import { takeStaffDestination } from '../../shared/auth/staff-destination'

const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

export default function SignInPage() {
  const { t: translate } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const intent = location.state as { returnTo?: unknown; googleUnlinkUncertain?: unknown } | null
  const unlinkUncertain = intent?.googleUnlinkUncertain === true
  const [pending, setPending] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<unknown>()
  const retryWait = useRetryAfter(error)
  const [token, setToken] = useState('')
  const [attempt, setAttempt] = useState(0)
  const submitting = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const errorRef = useRef<HTMLDivElement>(null)
  const configMissing = import.meta.env.PROD && !siteKey

  async function signInWithGoogle(idToken: string) {
    if (retryWait || submitting.current || configMissing) return
    if (siteKey && !token) {
      setError(new Error(translate('auth.waitGoogleVerification')))
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    submitting.current = true
    setPending(true)
    setError(undefined)
    try {
      await authCommand('/auth/google', { idToken, ...(token ? { turnstileToken: token } : {}) })
      clearIdentity()
      announceSessionChange()
      if (mounted.current) navigate(takeStaffDestination(intent?.returnTo), { replace: true })
    } catch (failure) {
      if (mounted.current) {
        setError(failure)
        requestAnimationFrame(() => errorRef.current?.focus())
      }
    } finally {
      submitting.current = false
      if (mounted.current) {
        setPending(false)
        setToken('')
        setAttempt((value) => value + 1)
      }
    }
  }

  return (
    <SignInScene
      header={
        <header className="border-b border-border bg-card/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            <Link to="/" className="flex items-center gap-2 text-base font-bold text-foreground">
              <Coffee className="h-6 w-6" aria-hidden="true" />
              Coffee Homes
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/menu"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer'
                )}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {translate('nav.menu')}
              </Link>
            </div>
          </div>
        </header>
      }
    >
      <section aria-labelledby="staff-sign-in-title">
        <div className="mb-6 space-y-2">
          <div className="mb-4 flex items-center gap-3">
            <span className="sign-in-form__icon">
              <LockKeyhole size={21} aria-hidden="true" />
            </span>
            <p className="text-xs font-semibold text-muted-foreground">
              {translate('auth.staffHeading')}
            </p>
          </div>
          <h1 id="staff-sign-in-title" className="text-2xl font-bold text-foreground">
            {translate('auth.staffSignIn')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {translate('auth.description')}
          </p>
        </div>
        {unlinkUncertain && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {translate('auth.unlinkUncertain')}
          </p>
        )}
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (retryWait || submitting.current || configMissing) return
            if (siteKey && !token) {
              setError(new Error(translate('auth.waitVerification')))
              requestAnimationFrame(() => errorRef.current?.focus())
              return
            }
            const form = event.currentTarget
            const values = new FormData(form)
            submitting.current = true
            setPending(true)
            setError(undefined)
            try {
              await authCommand('/auth/sign-in', {
                email: String(values.get('email')).trim(),
                password: String(values.get('password')),
                ...(token ? { turnstileToken: token } : {}),
              })
              form.reset()
              clearIdentity()
              announceSessionChange()
              if (mounted.current) navigate(takeStaffDestination(intent?.returnTo), { replace: true })
            } catch (failure) {
              if (!mounted.current) return
              setError(failure)
              const password = form.elements.namedItem('password') as HTMLInputElement
              if (password) password.value = ''
              requestAnimationFrame(() => errorRef.current?.focus())
            } finally {
              submitting.current = false
              if (mounted.current) {
                setPending(false)
                setToken('')
                setAttempt((value) => value + 1)
              }
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-foreground">
              Email
            </label>
            <div className="relative">
              <Mail
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground"
              />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                disabled={pending}
                className="sign-in-form__input pl-11"
                placeholder={translate('auth.emailPlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-semibold text-foreground">
              {translate('auth.password')}
            </label>
            <div className="relative">
              <LockKeyhole
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground"
              />
              <Input
                id="password"
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={256}
                required
                disabled={pending}
                className="sign-in-form__input pl-11 pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                aria-label={
                  visible ? translate('auth.hidePassword') : translate('auth.showPassword')
                }
                title={visible ? translate('auth.hidePassword') : translate('auth.showPassword')}
                onClick={() => setVisible((value) => !value)}
                aria-pressed={visible}
                disabled={pending}
                className="absolute right-0.5 top-0.5 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {siteKey && <Turnstile key={attempt} siteKey={siteKey} onToken={setToken} />}

          {configMissing && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {translate('auth.unavailable')}
            </p>
          )}

          {error !== undefined && (
            <div ref={errorRef} tabIndex={-1}>
              <ApiErrorAlert error={error} />
            </div>
          )}

          <Button
            type="submit"
            className="sign-in-form__submit w-full gap-2 font-semibold"
            isLoading={pending}
            disabled={retryWait > 0 || pending || configMissing || Boolean(siteKey && !token)}
          >
            {!pending && <LogIn className="h-4 w-4" aria-hidden="true" />}
            {pending ? translate('auth.signingIn') : translate('auth.signIn')}
          </Button>

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {translate('auth.forgotPasswordLink')}
            </Link>
          </div>
          {authConfig.googleClientId &&
            !retryWait &&
            !pending &&
            !configMissing &&
            (!siteKey || token) && (
              <GoogleButton
                clientId={authConfig.googleClientId}
                onCredential={(credential) => void signInWithGoogle(credential)}
              />
            )}
          {authConfig.signupEnabled && (
            <div className="pt-2 text-center text-xs text-muted-foreground">
              {translate('auth.noAccount')}{' '}
              <Link to="/sign-up" className="font-semibold text-primary hover:underline">
                {translate('auth.registerNew')}
              </Link>
            </div>
          )}
        </form>
        <div className="mt-6 border-t border-border pt-5 text-center text-sm">
          <Link
            to="/customer/sign-in"
            className="inline-flex min-h-11 items-center justify-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
          >
            {translate('wishlist.customerSignIn')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </SignInScene>
  )
}
